namespace ChinaTech.OfficeAssistant;
/// <summary>Each destructive boundary is journalled; cancellation never kills an installer.</summary>
public sealed class Workflow(IOfficePlatform platform, IJobStore store) {
 public async Task<JobRecord> RunAsync(JobRecord job, bool resume, CancellationToken cancellation) {
  var source = platform as IOfficeProgressSource;
  var precedingObserver = source?.ProgressObserver;
  var recorder = new ProgressRecorder(job, store);
  if (source != null) source.ProgressObserver = recorder.ObserveAsync;
  // An interrupted or resumed operation must get a new measurement from this worker.
  job.Progress = null;
  try {
   Policy.Validate(new(job.Id, job.Action, job.Language, job.Server, job.ExpectedFingerprint, resume) { SelectedComponents = job.SelectedComponents, RemovalMode = job.RemovalMode, RemovalTargets = job.RemovalTargets });
   if (job.Schema == 2) { await RunSelection(job, resume, cancellation); return job; }
   if (job.Schema != 1) throw new OfficeFailure("JOURNAL_INVALID");
   if (resume && job.Status == JobStatus.Completed) return job;
   if (resume && await ExecutionSafety.VerifyRestartAsync(job, platform.BootIdAsync, platform.InspectAsync)) await store.SaveAsync(job);
   var retryComponents = resume && job.Status == JobStatus.ComponentMissing;
   job.Observation = await platform.InspectAsync();
   if (!resume) job.OneDriveInitiallyPresent = job.Observation.Components.Any(c => c.Id == "OneDrive" && c.Present);
   if (Policy.Blocker(job.Observation) is { } blocker) throw new OfficeFailure(blocker);
   // After losing the worker, do not infer that a partly executed removal can be replayed.
   if (resume && job.RemovalStarted && !job.Removed) {
    if (job.Observation.HasOffice) throw new OfficeFailure("REMOVAL_UNKNOWN");
    job.Removed = true;
   }
   if (resume && !job.Installed && job.Removed && job.Observation.MatchesPlan(job) && job.Observation.AllComponents)
    job.Installed = true;
   if (retryComponents) job.Installed = false;
   await Enter(job, Stage.Detect, "DETECTED");
   cancellation.ThrowIfCancellationRequested();
   if (job.Action == ActionKind.Activate) {
    if (!Installed(job.Observation, job)) throw new OfficeFailure("PRODUCT_NOT_FOUND");
    await Activate(job, cancellation);
    return job;
   }
   if (job.Action == ActionKind.InstallActivate && !job.Installed) {
    await Enter(job, Stage.Download, "PREPARING_MEDIA");
    if (job.Media == null) { job.Media = await platform.PrepareAsync(job, cancellation); await store.SaveAsync(job); }
    await platform.VerifyMediaAsync(job);
    cancellation.ThrowIfCancellationRequested();
   }
   if (!job.Removed && !job.Installed) {
    var before = await platform.InspectAsync();
    if (before.Fingerprint != job.ExpectedFingerprint && before.LegacyFingerprint != job.ExpectedFingerprint) throw new OfficeFailure("ENVIRONMENT_CHANGED");
    if (Policy.Blocker(before) is { } changedBlocker) throw new OfficeFailure(changedBlocker);
    cancellation.ThrowIfCancellationRequested();
    if (before.HasOffice) {
     await platform.PrepareRemovalAsync(job, cancellation);
     cancellation.ThrowIfCancellationRequested();
     before = await platform.InspectAsync();
     if (before.Fingerprint != job.ExpectedFingerprint && before.LegacyFingerprint != job.ExpectedFingerprint) throw new OfficeFailure("ENVIRONMENT_CHANGED");
     if (Policy.Blocker(before) is { } removeBlocker) throw new OfficeFailure(removeBlocker);
     await ExecutionSafety.RecordInstallerStartAsync(job, platform.BootIdAsync, store.SaveAsync);
     await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
     job.RemovalStarted = true;
     await Enter(job, Stage.Remove, "REMOVING_OFFICE");
     await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
     var exit = await platform.RemoveAsync(job);
     await ExecutionSafety.RecordInstallerExitAsync(job, exit, store.SaveAsync);
     if (Policy.RebootExit(exit)) return job;
     job.Observation = await platform.InspectAsync();
     job.Removed = !job.Observation.HasOffice;
     await store.SaveAsync(job);
     if (exit != 0 || !job.Removed) throw new OfficeFailure("UNINSTALL_FAILED", exit);
    } else { job.Removed = true; await store.SaveAsync(job); }
   }
   if (job.Action == ActionKind.Uninstall) {
    job.Observation = await platform.InspectAsync();
    if (job.Observation.HasOffice) throw new OfficeFailure("UNINSTALL_FAILED");
    if (job.OneDriveInitiallyPresent && !job.Observation.Components.Any(c => c.Id == "OneDrive" && c.Present)) throw new OfficeFailure("ONEDRIVE_PRESERVATION_FAILED");
    await End(job, JobStatus.Completed, "OFFICE_REMOVED");
    return job;
   }
   cancellation.ThrowIfCancellationRequested();
   if (!job.Installed) {
    await platform.VerifyMediaAsync(job);
    var before = await platform.InspectAsync();
    if (Policy.Blocker(before) is { } installBlocker) throw new OfficeFailure(installBlocker);
    // Only the two requested targets may be present during installation recovery.
    if (before.MsiProducts.Length != 0 || before.OfficeProducts.Except(["ProPlus2024Volume", "SkypeforBusiness2024Volume"], StringComparer.OrdinalIgnoreCase).Any())
     throw new OfficeFailure("ENVIRONMENT_CHANGED");
    await ExecutionSafety.RecordInstallerStartAsync(job, platform.BootIdAsync, store.SaveAsync);
    await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
    await Enter(job, Stage.Install, "INSTALLING_OFFICE");
    await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
    var exit = await platform.InstallAsync(job);
    await ExecutionSafety.RecordInstallerExitAsync(job, exit, store.SaveAsync);
    if (Policy.RebootExit(exit)) return job;
    job.Observation = await platform.InspectAsync();
    job.Installed = job.Observation.MatchesPlan(job);
    await store.SaveAsync(job);
    if (exit != 0 || !job.Installed) throw new OfficeFailure("INSTALL_FAILED", exit);
   }
   cancellation.ThrowIfCancellationRequested();
   await Enter(job, Stage.Components, "CHECKING_COMPONENTS");
   await platform.EnsureOneDriveAsync(job, cancellation);
   job.Observation = await platform.InspectAsync();
   if (!Matches(job.Observation, job) || !Components(job.Observation, job)) {
    await End(job, JobStatus.ComponentMissing, "COMPONENT_MISSING"); return job;
   }
   await Activate(job, cancellation);
  } catch (OperationCanceledException) { await End(job, JobStatus.Cancelled, job.Removed && !job.Installed ? "REMOVED_NOT_INSTALLED" : "CANCELLED_SAFE"); }
  catch (OfficeFailure e) {
   job.InstallerExitCode = e.ExitCode ?? job.InstallerExitCode;
   if (e.ExitCode is { } restartExit && Policy.RebootExit(restartExit)) { await Pause(job); return job; }
   await End(job, e.Code == "RESTART_REQUIRED" ? JobStatus.AwaitingRestart : e.Code is "REMOVAL_UNKNOWN" or "RESTART_CHECKPOINT_MISSING" or "INSTALLER_RESULT_UNKNOWN" ? JobStatus.NeedsReview : JobStatus.Failed, e.Code);
  } catch { await End(job, JobStatus.NeedsReview, "UNEXPECTED_FAILURE"); }
  finally { if (source != null) source.ProgressObserver = precedingObserver; }
  return job;
 }
 private async Task RunSelection(JobRecord job, bool resume, CancellationToken cancellation) {
  if (resume && job.Status == JobStatus.Completed) return;
  if (resume && await ExecutionSafety.VerifyRestartAsync(job, platform.BootIdAsync, platform.InspectAsync)) await store.SaveAsync(job);
  var retryComponents = resume && job.Status == JobStatus.ComponentMissing;
  job.Observation = await platform.InspectAsync();
  if (Policy.Blocker(job.Observation) is { } blocker) throw new OfficeFailure(blocker);
  if (job.SelectionPlan == null) {
   job.SelectionPlan = OfficeSelection.Freeze(job, job.Observation);
   job.OneDriveInitiallyPresent = job.Observation.Components.Any(c => c.Id == "OneDrive" && c.Present);
   await store.SaveAsync(job);
  } else OfficeSelection.ValidatePlan(job);
  var plan = job.SelectionPlan;
  cancellation.ThrowIfCancellationRequested();
  await Enter(job, Stage.Detect, "DETECTED");
  if (job.Action == ActionKind.Activate) { await Activate(job, cancellation); return; }
  if (job.Action == ActionKind.Uninstall) {
   if (resume && job.RemovalStarted && !job.Removed && job.CurrentRemovalStep != null) {
    if (!OfficeSelection.RemovalStepComplete(job.Observation, job, job.CurrentRemovalStep)) throw new OfficeFailure("REMOVAL_UNKNOWN");
    job.CompletedRemovalSteps = job.CompletedRemovalSteps.Concat([job.CurrentRemovalStep]).Distinct().ToArray();
    job.Removed = OfficeSelection.RemovalComplete(job.Observation, job); job.CurrentRemovalStep = null; await store.SaveAsync(job);
   }
   if (!job.Removed) {
    OfficeSelection.ValidateRemovalEvolution(job.Observation, job);
    if (!job.RemovalStarted && job.Observation.Fingerprint != job.ExpectedFingerprint) throw new OfficeFailure("ENVIRONMENT_CHANGED");
    await platform.PrepareRemovalAsync(job, cancellation);
    cancellation.ThrowIfCancellationRequested();
    var before = await platform.InspectAsync(); OfficeSelection.ValidateRemovalEvolution(before, job);
    if (!job.RemovalStarted && before.Fingerprint != job.ExpectedFingerprint) throw new OfficeFailure("ENVIRONMENT_CHANGED");
    if (Policy.Blocker(before) is { } removeBlocker) throw new OfficeFailure(removeBlocker);
    await ExecutionSafety.RecordInstallerStartAsync(job, platform.BootIdAsync, store.SaveAsync);
    await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
    job.RemovalStarted = true; await Enter(job, Stage.Remove, "REMOVING_OFFICE");
    var exit = await platform.RemoveAsync(job);
    await ExecutionSafety.RecordInstallerExitAsync(job, exit, store.SaveAsync);
    if (Policy.RebootExit(exit)) return;
    job.Observation = await platform.InspectAsync();
    job.Removed = OfficeSelection.RemovalComplete(job.Observation, job);
    await store.SaveAsync(job);
    if (exit != 0 || !job.Removed) throw new OfficeFailure("UNINSTALL_FAILED", exit);
   }
   if (!OfficeSelection.Preserved(job.Observation, job)) throw new OfficeFailure("PRESERVATION_FAILED");
   await End(job, JobStatus.Completed, "OFFICE_REMOVED"); return;
  }
  // Schema 2 installation never removes an existing product as a side effect.
  if (OfficeSelection.InstallBlocker(job.Observation, plan.Components) is { } installBlocker) throw new OfficeFailure(installBlocker);
  if (resume && OfficeSelection.MatchesPlan(job.Observation, job) && OfficeSelection.ComponentsPresent(job.Observation, plan.Components)) job.Installed = true;
  if (retryComponents) job.Installed = false;
  if (!job.Installed) {
   await Enter(job, Stage.Download, "PREPARING_MEDIA");
   if (job.Media == null) { job.Media = await platform.PrepareAsync(job, cancellation); await store.SaveAsync(job); }
   await platform.VerifyMediaAsync(job); cancellation.ThrowIfCancellationRequested();
   var before = await platform.InspectAsync();
   if (OfficeSelection.InstallBlocker(before, plan.Components) is { } changed) throw new OfficeFailure(changed);
   if (!resume && before.Fingerprint != job.ExpectedFingerprint || resume && !OfficeSelection.InstallEvolutionAllowed(before, job)) throw new OfficeFailure("ENVIRONMENT_CHANGED");
   if (Policy.Blocker(before) is { } busy) throw new OfficeFailure(busy);
   if (plan.Products.Length != 0) {
    await ExecutionSafety.RecordInstallerStartAsync(job, platform.BootIdAsync, store.SaveAsync);
    await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
    await Enter(job, Stage.Install, "INSTALLING_OFFICE");
    await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
    var exit = await platform.InstallAsync(job); await ExecutionSafety.RecordInstallerExitAsync(job, exit, store.SaveAsync);
    if (Policy.RebootExit(exit)) return;
    job.Observation = await platform.InspectAsync(); job.Installed = OfficeSelection.MatchesPlan(job.Observation, job); await store.SaveAsync(job);
    if (exit != 0 || !job.Installed) throw new OfficeFailure("INSTALL_FAILED", exit);
   } else { job.Installed = true; await store.SaveAsync(job); }
  }
  cancellation.ThrowIfCancellationRequested(); await Enter(job, Stage.Components, "CHECKING_COMPONENTS");
  if (plan.Components.Contains("OneDrive")) await platform.EnsureOneDriveAsync(job, cancellation);
  job.Observation = await platform.InspectAsync();
  if (!OfficeSelection.Preserved(job.Observation, job)) throw new OfficeFailure("PRESERVATION_FAILED");
  if (!OfficeSelection.MatchesPlan(job.Observation, job) || !OfficeSelection.ComponentsPresent(job.Observation, plan.Components)) { await End(job, JobStatus.ComponentMissing, "COMPONENT_MISSING"); return; }
  if (OfficeSelection.RequiredProducts(plan.Components).Length == 0) { await End(job, JobStatus.Completed, "OFFICE_READY"); return; }
  await Activate(job, cancellation);
 }
 private async Task Activate(JobRecord job, CancellationToken cancellation) {
  cancellation.ThrowIfCancellationRequested();
  job.Observation = await platform.InspectAsync();
  if (job.Action == ActionKind.InstallActivate && job.Installed && job.Observation.Installers.Length != 0) {
   await Enter(job, Stage.Components, "WAITING_INSTALLERS");
   job.Observation = await InstallerSafety.WaitForClearAsync(job, platform.InspectAsync,
    async fresh => { job.Observation = fresh; await store.SaveAsync(job); }, cancellation);
  }
  if (job.Observation.LicenseError.Length != 0) throw new OfficeFailure(job.Observation.LicenseError);
  await Enter(job, Stage.Activate, "ACTIVATING_OFFICE");
  if (!Installed(job.Observation, job)) throw new OfficeFailure("PRODUCT_NOT_FOUND");
  if (Policy.Blocker(job.Observation) is { } blocker) throw new OfficeFailure(blocker);
  if (job.Action == ActionKind.InstallActivate && (!Matches(job.Observation, job) || !Components(job.Observation, job))) {
   await End(job, JobStatus.ComponentMissing, "COMPONENT_MISSING"); return;
  }
  if (Licensed(job.Observation, job)) { await End(job, JobStatus.Completed, "ALREADY_LICENSED"); return; }
  try { await platform.ActivateAsync(job); }
  catch (OfficeFailure) {
   job.Observation = await platform.InspectAsync();
   if (job.Observation.LicenseError.Length != 0) throw new OfficeFailure(job.Observation.LicenseError);
   await End(job, JobStatus.InstalledUnlicensed, "ACTIVATION_FAILED"); return;
  }
  job.Observation = await platform.InspectAsync();
  if (job.Observation.LicenseError.Length != 0) throw new OfficeFailure(job.Observation.LicenseError);
  if (!Installed(job.Observation, job)) throw new OfficeFailure("PRODUCT_NOT_FOUND");
  if (job.Action == ActionKind.InstallActivate && (!Matches(job.Observation, job) || !Components(job.Observation, job))) {
   await End(job, JobStatus.ComponentMissing, "COMPONENT_MISSING"); return;
  }
  await End(job, Licensed(job.Observation, job) ? JobStatus.Completed : JobStatus.InstalledUnlicensed,
   Licensed(job.Observation, job) ? job.Action == ActionKind.Activate ? "ACTIVATION_COMPLETE" : "OFFICE_READY" : "ACTIVATION_FAILED");
 }
 private static bool Installed(Inventory i, JobRecord j) => j.Schema == 1 ? i.TargetInstalled : OfficeSelection.InstalledForSelection(i, OfficeSelection.Selected(j));
 private static bool Licensed(Inventory i, JobRecord j) => j.Schema == 1 ? i.TargetLicensed : OfficeSelection.LicensedForSelection(i, OfficeSelection.Selected(j));
 private static bool Components(Inventory i, JobRecord j) => j.Schema == 1 ? i.AllComponents : OfficeSelection.ComponentsPresent(i, OfficeSelection.Selected(j));
 private static bool Matches(Inventory i, JobRecord j) => j.Schema == 1 ? i.MatchesPlan(j) : OfficeSelection.MatchesPlan(i, j);
 private async Task Enter(JobRecord job, Stage stage, string code) {
  job.Progress = null; job.Stage = stage; job.Status = JobStatus.Running; job.Code = code; job.UpdatedAt = DateTimeOffset.UtcNow;
  job.Events.Add(new(stage, code, job.UpdatedAt)); await store.SaveAsync(job);
 }
 private Task Pause(JobRecord job) {
  job.Progress = null;
  return ExecutionSafety.RecordInstallerRestartAsync(job, store.SaveAsync);
 }
 private async Task End(JobRecord job, JobStatus status, string code) {
  job.Progress = null; job.Status = status; job.Code = code; job.UpdatedAt = DateTimeOffset.UtcNow;
  if (status == JobStatus.Completed) job.Stage = Stage.Finished;
  job.Events.Add(new(job.Stage, code, job.UpdatedAt)); await store.SaveAsync(job);
 }
}
