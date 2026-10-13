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
await Test("install and removal are silent without weakening agreement or app protection", () => {
 var config = XDocument.Parse(Configuration.Install("media", "en-us"));
 Assert((string?)config.Root!.Element("Display")!.Attribute("Level") == "None" && (string?)config.Root.Element("Display")!.Attribute("AcceptEULA") == "TRUE");
 var removal = XDocument.Parse(Configuration.Remove());
 Assert((string?)removal.Root!.Element("Display")!.Attribute("Level") == "None" && removal.Root.Element("Display")!.Attribute("AcceptEULA") == null);
 Assert((string?)removal.Root!.Element("Property")!.Attribute("Value") == "FALSE" && (string?)removal.Root.Element("Remove")!.Attribute("All") == "TRUE");
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
await Test("progress accepts only measured operations and valid finite counts", () => {
 var now = DateTimeOffset.UtcNow;
 var valid = new JobProgress("DOWNLOADING_TOOL", ProgressUnit.Bytes, 100000, 200000, now);
 Assert(ProgressPolicy.IsValid(valid) && ProgressPolicy.Percentage(valid) == 50);
 foreach (var invalid in new[] {
  valid with { Code = "C:\\PRIVATE\\secret.log" }, valid with { Code = "https://private.invalid/key" },
  valid with { Code = "INSTALLING_OFFICE" }, valid with { Unit = (ProgressUnit)99 }, valid with { Unit = ProgressUnit.Items },
  valid with { Completed = -1 }, valid with { Total = 0 }, valid with { Total = -1 }, valid with { Completed = 200001 },
  valid with { Total = ProgressPolicy.ToolMaximum + 1 }, valid with { Completed = long.MaxValue, Total = null },
  valid with { ObservedAt = default }, valid with { ObservedAt = now.AddMinutes(2) }
 }) Assert(!ProgressPolicy.IsValid(invalid) && ProgressPolicy.Percentage(invalid) == null);
 Assert(!ProgressPolicy.IsValid(new("DOWNLOADING_OFFICE", ProgressUnit.None, 1, null, now)));
 Assert(!ProgressPolicy.IsValid(new("VERIFYING_MEDIA", ProgressUnit.Items, 0, null, now)));
 Assert(ProgressPolicy.IsValid(new("VERIFYING_MEDIA", ProgressUnit.Items, 4098, 4098, now)));
 try { JsonSerializer.Deserialize<JobProgress>("{\"Code\":\"DOWNLOADING_TOOL\",\"Unit\":1,\"Completed\":\"NaN\",\"Total\":200000}", Reports.Json); throw new Exception("non-finite count accepted"); }
 catch (JsonException) { }
 return Task.CompletedTask;
});
await Test("unknown byte totals and ODT stages never produce estimated percentages", async () => {
 var measurements = new List<JobProgress>(); using var input = new MemoryStream(new byte[200000]); using var output = new MemoryStream();
 var received = await MeasuredCopy.CopyAsync(input, output, "DOWNLOADING_ONEDRIVE", null, ProgressPolicy.OneDriveMaximum,
  p => { measurements.Add(p); Assert(p.Completed == output.Length); return Task.CompletedTask; }, default);
 Assert(received == 200000 && output.Length == received && measurements.Last().Completed == received);
 Assert(measurements.All(p => p.Total == null && ProgressPolicy.Percentage(p) == null));
 Assert(ProgressPolicy.Percentage(new("DOWNLOADING_OFFICE", ProgressUnit.None, 0, null, DateTimeOffset.UtcNow)) == null);
});
await Test("known byte progress follows written bytes and reaches its measured total", async () => {
 var measurements = new List<JobProgress>(); using var input = new MemoryStream(new byte[200000]); using var output = new MemoryStream();
 var received = await MeasuredCopy.CopyAsync(input, output, "DOWNLOADING_TOOL", 200000, ProgressPolicy.ToolMaximum,
  p => { measurements.Add(p); Assert(p.Completed == output.Length); return Task.CompletedTask; }, default);
 Assert(received == 200000 && measurements.First().Completed == 0 && measurements.Last().Completed == received);
 Assert(ProgressPolicy.Percentage(measurements.Last()) == 100 && measurements.All(ProgressPolicy.IsValid));
});
await Test("inconsistent advertised lengths and bounded unknown streams fail closed", async () => {
 foreach (var lengths in new (int Actual, long? Expected, long Maximum)[] { (200000, 200001, ProgressPolicy.ToolMaximum), (200000, 150000, ProgressPolicy.ToolMaximum), (200000, null, 150000), (99999, null, ProgressPolicy.ToolMaximum), (200000, 200000, 150000), (200000, 0, ProgressPolicy.ToolMaximum) }) {
  using var input = new MemoryStream(new byte[lengths.Actual]); using var output = new MemoryStream();
  try { await MeasuredCopy.CopyAsync(input, output, "DOWNLOADING_TOOL", lengths.Expected, lengths.Maximum, null, default); throw new Exception("invalid download succeeded"); }
  catch (OfficeFailure failure) { Assert(failure.Code == "DOWNLOAD_FAILED" && output.Length <= lengths.Maximum); }
 }
});
await Test("an understated length never emits 100 percent before inconsistent EOF", async () => {
 using var input = new MemoryStream(new byte[200000]); using var output = new MemoryStream(); var measurements = new List<JobProgress>();
 try { await MeasuredCopy.CopyAsync(input, output, "DOWNLOADING_TOOL", 131072, ProgressPolicy.ToolMaximum,
  p => { measurements.Add(p); return Task.CompletedTask; }, default); throw new Exception("extra bytes accepted"); }
 catch (OfficeFailure failure) { Assert(failure.Code == "DOWNLOAD_FAILED"); }
 Assert(measurements.All(p => ProgressPolicy.Percentage(p) < 100) && output.Length == 131072);
});
await Test("cancelling a measured copy stops before EOF without claiming completion", async () => {
 using var cancel = new CancellationTokenSource(); using var input = new MemoryStream(new byte[200000]); using var output = new MemoryStream();
 var measurements = new List<JobProgress>();
 try { await MeasuredCopy.CopyAsync(input, output, "DOWNLOADING_TOOL", 200000, ProgressPolicy.ToolMaximum,
  p => { measurements.Add(p); if (p.Completed > 0) cancel.Cancel(); return Task.CompletedTask; }, cancel.Token); throw new Exception("cancelled transfer completed"); }
 catch (OperationCanceledException) { }
 Assert(output.Length < 200000 && measurements.Last().Completed < measurements.Last().Total);
});
await Test("progress saves are awaited and throttled with operation and completion updates", async () => {
 var job = New(); job.Stage = Stage.Download; var store = new ProgressStore(); var clock = new ProgressClock(); var recorder = new ProgressRecorder(job, store, clock);
 JobProgress Bytes(long count) => new("DOWNLOADING_TOOL", ProgressUnit.Bytes, count, 200000, DateTimeOffset.UtcNow);
 await recorder.ObserveAsync(Bytes(0)); await recorder.ObserveAsync(Bytes(0));
 await recorder.ObserveAsync(Bytes(1)); await recorder.ObserveAsync(Bytes(2)); Assert(store.Saved.Count == 1);
 clock.Advance(); await recorder.ObserveAsync(Bytes(100000)); Assert(store.Saved.Count == 2);
 await recorder.ObserveAsync(new("DOWNLOADING_OFFICE", ProgressUnit.None, 0, null, DateTimeOffset.UtcNow));
 await recorder.ObserveAsync(Bytes(0)); await recorder.ObserveAsync(Bytes(200000));
 Assert(store.Saved.Count == 5 && !store.InFlight && ProgressPolicy.Percentage(job.Progress!) == 100);
});
await Test("restarting the same verification immediately clears its previous completed count", async () => {
 var job = New(); job.Stage = Stage.Download; var store = new ProgressStore(); var recorder = new ProgressRecorder(job, store);
 await recorder.ObserveAsync(new("VERIFYING_MEDIA", ProgressUnit.Items, 2, 2, DateTimeOffset.UtcNow));
 await recorder.ObserveAsync(new("VERIFYING_MEDIA", ProgressUnit.Items, 0, 2, DateTimeOffset.UtcNow));
 Assert(store.Saved.Count == 2 && job.Progress!.Completed == 0);
});
await Test("every workflow stage and terminal result clear earlier operation progress", async () => {
 var f = new Fake { EmitProgress = true }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.Completed && job.Progress == null && f.History.Any(j => j.Progress?.Unit == ProgressUnit.Bytes));
 Assert(f.History.GroupBy(j => j.Stage).All(group => group.First().Progress == null));
 var failed = new Fake { EmitProgress = true, MediaFails = true }; var failure = await Run(failed, New());
 Assert(failure.Status == JobStatus.Failed && failure.Progress == null && failed.Removes == 0 && failed.Saved!.Progress == null);
});
await Test("download cancellation clears measured progress and never removes Office", async () => {
 using var cancel = new CancellationTokenSource(); var f = new Fake { EmitProgress = true, CancelDuringProgress = cancel }; var job = await Run(f, New(), token: cancel.Token);
 Assert(job.Status == JobStatus.Cancelled && job.Progress == null && f.Saved!.Progress == null && f.Removes == 0);
});
await Test("progress recording failure has an explicit error before destructive boundaries", async () => {
 var f = new Fake { EmitProgress = true, FailProgressSave = true }; var job = await Run(f, New());
 Assert(job.Status == JobStatus.Failed && job.Code == "JOB_RECORDING_FAILED" && job.Progress == null && f.Removes == 0 && f.Installs == 0);
});
await Test("stale, terminal and wrong-stage progress cannot be rendered or exported", () => {
 var job = New(); job.Stage = Stage.Download; job.UpdatedAt = DateTimeOffset.UtcNow;
 job.Progress = new("DOWNLOADING_TOOL", ProgressUnit.Bytes, 99000, 100000, job.UpdatedAt);
 Assert(ProgressPolicy.Current(job) != null); var fingerprint = Fake.Old.Fingerprint;
 foreach (var status in Enum.GetValues<JobStatus>().Where(s => s != JobStatus.Running)) {
  job.Status = status; Assert(ProgressPolicy.Current(job) == null);
  using var json = JsonDocument.Parse(Reports.Export(Fake.Old, job, "zh")); Assert(json.RootElement.GetProperty("task").GetProperty("Progress").ValueKind == JsonValueKind.Null);
 }
 job.Status = JobStatus.Running; job.Stage = Stage.Install; Assert(ProgressPolicy.Current(job) == null);
 job.Stage = Stage.Download; job.Progress = job.Progress with { ObservedAt = job.StartedAt.AddSeconds(-1) }; Assert(ProgressPolicy.Current(job) == null);
 Assert(Fake.Old.Fingerprint == fingerprint);
 return Task.CompletedTask;
});
await Test("exported progress contains only its allowlisted operation and counts", () => {
 var job = New(); job.Stage = Stage.Download; job.UpdatedAt = DateTimeOffset.UtcNow;
 job.Progress = new("DOWNLOADING_TOOL", ProgressUnit.Bytes, 100000, 200000, job.UpdatedAt);
 using var json = JsonDocument.Parse(Reports.Export(Fake.Old, job, "en")); var progress = json.RootElement.GetProperty("task").GetProperty("Progress");
 Assert(progress.EnumerateObject().Select(p => p.Name).Order().SequenceEqual(new[] { "Code", "Completed", "ObservedAt", "Total", "Unit" }.Order()));
 Assert(progress.GetProperty("Completed").GetInt64() == 100000 && progress.GetProperty("Total").GetInt64() == 200000);
 return Task.CompletedTask;
});
await Test("resume replaces stale progress and restores the platform observer", async () => {
 var job = New(); job.Stage = Stage.Download; job.Status = JobStatus.Failed; job.UpdatedAt = DateTimeOffset.UtcNow;
 job.Progress = new("DOWNLOADING_TOOL", ProgressUnit.Bytes, 99000, 100000, job.UpdatedAt);
 var f = new Fake { EmitProgress = true }; Func<JobProgress, Task> prior = _ => throw new Exception("stale observer used"); f.ProgressObserver = prior;
 await Run(f, job, true);
 Assert(job.Status == JobStatus.Completed && job.Progress == null && f.History.First().Progress == null && ReferenceEquals(prior, f.ProgressObserver));
});
await Test("UI suggests activation only for an owned installed-unlicensed task with targets present", () => {
 var job = New(); job.Status = JobStatus.InstalledUnlicensed; job.Installed = true;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.Activate);
 Assert(PresentationPolicy.Primary(job, Fake.Empty, true) == PrimaryOperation.InstallActivate);
 Assert(PresentationPolicy.Primary(job, Fake.Ready, false) == PrimaryOperation.InstallActivate);
 return Task.CompletedTask;
});
await Test("UI resumes settlement failure without suggesting another removal", () => {
 var job = New(); job.Status = JobStatus.Failed; job.Installed = true; job.Stage = Stage.Components; job.Code = "INSTALLER_BUSY";
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.Resume);
 return Task.CompletedTask;
});
await Test("UI resumes cancellation after a successful installer result", () => {
 var job = New(); job.Status = JobStatus.Cancelled; job.Installed = true; job.Stage = Stage.Install; job.InstallerExitCode = 0;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.Resume);
 return Task.CompletedTask;
});
await Test("UI never treats an uncertain installer result as a safe continuation", () => {
 var job = New(); job.Status = JobStatus.Failed; job.Installed = true; job.Stage = Stage.Install; job.InstallerExitCode = 500;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.InstallActivate);
 job.Status = JobStatus.NeedsReview; job.Stage = Stage.Components;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.InstallActivate);
 return Task.CompletedTask;
});
await Test("UI never converts removal failures or completed tasks to activation resume", () => {
 var job = New(ActionKind.Uninstall); job.Status = JobStatus.Failed; job.Installed = true; job.Stage = Stage.Components;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.InstallActivate);
 job = New(); job.Status = JobStatus.Completed; job.Installed = true; job.Stage = Stage.Finished;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.InstallActivate);
 return Task.CompletedTask;
});
await Test("UI repairs missing components through the original task instead of removing Office again", () => {
 var job = New(); job.Status = JobStatus.ComponentMissing; job.Installed = true; job.Stage = Stage.Components;
 Assert(PresentationPolicy.Primary(job, Fake.Ready, true) == PrimaryOperation.Resume);
 Assert(PresentationPolicy.Primary(job, Fake.Ready, false) == PrimaryOperation.InstallActivate);
 return Task.CompletedTask;
});
await Test("UI percentage never rounds incomplete bytes to one hundred", () => {
 var progress = new JobProgress("DOWNLOADING_TOOL", ProgressUnit.Bytes, 131072, 131073, DateTimeOffset.UtcNow);
 Assert(PresentationPolicy.DisplayPercentage(progress) == 99);
 Assert(PresentationPolicy.DisplayPercentage(progress with { Completed = 131073 }) == 100);
 Assert(PresentationPolicy.DisplayPercentage(progress with { Total = null }) == null);
 Assert(PresentationPolicy.DisplayPercentage(progress with { Completed = -1 }) == null);
 return Task.CompletedTask;
});
Inventory Compatible(params string[] apps) {
 var componentIds = apps.Length == 0 ? new[] { "Word" } : apps;
 var suite = componentIds.Any(OfficeSelection.SuiteComponents.Contains);
 var skype = componentIds.Contains("Lync");
 var products = new List<C2rProductState>();
 if (suite) products.Add(new(OfficeSelection.Suite, ["en-us", "it-it"], OfficeSelection.SuiteComponents.Except(componentIds).Concat(["Lync", "Groove", "OneDrive", "Teams", "Publisher"]).ToArray(), true));
 if (skype) products.Add(new(OfficeSelection.Skype, ["en-us", "it-it"], ["Groove", "OneDrive", "Teams"], true));
 return Fake.Empty with { OfficeProducts = products.Select(p => p.Id).ToArray(), C2rDetails = products.ToArray(), Platform = "x64", OfficeVersion = "16.0.1.1", SuiteLanguages = suite ? ["en-us", "it-it"] : [], SkypeLanguages = skype ? ["en-us", "it-it"] : [], Components = Policy.Components.Select(c => new ComponentState(c, componentIds.Contains(c))).ToArray() };
}
JobRecord SelectedJob(Inventory inventory, string[] components, ActionKind action = ActionKind.InstallActivate, string[]? targets = null, RemovalMode mode = RemovalMode.Selected) => new() { Schema = 2, Id = Guid.NewGuid(), Action = action, Language = "en-us", Server = "k.302.pub", ExpectedFingerprint = inventory.Fingerprint, SelectedComponents = components, RemovalTargets = targets, RemovalMode = mode };
await Test("schema2 partial installation retains installed unselected apps and all languages", async () => {
 var f = new Fake { Inventory = Compatible("Word") }; var j = SelectedJob(f.Inventory, ["Excel"]); await Run(f, j);
 Assert(j.Status == JobStatus.Completed && f.Removes == 0 && f.Activations == 1 && OfficeSelection.ComponentsPresent(f.Inventory, ["Word", "Excel"]) && f.Inventory.C2rDetails.Single().Languages.SequenceEqual(["en-us", "it-it"]));
 var xml = XDocument.Parse(Configuration.Selected("media", j, j.Media!.Version));
 Assert(xml.Descendants("Language").Count() == 2 && !xml.Descendants("Remove").Any() && !xml.Descendants("RemoveMSI").Any());
});
await Test("schema2 incompatible MSI or foreign Office blocks before downloads or removals", async () => {
 foreach (var inventory in new[] { Compatible("Word") with { MsiProducts = ["Microsoft Office 2016"] }, Compatible("Word") with { OfficeProducts = [OfficeSelection.Suite, "VisioPro2021Volume"] }, Compatible("Word") with { Platform = "x86" } }) {
  var f = new Fake { Inventory = inventory }; var j = SelectedJob(inventory, ["Excel"]); await Run(f, j); Assert(j.Code == "OFFICE_INCOMPATIBLE" && f.Downloads == 0 && f.Removes == 0 && f.Installs == 0);
 }
});
await Test("schema2 unknown exclusions fail closed without modifying Office", async () => {
 var inventory = Compatible("Word") with { C2rDetails = [] }; var f = new Fake { Inventory = inventory }; var j = SelectedJob(inventory, ["Excel"]); await Run(f, j); Assert(j.Code == "OFFICE_CONFIGURATION_UNKNOWN" && f.Installs == 0);
});
await Test("schema2 individual suite removal retains other applications languages and Skype SKU", async () => {
 var f = new Fake { Inventory = Compatible("Word", "Excel", "Lync") }; var j = SelectedJob(f.Inventory, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]); await Run(f, j);
 Assert(j.Status == JobStatus.Completed && OfficeSelection.ComponentsPresent(f.Inventory, ["Word", "Lync"]) && !OfficeSelection.ComponentsPresent(f.Inventory, ["Excel"]) && f.Inventory.OfficeProducts.Contains(OfficeSelection.Skype));
 var xml = XDocument.Parse(Configuration.Selected("media", j, "16.0.1.1", true)); Assert(!xml.Descendants("Remove").Any() && xml.Descendants("Language").Any(l => (string?)l.Attribute("ID") == "it-it") && (string?)xml.Root!.Element("Add")!.Attribute("Version") == "16.0.1.1");
});
await Test("schema2 last suite app removal removes only suite and leaves independent Skype", async () => {
 var f = new Fake { Inventory = Compatible("Word", "Lync") }; var j = SelectedJob(f.Inventory, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Word"]); await Run(f, j);
 Assert(j.Status == JobStatus.Completed && !f.Inventory.OfficeProducts.Contains(OfficeSelection.Suite) && f.Inventory.OfficeProducts.Contains(OfficeSelection.Skype));
 var xml = XDocument.Parse(Configuration.Selected("media", j, null, true)); Assert((string?)xml.Root!.Element("Remove")!.Attribute("All") == "FALSE" && xml.Descendants("Remove").Descendants("Product").Single().Attribute("ID")!.Value == OfficeSelection.Suite && !xml.Descendants("RemoveMSI").Any());
});
await Test("schema2 exact foreign C2R removal preserves unrelated Office products", async () => {
 var f = new Fake { Inventory = Compatible("Word") with { OfficeProducts = [OfficeSelection.Suite, "VisioPro2021Volume", "ProjectPro2021Volume"] } }; var j = SelectedJob(f.Inventory, ["Word"], ActionKind.Uninstall, ["c2r-product:VisioPro2021Volume"]); await Run(f, j); Assert(j.Status == JobStatus.Completed && f.Inventory.OfficeProducts.SequenceEqual([OfficeSelection.Suite, "ProjectPro2021Volume"]));
});
await Test("schema2 selected MSI uses only verified exact GUID and preserves other MSI", async () => {
 var a = new MsiProductState("{11111111-1111-1111-1111-111111111111}", "Microsoft Office 2016", true); var b = new MsiProductState("{22222222-2222-2222-2222-222222222222}", "Microsoft Visio 2016", true);
 var f = new Fake { Inventory = Fake.Empty with { MsiProducts = [a.DisplayName, b.DisplayName], MsiDetails = [a, b] } }; var j = SelectedJob(f.Inventory, ["Word"], ActionKind.Uninstall, ["msi:" + a.ProductCode]); await Run(f, j); Assert(j.Status == JobStatus.Completed && f.Inventory.MsiDetails.SequenceEqual([b]));
 var unsupported = f.Inventory with { MsiDetails = [b with { Verified = false }] }; var u = new Fake { Inventory = unsupported }; var rejected = SelectedJob(unsupported, ["Word"], ActionKind.Uninstall, ["msi:" + b.ProductCode]); await Run(u, rejected); Assert(rejected.Code == "MSI_IDENTITY_UNVERIFIED" && u.Removes == 0);
});
await Test("schema2 all mode freezes exact IDs preserves OneDrive and contains no broad removal", async () => {
 var od = new OneDriveState("onedrive:user:" + new string('A', 64), "user", "sid", "profile/OneDrive.exe", "1", true, "");
 var baseline = Compatible("Word") with { OneDriveDetails = [od], Components = Policy.Components.Select(c => new ComponentState(c, c is "Word" or "OneDrive")).ToArray() };
 var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-product:" + OfficeSelection.Suite], RemovalMode.All); await Run(f, j);
 Assert(j.Status == JobStatus.Completed && f.Inventory.OneDriveDetails.SequenceEqual([od]) && j.SelectionPlan!.OneDriveIds.Length == 0 && j.SelectionPlan.RemoveProducts.SequenceEqual([OfficeSelection.Suite]));
 var invalid = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, [od.Id], RemovalMode.All); await Run(new Fake { Inventory = baseline }, invalid); Assert(invalid.Code == "REMOVAL_SELECTION_INVALID");
});
await Test("schema2 OneDrive explicit user selection removes only detected app and machine scope is unsupported", async () => {
 var od = new OneDriveState("onedrive:user:" + new string('A', 64), "user", "sid", "profile/OneDrive.exe", "1", true, "");
 var baseline = Compatible("Word") with { OneDriveDetails = [od] }; var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["OneDrive"], ActionKind.Uninstall, [od.Id]); await Run(f, j); Assert(j.Status == JobStatus.Completed && f.Inventory.OfficeProducts.Contains(OfficeSelection.Suite) && f.Inventory.OneDriveDetails.Length == 0);
 var machine = od with { Id = "onedrive:machine:" + new string('B', 64), Scope = "machine", Supported = false, ReasonCode = "ONEDRIVE_SCOPE_UNSUPPORTED" }; var unsupported = baseline with { OneDriveDetails = [machine] }; var u = new Fake { Inventory = unsupported }; var rejected = SelectedJob(unsupported, ["OneDrive"], ActionKind.Uninstall, [machine.Id]); await Run(u, rejected); Assert(rejected.Code == "ONEDRIVE_SCOPE_UNSUPPORTED" && u.Removes == 0 && OfficeSelection.GetRemovalOptions(unsupported).Single(o => o.RawKind == "onedrive-machine").Supported == false);
});
await Test("schema2 OneDrive-only installation requires no Office products or activation", async () => {
 var f = new Fake { Inventory = Fake.Empty, OneDriveNeedsInstall = true }; var j = SelectedJob(f.Inventory, ["OneDrive"]); await Run(f, j); Assert(j.Status == JobStatus.Completed && f.Installs == 0 && f.Activations == 0 && OfficeSelection.RequiredProducts(["OneDrive"]).Length == 0);
});
await Test("schema2 requested product licensing ignores unrelated absent Skype", () => { var inventory = Compatible("Word") with { Licenses = [Fake.ValidLicenses[0]] }; Assert(OfficeSelection.InstalledForSelection(inventory, ["Word"]) && OfficeSelection.LicensedForSelection(inventory, ["Word"]) && !OfficeSelection.LicensedForSelection(inventory, ["Word", "Lync"]) && OfficeSelection.LicensedForSelection(inventory with { LicenseError = "bad" }, ["OneDrive"])); return Task.CompletedTask; });
await Test("schema2 arbitrary duplicate empty selection and targets are rejected", () => {
 foreach (var selected in new[] { Array.Empty<string>(), new[] { "Word", "Word" }, new[] { "Word;evil" } }) { try { Policy.Validate(new(Guid.NewGuid(), ActionKind.InstallActivate, "en-us", "k.302.pub", new string('A', 64)) { SelectedComponents = selected }); throw new Exception("invalid selection accepted"); } catch (OfficeFailure e) { Assert(e.Code == "SELECTION_INVALID"); } }
 try { Policy.Validate(new(Guid.NewGuid(), ActionKind.Uninstall, "en-us", "k.302.pub", new string('A', 64)) { RemovalMode = RemovalMode.Selected, RemovalTargets = ["msi:display-name"] }); throw new Exception("invalid target accepted"); } catch (OfficeFailure e) { Assert(e.Code == "REMOVAL_SELECTION_INVALID"); }
 return Task.CompletedTask;
});
await Test("schema2 frozen selections survive serialization and reject changed resume payload", () => {
 var j = SelectedJob(Compatible("Word"), ["Excel"]); j.SelectionPlan = OfficeSelection.Freeze(j, Compatible("Word")); var restored = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(j, Reports.Json), Reports.Json)!; OfficeSelection.ValidatePlan(restored);
 var request = new JobRequest(j.Id, j.Action, j.Language, j.Server, j.ExpectedFingerprint, true) { SelectedComponents = ["Word"], RemovalMode = j.RemovalMode };
 try { OfficeSelection.ValidateResume(restored, request); throw new Exception("selection mutated"); } catch (OfficeFailure e) { Assert(e.Code == "RESUME_SELECTION_CHANGED"); }
 return Task.CompletedTask;
});
await Test("schema2 inventory app MSI and OneDrive changes invalidate confirmation", () => {
 var baseline = Compatible("Word"); Assert(baseline.Fingerprint != (baseline with { Components = [] }).Fingerprint && baseline.Fingerprint != (baseline with { MsiDetails = [new("{11111111-1111-1111-1111-111111111111}", "Office", true)] }).Fingerprint && baseline.Fingerprint != (baseline with { OneDriveDetails = [new("onedrive:user:" + new string('A', 64), "user", "sid", "path", "version", true, "")] }).Fingerprint); return Task.CompletedTask;
});
await Test("schema2 fresh unconfirmed product during preparation stops all removal", async () => {
 var baseline = Compatible("Word"); var f = new Fake { Inventory = baseline, ChangeAfterRemovalPreparation = true }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-product:" + OfficeSelection.Suite], RemovalMode.All); await Run(f, j); Assert(j.Code == "ENVIRONMENT_CHANGED" && f.Removes == 0);
});
await Test("schema2 cancellation after removal records completed facts and never activates", async () => {
 using var token = new CancellationTokenSource(); var baseline = Compatible("Word", "Excel"); var f = new Fake { Inventory = baseline, CancelAfterRemove = token }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]); await Run(f, j, token: token.Token); Assert(j.Removed && f.Installs == 0 && f.Activations == 0);
});
await Test("schema2 unknown partial removal is never replayed", async () => {
 var baseline = Compatible("Word", "Excel"); var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]); j.SelectionPlan = OfficeSelection.Freeze(j, baseline); j.RemovalStarted = true; j.CurrentRemovalStep = "c2r"; await Run(f, j, true); Assert(j.Status == JobStatus.NeedsReview && j.Code == "REMOVAL_UNKNOWN" && f.Removes == 0);
});
await Test("schema2 real reboot return is recovered without replaying completed exact removal", async () => {
 var baseline = Compatible("Word", "Excel"); var f = new Fake { Inventory = baseline, RemoveExit = 3010 }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]); await Run(f, j); Assert(j.Status == JobStatus.AwaitingRestart && f.Removes == 1); f.Boot = "2000"; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1);
});
await Test("schema2 installation reboot recovery preserves selected plan and skips removal", async () => {
 var baseline = Compatible("Word"); var f = new Fake { Inventory = baseline, InstallExit = 3010 }; var j = SelectedJob(baseline, ["Excel"]); await Run(f, j); Assert(j.Status == JobStatus.AwaitingRestart); f.Boot = "2000"; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Installs == 1 && f.Removes == 0);
});
await Test("legacy null selections still use all eight and original full-install semantics", () => { Assert(OfficeSelection.Selected(New()).SequenceEqual(Policy.Components) && OfficeSelection.Selected(new JobRequest(Guid.NewGuid(), ActionKind.InstallActivate, "en-us", "k.302.pub", new string('A', 64))).SequenceEqual(Policy.Components)); return Task.CompletedTask; });
await Test("schema2 unknown result after reboot accepts verified completed target without replay", async () => {
 var baseline = Compatible("Word", "Excel"); var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]); j.SelectionPlan = OfficeSelection.Freeze(j, baseline);
 await f.RemoveAsync(j); j.CurrentRemovalStep = "c2r"; j.CompletedRemovalSteps = []; j.RemovalStarted = true; j.InstallerStarted = true; j.InstallerBoot = "1000"; j.InstallerExitCode = null; j.Stage = Stage.Remove; f.Boot = "2000";
 await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && j.Removed);
});
await Test("schema2 tampered persisted plan is rejected before operations", async () => {
 var baseline = Compatible("Word"); var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["Excel"]); j.SelectionPlan = OfficeSelection.Freeze(j, baseline) with { Components = ["Access"] }; await Run(f, j, true); Assert(j.Code == "JOURNAL_INVALID" && f.Installs == 0 && f.Removes == 0);
});
await Test("schema2 activation can target suite only while foreign products remain untouched", async () => {
 var baseline = Compatible("Word") with { OfficeProducts = [OfficeSelection.Suite, "VisioPro2021Volume"] }; var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["Word"], ActionKind.Activate); await Run(f, j);
 Assert(j.Status == JobStatus.Completed && f.Removes == 0 && f.Installs == 0 && f.Activations == 1 && f.Inventory.OfficeProducts.SequenceEqual(baseline.OfficeProducts));
});
await Test("schema2 report removes OneDrive actor identity and path from both projections", () => {
 var baseline = Compatible("Word") with { OneDriveDetails = [new("onedrive:user:" + new string('A', 64), "user", "PRIVATE-ACTOR", "PRIVATE-LOCAL-PATH", "1", true, "")] }; var j = SelectedJob(baseline, ["Word"]); j.Observation = baseline; var report = Reports.Export(baseline, j, "en"); Assert(!report.Contains("PRIVATE-ACTOR") && !report.Contains("PRIVATE-LOCAL-PATH")); return Task.CompletedTask;
});
await Test("schema1 persisted historical fingerprint still accepts unchanged detected inventory", async () => {
 var f = new Fake(); var j = New(); j.ExpectedFingerprint = f.Inventory.LegacyFingerprint; await Run(f, j); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1);
});
await Test("schema2 All cannot silently omit an unsafe or newly detected Office product", async () => {
 var baseline = Compatible("Word") with { MsiProducts = ["Microsoft Office unknown"] }; var f = new Fake { Inventory = baseline }; var j = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-product:" + OfficeSelection.Suite], RemovalMode.All); await Run(f, j); Assert(j.Code == "MSI_IDENTITY_UNVERIFIED" && f.Removes == 0);
 var additional = Compatible("Word") with { OfficeProducts = [OfficeSelection.Suite, "VisioPro2021Volume"] }; f = new Fake { Inventory = additional }; j = SelectedJob(additional, ["Word"], ActionKind.Uninstall, ["c2r-product:" + OfficeSelection.Suite], RemovalMode.All); await Run(f, j); Assert(j.Code == "REMOVAL_SELECTION_INVALID" && f.Removes == 0);
});
await Test("schema2 installer cannot ignore exclusions and silently install unselected apps", () => {
 var baseline = Fake.Empty with { Components = Policy.Components.Select(c => new ComponentState(c, false)).ToArray() }; var job = SelectedJob(baseline, ["Word"]); job.SelectionPlan = OfficeSelection.Freeze(job, baseline);
 var wrong = Compatible("Word", "Excel"); Assert(!OfficeSelection.MatchesPlan(wrong, job)); return Task.CompletedTask;
});
await Test("schema2 suite-only activation failure suggests activation of the original selection", () => {
 var inventory = Compatible("Word"); var job = SelectedJob(inventory, ["Word"]); job.Status = JobStatus.InstalledUnlicensed; job.Installed = true; Assert(PresentationPolicy.Primary(job, inventory, true) == PrimaryOperation.Activate); return Task.CompletedTask;
});
await Test("schema2 conflicting binary and effective exclusion never broadens per-app removal", () => {
 var baseline = Compatible("Word", "Excel"); baseline = baseline with { C2rDetails = baseline.C2rDetails.Select(p => p with { ExcludedApps = p.ExcludedApps.Concat(["Word"]).ToArray() }).ToArray() };
 Assert(OfficeSelection.InstallBlocker(baseline, ["Excel"]) == "OFFICE_CONFIGURATION_UNKNOWN");
 Assert(OfficeSelection.GetRemovalOptions(baseline).Where(o => o.RawKind == "component").All(o => !o.Supported));
 var job = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]);
 try { OfficeSelection.Freeze(job, baseline); throw new Exception("conflicting plan accepted"); } catch (OfficeFailure e) { Assert(e.Code == "OFFICE_CONFIGURATION_UNKNOWN"); }
 Assert(OfficeSelection.GetRemovalOptions(baseline).Single(o => o.RawKind == "c2r").Supported); return Task.CompletedTask;
});
await Test("schema2 preserves non-preset application exclusions on add and per-app removal", () => {
 var baseline = Compatible("Word", "Excel"); baseline = baseline with { C2rDetails = baseline.C2rDetails.Select(p => p with { ExcludedApps = p.ExcludedApps.Except(["Publisher", "Groove", "Teams"]).ToArray() }).ToArray() };
 var add = SelectedJob(baseline, ["Access"]); add.SelectionPlan = OfficeSelection.Freeze(add, baseline);
 Assert(!add.SelectionPlan.Products.Single().ExcludedApps.Intersect(["Publisher", "Groove", "Teams"]).Any());
 var remove = SelectedJob(baseline, ["Word"], ActionKind.Uninstall, ["c2r-app:" + OfficeSelection.Suite + ":Excel"]); remove.SelectionPlan = OfficeSelection.Freeze(remove, baseline);
 Assert(!remove.SelectionPlan.Products.Single().ExcludedApps.Intersect(["Publisher", "Groove", "Teams"]).Any());
 var changed = baseline with { C2rDetails = baseline.C2rDetails.Select(p => p with { ExcludedApps = p.ExcludedApps.Concat(["Publisher"]).ToArray() }).ToArray() };
 Assert(!OfficeSelection.Preserved(changed, add)); return Task.CompletedTask;
});
await Test("schema2 keeps configured unselected application when its executable is missing", () => {
 var baseline = Compatible("Word", "Excel"); baseline = baseline with { Components = baseline.Components.Select(c => c.Id == "Excel" ? c with { Present = false } : c).ToArray() };
 var job = SelectedJob(baseline, ["Word"]); var plan = OfficeSelection.Freeze(job, baseline);
 Assert(!plan.Products.Single().ExcludedApps.Contains("Excel")); return Task.CompletedTask;
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

sealed class ProgressStore : IJobStore {
 public bool InFlight;
 public List<JobRecord> Saved { get; } = [];
 public async Task SaveAsync(JobRecord job) {
  if (InFlight) throw new Exception("overlapping progress write"); InFlight = true;
  await Task.Yield(); Saved.Add(JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(job, Reports.Json), Reports.Json)!); InFlight = false;
 }
}
sealed class ProgressClock : TimeProvider {
 private long timestamp;
 public override long TimestampFrequency => 1000;
 public override long GetTimestamp() => timestamp;
 public void Advance() => timestamp += 1000;
}

sealed class Fake : IOfficePlatform, IJobStore, IOfficeProgressSource {
 public static readonly Inventory Old = new("Windows 11", "X64", ["ProPlus2021Volume", "VisioPro2021Volume", "ProjectPro2021Volume"], [], [], [], [], [], [], DateTimeOffset.UtcNow);
 public static readonly Inventory Empty = Old with { OfficeProducts = [] };
 public static readonly Inventory Ready = Empty with { OfficeProducts = ["ProPlus2024Volume", "SkypeforBusiness2024Volume"], Platform = "x64", OfficeVersion = "16.0.1.1", SuiteLanguages = ["en-us"], SkypeLanguages = ["en-us"], Components = Policy.Components.Select(id => new ComponentState(id, true)).ToArray() };
 public static readonly LicenseState[] ValidLicenses = [new("ProPlus2024Volume", 1, 259200), new("SkypeforBusiness2024Volume", 1, 259200)];
 public Inventory Inventory = Old;
 public bool ChangeAfterRemovalPreparation;
 public bool DownloadFails, MediaFails, MissingSkype, ActivationFails, WrongLicense, OnlySuiteLicense, ChangeAfterDownload, LeaveProducts, ForeignAfterRemove;
 public bool WrongPlatform, WrongLanguage, MissingSkypeSku, LostDuringActivation, LicenseErrorAfterActivation;
 public int Removes, Installs, Activations, Downloads, RemoveExit, InstallExit;
 public string Boot = "1000";
 public int BootReads, OneDriveRuns, OneDriveExit;
 public int BusyAfterInstallReads;
 public bool FailBootAfterMutation, OneDriveNeedsInstall;
 public JobRecord? Saved;
 public List<JobRecord> History { get; } = [];
 public Func<JobProgress, Task>? ProgressObserver { get; set; }
 public bool EmitProgress, FailProgressSave;
 public CancellationTokenSource? CancelDuringProgress;
 public CancellationTokenSource? CancelAfterRemove;
 public CancellationTokenSource? CancelAfterInstall;
 public CancellationTokenSource? CancelOnWait, CancelOnBoot;
 public Task<Inventory> InspectAsync() { if (Installs > 0 && BusyAfterInstallReads-- > 0) return Task.FromResult(Inventory with { Installers = ["OfficeC2RClient", "msiexec"] }); return Task.FromResult(Inventory); }
 public Task<string> BootIdAsync() { BootReads++; CancelOnBoot?.Cancel(); if (FailBootAfterMutation && Removes + Installs + OneDriveRuns > 0) throw new OfficeFailure("INSPECTION_FAILED"); return Task.FromResult(Boot); }
 public Task SaveAsync(JobRecord job) {
  if (FailProgressSave && job.Progress != null) { FailProgressSave = false; throw new IOException("simulated progress save failure"); }
  Saved = JsonSerializer.Deserialize<JobRecord>(JsonSerializer.Serialize(job, Reports.Json), Reports.Json); History.Add(Saved!);
  if (job.Code == "WAITING_INSTALLERS") CancelOnWait?.Cancel(); return Task.CompletedTask;
 }
 public async Task<MediaState> PrepareAsync(JobRecord job, CancellationToken cancellation) {
  Downloads++; if (DownloadFails) throw new OfficeFailure("DOWNLOAD_FAILED");
  if (EmitProgress && ProgressObserver != null) {
   await ProgressObserver(new("DOWNLOADING_TOOL", ProgressUnit.Bytes, 0, 200000, DateTimeOffset.UtcNow));
   await ProgressObserver(new("DOWNLOADING_TOOL", ProgressUnit.Bytes, 200000, 200000, DateTimeOffset.UtcNow));
   CancelDuringProgress?.Cancel(); cancellation.ThrowIfCancellationRequested();
   await ProgressObserver(new("DOWNLOADING_OFFICE", ProgressUnit.None, 0, null, DateTimeOffset.UtcNow));
  }
  if (ChangeAfterDownload) Inventory = Old with { OfficeProducts = ["Different"] };
  return new MediaState("16.0.1.1", "hash", []);
 }
 public Task VerifyMediaAsync(JobRecord job) { if (MediaFails) throw new OfficeFailure("MEDIA_CHANGED"); return Task.CompletedTask; }
 public Task PrepareRemovalAsync(JobRecord job, CancellationToken cancellation) { if (ChangeAfterRemovalPreparation) Inventory = Inventory with { OfficeProducts = Inventory.OfficeProducts.Concat(["FreshProduct"]).ToArray() }; return Task.CompletedTask; }
 public Task<int> RemoveAsync(JobRecord job) {
  if (job.Schema == 2) {
   Removes++; var plan = job.SelectionPlan!; job.CurrentRemovalStep = "c2r";
   Inventory = Inventory with {
    OfficeProducts = Inventory.OfficeProducts.Except(plan.RemoveProducts).ToArray(),
    MsiDetails = Inventory.MsiDetails.Where(m => !plan.MsiProductCodes.Contains(m.ProductCode)).ToArray(),
    MsiProducts = Inventory.MsiProducts.Where(title => !plan.Baseline.MsiDetails.Any(m => plan.MsiProductCodes.Contains(m.ProductCode) && m.DisplayName == title)).ToArray(),
    OneDriveDetails = Inventory.OneDriveDetails.Where(d => !plan.OneDriveIds.Contains(d.Id)).ToArray(),
    C2rDetails = Inventory.C2rDetails.Where(d => !plan.RemoveProducts.Contains(d.Id)).Select(d => plan.Products.FirstOrDefault(p => p.Id == d.Id) is { } change ? d with { ExcludedApps = change.ExcludedApps } : d).ToArray(),
    Components = Inventory.Components.Select(c => c with { Present = c.Present && !(plan.RemoveProducts.Contains(OfficeSelection.Suite) && OfficeSelection.SuiteComponents.Contains(c.Id)) && !(plan.RemoveProducts.Contains(OfficeSelection.Skype) && c.Id == "Lync") && !(plan.Products.Any(p => p.ExcludedApps.Contains(c.Id) && (c.Id != "Lync" || p.Id == OfficeSelection.Skype))) && !(plan.OneDriveIds.Length != 0 && c.Id == "OneDrive") }).ToArray()
   };
   if (!Policy.RebootExit(RemoveExit)) { job.CurrentRemovalStep = null; if (plan.RemoveProducts.Length != 0 || plan.Products.Length != 0) job.CompletedRemovalSteps = ["c2r"]; }
   CancelAfterRemove?.Cancel(); return Task.FromResult(RemoveExit);
  }
  Removes++; if (!LeaveProducts) Inventory = ForeignAfterRemove ? Empty with { OfficeProducts = ["Foreign"] } : Empty; CancelAfterRemove?.Cancel(); return Task.FromResult(RemoveExit); }
 public Task<int> InstallAsync(JobRecord job) {
  if (job.Schema == 2) {
   Installs++; var plan = job.SelectionPlan!;
   Inventory = Inventory with { OfficeProducts = Inventory.OfficeProducts.Concat(plan.Products.Select(p => p.Id)).Distinct().ToArray(), OfficeVersion = job.Media!.Version, Platform = "x64", C2rDetails = Inventory.C2rDetails.Where(p => !plan.Products.Any(change => change.Id == p.Id)).Concat(plan.Products.Select(p => new C2rProductState(p.Id, p.Languages, p.ExcludedApps, true))).ToArray(), Components = Policy.Components.Select(c => new ComponentState(c, Inventory.Components.Any(old => old.Id == c && old.Present) || plan.Components.Contains(c) && c != "OneDrive")).ToArray() };
   CancelAfterInstall?.Cancel(); return Task.FromResult(InstallExit);
  }
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
  OneDriveRuns++; OneDriveNeedsInstall = false; Inventory = Inventory with { Components = Inventory.Components.Any(c => c.Id == "OneDrive") ? Inventory.Components.Select(c => c.Id == "OneDrive" ? c with { Present = true } : c).ToArray() : Inventory.Components.Concat([new ComponentState("OneDrive", true)]).ToArray() };
  await ExecutionSafety.RecordInstallerExitAsync(job, OneDriveExit, SaveAsync);
  if (Policy.RebootExit(OneDriveExit)) throw new OfficeFailure("ONEDRIVE_RESTART_REQUIRED", OneDriveExit);
 }
 public Task ActivateAsync(JobRecord job) { Activations++; if (LicenseErrorAfterActivation) Inventory = Inventory with { LicenseError = "LICENSE_CHECK_FAILED" }; if (ActivationFails) throw new OfficeFailure("ACTIVATION_FAILED"); Inventory = Inventory with { Licenses = WrongLicense ? [new("VisioPro2024Volume", 1, 100)] : OnlySuiteLicense ? [ValidLicenses[0]] : ValidLicenses }; if (LostDuringActivation) Inventory = Inventory with { OfficeProducts = [] }; return Task.CompletedTask; }
}
