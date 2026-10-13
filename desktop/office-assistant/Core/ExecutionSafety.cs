using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Text;

namespace ChinaTech.OfficeAssistant;

public static class ExecutionSafety {
 private static bool TrustedBoot(string? boot) => long.TryParse(boot, NumberStyles.None, CultureInfo.InvariantCulture, out var ticks) && ticks > 0;
 private static bool UnknownInstallerResult(JobRecord job) => job.InstallerStarted && job.InstallerExitCode == null
  && job.InstallerBoot != null && job.Stage is Stage.Remove or Stage.Install or Stage.Components;

 public static string? RestartCheckpointError(JobRecord? job) {
  if (job == null) return null;
  if (UnknownInstallerResult(job)) return "INSTALLER_RESULT_UNKNOWN";
  if (job.RestartBoot != null && !TrustedBoot(job.RestartBoot)
   || job.RestartVerifiedBoot != null && !TrustedBoot(job.RestartVerifiedBoot)) return "RESTART_CHECKPOINT_MISSING";
  return Policy.RebootExit(job.InstallerExitCode ?? 0) && job.RestartBoot == null && job.RestartVerifiedBoot == null && !TrustedBoot(job.InstallerBoot)
   ? "RESTART_CHECKPOINT_MISSING" : null;
 }

 private static string? PendingRestartBoot(JobRecord job) => job.RestartBoot
  ?? (Policy.RebootExit(job.InstallerExitCode ?? 0) && job.RestartVerifiedBoot == null ? job.InstallerBoot : null);

 public static async Task<bool> VerifyRestartAsync(JobRecord? job, Func<Task<string>> bootId, Func<Task<Inventory>>? inspect = null) {
  if (job != null && UnknownInstallerResult(job)) {
   if (!TrustedBoot(job.InstallerBoot) || inspect == null) throw new OfficeFailure("INSTALLER_RESULT_UNKNOWN");
   var after = await bootId();
   if (!TrustedBoot(after)) throw new OfficeFailure("INSPECTION_FAILED");
   if (after == job.InstallerBoot) throw new OfficeFailure("INSTALLER_RESULT_UNKNOWN");
   var fresh = await inspect();
   if (Policy.Blocker(fresh) is { } busy) throw new OfficeFailure(busy);
   if (job.Schema == 2) {
    OfficeSelection.ValidatePlan(job);
    if (job.Action == ActionKind.Uninstall) {
     OfficeSelection.ValidateRemovalEvolution(fresh, job);
     if (job.CurrentRemovalStep != null) {
      if (!OfficeSelection.RemovalStepComplete(fresh, job, job.CurrentRemovalStep)) throw new OfficeFailure("REMOVAL_UNKNOWN");
      job.CompletedRemovalSteps = job.CompletedRemovalSteps.Concat([job.CurrentRemovalStep]).Distinct().ToArray(); job.CurrentRemovalStep = null;
     }
     job.Removed = OfficeSelection.RemovalComplete(fresh, job);
    } else {
     if (!OfficeSelection.InstallEvolutionAllowed(fresh, job)) throw new OfficeFailure("ENVIRONMENT_CHANGED");
     job.Installed = OfficeSelection.MatchesPlan(fresh, job) && OfficeSelection.ComponentsPresent(fresh, OfficeSelection.Selected(job));
    }
    job.Observation = fresh; job.RestartVerifiedBoot = after; job.InstallerStarted = false; job.Status = JobStatus.Failed; job.Code = "WORKER_INTERRUPTED"; return true;
   }
   if (job.RemovalStarted && !job.Removed && fresh.HasOffice) throw new OfficeFailure("REMOVAL_UNKNOWN");
   if (job.Stage != Stage.Remove && (fresh.MsiProducts.Length != 0 || fresh.OfficeProducts.Except(["ProPlus2024Volume", "SkypeforBusiness2024Volume"], StringComparer.OrdinalIgnoreCase).Any()))
    throw new OfficeFailure("ENVIRONMENT_CHANGED");
   if (job.RemovalStarted && !fresh.HasOffice) job.Removed = true;
   if (job.Stage != Stage.Remove) job.Installed = fresh.MatchesPlan(job) && fresh.AllComponents;
   job.Observation = fresh;
   job.RestartVerifiedBoot = after;
   job.InstallerStarted = false;
   job.Status = JobStatus.Failed; job.Code = "WORKER_INTERRUPTED";
   return true;
  }
  if (RestartCheckpointError(job) is { } error) throw new OfficeFailure(error);
  if (job == null || PendingRestartBoot(job) is not { } before) return false;
  var current = await bootId();
  if (!TrustedBoot(current)) throw new OfficeFailure("INSPECTION_FAILED");
  if (before == current) throw new OfficeFailure("RESTART_REQUIRED");
  job.RestartBoot = null;
  job.RestartVerifiedBoot = current;
  return true;
 }

