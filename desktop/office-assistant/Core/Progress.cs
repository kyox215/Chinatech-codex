namespace ChinaTech.OfficeAssistant;

public enum ProgressUnit { None, Bytes, Items }
/// <summary>One measured operation, never an estimate of the whole Office workflow.</summary>
public sealed record JobProgress(string Code, ProgressUnit Unit, long Completed, long? Total, DateTimeOffset ObservedAt);

/// <summary>Optional: existing platforms and test substitutes need not implement progress.</summary>
public interface IOfficeProgressSource {
 Func<JobProgress, Task>? ProgressObserver { get; set; }
}

public static class ProgressPolicy {
 public const long ToolMaximum = 50L * 1024 * 1024;
 public const long OneDriveMaximum = 250L * 1024 * 1024;
 public static bool IsValid(JobProgress progress) {
  if (!Enum.IsDefined(progress.Unit) || progress.Completed < 0 || progress.Total is <= 0
   || progress.Total is { } total && progress.Completed > total || progress.ObservedAt == default
   || progress.ObservedAt > DateTimeOffset.UtcNow.AddMinutes(1)) return false;
  return progress.Code switch {
   "DOWNLOADING_TOOL" => ValidBytes(progress, ToolMaximum),
   "DOWNLOADING_ONEDRIVE" => ValidBytes(progress, OneDriveMaximum),
   "DOWNLOADING_OFFICE" => progress.Unit == ProgressUnit.None && progress.Completed == 0 && progress.Total == null,
   "VERIFYING_MEDIA" => progress.Unit == ProgressUnit.Items && progress.Total is > 0 and <= 4098,
   _ => false
  };
 }
 private static bool ValidBytes(JobProgress progress, long maximum) => progress.Unit == ProgressUnit.Bytes
  && progress.Completed <= maximum && (progress.Total == null || progress.Total <= maximum);
 public static void Validate(JobProgress progress) { if (!IsValid(progress)) throw new OfficeFailure("JOURNAL_INVALID"); }
 private static bool MatchesStage(JobProgress progress, Stage stage) => progress.Code switch {
  "DOWNLOADING_TOOL" => stage is Stage.Detect or Stage.Download,
  "DOWNLOADING_ONEDRIVE" or "DOWNLOADING_OFFICE" => stage == Stage.Download,
  "VERIFYING_MEDIA" => stage is Stage.Download or Stage.Remove,
  _ => false
 };
 public static JobProgress? Current(JobRecord job) => job.Status == JobStatus.Running && job.Progress is { } progress
  && IsValid(progress) && MatchesStage(progress, job.Stage) && progress.ObservedAt >= job.StartedAt
  && progress.ObservedAt <= job.UpdatedAt ? progress : null;
 public static double? Percentage(JobProgress progress) => IsValid(progress) && progress.Unit != ProgressUnit.None && progress.Total is { } total
  ? 100d * progress.Completed / total : null;
}

/// <summary>The worker awaits each save. Cancellation listeners never mutate this record.</summary>
public sealed class ProgressRecorder(JobRecord job, IJobStore store, TimeProvider? clock = null) {
 private readonly TimeProvider time = clock ?? TimeProvider.System;
 private long lastSaved;
 private bool hasSaved;
 public async Task ObserveAsync(JobProgress progress) {
  ProgressPolicy.Validate(progress);
  if (job.Status != JobStatus.Running) return;
  var current = ProgressPolicy.Current(job);
  if (current is { } p && p.Code == progress.Code && p.Unit == progress.Unit && p.Completed == progress.Completed && p.Total == progress.Total) return;
  var now = time.GetTimestamp();
  var changedOperation = current == null || current.Code != progress.Code || current.Unit != progress.Unit || current.Total != progress.Total
   || progress.Completed < current.Completed;
  var finishedMeasurement = progress.Total is { } total && progress.Completed == total;
  if (hasSaved && !changedOperation && !finishedMeasurement && time.GetElapsedTime(lastSaved, now) < TimeSpan.FromSeconds(1)) return;
  var previous = job.Progress; var updatedAt = job.UpdatedAt;
  job.Progress = progress; job.UpdatedAt = progress.ObservedAt;
  if (ProgressPolicy.Current(job) == null) { job.Progress = previous; job.UpdatedAt = updatedAt; throw new OfficeFailure("JOURNAL_INVALID"); }
  try { await store.SaveAsync(job); }
  catch { job.Progress = previous; job.UpdatedAt = updatedAt; throw new OfficeFailure("JOB_RECORDING_FAILED"); }
  lastSaved = now; hasSaved = true;
 }
}

/// <summary>Measures bytes actually written; an advertised length must match EOF.</summary>
public static class MeasuredCopy {
 public static async Task<long> CopyAsync(Stream input, Stream output, string code, long? expectedLength, long maximum,
  Func<JobProgress, Task>? observer, CancellationToken cancellation) {
  if (maximum <= 0 || expectedLength is <= 0 || expectedLength > maximum) throw new OfficeFailure("DOWNLOAD_FAILED");
  async Task Report(long count) {
   if (observer != null) await observer(new(code, ProgressUnit.Bytes, count, expectedLength, DateTimeOffset.UtcNow));
  }
  await Report(0);
  var bytes = new byte[65536]; long received = 0; int count;
  while ((count = await input.ReadAsync(bytes, cancellation)) != 0) {
   if (count > maximum - received || expectedLength is { } total && count > total - received) throw new OfficeFailure("DOWNLOAD_FAILED");
   await output.WriteAsync(bytes.AsMemory(0, count), cancellation);
   received += count;
   // A claimed 100% is not emitted until EOF proves there are no extra or missing bytes.
   if (expectedLength != received) await Report(received);
  }
  if (received < 100000 || expectedLength is { } length && received != length) throw new OfficeFailure("DOWNLOAD_FAILED");
  await Report(received);
  return received;
 }
}
