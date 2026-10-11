using ChinaTech.OfficeAssistant;
using System.Globalization;
using System.Xml.Linq;
using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Reflection;
if (args.Length > 0 && args[0] == "--probe-fixture") {
 if (args.Length == 2) { await File.WriteAllTextAsync(args[1], Environment.ProcessId.ToString(CultureInfo.InvariantCulture)); await Task.Delay(Timeout.InfiniteTimeSpan); }
 else Console.Write("probe complete");
 return;
}
int passed = 0;
async Task Test(string name, Func<Task> test) { await test(); passed++; Console.WriteLine("PASS " + name); }
void Assert(bool value) { if (!value) throw new Exception("Assertion failed"); }
JobRecord New(ActionKind action = ActionKind.InstallActivate) => new() { Id = Guid.NewGuid(), Action = action, Language = "en-us", Server = "s1.kms.cx", ExpectedFingerprint = Fake.Old.Fingerprint };
async Task<JobRecord> Run(Fake f, JobRecord j, bool resume = false, CancellationToken token = default) => await new Workflow(f, f).RunAsync(j, resume, token);
await Test("download failure never removes existing Office", async () => { var f = new Fake { DownloadFails = true }; var j = await Run(f, New()); Assert(j.Status == JobStatus.Failed && f.Removes == 0 && f.Inventory.HasOffice); });
await Test("media modification never removes Office", async () => { var f = new Fake { MediaFails = true }; await Run(f, New()); Assert(f.Removes == 0); });
await Test("pending Windows restart remains advisory", async () => { var f = new Fake(); f.Inventory = Fake.Old with { RestartReasons = ["CBS", "WINDOWS_UPDATE"] }; var j = await Run(f, New()); Assert(j.Status == JobStatus.Completed && f.Removes == 1); });
await Test("target plus all eight applications plus both licenses", async () => { var f = new Fake(); var j = await Run(f, New()); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1 && f.Activations == 1); });
await Test("Skype missing never claims complete", async () => { var f = new Fake { MissingSkype = true }; var j = await Run(f, New()); Assert(j.Status == JobStatus.ComponentMissing && f.Activations == 0); });
await Test("missing component recovery skips removal", async () => { var f = new Fake { MissingSkype = true }; var j = await Run(f, New()); f.MissingSkype = false; j = await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 2); });
await Test("activation failure retains installed applications", async () => { var f = new Fake { ActivationFails = true }; var j = await Run(f, New()); Assert(j.Status == JobStatus.InstalledUnlicensed && j.Installed && f.Installs == 1); });
await Test("only retry activation after install failure to activate", async () => { var f = new Fake { ActivationFails = true }; await Run(f, New()); f.ActivationFails = false; var j = New(ActionKind.Activate); j.ExpectedFingerprint = f.Inventory.Fingerprint; await Run(f, j); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1); });
await Test("different product license cannot satisfy target", async () => { var f = new Fake { WrongLicense = true }; var j = await Run(f, New()); Assert(j.Status == JobStatus.InstalledUnlicensed); });
await Test("single target licensed does not prove Skype licensed", async () => { var f = new Fake { OnlySuiteLicense = true }; var j = await Run(f, New()); Assert(j.Status == JobStatus.InstalledUnlicensed); });
await Test("already licensed skips network activation", async () => { var f = new Fake { Inventory = Fake.Ready with { Licenses = Fake.ValidLicenses } }; var j = New(ActionKind.Activate); var result = await Run(f, j); Assert(result.Code == "ALREADY_LICENSED" && f.Activations == 0); });
await Test("real installer reboot exit pauses before installation", async () => { var f = new Fake { RemoveExit = 3010 }; var j = await Run(f, New()); Assert(j.Status == JobStatus.AwaitingRestart && j.RestartBoot == "1000" && !j.Removed && f.Installs == 0); await Run(f, j, true); Assert(f.Installs == 0 && j.Status == JobStatus.AwaitingRestart); f.Boot = "2000"; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1); });
await Test("installation reboot exit is recovered without uninstall", async () => { var f = new Fake { InstallExit = 3010 }; var j = await Run(f, New()); Assert(j.Status == JobStatus.AwaitingRestart && j.RestartBoot == "1000" && !j.Installed); f.Boot = "2000"; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1); });
await Test("worker interrupted during uncertain removal never repeats", async () => { var f = new Fake(); var j = New(); j.Stage = Stage.Remove; j.RemovalStarted = true; await Run(f, j, true); Assert(j.Status == JobStatus.NeedsReview && f.Removes == 0); await Run(f, j, true); Assert(f.Removes == 0 && j.Status == JobStatus.NeedsReview); });
await Test("interrupted removal confirmed absent resumes only install", async () => { var f = new Fake { Inventory = Fake.Empty }; var j = New(); j.Stage = Stage.Remove; j.RemovalStarted = true; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 0 && f.Installs == 1); });
await Test("inventory changes during download stop before remove", async () => { var f = new Fake { ChangeAfterDownload = true }; var j = await Run(f, New()); Assert(j.Code == "ENVIRONMENT_CHANGED" && f.Removes == 0); });
await Test("uninstall requires actual absence", async () => { var f = new Fake { LeaveProducts = true }; var j = await Run(f, New(ActionKind.Uninstall)); Assert(j.Status == JobStatus.Failed && j.Code == "UNINSTALL_FAILED"); });
await Test("uninstall never runs activation or Office installation", async () => { var f = new Fake(); var j = await Run(f, New(ActionKind.Uninstall)); Assert(j.Status == JobStatus.Completed && f.Installs == 0 && f.Activations == 0); });
await Test("safe cancellation after removing skips installation", async () => { using var token = new CancellationTokenSource(); var f = new Fake { CancelAfterRemove = token }; var j = await Run(f, New(), token: token.Token); Assert(j.Status == JobStatus.Cancelled && j.Removed && !j.Installed && f.Installs == 0); await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1); });
await Test("open documents are never force closed", async () => { var f = new Fake { Inventory = Fake.Old with { OpenApps = ["WINWORD"] } }; var j = await Run(f, New()); Assert(j.Code == "APPS_OPEN" && f.Removes == 0); });
await Test("another installer blocks before destructive actions", async () => { var f = new Fake { Inventory = Fake.Old with { Installers = ["msiexec"] } }; var j = await Run(f, New()); Assert(j.Code == "INSTALLER_BUSY" && f.Removes == 0); });
await Test("cancel before preparation leaves Office untouched", async () => { using var token = new CancellationTokenSource(); token.Cancel(); var f = new Fake(); var j = await Run(f, New(), token: token.Token); Assert(j.Status == JobStatus.Cancelled && f.Removes == 0 && f.Downloads == 0); });
await Test("new foreign products after uninstall block installation", async () => { var f = new Fake { ForeignAfterRemove = true }; var j = await Run(f, New()); Assert(j.Status == JobStatus.Failed && f.Installs == 0); });
await Test("configuration has explicit Skype and language without exclusions", () => { foreach (var language in Policy.Languages) { var xml = XDocument.Parse(Configuration.Install(@"C:\protected\media", language, "16.0.17932.21000")); var add = xml.Root!.Element("Add")!; Assert((string?)add.Attribute("OfficeClientEdition") == "64" && (string?)add.Attribute("Channel") == "PerpetualVL2024"); Assert(add.Elements("Product").Count() == 2 && add.Descendants("Language").All(x => (string?)x.Attribute("ID") == language)); Assert(!xml.Descendants("ExcludeApp").Any() && !xml.Descendants("RemoveMSI").Any()); } return Task.CompletedTask; });
await Test("follow Windows locale independently of UI", () => { Assert(Policy.DefaultLanguage(CultureInfo.GetCultureInfo("zh-TW")) == "zh-cn" && Policy.DefaultLanguage(CultureInfo.GetCultureInfo("it-IT")) == "it-it" && Policy.DefaultLanguage(CultureInfo.GetCultureInfo("de-DE")) == "en-us"); return Task.CompletedTask; });
await Test("host validation rejects command injection and arbitrary domains", () => { foreach (var server in new[] { "evil.example", "s1.kms.cx;whoami", "kms.cx/", "s1.kms.cx:0", "k.302.pub:65536", "https://kms.cx", "a\nkms.cx" }) { try { Policy.ValidateServer(server); throw new Exception("accepted invalid server"); } catch (OfficeFailure) { } } Assert(Policy.ValidateServer("S1.KMS.CX:1688") == "s1.kms.cx:1688"); return Task.CompletedTask; });
await Test("export retains removal execution facts while excluding protected actor and media paths", () => {
 var j = New(); j.ActorSid = "PRIVATE-SID"; j.Media = new("16.0.1.1", "hash", [new("PRIVATE-PATH", 1, "sha")]); j.Removed = true;
 foreach (var actualRemoval in new[] { false, true }) {
  j.RemovalStarted = actualRemoval; var report = Reports.Export(Fake.Empty, j, "zh");
  Assert(!report.Contains("PRIVATE-SID") && !report.Contains("PRIVATE-PATH"));
  using var json = JsonDocument.Parse(report); Assert(json.RootElement.GetProperty("task").GetProperty("RemovalStarted").GetBoolean() == actualRemoval && json.RootElement.GetProperty("task").GetProperty("Removed").GetBoolean());
 }
 return Task.CompletedTask;
});
Console.WriteLine($"{passed} meaningful workflow checks passed; these use fake Office boundaries, not real installation evidence.");
await Test("32-bit Office cannot satisfy 64-bit installation", async () => { var f = new Fake { WrongPlatform = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && !j.Installed); });
await Test("wrong language cannot satisfy the pinned plan", async () => { var f = new Fake { WrongLanguage = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && !j.Installed); });
await Test("missing Skype SKU cannot be hidden by stale Lync executable", async () => { var f = new Fake { MissingSkypeSku = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && f.Activations == 0); });
await Test("Office removed during activation cannot report ready", async () => { var f = new Fake { LostDuringActivation = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && j.Code == "PRODUCT_NOT_FOUND"); });
await Test("cancel after installation records installed state and does not activate", async () => { using var token = new CancellationTokenSource(); var f = new Fake { CancelAfterInstall = token }; var j = await Run(f, New(), token: token.Token); Assert(j.Status == JobStatus.Cancelled && j.Installed && f.Activations == 0); });
await Test("filesystem read mask does not overlap mutation mask", () => { Assert(!Policy.CanMutateFileSystem(0x1200a9) && Policy.CanMutateFileSystem(0x2) && Policy.CanMutateFileSystem(0x40000)); return Task.CompletedTask; });
await Test("configuration changes invalidate the confirmed fingerprint", () => { Assert(Fake.Ready.Fingerprint != (Fake.Ready with { Platform = "x86" }).Fingerprint && Fake.Ready.Fingerprint != (Fake.Ready with { SuiteLanguages = ["it-it"] }).Fingerprint); return Task.CompletedTask; });
await Test("stalled server response body has a deadline and can retry", async () => {
 using var stalled = new HttpClient(new ResponseFixture(new StalledBody()));
 var watch = Stopwatch.StartNew();
 Assert(await ActivationSource.ResolveAsync(stalled, TimeSpan.FromMilliseconds(100)) == "k.302.pub" && watch.Elapsed < TimeSpan.FromSeconds(2));
 using var valid = new HttpClient(new ResponseFixture(new MemoryStream(Encoding.UTF8.GetBytes("{\"data\":{\"kms_server_address\":\"S1.KMS.CX:1688\"}}"))));
 Assert(await ActivationSource.ResolveAsync(valid, TimeSpan.FromSeconds(2)) == "s1.kms.cx:1688");
});
await Test("oversized server body fails closed to the fixed fallback", async () => {
 using var client = new HttpClient(new ResponseFixture(new MemoryStream(new byte[65537])));
 Assert(await ActivationSource.ResolveAsync(client, TimeSpan.FromSeconds(2)) == "k.302.pub");
});
ProcessStartInfo ProbeStart(string? marker = null) {
 var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
 if (Path.GetFileNameWithoutExtension(start.FileName).Equals("dotnet", StringComparison.OrdinalIgnoreCase)) start.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
 start.ArgumentList.Add("--probe-fixture");
 if (marker != null) start.ArgumentList.Add(marker);
 return start;
}
await Test("hung read-only probe is bounded and only its child is stopped", async () => {
 var marker = Path.Combine(Path.GetTempPath(), "office-probe-" + Guid.NewGuid() + ".txt");
 var watch = Stopwatch.StartNew();
 try {
  try { await ExecutionSafety.RunProbeAsync(ProbeStart(marker), TimeSpan.FromSeconds(1), "POWERSHELL_UNAVAILABLE"); throw new Exception("probe unexpectedly completed"); }
  catch (OfficeFailure failure) { Assert(failure.Code == "PROBE_TIMEOUT"); }
  Assert(watch.Elapsed < TimeSpan.FromSeconds(4) && File.Exists(marker));
  var pid = int.Parse(await File.ReadAllTextAsync(marker), CultureInfo.InvariantCulture);
  try { using var child = Process.GetProcessById(pid); Assert(child.HasExited); } catch (ArgumentException) { }
  var retry = await ExecutionSafety.RunProbeAsync(ProbeStart(), TimeSpan.FromSeconds(5), "POWERSHELL_UNAVAILABLE");
  Assert(retry.Exit == 0 && retry.Output == "probe complete");
 } finally { File.Delete(marker); }
});
await Test("missing probe dependency has an explicit recoverable error", async () => {
 var missing = new ProcessStartInfo(Path.Combine(Path.GetTempPath(), "office-missing-" + Guid.NewGuid())) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
 try { await ExecutionSafety.RunProbeAsync(missing, TimeSpan.FromSeconds(1), "POWERSHELL_UNAVAILABLE"); throw new Exception("missing dependency started"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "POWERSHELL_UNAVAILABLE"); }
});
await Test("safe worker interruption is resumable in both current and reopened views", async () => {
 var current = New(); current.Stage = Stage.Download;
 var reopened = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(current, Reports.Json), Reports.Json)!;
 ExecutionSafety.MarkWorkerInterrupted(current); ExecutionSafety.MarkWorkerInterrupted(reopened);
 Assert(current.Status == JobStatus.Failed && reopened.Status == current.Status && reopened.Code == current.Code);
 var f = new Fake(); await Run(f, current, true);
 Assert(current.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1);
});
await Test("confirmed removal interruption resumes installation without another removal", async () => {
 var job = New(); job.Stage = Stage.Install; job.RemovalStarted = true; job.Removed = true;
 ExecutionSafety.MarkWorkerInterrupted(job); var f = new Fake { Inventory = Fake.Empty }; await Run(f, job, true);
 Assert(job.Status == JobStatus.Completed && f.Removes == 0 && f.Installs == 1);
});
await Test("uncertain removal stays review-required in both observed views", () => {
 var job = New(); job.Stage = Stage.Remove; job.RemovalStarted = true;
 var reopened = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(job, Reports.Json), Reports.Json)!;
 ExecutionSafety.MarkWorkerInterrupted(job); ExecutionSafety.MarkWorkerInterrupted(reopened);
 Assert(job.Status == JobStatus.NeedsReview && job.Code == "REMOVAL_UNKNOWN" && reopened.Status == job.Status && reopened.Code == job.Code);
 return Task.CompletedTask;
});
await Test("terminal worker results keep restart and failure boundaries", () => {
 foreach (var status in new[] { JobStatus.Completed, JobStatus.AwaitingRestart, JobStatus.NeedsReview, JobStatus.InstalledUnlicensed, JobStatus.ComponentMissing }) {
  var job = New(); job.Status = status; job.Code = "existing"; job.RestartBoot = "same-boot";
  ExecutionSafety.MarkWorkerInterrupted(job); Assert(job.Status == status && job.Code == "existing" && job.RestartBoot == "same-boot");
 }
 return Task.CompletedTask;
});
await Test("reboot checkpoint uses pre-removal boot even if later BootId queries fail", async () => {
 var f = new Fake { RemoveExit = 3010, FailBootAfterMutation = true }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.AwaitingRestart && job.RestartBoot == "1000" && job.InstallerBoot == "1000" && job.InstallerExitCode == 3010 && f.BootReads == 1);
 Assert(f.Saved!.Status == JobStatus.AwaitingRestart && f.Saved.RestartBoot == "1000");
});
await Test("reboot checkpoint uses pre-installation boot without any post-return query", async () => {
 var f = new Fake { Inventory = Fake.Empty, InstallExit = 1641, FailBootAfterMutation = true }; var job = New(); job.ExpectedFingerprint = f.Inventory.Fingerprint;
 await Run(f, job);
 Assert(job.Status == JobStatus.AwaitingRestart && job.RestartBoot == "1000" && job.InstallerExitCode == 1641 && f.BootReads == 1 && f.Removes == 0);
});
await Test("known reboot exit interrupted before pause keeps the same boot in both views", async () => {
 var job = New(); job.Stage = Stage.Install; job.Removed = true; job.InstallerBoot = "1000"; job.InstallerExitCode = 3010;
 var reopened = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(job, Reports.Json), Reports.Json)!;
 ExecutionSafety.MarkWorkerInterrupted(job); ExecutionSafety.MarkWorkerInterrupted(reopened);
 Assert(job.Status == JobStatus.AwaitingRestart && reopened.Status == job.Status && job.RestartBoot == "1000" && reopened.RestartBoot == "1000");
 try { await ExecutionSafety.VerifyRestartAsync(reopened, () => Task.FromResult("1000")); throw new Exception("same-boot new launch allowed"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "RESTART_REQUIRED"); }
 var f = new Fake { Inventory = Fake.Empty }; await Run(f, job, true);
 Assert(job.Status == JobStatus.AwaitingRestart && f.Installs == 0 && f.Removes == 0);
});
await Test("persisted reboot checkpoint remains gated after worker loss", async () => {
 var job = New(); job.InstallerBoot = "1000"; job.InstallerExitCode = 1641;
 JobRecord? stored = null;
 await ExecutionSafety.RecordInstallerRestartAsync(job, record => { stored = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(record, Reports.Json), Reports.Json); return Task.CompletedTask; });
 ExecutionSafety.MarkWorkerInterrupted(stored!);
 Assert(stored!.Status == JobStatus.AwaitingRestart && stored.RestartBoot == "1000");
 try { await ExecutionSafety.VerifyRestartAsync(stored, () => Task.FromResult("1000")); throw new Exception("same-boot launch allowed"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "RESTART_REQUIRED"); }
});
await Test("legacy reboot exit without trusted checkpoint blocks resume and new launch", async () => {
 foreach (var exit in new[] { 3010, 1641 }) {
  var job = New(); job.Removed = true; job.Stage = Stage.Install; job.InstallerExitCode = exit;
  Assert(ExecutionSafety.RestartCheckpointError(job) == "RESTART_CHECKPOINT_MISSING");
  try { await ExecutionSafety.VerifyRestartAsync(job, () => Task.FromResult("2000")); throw new Exception("legacy new launch allowed"); }
  catch (OfficeFailure failure) { Assert(failure.Code == "RESTART_CHECKPOINT_MISSING"); }
  var f = new Fake { Inventory = Fake.Empty, Boot = "2000" }; await Run(f, job, true);
  Assert(job.Status == JobStatus.NeedsReview && job.Code == "RESTART_CHECKPOINT_MISSING" && f.Installs == 0 && f.Removes == 0 && f.BootReads == 0);
 }
});
await Test("different boot verifies restart and preserves the real exit code", async () => {
 var job = New(); job.InstallerBoot = "1000"; job.RestartBoot = "1000"; job.InstallerExitCode = 3010;
 Assert(await ExecutionSafety.VerifyRestartAsync(job, () => Task.FromResult("2000")) && job.RestartBoot == null && job.RestartVerifiedBoot == "2000" && job.InstallerExitCode == 3010);
 Assert(!await ExecutionSafety.VerifyRestartAsync(job, () => throw new Exception("already verified restart queried again")));
 ExecutionSafety.MarkWorkerInterrupted(job); Assert(job.Status == JobStatus.Failed && job.Code == "WORKER_INTERRUPTED");
});
await Test("invalid pre-installer boot prevents mutation and leaves old evidence", async () => {
 var f = new Fake { Boot = "invalid" }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.Failed && f.Removes == 0 && f.Installs == 0 && !job.RemovalStarted && job.InstallerBoot == null);
});
await Test("installer startup checkpoint is persisted before its operation", async () => {
 var job = New(); job.InstallerExitCode = 3010; job.RestartVerifiedBoot = "2000";
 var saved = false;
 await ExecutionSafety.RecordInstallerStartAsync(job, () => Task.FromResult("2000"), record => { saved = record.InstallerBoot == "2000" && record.InstallerExitCode == null && record.RestartVerifiedBoot == null; return Task.CompletedTask; });
 Assert(saved && job.RestartBoot == null);
});
await Test("actual OneDrive reboot uses its own pre-installer boot", async () => {
 var f = new Fake { OneDriveNeedsInstall = true, OneDriveExit = 3010 }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.AwaitingRestart && job.RestartBoot == "1000" && job.InstallerExitCode == 3010 && f.OneDriveRuns == 1);
 f.Boot = "2000"; await Run(f, job, true);
 Assert(job.Status == JobStatus.Completed && f.OneDriveRuns == 1 && f.Installs == 1 && f.Removes == 1 && job.InstallerExitCode == 3010 && job.RestartVerifiedBoot == "2000");
});
await Test("existing OneDrive preserves Office installer restart evidence", async () => {
 var f = new Fake { InstallExit = 3010 }; var job = await Run(f, New()); f.Boot = "2000"; await Run(f, job, true);
 Assert(job.Status == JobStatus.Completed && f.OneDriveRuns == 0 && job.InstallerExitCode == 3010 && job.InstallerBoot == "1000" && job.RestartVerifiedBoot == "2000");
});
await Test("lost installer result blocks same-boot launch without inventing a restart code", async () => {
 var job = New(); job.Stage = Stage.Install; job.InstallerBoot = "1000"; job.InstallerStarted = true; job.Removed = true;
 ExecutionSafety.MarkWorkerInterrupted(job);
 Assert(job.Status == JobStatus.NeedsReview && job.Code == "INSTALLER_RESULT_UNKNOWN" && job.InstallerExitCode == null);
 try { await ExecutionSafety.VerifyRestartAsync(job, () => Task.FromResult("1000"), () => Task.FromResult(Fake.Empty)); throw new Exception("unknown same-boot launch allowed"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "INSTALLER_RESULT_UNKNOWN"); }
});
await Test("unknown removal with residual Office never replays after reboot", async () => {
 var job = New(); job.Stage = Stage.Remove; job.InstallerBoot = "1000"; job.InstallerStarted = true; job.RemovalStarted = true;
 var f = new Fake { Boot = "2000" }; await Run(f, job, true);
 Assert(job.Status == JobStatus.NeedsReview && job.Code == "REMOVAL_UNKNOWN" && f.Removes == 0 && f.Installs == 0 && job.InstallerStarted);
});
await Test("unknown removal confirmed absent after reboot resumes installation only", async () => {
 var job = New(); job.Stage = Stage.Remove; job.InstallerBoot = "1000"; job.InstallerStarted = true; job.RemovalStarted = true;
 var f = new Fake { Boot = "2000", Inventory = Fake.Empty }; await Run(f, job, true);
 Assert(job.Status == JobStatus.Completed && f.Removes == 0 && f.Installs == 1);
});
await Test("lost installation result after reboot uses fresh target without reinstalling", async () => {
 var job = New(); job.Stage = Stage.Install; job.InstallerBoot = "1000"; job.InstallerStarted = true; job.Removed = true;
 var f = new Fake { Boot = "2000", Inventory = Fake.Ready }; await Run(f, job, true);
 Assert(job.Status == JobStatus.Completed && f.Removes == 0 && f.Installs == 0 && job.InstallerExitCode == null && job.RestartVerifiedBoot == "2000");
});
await Test("download and successful completed tasks do not gain unknown-result gates", () => {
 var download = New(); download.Stage = Stage.Download; download.InstallerBoot = "1000"; download.InstallerStarted = true;
 ExecutionSafety.MarkWorkerInterrupted(download); Assert(download.Status == JobStatus.Failed && ExecutionSafety.RestartCheckpointError(download) == null);
 var complete = New(); complete.Stage = Stage.Finished; complete.Status = JobStatus.Completed; complete.InstallerBoot = "1000"; complete.InstallerExitCode = 0;
 Assert(ExecutionSafety.RestartCheckpointError(complete) == null);
 return Task.CompletedTask;
});
await Test("failed post-installer write leaves a conservative durable startup checkpoint", async () => {
 var job = New(); job.Stage = Stage.Install;
 JobRecord? persisted = null;
 await ExecutionSafety.RecordInstallerStartAsync(job, () => Task.FromResult("1000"), record => { persisted = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(record, Reports.Json), Reports.Json); return Task.CompletedTask; });
 try { await ExecutionSafety.RecordInstallerExitAsync(job, 3010, _ => throw new IOException("simulated atomic save failure")); throw new Exception("write failure hidden"); } catch (IOException) { }
 ExecutionSafety.MarkWorkerInterrupted(persisted!);
 Assert(persisted!.Status == JobStatus.NeedsReview && persisted.Code == "INSTALLER_RESULT_UNKNOWN" && persisted.InstallerExitCode == null);
});
await Test("only the verified idle MSI service PID can be excluded", () => {
 Assert(InstallerSafety.IsVerifiedIdleServiceProcess(100, new(100, 4, 1)));
 Assert(!InstallerSafety.IsVerifiedIdleServiceProcess(101, new(100, 4, 1)) && !InstallerSafety.IsVerifiedIdleServiceProcess(100, null));
 Assert(!InstallerSafety.IsVerifiedIdleServiceProcess(100, new(100, 4, 0)) && !InstallerSafety.IsVerifiedIdleServiceProcess(100, new(100, 4, 4)) && !InstallerSafety.IsVerifiedIdleServiceProcess(100, new(100, 3, 1)));
 return Task.CompletedTask;
});
await Test("installer settlement waits for every actual blocker to disappear", async () => {
 var job = New(); job.Installed = true;
 var queue = new Queue<Inventory>([Fake.Ready with { Installers = ["OfficeC2RClient", "msiexec"] }, Fake.Ready with { Installers = ["OfficeC2RClient"] }, Fake.Ready]);
 int reads = 0, observations = 0;
 var result = await InstallerSafety.WaitForClearAsync(job, () => { reads++; return Task.FromResult(queue.Dequeue()); }, _ => { observations++; return Task.CompletedTask; }, default, TimeSpan.FromSeconds(1), TimeSpan.FromMilliseconds(1));
 Assert(reads == 3 && observations == 3 && result.Installers.Length == 0 && job.Installed);
});
await Test("persistent installer settlement times out without losing installation", async () => {
 var job = New(); job.Installed = true;
 try { await InstallerSafety.WaitForClearAsync(job, () => Task.FromResult(Fake.Ready with { Installers = ["OfficeC2RClient"] }), _ => Task.CompletedTask, default, TimeSpan.FromMilliseconds(20), TimeSpan.FromMilliseconds(1)); throw new Exception("busy installer bypassed"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "INSTALLER_BUSY" && job.Installed); }
});
await Test("settlement cancellation leaves installation and never invokes an operation", async () => {
 var job = New(); job.Installed = true; using var cancel = new CancellationTokenSource();
 try { await InstallerSafety.WaitForClearAsync(job, () => Task.FromResult(Fake.Ready with { Installers = ["msiexec"] }), _ => { cancel.Cancel(); return Task.CompletedTask; }, cancel.Token); throw new Exception("cancellation ignored"); }
 catch (OperationCanceledException) { Assert(job.Installed); }
});
await Test("foreign products or open documents during settlement stop continuation", async () => {
 foreach (var observation in new[] { Fake.Ready with { OfficeProducts = ["ProPlus2024Volume", "SkypeforBusiness2024Volume", "VisioPro2024Volume"] }, Fake.Ready with { OpenApps = ["WINWORD"] } }) {
  try { await InstallerSafety.WaitForClearAsync(New(), () => Task.FromResult(observation), _ => Task.CompletedTask, default); throw new Exception("changed environment allowed"); }
  catch (OfficeFailure failure) { Assert(failure.Code is "ENVIRONMENT_CHANGED" or "APPS_OPEN"); }
 }
});
await Test("settlement deadline also bounds a hung inspection", async () => {
 var pending = new TaskCompletionSource<Inventory>(TaskCreationOptions.RunContinuationsAsynchronously);
 var watch = Stopwatch.StartNew();
 try { await InstallerSafety.WaitForClearAsync(New(), () => pending.Task, _ => Task.CompletedTask, default, TimeSpan.FromMilliseconds(20)); throw new Exception("hung detection allowed"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "INSTALLER_BUSY" && watch.Elapsed < TimeSpan.FromSeconds(1)); }
 finally { pending.TrySetResult(Fake.Ready); }
});
await Test("installation display is silent while external acceptance remains explicit", () => {
 var config = XDocument.Parse(Configuration.Install("media", "en-us"));
 Assert((string?)config.Root!.Element("Display")!.Attribute("Level") == "None" && (string?)config.Root.Element("Display")!.Attribute("AcceptEULA") == "TRUE");
 var removal = XDocument.Parse(Configuration.Remove());
 Assert((string?)removal.Root!.Element("Display")!.Attribute("Level") == "Full" && removal.Root.Element("Display")!.Attribute("AcceptEULA") == null);
 return Task.CompletedTask;
});
await Test("complete install waits for settlement before activating and never repeats removal", async () => {
 var f = new Fake { BusyAfterInstallReads = 4 }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1 && f.Activations == 1 && job.Events.Any(e => e.Code == "WAITING_INSTALLERS"));
});
await Test("cancelling settlement keeps installed Office and skips activation", async () => {
 using var cancel = new CancellationTokenSource(); var f = new Fake { BusyAfterInstallReads = 5, CancelOnWait = cancel }; var job = await Run(f, New(), token: cancel.Token);
 Assert(job.Status == JobStatus.Cancelled && job.Installed && f.Removes == 1 && f.Installs == 1 && f.Activations == 0);
});
await Test("partial unknown installation after reboot is checked then repaired without removal", async () => {
 var job = New(); job.Stage = Stage.Install; job.InstallerBoot = "1000"; job.InstallerStarted = true; job.Removed = true;
 var f = new Fake { Boot = "2000", Inventory = Fake.Ready with { Components = Fake.Ready.Components.Where(c => c.Id != "Lync").ToArray() } };
 await Run(f, job, true); Assert(job.Status == JobStatus.Completed && f.Removes == 0 && f.Installs == 1 && f.Activations == 1);
});
await Test("cancellation during boot checkpoint cannot start removal or invent unknown result", async () => {
 using var cancel = new CancellationTokenSource(); var f = new Fake { CancelOnBoot = cancel }; var job = await Run(f, New(), token: cancel.Token);
 Assert(job.Status == JobStatus.Cancelled && f.Removes == 0 && f.Installs == 0 && !job.InstallerStarted && ExecutionSafety.RestartCheckpointError(job) == null);
});
await Test("unknown existing license state blocks activation without modifying licenses", async () => {
 var f = new Fake { Inventory = Fake.Ready with { Licenses = Fake.ValidLicenses, LicenseError = "PROBE_TIMEOUT" } };
 var job = await Run(f, New(ActionKind.Activate));
 Assert(job.Status == JobStatus.Failed && job.Code == "PROBE_TIMEOUT" && f.Activations == 0 && f.Removes == 0 && f.Installs == 0 && f.Inventory.Licenses.SequenceEqual(Fake.ValidLicenses));
});
await Test("post-activation license read error cannot report licensed or unlicensed", async () => {
 var f = new Fake { LicenseErrorAfterActivation = true }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.Failed && job.Code == "LICENSE_CHECK_FAILED" && job.Installed && f.Removes == 1 && f.Installs == 1 && f.Activations == 1);
 Assert(job.Observation!.Licenses.SequenceEqual(Fake.ValidLicenses) && job.Observation.LicenseError == "LICENSE_CHECK_FAILED");
});
await Test("activation exception followed by unreadable license keeps installation and can retry later", async () => {
 var f = new Fake { ActivationFails = true, LicenseErrorAfterActivation = true }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.Failed && job.Code == "LICENSE_CHECK_FAILED" && job.Installed && f.Removes == 1 && f.Installs == 1 && f.Activations == 1);
 f.ActivationFails = false; f.LicenseErrorAfterActivation = false; f.Inventory = f.Inventory with { LicenseError = "" };
 var retry = await Run(f, New(ActionKind.Activate));
 Assert(retry.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1 && f.Activations == 2);
});
Console.WriteLine($"FINAL: {passed} meaningful workflow checks passed; Office boundaries are synthetic.");

