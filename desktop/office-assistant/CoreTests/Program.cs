using ChinaTech.OfficeAssistant;
using System.Globalization;
using System.Xml.Linq;
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
await Test("real installer reboot exit pauses before installation", async () => { var f = new Fake { RemoveExit = 3010 }; var j = await Run(f, New()); Assert(j.Status == JobStatus.AwaitingRestart && j.Removed && f.Installs == 0); await Run(f, j, true); Assert(f.Installs == 0 && j.Status == JobStatus.AwaitingRestart); f.Boot = "next"; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1); });
await Test("installation reboot exit is recovered without uninstall", async () => { var f = new Fake { InstallExit = 3010 }; var j = await Run(f, New()); Assert(j.Status == JobStatus.AwaitingRestart && j.Installed); f.Boot = "next"; await Run(f, j, true); Assert(j.Status == JobStatus.Completed && f.Removes == 1 && f.Installs == 1); });
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
await Test("export excludes protected actor and media paths", () => { var j = New(); j.ActorSid = "PRIVATE-SID"; j.Media = new("16.0.1.1", "hash", [new("PRIVATE-PATH", 1, "sha")]); var report = Reports.Export(Fake.Empty, j, "zh"); Assert(!report.Contains("PRIVATE-SID") && !report.Contains("PRIVATE-PATH")); return Task.CompletedTask; });
Console.WriteLine($"{passed} meaningful workflow checks passed; these use fake Office boundaries, not real installation evidence.");
await Test("32-bit Office cannot satisfy 64-bit installation", async () => { var f = new Fake { WrongPlatform = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && !j.Installed); });
await Test("wrong language cannot satisfy the pinned plan", async () => { var f = new Fake { WrongLanguage = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && !j.Installed); });
await Test("missing Skype SKU cannot be hidden by stale Lync executable", async () => { var f = new Fake { MissingSkypeSku = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && f.Activations == 0); });
await Test("Office removed during activation cannot report ready", async () => { var f = new Fake { LostDuringActivation = true }; var j = await Run(f, New()); Assert(j.Status != JobStatus.Completed && j.Code == "PRODUCT_NOT_FOUND"); });
await Test("cancel after installation records installed state and does not activate", async () => { using var token = new CancellationTokenSource(); var f = new Fake { CancelAfterInstall = token }; var j = await Run(f, New(), token: token.Token); Assert(j.Status == JobStatus.Cancelled && j.Installed && f.Activations == 0); });
await Test("filesystem read mask does not overlap mutation mask", () => { Assert(!Policy.CanMutateFileSystem(0x1200a9) && Policy.CanMutateFileSystem(0x2) && Policy.CanMutateFileSystem(0x40000)); return Task.CompletedTask; });
await Test("configuration changes invalidate the confirmed fingerprint", () => { Assert(Fake.Ready.Fingerprint != (Fake.Ready with { Platform = "x86" }).Fingerprint && Fake.Ready.Fingerprint != (Fake.Ready with { SuiteLanguages = ["it-it"] }).Fingerprint); return Task.CompletedTask; });
Console.WriteLine($"FINAL: {passed} meaningful workflow checks passed; Office boundaries are synthetic.");

sealed class Fake : IOfficePlatform, IJobStore {
 public static readonly Inventory Old = new("Windows 11", "X64", ["ProPlus2021Volume", "VisioPro2021Volume", "ProjectPro2021Volume"], [], [], [], [], [], [], DateTimeOffset.UtcNow);
 public static readonly Inventory Empty = Old with { OfficeProducts = [] };
 public static readonly Inventory Ready = Empty with { OfficeProducts = ["ProPlus2024Volume", "SkypeforBusiness2024Volume"], Platform = "x64", OfficeVersion = "16.0.1.1", SuiteLanguages = ["en-us"], SkypeLanguages = ["en-us"], Components = Policy.Components.Select(id => new ComponentState(id, true)).ToArray() };
 public static readonly LicenseState[] ValidLicenses = [new("ProPlus2024Volume", 1, 259200), new("SkypeforBusiness2024Volume", 1, 259200)];
 public Inventory Inventory = Old;
 public bool DownloadFails, MediaFails, MissingSkype, ActivationFails, WrongLicense, OnlySuiteLicense, ChangeAfterDownload, LeaveProducts, ForeignAfterRemove;
 public bool WrongPlatform, WrongLanguage, MissingSkypeSku, LostDuringActivation;
 public int Removes, Installs, Activations, Downloads, RemoveExit, InstallExit;
 public string Boot = "first";
 public CancellationTokenSource? CancelAfterRemove;
 public CancellationTokenSource? CancelAfterInstall;
 public Task<Inventory> InspectAsync() => Task.FromResult(Inventory);
 public Task<string> BootIdAsync() => Task.FromResult(Boot);
 public Task SaveAsync(JobRecord job) => Task.CompletedTask;
 public Task<MediaState> PrepareAsync(JobRecord job, CancellationToken cancellation) { Downloads++; if (DownloadFails) throw new OfficeFailure("DOWNLOAD_FAILED"); if (ChangeAfterDownload) Inventory = Old with { OfficeProducts = ["Different"] }; return Task.FromResult(new MediaState("16.0.1.1", "hash", [])); }
 public Task VerifyMediaAsync(JobRecord job) { if (MediaFails) throw new OfficeFailure("MEDIA_CHANGED"); return Task.CompletedTask; }
 public Task PrepareRemovalAsync(JobRecord job, CancellationToken cancellation) => Task.CompletedTask;
 public Task<int> RemoveAsync(JobRecord job) { Removes++; if (!LeaveProducts) Inventory = ForeignAfterRemove ? Empty with { OfficeProducts = ["Foreign"] } : Empty; CancelAfterRemove?.Cancel(); return Task.FromResult(RemoveExit); }
 public Task<int> InstallAsync(JobRecord job) {
  Installs++; Inventory = MissingSkype ? Ready with { Components = Ready.Components.Select(x => x.Id == "Lync" ? x with { Present = false } : x).ToArray() } : Ready;
  if (WrongPlatform) Inventory = Inventory with { Platform = "x86" };
  if (WrongLanguage) Inventory = Inventory with { SuiteLanguages = ["it-it"] };
  if (MissingSkypeSku) Inventory = Inventory with { OfficeProducts = ["ProPlus2024Volume"] };
  CancelAfterInstall?.Cancel(); return Task.FromResult(InstallExit);
 }
 public Task EnsureOneDriveAsync(JobRecord job, CancellationToken cancellation) => Task.CompletedTask;
 public Task ActivateAsync(JobRecord job) { Activations++; if (ActivationFails) throw new OfficeFailure("ACTIVATION_FAILED"); Inventory = Inventory with { Licenses = WrongLicense ? [new("VisioPro2024Volume", 1, 100)] : OnlySuiteLicense ? [ValidLicenses[0]] : ValidLicenses }; if (LostDuringActivation) Inventory = Inventory with { OfficeProducts = [] }; return Task.CompletedTask; }
}