 public static async Task RecordInstallerStartAsync(JobRecord job, Func<Task<string>> bootId, Func<JobRecord, Task> save) {
  var before = await bootId();
  if (!TrustedBoot(before)) throw new OfficeFailure("INSPECTION_FAILED");
  job.InstallerBoot = before;
  job.InstallerStarted = true;
  job.InstallerExitCode = null;
  job.RestartBoot = null;
  job.RestartVerifiedBoot = null;
  await save(job);
 }

 public static async Task RecordInstallerRestartAsync(JobRecord job, Func<JobRecord, Task> save) {
  if (!TrustedBoot(job.InstallerBoot)) throw new OfficeFailure("RESTART_CHECKPOINT_MISSING");
  if (job.Status == JobStatus.AwaitingRestart && job.RestartBoot == job.InstallerBoot && job.Code == "RESTART_REQUIRED") return;
  job.RestartBoot = job.InstallerBoot;
  job.InstallerStarted = false;
  job.RestartVerifiedBoot = null;
  job.Status = JobStatus.AwaitingRestart;
  job.Code = "RESTART_REQUIRED";
  job.UpdatedAt = DateTimeOffset.UtcNow;
  job.Events.Add(new(job.Stage, job.Code, job.UpdatedAt));
  await save(job);
 }

 public static async Task RecordInstallerExitAsync(JobRecord job, int exit, Func<JobRecord, Task> save) {
  job.InstallerExitCode = exit;
  job.InstallerStarted = false;
  if (Policy.RebootExit(exit)) await RecordInstallerRestartAsync(job, save);
  else await save(job);
 }

 public static async Task CheckInstallerCancellationAsync(JobRecord job, Func<JobRecord, Task> save, CancellationToken cancellation) {
  if (!cancellation.IsCancellationRequested) return;
  job.InstallerStarted = false;
  await save(job);
  cancellation.ThrowIfCancellationRequested();
 }

 public static JobRecord MarkWorkerInterrupted(JobRecord job) {
  if (job.Status != JobStatus.Running) return job;
  if (RestartCheckpointError(job) is { } error) { job.Status = JobStatus.NeedsReview; job.Code = error; return job; }
  if (PendingRestartBoot(job) is { } before) {
   job.Status = JobStatus.AwaitingRestart; job.Code = "RESTART_REQUIRED"; job.RestartBoot = before; return job;
  }
  var uncertainRemoval = job.RemovalStarted && !job.Removed;
  job.Status = uncertainRemoval ? JobStatus.NeedsReview : JobStatus.Failed;
  job.Code = uncertainRemoval ? "REMOVAL_UNKNOWN" : "WORKER_INTERRUPTED";
  return job;
 }

 public static async Task<byte[]> ReadBoundedAsync(Stream input, int maximum, CancellationToken cancellation) {
  using var bounded = new MemoryStream();
  var buffer = new byte[4096]; int count;
  while ((count = await input.ReadAsync(buffer.AsMemory(), cancellation)) != 0) {
   if (bounded.Length + count > maximum) throw new OfficeFailure("SERVER_INVALID");
   bounded.Write(buffer, 0, count);
  }
  return bounded.ToArray();
 }

 // Only caller-owned, read-only probes use this deadline. Installers and OSPP do not.
 public static async Task<(int Exit, string Output)> RunProbeAsync(ProcessStartInfo start, TimeSpan timeout,
  string unavailableCode, CancellationToken cancellation = default) {
  using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
  deadline.CancelAfter(timeout);
  Process process;
  try { process = Process.Start(start) ?? throw new OfficeFailure(unavailableCode); }
  catch (Win32Exception) { throw new OfficeFailure(unavailableCode); }
  using (process) {
   var stdout = Drain(process.StandardOutput, deadline.Token);
   var stderr = Drain(process.StandardError, deadline.Token);
   try {
    await process.WaitForExitAsync(deadline.Token);
    var output = await stdout; await stderr;
    return (process.ExitCode, output);
   } catch (OperationCanceledException) {
    // This is the exact process created above, never an existing installer or WMI service.
    try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } catch (Win32Exception) { }
    try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(2)); } catch (TimeoutException) { }
    try { await Task.WhenAll(stdout, stderr); } catch (OperationCanceledException) { }
    cancellation.ThrowIfCancellationRequested();
    throw new OfficeFailure("PROBE_TIMEOUT");
   }
  }
 }

 private static async Task<string> Drain(StreamReader reader, CancellationToken cancellation) {
  var buffer = new char[4096]; var output = new StringBuilder(); int count;
  while ((count = await reader.ReadAsync(buffer.AsMemory(), cancellation)) != 0)
   if (output.Length < 256000) output.Append(buffer, 0, Math.Min(count, 256000 - output.Length));
  return output.ToString();
 }
}