sealed class ResponseFixture(Stream body) : HttpMessageHandler {
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
  => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(body) });
}
sealed class StalledBody : Stream {
 public override bool CanRead => true;
 public override bool CanSeek => false;
 public override bool CanWrite => false;
 public override long Length => throw new NotSupportedException();
 public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
 public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) { await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken); return 0; }
 public override void Flush() => throw new NotSupportedException();
 public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
 public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
 public override void SetLength(long value) => throw new NotSupportedException();
 public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}

sealed class Fake : IOfficePlatform, IJobStore {
 public static readonly Inventory Old = new("Windows 11", "X64", ["ProPlus2021Volume", "VisioPro2021Volume", "ProjectPro2021Volume"], [], [], [], [], [], [], DateTimeOffset.UtcNow);
 public static readonly Inventory Empty = Old with { OfficeProducts = [] };
 public static readonly Inventory Ready = Empty with { OfficeProducts = ["ProPlus2024Volume", "SkypeforBusiness2024Volume"], Platform = "x64", OfficeVersion = "16.0.1.1", SuiteLanguages = ["en-us"], SkypeLanguages = ["en-us"], Components = Policy.Components.Select(id => new ComponentState(id, true)).ToArray() };
 public static readonly LicenseState[] ValidLicenses = [new("ProPlus2024Volume", 1, 259200), new("SkypeforBusiness2024Volume", 1, 259200)];
 public Inventory Inventory = Old;
 public bool DownloadFails, MediaFails, MissingSkype, ActivationFails, WrongLicense, OnlySuiteLicense, ChangeAfterDownload, LeaveProducts, ForeignAfterRemove;
 public bool WrongPlatform, WrongLanguage, MissingSkypeSku, LostDuringActivation, LicenseErrorAfterActivation;
 public int Removes, Installs, Activations, Downloads, RemoveExit, InstallExit;
 public string Boot = "1000";
 public int BootReads, OneDriveRuns, OneDriveExit;
 public int BusyAfterInstallReads;
 public bool FailBootAfterMutation, OneDriveNeedsInstall;
 public JobRecord? Saved;
 public CancellationTokenSource? CancelAfterRemove;
 public CancellationTokenSource? CancelAfterInstall;
 public CancellationTokenSource? CancelOnWait, CancelOnBoot;
 public Task<Inventory> InspectAsync() { if (Installs > 0 && BusyAfterInstallReads-- > 0) return Task.FromResult(Inventory with { Installers = ["OfficeC2RClient", "msiexec"] }); return Task.FromResult(Inventory); }
 public Task<string> BootIdAsync() { BootReads++; CancelOnBoot?.Cancel(); if (FailBootAfterMutation && Removes + Installs + OneDriveRuns > 0) throw new OfficeFailure("INSPECTION_FAILED"); return Task.FromResult(Boot); }
 public Task SaveAsync(JobRecord job) { Saved = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(job, Reports.Json), Reports.Json); if (job.Code == "WAITING_INSTALLERS") CancelOnWait?.Cancel(); return Task.CompletedTask; }
 public Task<MediaState> PrepareAsync(JobRecord job, CancellationToken cancellation) { Downloads++; if (DownloadFails) throw new OfficeFailure("DOWNLOAD_FAILED"); if (ChangeAfterDownload) Inventory = Old with { OfficeProducts = ["Different"] }; return Task.FromResult(new MediaState("16.0.1.1", "hash", [])); }
 public Task VerifyMediaAsync(JobRecord job) { if (MediaFails) throw new OfficeFailure("MEDIA_CHANGED"); return Task.CompletedTask; }
 public Task PrepareRemovalAsync(JobRecord job, CancellationToken cancellation) => Task.CompletedTask;
 public Task<int> RemoveAsync(JobRecord job) { Removes++; if (!LeaveProducts) Inventory = ForeignAfterRemove ? Empty with { OfficeProducts = ["Foreign"] } : Empty; CancelAfterRemove?.Cancel(); return Task.FromResult(RemoveExit); }
 public Task<int> InstallAsync(JobRecord job) {
  Installs++; Inventory = MissingSkype ? Ready with { Components = Ready.Components.Select(x => x.Id == "Lync" ? x with { Present = false } : x).ToArray() } : Ready;
  if (WrongPlatform) Inventory = Inventory with { Platform = "x86" };
  if (WrongLanguage) Inventory = Inventory with { SuiteLanguages = ["it-it"] };
  if (MissingSkypeSku) Inventory = Inventory with { OfficeProducts = ["ProPlus2024Volume"] };
  if (OneDriveNeedsInstall) Inventory = Inventory with { Components = Inventory.Components.Select(c => c.Id == "OneDrive" ? c with { Present = false } : c).ToArray() };
  CancelAfterInstall?.Cancel(); return Task.FromResult(InstallExit);
 }
 public async Task EnsureOneDriveAsync(JobRecord job, CancellationToken cancellation) {
  if (!OneDriveNeedsInstall) return;
  await ExecutionSafety.RecordInstallerStartAsync(job, BootIdAsync, SaveAsync);
  OneDriveRuns++; OneDriveNeedsInstall = false; Inventory = Inventory with { Components = Inventory.Components.Select(c => c.Id == "OneDrive" ? c with { Present = true } : c).ToArray() };
  await ExecutionSafety.RecordInstallerExitAsync(job, OneDriveExit, SaveAsync);
  if (Policy.RebootExit(OneDriveExit)) throw new OfficeFailure("ONEDRIVE_RESTART_REQUIRED", OneDriveExit);
 }
 public Task ActivateAsync(JobRecord job) { Activations++; if (LicenseErrorAfterActivation) Inventory = Inventory with { LicenseError = "LICENSE_CHECK_FAILED" }; if (ActivationFails) throw new OfficeFailure("ACTIVATION_FAILED"); Inventory = Inventory with { Licenses = WrongLicense ? [new("VisioPro2024Volume", 1, 100)] : OnlySuiteLicense ? [ValidLicenses[0]] : ValidLicenses }; if (LostDuringActivation) Inventory = Inventory with { OfficeProducts = [] }; return Task.CompletedTask; }
}
