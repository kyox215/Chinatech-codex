using Microsoft.Win32;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
namespace ChinaTech.OfficeAssistant;

public sealed partial class OfficePlatform(string? jobDirectory = null, string? actorSid = null, int actorPid = 0, long actorStarted = 0) : IOfficePlatform, IOfficeProgressSource {
 private CancellationToken removalCancellation;
 public Func<JobProgress, Task>? ProgressObserver { get; set; }
 private Task ReportProgress(string code, ProgressUnit unit, long completed, long? total = null) =>
  ProgressObserver?.Invoke(new(code, unit, completed, total, DateTimeOffset.UtcNow)) ?? Task.CompletedTask;
 private string DirectoryPath => jobDirectory ?? throw new OfficeFailure("REQUEST_INVALID");
 private string Setup => Path.Combine(DirectoryPath, "setup.exe");
 private string MediaRoot => Path.Combine(DirectoryPath, "media");
 private static readonly Dictionary<string, string> Executables = new() {
  ["Access"] = "MSACCESS.EXE", ["Excel"] = "EXCEL.EXE", ["OneNote"] = "ONENOTE.EXE", ["Outlook"] = "OUTLOOK.EXE",
  ["PowerPoint"] = "POWERPNT.EXE", ["Lync"] = "LYNC.EXE", ["Word"] = "WINWORD.EXE"
 };
 private static string PS(string value) => "'" + value.Replace("'", "''", StringComparison.Ordinal) + "'";
 private static string PowerShell => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
 private static IEnumerable<string> OfficeRoots() {
  foreach (var folder in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) }.Distinct()) {
   if (folder.Length == 0) continue;
   yield return Path.Combine(folder, "Microsoft Office", "root", "Office16");
   yield return Path.Combine(folder, "Microsoft Office", "Office16");
  }
 }
 private string UserProfile() {
  if (actorSid == null) return Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
  using var lm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
  using var profile = lm.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\" + actorSid);
  return profile?.GetValue("ProfileImagePath") as string ?? throw new OfficeFailure("IDENTITY_UNAVAILABLE");
 }
 private IEnumerable<string> OneDrivePaths() {
  foreach (var root in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) }.Distinct())
   if (root.Length > 0) yield return Path.Combine(root, "Microsoft OneDrive", "OneDrive.exe");
  yield return Path.Combine(UserProfile(), "AppData", "Local", "Microsoft", "OneDrive", "OneDrive.exe");
 }
 public static Task<Inventory> InspectAsync() => new OfficePlatform().InspectCoreAsync();
 Task<Inventory> IOfficePlatform.InspectAsync() => InspectCoreAsync();
 private async Task<Inventory> InspectCoreAsync() {
  try {
   var products = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   var msi = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   var msiDetails = new List<MsiProductState>(); var c2rDetails = new List<C2rProductState>();
   var restart = new List<string>();
   string platform = "", officeVersion = "", installationPath = "";
   string[] suiteLanguages = [], skypeLanguages = [];
   using var lm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
   using (var config = lm.OpenSubKey(@"SOFTWARE\Microsoft\Office\ClickToRun\Configuration")) {
    foreach (var id in ((config?.GetValue("ProductReleaseIds") as string) ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) products.Add(id);
    platform = config?.GetValue("Platform") as string ?? "";
    officeVersion = config?.GetValue("VersionToReport") as string ?? "";
    installationPath = config?.GetValue("InstallationPath") as string ?? "";
   }
   using var selectionConfig = lm.OpenSubKey(@"SOFTWARE\Microsoft\Office\ClickToRun\Configuration");
   using (var releases = lm.OpenSubKey(@"SOFTWARE\Microsoft\Office\ClickToRun\ProductReleaseIDs")) {
    var active = releases?.GetValue("ActiveConfiguration") as string;
    if (Guid.TryParseExact(active, "D", out _)) {
     foreach (var product in products) {
      using var item = releases?.OpenSubKey(active + @"\" + product + ".16");
      var languages = ReadLanguages(item);
      var excludedRaw = item?.GetValue("ExclusionApps");
      var excluded = excludedRaw is string raw ? raw.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
       : excludedRaw is string[] array ? array : Array.Empty<string>();
      var allowedExclusions = Policy.Components.Concat(["Groove", "Teams", "Publisher", "OutlookForWindows"]).ToArray();
      var known = item != null && languages.Length > 0 && excludedRaw is string or string[] && excluded.All(a => allowedExclusions.Contains(a, StringComparer.OrdinalIgnoreCase));
      excluded = excluded.Select(a => allowedExclusions.FirstOrDefault(c => c.Equals(a, StringComparison.OrdinalIgnoreCase)) ?? a).ToArray();
      c2rDetails.Add(new(product, languages, excluded.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.Ordinal).ToArray(), known));
      if (product == OfficeSelection.Suite) suiteLanguages = languages;
      if (product == OfficeSelection.Skype) skypeLanguages = languages;
     }
     if ((releases?.GetValue("ActiveConfiguration") as string) != active) throw new OfficeFailure("INSPECTION_FAILED");
    }
   }
   foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 }) {
    using var hive = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view);
    using var uninstall = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
    if (uninstall == null) continue;
    foreach (var name in uninstall.GetSubKeyNames()) {
     using var item = uninstall.OpenSubKey(name);
     var title = item?.GetValue("DisplayName") as string ?? "";
     var publisher = item?.GetValue("Publisher") as string ?? "";
     if (item?.GetValue("WindowsInstaller") is int value && value == 1 && publisher.Contains("Microsoft", StringComparison.OrdinalIgnoreCase)
      && LegacyOfficePattern().IsMatch(title)) {
      msi.Add(title);
      if (OfficeSelection.ValidMsiCode(name) && !msiDetails.Any(d => d.ProductCode.Equals(name, StringComparison.OrdinalIgnoreCase))) {
       var productCode = "{" + Guid.Parse(name).ToString("D").ToUpperInvariant() + "}";
       msiDetails.Add(new(productCode, title, MsiQueryProductState(productCode) == 5));
      }
     }
    }
   }
   using (var cbs = lm.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending")) if (cbs != null) restart.Add("CBS");
   using (var wu = lm.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired")) if (wu != null) restart.Add("WINDOWS_UPDATE");
   using (var manager = lm.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Session Manager"))
    if (manager?.GetValue("PendingFileRenameOperations") is string[] rename && rename.Any(x => x.Length > 0)) restart.Add("PENDING_RENAME");
   var open = new List<string>(); var installers = new List<string>(); var idleServices = new List<string>();
   var msiService = WindowsInstallerService.ReadState();
   foreach (var process in Process.GetProcesses()) {
    using (process) {
     try {
      var name = process.ProcessName;
      if (Executables.Values.Any(x => Path.GetFileNameWithoutExtension(x).Equals(name, StringComparison.OrdinalIgnoreCase))
       || name.Equals("VISIO", StringComparison.OrdinalIgnoreCase) || name.Equals("WINPROJ", StringComparison.OrdinalIgnoreCase)) open.Add(name);
      if (new[] { "setup", "OfficeSetup", "OfficeC2RClient", "msiexec" }.Contains(name, StringComparer.OrdinalIgnoreCase)) {
       if (name.Equals("msiexec", StringComparison.OrdinalIgnoreCase) && InstallerSafety.IsVerifiedIdleServiceProcess(process.Id, msiService)) idleServices.Add("msiexec");
       else installers.Add(name);
      }
     } catch (InvalidOperationException) { }
    }
   }
   var targetRoots = installationPath.Length == 0 ? [] : new[] { Path.Combine(installationPath, "root", "Office16"), Path.Combine(installationPath, "Office16") };
   var oneDriveDetails = await DetectOneDriveAsync();
   var components = Policy.Components.Select(id => new ComponentState(id, id == "OneDrive" ? oneDriveDetails.Any(d => d.ReasonCode != "SIGNATURE_INVALID")
    : targetRoots.Any(root => ValidOfficeFile(Path.Combine(root, Executables[id]), officeVersion)))).ToArray();
   LicenseState[] licenses = []; string licenseError = "";
   try { licenses = await ReadLicenses(); }
   catch (OfficeFailure failure) { licenseError = failure.Code is "PROBE_TIMEOUT" or "POWERSHELL_UNAVAILABLE" ? failure.Code : "LICENSE_CHECK_FAILED"; }
   if (!((selectionConfig?.GetValue("ProductReleaseIds") as string) ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.OrdinalIgnoreCase).SetEquals(products)
    || (selectionConfig?.GetValue("VersionToReport") as string ?? "") != officeVersion || (selectionConfig?.GetValue("Platform") as string ?? "") != platform) throw new OfficeFailure("INSPECTION_FAILED");
   return new(Environment.OSVersion.VersionString, RuntimeInformation.OSArchitecture.ToString(), products.Order().ToArray(), msi.Order().ToArray(),
    restart.ToArray(), open.Distinct().ToArray(), installers.Distinct().ToArray(), components, licenses, DateTimeOffset.UtcNow) {
     C2rDetails = c2rDetails.OrderBy(p => p.Id, StringComparer.Ordinal).ToArray(), MsiDetails = msiDetails.OrderBy(p => p.ProductCode, StringComparer.Ordinal).ToArray(), OneDriveDetails = oneDriveDetails,
     Platform = platform, OfficeVersion = officeVersion, SuiteLanguages = suiteLanguages, SkypeLanguages = skypeLanguages, LicenseError = licenseError,
     IdleInstallerServices = idleServices.Distinct().ToArray()
    };
  } catch (OfficeFailure) { throw; } catch { throw new OfficeFailure("INSPECTION_FAILED"); }
 }
 [LibraryImport("msi.dll", EntryPoint = "MsiQueryProductStateW", StringMarshalling = StringMarshalling.Utf16)]
 private static partial int MsiQueryProductState(string productCode);
 private async Task<OneDriveState[]> DetectOneDriveAsync() {
  using var actor = System.Security.Principal.WindowsIdentity.GetCurrent();
  var sid = actorSid ?? actor.User?.Value ?? throw new OfficeFailure("IDENTITY_UNAVAILABLE");
  var result = new List<OneDriveState>();
  foreach (var path in OneDrivePaths().Distinct(StringComparer.OrdinalIgnoreCase).Where(File.Exists)) {
   var scope = path.StartsWith(UserProfile() + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ? "user" : "machine";
   var supported = scope == "user"; var reason = scope == "user" ? "" : "ONEDRIVE_SCOPE_UNSUPPORTED";
   try { Journal.RejectReparse(path); await VerifyMicrosoft(path); } catch (OfficeFailure) { supported = false; reason = "SIGNATURE_INVALID"; }
   var identity = scope + ":" + (scope == "user" ? sid : "machine") + ":" + Path.GetFullPath(path).ToUpperInvariant();
   var id = "onedrive:" + scope + ":" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity)));
   result.Add(new(id, scope, scope == "user" ? sid : "", path, FileVersionInfo.GetVersionInfo(path).FileVersion ?? "", supported, reason));
  }
  return result.OrderBy(d => d.Id, StringComparer.Ordinal).ToArray();
 }
 [GeneratedRegex(@"\b(?:Microsoft\s+Office|Microsoft\s+(?:Visio|Project)|Skype\s+for\s+Business)\b", RegexOptions.IgnoreCase)]
 private static partial Regex LegacyOfficePattern();
 private static string[] ReadLanguages(RegistryKey? key) => key?.GetSubKeyNames().Where(n => {
  try { return CultureInfo.GetCultureInfo(n).Name.Length > 0 && n.Contains('-'); } catch (CultureNotFoundException) { return false; }
 }).Select(n => n.ToLowerInvariant()).Distinct().Order().ToArray() ?? [];
 private static bool ValidOfficeFile(string path, string version) {
  try {
   Journal.RejectReparse(path);
   if (!File.Exists(path) || !Version.TryParse(version, out var expected)) return false;
   using var input = new BinaryReader(File.OpenRead(path));
   if (input.ReadUInt16() != 0x5a4d) return false;
   input.BaseStream.Position = 0x3c; var offset = input.ReadInt32();
   if (offset < 64 || offset + 6 > input.BaseStream.Length) return false;
   input.BaseStream.Position = offset;
   if (input.ReadUInt32() != 0x00004550 || input.ReadUInt16() is not (0x8664 or 0xaa64 or 0xa64e)) return false;
   var info = FileVersionInfo.GetVersionInfo(path);
   return new Version(info.FileMajorPart, info.FileMinorPart, info.FileBuildPart, info.FilePrivatePart) == expected;
  } catch { return false; }
 }
 private static async Task<LicenseState[]> ReadLicenses() {
  var script = "$ErrorActionPreference='Stop'; $items=@(Get-CimInstance SoftwareLicensingProduct -Filter \"ApplicationID='0ff1ce15-a989-479d-af46-f275c6370663'\" | Where-Object { $_.PartialProductKey -and ($_.Name -match 'Office24ProPlus2024VL' -or $_.Name -match 'Office24SkypeforBusiness2024VL') } | ForEach-Object { [pscustomobject]@{Product=$(if($_.Name -match 'Office24ProPlus2024VL'){'ProPlus2024Volume'}else{'SkypeforBusiness2024Volume'});Status=[int]$_.LicenseStatus;GraceMinutes=[int]$_.GracePeriodRemaining} }); ConvertTo-Json -InputObject $items -Compress";
  var (code, output) = await RunPowerShell(script);
  if (code != 0) throw new OfficeFailure("LICENSE_CHECK_FAILED");
  try { return JsonSerializer.Deserialize<LicenseState[]>(output, Reports.Json) ?? []; }
  catch { throw new OfficeFailure("LICENSE_CHECK_FAILED"); }
 }
 public async Task<string> BootIdAsync() {
  var (code, output) = await RunPowerShell("$ErrorActionPreference='Stop'; (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().Ticks.ToString()");
  if (code != 0 || !long.TryParse(output.Trim(), out _)) throw new OfficeFailure("INSPECTION_FAILED");
  return output.Trim();
 }
 public async Task<MediaState> PrepareAsync(JobRecord job, CancellationToken cancellation) {
  var drive = new DriveInfo(Path.GetPathRoot(DirectoryPath)!);
  var needsOffice = job.Schema == 1 || job.SelectionPlan?.Products.Length > 0;
  if (drive.AvailableFreeSpace < (needsOffice ? 12L * 1024 * 1024 * 1024 : 300L * 1024 * 1024)) throw new OfficeFailure("DISK_SPACE_LOW");
  if (needsOffice) { await Download("https://officecdn.microsoft.com/pr/wsus/setup.exe", Setup, ProgressPolicy.ToolMaximum, "DOWNLOADING_TOOL", cancellation); await VerifyMicrosoft(Setup); }
  string? oneDriveHash = null;
  if ((job.Schema == 1 || OfficeSelection.Selected(job).Contains("OneDrive")) && !OneDrivePaths().Any(File.Exists)) {
   var oneDrive = Path.Combine(DirectoryPath, "OneDriveSetup.exe");
   await Download("https://go.microsoft.com/fwlink/?linkid=844652", oneDrive, ProgressPolicy.OneDriveMaximum, "DOWNLOADING_ONEDRIVE", cancellation);
   await VerifyMicrosoft(oneDrive); oneDriveHash = await Sha256(oneDrive);
  }
  if (job.Schema == 2 && job.SelectionPlan?.Products.Length == 0) return new("", "", [], oneDriveHash);
  Directory.CreateDirectory(MediaRoot);
  var config = Path.Combine(DirectoryPath, "download.xml");
  await File.WriteAllTextAsync(config, job.Schema == 1 ? Configuration.Install(MediaRoot, job.Language) : Configuration.Selected(MediaRoot, job), cancellation);
  // ODT does not expose a measured total through this call. Do not estimate it from elapsed time or pass count.
  await ReportProgress("DOWNLOADING_OFFICE", ProgressUnit.None, 0);
  var exit = await RunInstaller(Setup, ["/download", config]);
  if (exit != 0) throw new OfficeFailure("DOWNLOAD_FAILED", exit);
  cancellation.ThrowIfCancellationRequested();
  var data = Path.Combine(MediaRoot, "Office", "Data");
  var versions = Directory.GetDirectories(data).Select(Path.GetFileName).Where(n => Version.TryParse(n, out var v) && v.Major == 16 && v.Minor == 0).ToArray();
  if (versions.Length != 1 || versions[0] == null) throw new OfficeFailure("MEDIA_INCOMPLETE");
  var version = versions[0]!;
  await File.WriteAllTextAsync(config, job.Schema == 1 ? Configuration.Install(MediaRoot, job.Language, version) : Configuration.Selected(MediaRoot, job, version), cancellation);
  // Download the fixed version again so that a channel update cannot change the task mid-flight.
  await ReportProgress("DOWNLOADING_OFFICE", ProgressUnit.None, 0);
  exit = await RunInstaller(Setup, ["/download", config]);
  if (exit != 0) throw new OfficeFailure("DOWNLOAD_FAILED", exit);
  foreach (var language in MediaLanguages(job)) CheckMediaFiles(version, language);
  var files = new List<MediaFile>();
  var paths = Directory.EnumerateFiles(MediaRoot, "*", SearchOption.AllDirectories).Take(4097).ToArray();
  if (paths.Length is 0 or > 4096) throw new OfficeFailure("MEDIA_INVALID");
  var totalFiles = paths.Length + 1;
  await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, 0, totalFiles);
  foreach (var file in paths) {
   cancellation.ThrowIfCancellationRequested(); Journal.RejectReparse(file);
   files.Add(new(Path.GetRelativePath(MediaRoot, file), new FileInfo(file).Length, await Sha256(file)));
   await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, files.Count, totalFiles);
  }
  var setupHash = await Sha256(Setup);
  await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, totalFiles, totalFiles);
  return new(version, setupHash, files, oneDriveHash);
 }
 private void CheckMediaFiles(string version, string language) {
  var data = Path.Combine(MediaRoot, "Office", "Data"); var folder = Path.Combine(data, version);
  var lcid = CultureInfo.GetCultureInfo(language).LCID;
  var names = new List<string> { "i640.cab", "i640.cab.cat", "s640.cab", "stream.x64.x-none.dat", "stream.x64.x-none.dat.cat",
   $"i64{lcid}.cab", $"s64{lcid}.cab", $"stream.x64.{language}.dat", $"stream.x64.{language}.dat.cat" };
  if (RuntimeInformation.OSArchitecture == Architecture.Arm64) names.AddRange(["sa640.cab", "stream.x64.x-none.arm64x.dat", "stream.x64.x-none.arm64x.dat.cat"]);
  foreach (var file in names.Select(n => Path.Combine(folder, n)).Concat([Path.Combine(data, "v64.cab"), Path.Combine(data, $"v64_{version}.cab")])) {
   Journal.RejectReparse(file);
   if (!File.Exists(file) || new FileInfo(file).Length == 0) throw new OfficeFailure("MEDIA_INCOMPLETE");
  }
 }
 private static string[] MediaLanguages(JobRecord job) => job.Schema == 1 ? [job.Language] : (job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID")).Products.SelectMany(p => p.Languages).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
 public async Task VerifyMediaAsync(JobRecord job) {
  if (job.Schema == 2 && job.SelectionPlan?.Products.Length == 0) {
   if (job.Media?.OneDriveSha256 != null) { var path = Path.Combine(DirectoryPath, "OneDriveSetup.exe"); await VerifyMicrosoft(path); if (await Sha256(path) != job.Media.OneDriveSha256) throw new OfficeFailure("MEDIA_CHANGED"); }
   return;
  }
  if (job.Media == null || job.Media.Files.Count == 0 || job.Media.Files.Count > 4096) throw new OfficeFailure("MEDIA_INVALID");
  var totalFiles = job.Media.Files.Count + 1 + (job.Media.OneDriveSha256 == null ? 0 : 1); var checkedFiles = 0;
  await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, checkedFiles, totalFiles);
  await VerifyMicrosoft(Setup);
  if (await Sha256(Setup) != job.Media.SetupSha256) throw new OfficeFailure("MEDIA_CHANGED");
  await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, ++checkedFiles, totalFiles);
  if (job.Media.OneDriveSha256 != null) {
   var oneDrive = Path.Combine(DirectoryPath, "OneDriveSetup.exe"); await VerifyMicrosoft(oneDrive);
   if (await Sha256(oneDrive) != job.Media.OneDriveSha256) throw new OfficeFailure("MEDIA_CHANGED");
   await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, ++checkedFiles, totalFiles);
  }
  foreach (var language in MediaLanguages(job)) CheckMediaFiles(job.Media.Version, language);
  foreach (var expected in job.Media.Files) {
   var path = Path.GetFullPath(Path.Combine(MediaRoot, expected.RelativePath));
   if (!path.StartsWith(MediaRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new OfficeFailure("MEDIA_INVALID");
   Journal.RejectReparse(path);
   if (!File.Exists(path) || new FileInfo(path).Length != expected.Length || await Sha256(path) != expected.Sha256) throw new OfficeFailure("MEDIA_CHANGED");
   await ReportProgress("VERIFYING_MEDIA", ProgressUnit.Items, ++checkedFiles, totalFiles);
  }
 }
 public async Task PrepareRemovalAsync(JobRecord job, CancellationToken cancellation) {
  removalCancellation = cancellation;
  if (job.Schema == 2) {
   var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
   if (plan.Products.Length != 0) { if (job.Media == null) { job.Media = await PrepareAsync(job, cancellation); await new Journal(job.Id).SaveAsync(job); } await VerifyMediaAsync(job); }
   if (plan.OneDriveIds.Length != 0) {
    var oneDrive = Path.Combine(DirectoryPath, "OneDriveRemoveSetup.exe");
    await Download("https://go.microsoft.com/fwlink/?linkid=844652", oneDrive, ProgressPolicy.OneDriveMaximum, "DOWNLOADING_ONEDRIVE", cancellation); await VerifyMicrosoft(oneDrive);
   }
   if (plan.Products.Length == 0 && plan.RemoveProducts.Length == 0) return;
  }

  if (!File.Exists(Setup)) await Download("https://officecdn.microsoft.com/pr/wsus/setup.exe", Setup, ProgressPolicy.ToolMaximum, "DOWNLOADING_TOOL", cancellation);
  await VerifyMicrosoft(Setup);
 }
 public async Task<int> RemoveAsync(JobRecord job) {
  if (job.Schema == 2) return await RemoveSelectedAsync(job);

  await VerifyMicrosoft(Setup);
  var config = Path.Combine(DirectoryPath, "remove.xml");
  await File.WriteAllTextAsync(config, Configuration.Remove());
  return await RunInstaller(Setup, ["/configure", config]);
 }
 private async Task<int> RemoveSelectedAsync(JobRecord job) {
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID"); var store = new Journal(job.Id);
  var steps = new List<(string Id, Func<Task<int>> Run)>();
  if (plan.Products.Length != 0 || plan.RemoveProducts.Length != 0) steps.Add(("c2r", async () => {
   await VerifyMicrosoft(Setup); if (plan.Products.Length != 0) await VerifyMediaAsync(job);
   var config = Path.Combine(DirectoryPath, "remove-selected.xml"); await File.WriteAllTextAsync(config, Configuration.Selected(MediaRoot, job, job.Media?.Version, true));
   return await RunInstaller(Setup, ["/configure", config]);
  }));
  foreach (var code in plan.MsiProductCodes) steps.Add(("msi:" + code, () => {
   if (!OfficeSelection.ValidMsiCode(code) || MsiQueryProductState(code) != 5) throw new OfficeFailure("MSI_IDENTITY_UNVERIFIED");
   return RunInstaller(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "msiexec.exe"), ["/x", code, "/qn", "/norestart", "MSIRESTARTMANAGERCONTROL=Disable"]);
  }));
  foreach (var id in plan.OneDriveIds) steps.Add((id, async () => {
   var target = plan.Baseline.OneDriveDetails.Single(d => d.Id == id);
   if (target.Scope != "user" || !target.Supported) throw new OfficeFailure("ONEDRIVE_SCOPE_UNSUPPORTED");
   if (target.ActorSid != actorSid) throw new OfficeFailure("ACTOR_MISMATCH");
   if (Process.GetProcessesByName("OneDrive").Length > 0) throw new OfficeFailure("ONEDRIVE_APPS_OPEN");
   var setup = Path.Combine(DirectoryPath, "OneDriveRemoveSetup.exe"); await VerifyMicrosoft(setup);
   return await OriginalActorProcess.RunOneDriveUninstallAsync(setup, target.ActorSid, actorPid, actorStarted);
  }));
  foreach (var step in steps) {
   await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, removalCancellation);
   if (job.CompletedRemovalSteps.Contains(step.Id)) continue;
   var before = await InspectCoreAsync(); OfficeSelection.ValidateRemovalEvolution(before, job);
   if (Policy.Blocker(before) is { } blocker) throw new OfficeFailure(blocker);
   if (job.CurrentRemovalStep != null) throw new OfficeFailure("REMOVAL_UNKNOWN");
   await ExecutionSafety.RecordInstallerStartAsync(job, BootIdAsync, store.SaveAsync);
   await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, removalCancellation);
   job.CurrentRemovalStep = step.Id; await store.SaveAsync(job);
   if (removalCancellation.IsCancellationRequested) { job.CurrentRemovalStep = null; await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, removalCancellation); }
   var exit = await step.Run(); await ExecutionSafety.RecordInstallerExitAsync(job, exit, store.SaveAsync);
   if (Policy.RebootExit(exit)) return exit;
   var after = await InspectCoreAsync();
   if (exit != 0 || !OfficeSelection.RemovalStepComplete(after, job, step.Id)) throw new OfficeFailure(step.Id.StartsWith("onedrive:", StringComparison.Ordinal) ? "ONEDRIVE_UNINSTALL_FAILED" : "UNINSTALL_FAILED", exit);
   if (!OfficeSelection.Preserved(after, job)) throw new OfficeFailure("PRESERVATION_FAILED");
   job.CompletedRemovalSteps = job.CompletedRemovalSteps.Concat([step.Id]).ToArray(); job.CurrentRemovalStep = null; await store.SaveAsync(job);
  }
  return 0;
 }
 public async Task<int> InstallAsync(JobRecord job) {
  var config = Path.Combine(DirectoryPath, "install.xml");
  await File.WriteAllTextAsync(config, job.Schema == 1 ? Configuration.Install(MediaRoot, job.Language, job.Media?.Version ?? throw new OfficeFailure("MEDIA_INVALID")) : Configuration.Selected(MediaRoot, job, job.Media?.Version ?? throw new OfficeFailure("MEDIA_INVALID")));
  return await RunInstaller(Setup, ["/configure", config]);
 }
 public async Task EnsureOneDriveAsync(JobRecord job, CancellationToken cancellation) {
  if (OneDrivePaths().Any(File.Exists)) return;
  var installer = Path.Combine(DirectoryPath, "OneDriveSetup.exe");
  if (job.OneDriveInitiallyPresent) throw new OfficeFailure("ONEDRIVE_PRESERVATION_FAILED");
  if (job.Media?.OneDriveSha256 == null || !File.Exists(installer) || await Sha256(installer) != job.Media.OneDriveSha256) throw new OfficeFailure("MEDIA_CHANGED");
  await VerifyMicrosoft(installer); cancellation.ThrowIfCancellationRequested();
  var store = new Journal(job.Id);
  await ExecutionSafety.RecordInstallerStartAsync(job, BootIdAsync, store.SaveAsync);
  await ExecutionSafety.CheckInstallerCancellationAsync(job, store.SaveAsync, cancellation);
  var code = await RunInstaller(installer, ["/allusers", "/silent"]);
  await ExecutionSafety.RecordInstallerExitAsync(job, code, store.SaveAsync);
  if (Policy.RebootExit(code)) throw new OfficeFailure("ONEDRIVE_RESTART_REQUIRED", code);
  if (code != 0 || !OneDrivePaths().Any(File.Exists)) throw new OfficeFailure("ONEDRIVE_INSTALL_FAILED", code);
 }
 public async Task ActivateAsync(JobRecord job) {
  if (job.Schema == 2) { await ActivateSelectedAsync(job); return; }
  var ospp = OfficeRoots().Select(root => Path.Combine(root, "OSPP.VBS")).FirstOrDefault(File.Exists) ?? throw new OfficeFailure("PRODUCT_NOT_FOUND");
  var cscript = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cscript.exe");
  var required = job.Schema == 1 ? new[] { OfficeSelection.Suite, OfficeSelection.Skype } : OfficeSelection.RequiredProducts(OfficeSelection.Selected(job));
  if (required.Length == 0) return;
  foreach (var server in new[] { Policy.ValidateServer(job.Server), "k.302.pub" }.Distinct()) {
   job.ActivationServer = server; await new Journal(job.Id).SaveAsync(job);
   var parts = server.Split(':');
   if ((await Run(cscript, ["//NoLogo", ospp, "/sethst:" + parts[0]])).Exit != 0) continue;
   if ((await Run(cscript, ["//NoLogo", ospp, "/setprt:" + (parts.Length == 2 ? parts[1] : "1688")])).Exit != 0) continue;
   // Explicitly target both LTSC 2024 public GVLKs, never an arbitrary existing product license.
   foreach (var key in required.Select(id => id == OfficeSelection.Suite ? "XJ2XN-FW8RK-P4HMP-DKDBV-GCVGB" : "4NKHF-9HBQF-Q3B6C-7YV34-F64P3"))
    if ((await Run(cscript, ["//NoLogo", ospp, "/inpkey:" + key])).Exit != 0) throw new OfficeFailure("ACTIVATION_FAILED");
   await Run(cscript, ["//NoLogo", ospp, "/act"]);
   var licenses = await ReadLicenses();
   var licensed = required.All(id => licenses.Any(l => l.Product == id && l.Status == 1));
   job.ActivationAttempts.Add(new(server, licensed, DateTimeOffset.UtcNow)); await new Journal(job.Id).SaveAsync(job);
   if (licensed) return;
  }
  throw new OfficeFailure("ACTIVATION_FAILED");
 }
 private async Task ActivateSelectedAsync(JobRecord job) {
  var required = OfficeSelection.RequiredProducts(OfficeSelection.Selected(job));
  foreach (var server in new[] { Policy.ValidateServer(job.Server), "k.302.pub" }.Distinct()) {
   job.ActivationServer = server; await new Journal(job.Id).SaveAsync(job);
   var parts = server.Split(':'); var script = new StringBuilder("$ErrorActionPreference='Stop';");
   var existingLicenses = await ReadLicenses();
   foreach (var product in required.Where(id => !existingLicenses.Any(l => l.Product == id && l.Status == 1))) {
    var name = product == OfficeSelection.Suite ? "Office24ProPlus2024VL" : "Office24SkypeforBusiness2024VL";
    var key = product == OfficeSelection.Suite ? "XJ2XN-FW8RK-P4HMP-DKDBV-GCVGB" : "4NKHF-9HBQF-Q3B6C-7YV34-F64P3";
    script.Append("$service=Get-CimInstance SoftwareLicensingService; $r=Invoke-CimMethod -InputObject $service -MethodName InstallProductKey -Arguments @{ProductKey=" + PS(key) + "}; if($r.ReturnValue -ne 0){exit 1};");
    script.Append("$items=@(Get-CimInstance SoftwareLicensingProduct -Filter \"ApplicationID='0ff1ce15-a989-479d-af46-f275c6370663'\" | Where-Object { $_.Name -match " + PS(name + "[_ ,]") + " -and $_.PartialProductKey -eq " + PS(key[^5..]) + " }); if($items.Count -ne 1 -or $items[0].ID -notmatch '^[0-9a-fA-F-]{36}$'){exit 1}; $sku=$items[0];");
    script.Append("$r=Invoke-CimMethod -InputObject $sku -MethodName SetKeyManagementServiceMachine -Arguments @{MachineName=" + PS(parts[0]) + "}; if($r.ReturnValue -ne 0){exit 1};");
    script.Append("$r=Invoke-CimMethod -InputObject $sku -MethodName SetKeyManagementServicePort -Arguments @{PortNumber=[uint32]" + (parts.Length == 2 ? parts[1] : "1688") + "}; if($r.ReturnValue -ne 0){exit 1};");
    script.Append("$r=Invoke-CimMethod -InputObject $sku -MethodName Activate; if($r.ReturnValue -ne 0){exit 1};");
   }
   // Activation is a mutating licensing operation: await it without the read-only probe kill deadline.
   var (exit, _) = await Run(PowerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Convert.ToBase64String(Encoding.Unicode.GetBytes(script.ToString()))]);
   var licenses = await ReadLicenses(); var licensed = exit == 0 && required.All(id => licenses.Any(l => l.Product == id && l.Status == 1));
   job.ActivationAttempts.Add(new(server, licensed, DateTimeOffset.UtcNow)); await new Journal(job.Id).SaveAsync(job);
   if (licensed) return;
  }
  throw new OfficeFailure("ACTIVATION_FAILED");
 }
 private async Task Download(string url, string destination, long maximum, string progressCode, CancellationToken cancellation) {
  try {
   using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
   deadline.CancelAfter(TimeSpan.FromMinutes(10));
   using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
   using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
   response.EnsureSuccessStatusCode();
   var expectedLength = response.Content.Headers.ContentLength;
   if (response.RequestMessage?.RequestUri?.Scheme != "https" || expectedLength is <= 0 || expectedLength > maximum) throw new OfficeFailure("DOWNLOAD_FAILED");
   var temporary = destination + ".download";
   Journal.RejectReparse(temporary);
   await using (var output = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None)) {
    await using var input = await response.Content.ReadAsStreamAsync(deadline.Token);
    await MeasuredCopy.CopyAsync(input, output, progressCode, expectedLength, maximum, ProgressObserver, deadline.Token);
    await output.FlushAsync(deadline.Token); output.Flush(true);
   }
   File.Move(temporary, destination, true);
  } catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { throw new OfficeFailure("DOWNLOAD_FAILED"); }
  catch (OperationCanceledException) { throw; } catch (OfficeFailure) { throw; } catch { throw new OfficeFailure("DOWNLOAD_FAILED"); }
 }
 private static async Task VerifyMicrosoft(string path) {
  Journal.RejectReparse(path);
  var (code, result) = await RunPowerShell("$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath " + PS(path) + "; if($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -match '(?:^|, )O=Microsoft Corporation(?:,|$)'){ 'VALID' } else { exit 1 }");
  if (code != 0 || result.Trim() != "VALID") throw new OfficeFailure("SIGNATURE_INVALID");
 }
 private static async Task<string> Sha256(string path) {
  await using var stream = File.OpenRead(path); return Convert.ToHexString(await SHA256.HashDataAsync(stream));
 }
 private static Task<(int Exit, string Output)> RunPowerShell(string script) {
  var start = new ProcessStartInfo(PowerShell) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
  foreach (var argument in new[] { "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Convert.ToBase64String(Encoding.Unicode.GetBytes(script)) }) start.ArgumentList.Add(argument);
  return ExecutionSafety.RunProbeAsync(start, TimeSpan.FromSeconds(30), "POWERSHELL_UNAVAILABLE");
 }
 private static async Task<int> RunInstaller(string exe, string[] arguments) => (await Run(exe, arguments)).Exit;
 private static async Task<(int Exit, string Output)> Run(string exe, string[] arguments) {
  var start = new ProcessStartInfo(exe) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
  foreach (var argument in arguments) start.ArgumentList.Add(argument);
  using var process = Process.Start(start) ?? throw new OfficeFailure("PROCESS_START_FAILED");
  var stdout = Drain(process.StandardOutput); var stderr = Drain(process.StandardError);
  await process.WaitForExitAsync();
  // Raw OSPP output and process arguments can contain keys. They are never journalled or exported.
  var output = await stdout; await stderr; return (process.ExitCode, output);
 }
 private static async Task<string> Drain(StreamReader reader) {
  var buffer = new char[4096]; var output = new StringBuilder(); int count;
  while ((count = await reader.ReadAsync(buffer)) != 0) if (output.Length < 256000) output.Append(buffer, 0, Math.Min(count, 256000 - output.Length));
  return output.ToString();
 }
}
