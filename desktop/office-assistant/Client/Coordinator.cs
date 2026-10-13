using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace ChinaTech.OfficeAssistant;
public static partial class Coordinator {
 public static JobRecord? Latest() {
  try {
   var latest = Journal.Latest();
   if (latest?.Status == JobStatus.Running && !IsWorkerActive()) {
    ExecutionSafety.MarkWorkerInterrupted(latest); latest.Progress = null;
   }
   return latest;
  } catch (OfficeFailure) { throw; } catch { throw new OfficeFailure("JOURNAL_INVALID"); }
 }
 public static bool IsWorkerActive() => Journal.IsWorkerActive();
 public static async Task<JobRecord> ReviewInterruptedAsync(JobRecord job, Inventory fresh) {
  if (IsWorkerActive() || ExecutionSafety.RestartCheckpointError(job) != "INSTALLER_RESULT_UNKNOWN"
   && job.RestartBoot == null && (!Policy.RebootExit(job.InstallerExitCode ?? 0) || job.RestartVerifiedBoot != null)) return job;
  var reviewed = System.Text.Json.JsonSerializer.Deserialize<JobRecord>(System.Text.Json.JsonSerializer.Serialize(job, Reports.Json), Reports.Json)!;
  if (await ExecutionSafety.VerifyRestartAsync(reviewed, new OfficePlatform().BootIdAsync, () => Task.FromResult(fresh))) {
   reviewed.UpdatedAt = DateTimeOffset.UtcNow;
   if (reviewed.Status == JobStatus.AwaitingRestart) reviewed.Code = "RESTART_VERIFIED";
  }
  return reviewed;
 }
 private static string PipeName(Guid id) => "ChinaTech.OfficeAssistant1.Cancel." + id.ToString("N");
 public static async Task<bool> RequestCancelAsync(Guid id) {
  try {
   using var pipe = new NamedPipeClientStream(".", PipeName(id), PipeDirection.InOut, PipeOptions.Asynchronous);
   using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
   await pipe.ConnectAsync(timeout.Token);
   await pipe.WriteAsync("CANCEL\n"u8.ToArray(), timeout.Token); await pipe.FlushAsync(timeout.Token);
   var buffer = new byte[3]; var offset = 0;
   while (offset < buffer.Length) { var count = await pipe.ReadAsync(buffer.AsMemory(offset), timeout.Token); if (count == 0) break; offset += count; }
   return offset == 3 && System.Text.Encoding.ASCII.GetString(buffer) == "OK\n";
  } catch { return false; }
 }
 public static async Task<JobRecord> LaunchAsync(JobRequest request, IProgress<JobRecord> progress, CancellationToken cancellation) {
  Policy.Validate(request);
  if (IsWorkerActive()) throw new OfficeFailure("ANOTHER_TASK");
  var preceding = Latest();
  var platform = new OfficePlatform();
  await ExecutionSafety.VerifyRestartAsync(preceding, platform.BootIdAsync, () => OfficePlatform.InspectAsync());
  using var identity = WindowsIdentity.GetCurrent();
  var sid = identity.User?.Value ?? throw new OfficeFailure("IDENTITY_UNAVAILABLE");
  if (request.Resume && new Journal(request.Id).Read().ActorSid != sid) throw new OfficeFailure("ACTOR_MISMATCH");
  var executable = Environment.ProcessPath ?? throw new OfficeFailure("PROCESS_START_FAILED");
  var start = new ProcessStartInfo(executable) { UseShellExecute = true, Verb = "runas" };
  using var ui = Process.GetCurrentProcess();
  foreach (var argument in new[] { "--worker", request.Id.ToString("D"), request.Action.ToString(), request.Language,
   request.Server, request.ExpectedFingerprint, request.Resume ? "resume" : "new", sid,
   Environment.ProcessId.ToString(System.Globalization.CultureInfo.InvariantCulture), ui.StartTime.ToUniversalTime().Ticks.ToString(System.Globalization.CultureInfo.InvariantCulture),
   Convert.ToBase64String(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new SelectionPayload(request.SelectedComponents, request.RemovalMode, request.RemovalTargets), Reports.Json)) }) start.ArgumentList.Add(argument);
  Process worker;
  try { worker = Process.Start(start) ?? throw new OfficeFailure("PROCESS_START_FAILED"); }
  catch (Win32Exception e) when (e.NativeErrorCode == 1223) { throw new OfficeFailure("UAC_CANCELLED"); }
  using (worker) {
   JobRecord? observed = null;
   var cancelDelivered = false;
   while (!worker.HasExited) {
    if (cancellation.IsCancellationRequested && !cancelDelivered) cancelDelivered = await RequestCancelAsync(request.Id);
    try {
     var current = Latest();
     if (current?.Id == request.Id && current.ActorSid == sid) { observed = current; if (cancellation.IsCancellationRequested && !cancelDelivered) current.Code = "CANCEL_REQUEST_FAILED"; progress.Report(current); }
    } catch (OfficeFailure) { /* A concurrent atomic save is retried; success is never inferred. */ }
    await Task.Delay(700);
   }
   JobRecord last;
   try { last = new Journal(request.Id).Read(); }
   catch { throw new OfficeFailure("JOB_RECORDING_FAILED"); }
   if (last.Id != request.Id || last.ActorSid != sid) throw new OfficeFailure("JOB_RECORDING_FAILED");
   observed = last;
   if (observed == null) throw new OfficeFailure(worker.ExitCode == 3 ? "ANOTHER_TASK" : "WORKER_FAILED");
   ExecutionSafety.MarkWorkerInterrupted(observed);
   observed.Progress = null;
   progress.Report(observed); return observed;
  }
 }
 public static async Task<int> Worker(string[] args) {
  try {
   if (args.Length is not (10 or 11) || args[0] != "--worker" || !Guid.TryParseExact(args[1], "D", out var id)
    || !Enum.TryParse<ActionKind>(args[2], false, out var action) || args[6] is not ("new" or "resume")) return 2;
   SelectionPayload? selection = null;
   if (args.Length == 11) {
    if (args[10].Length > 131072) return 2;
    selection = System.Text.Json.JsonSerializer.Deserialize<SelectionPayload>(Convert.FromBase64String(args[10]), Reports.Json) ?? throw new OfficeFailure("REQUEST_INVALID");
   }
   var request = new JobRequest(id, action, args[3], args[4], args[5], args[6] == "resume") { SelectedComponents = selection?.SelectedComponents, RemovalMode = selection?.RemovalMode ?? RemovalMode.All, RemovalTargets = selection?.RemovalTargets }; Policy.Validate(request);
   using var identity = WindowsIdentity.GetCurrent();
   if (!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) return 2;
   var actor = new SecurityIdentifier(args[7]);
   if (!int.TryParse(args[8], out var uiPid) || !long.TryParse(args[9], out var uiStarted) || !VerifyActor(uiPid, uiStarted, actor)) return 2;
   Journal.Initialize();
   FileStream lease;
   try { lease = new FileStream(Journal.LockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
   catch (IOException) { return 3; }
   using (lease) {
    var preceding = Latest();
    var platform = new OfficePlatform(actorSid: actor.Value, actorPid: uiPid, actorStarted: uiStarted);
    await ExecutionSafety.VerifyRestartAsync(preceding, platform.BootIdAsync, ((IOfficePlatform)platform).InspectAsync);
    var store = new Journal(id); store.Create();
    if (!request.Resume && File.Exists(Path.Combine(store.DirectoryPath, "job.json"))) return 2;
    var job = request.Resume ? store.Read() : new JobRecord { Id = id, Action = action, Language = request.Language,
     Server = request.Server, ExpectedFingerprint = request.ExpectedFingerprint, ActorSid = actor.Value, Schema = args.Length == 11 ? 2 : 1,
     SelectedComponents = request.SelectedComponents?.ToArray(), RemovalMode = request.RemovalMode, RemovalTargets = request.RemovalTargets?.ToArray() };
    if (job.ActorSid != actor.Value || job.Action != action || job.Language != request.Language || job.Server != request.Server) return 2;
    OfficeSelection.ValidateResume(job, request);
    // Start cancellation listener before inspection/download. It authorizes only a safe cancellation request.
    using var cancelled = new CancellationTokenSource(); using var listenerStop = new CancellationTokenSource();
    var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var listener = ListenForCancel(id, actor, cancelled, listenerStop.Token, ready);
    try {
     await ready.Task;
     if (!request.Resume) await store.SaveAsync(job);
     await new Workflow(new OfficePlatform(store.DirectoryPath, actor.Value, uiPid, uiStarted), store).RunAsync(job, request.Resume, cancelled.Token);
    } finally {
     listenerStop.Cancel();
     try { await listener; } catch (OperationCanceledException) { }
    }
    return job.Status == JobStatus.Completed ? 0 : 1;
   }
  } catch { return 1; }
 }
 private sealed record SelectionPayload(string[]? SelectedComponents, RemovalMode RemovalMode, string[]? RemovalTargets);
 private static bool VerifyActor(int pid, long started, SecurityIdentifier actor) {
  try {
   using var process = Process.GetProcessById(pid);
   if (process.StartTime.ToUniversalTime().Ticks != started || process.HasExited) return false;
   using var handle = OpenProcess(0x1000, false, pid);
   if (handle.IsInvalid || !OpenProcessToken(handle, 0x0008, out var token)) return false;
   using (token) using (var owner = new WindowsIdentity(token.DangerousGetHandle())) return owner.User?.Equals(actor) == true;
  } catch { return false; }
 }
 [LibraryImport("kernel32.dll", SetLastError = true)]
 private static partial SafeProcessHandle OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, int pid);
 [LibraryImport("advapi32.dll", SetLastError = true)]
 [return: MarshalAs(UnmanagedType.Bool)]
 private static partial bool OpenProcessToken(SafeProcessHandle process, uint access, out SafeAccessTokenHandle token);
 private static async Task ListenForCancel(Guid id, SecurityIdentifier actor, CancellationTokenSource cancellation, CancellationToken stop, TaskCompletionSource ready) {
  try {
  while (!stop.IsCancellationRequested) {
   var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false);
   security.AddAccessRule(new(actor, PipeAccessRights.ReadWrite, AccessControlType.Allow));
   security.AddAccessRule(new(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
   security.AddAccessRule(new(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
   using var pipe = NamedPipeServerStreamAcl.Create(PipeName(id), PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
    PipeOptions.Asynchronous | PipeOptions.FirstPipeInstance, 4096, 4096, security);
   ready.TrySetResult();
   await pipe.WaitForConnectionAsync(stop);
   using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stop); timeout.CancelAfter(TimeSpan.FromSeconds(2));
   var buffer = new byte[7]; var offset = 0;
   try {
    while (offset < buffer.Length) {
     var count = await pipe.ReadAsync(buffer.AsMemory(offset), timeout.Token); if (count == 0) break; offset += count;
    }
    if (offset == 7 && System.Text.Encoding.ASCII.GetString(buffer) == "CANCEL\n") {
     cancellation.Cancel(); await pipe.WriteAsync("OK\n"u8.ToArray(), timeout.Token); await pipe.FlushAsync(timeout.Token);
    }
   } catch (IOException) { } catch (OperationCanceledException) when (!stop.IsCancellationRequested) { }
  }
  } catch (Exception e) { ready.TrySetException(e); throw; }
 }
}
