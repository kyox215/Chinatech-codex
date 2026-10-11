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

public sealed partial class OfficePlatform(string? jobDirectory = null, string? actorSid = null) : IOfficePlatform {
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
  return profile?.GetValue("ProfileImagePath") as string ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
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
   using (var releases = lm.OpenSubKey(@"SOFTWARE\Microsoft\Office\ClickToRun\ProductReleaseIDs")) {
    var active = releases?.GetValue("ActiveConfiguration") as string;
    if (Guid.TryParseExact(active, "D", out _)) {
     using var suite = releases?.OpenSubKey(active + @"\ProPlus2024Volume.16");
     using var skype = releases?.OpenSubKey(active + @"\SkypeforBusiness2024Volume.16");
     suiteLanguages = ReadLanguages(suite); skypeLanguages = ReadLanguages(skype);
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
      && LegacyOfficePattern().IsMatch(title)) msi.Add(title);
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
   var components = Policy.Components.Select(id => new ComponentState(id, id == "OneDrive" ? OneDrivePaths().Any(File.Exists)
    : targetRoots.Any(root => ValidOfficeFile(Path.Combine(root, Executables[id]), officeVersion)))).ToArray();
   LicenseState[] licenses = []; string licenseError = "";
   try { licenses = await ReadLicenses(); }
   catch (OfficeFailure failure) { licenseError = failure.Code is "PROBE_TIMEOUT" or "POWERSHELL_UNAVAILABLE" ? failure.Code : "LICENSE_CHECK_FAILED"; }
   return new(Environment.OSVersion.VersionString, RuntimeInformation.OSArchitecture.ToString(), products.Order().ToArray(), msi.Order().ToArray(),
    restart.ToArray(), open.Distinct().ToArray(), installers.Distinct().ToArray(), components, licenses, DateTimeOffset.UtcNow) {
     Platform = platform, OfficeVersion = officeVersion, SuiteLanguages = suiteLanguages, SkypeLanguages = skypeLanguages, LicenseError = licenseError,
     IdleInstallerServices = idleServices.Distinct().ToArray()
    };
  } catch (OfficeFailure) { throw; } catch { throw new OfficeFailure("INSPECTION_FAILED"); }
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
  if (drive.AvailableFreeSpace < 12L * 1024 * 1024 * 1024) throw new OfficeFailure("DISK_SPACE_LOW");
  await Download("https://officecdn.microsoft.com/pr/wsus/setup.exe", Setup, 50L * 1024 * 1024, cancellation);
  await VerifyMicrosoft(Setup);
  string? oneDriveHash = null;
  if (!OneDrivePaths().Any(File.Exists)) {
   var oneDrive = Path.Combine(DirectoryPath, "OneDriveSetup.exe");
   await Download("https://go.microsoft.com/fwlink/?linkid=844652", oneDrive, 250L * 1024 * 1024, cancellation);
   await VerifyMicrosoft(oneDrive); oneDriveHash = await Sha256(oneDrive);
  }
  Directory.CreateDirectory(MediaRoot);
  var config = Path.Combine(DirectoryPath, "download.xml");
  await File.WriteAllTextAsync(config, Configuration.Install(MediaRoot, job.Language), cancellation);
  var exit = await RunInstaller(Setup, ["/download", config]);
  if (exit != 0) throw new OfficeFailure("DOWNLOAD_FAILED", exit);
  cancellation.ThrowIfCancellationRequested();
  var data = Path.Combine(MediaRoot, "Office", "Data");
  var versions = Directory.GetDirectories(data).Select(Path.GetFileName).Where(n => Version.TryParse(n, out var v) && v.Major == 16 && v.Minor == 0).ToArray();
  if (versions.Length != 1 || versions[0] == null) throw new OfficeFailure("MEDIA_INCOMPLETE");
  var version = versions[0]!;
  await File.WriteAllTextAsync(config, Configuration.Install(MediaRoot, job.Language, version), cancellation);
  // Download the fixed version again so that a channel update cannot change the task mid-flight.
  exit = await RunInstaller(Setup, ["/download", config]);
  if (exit != 0) throw new OfficeFailure("DOWNLOAD_FAILED", exit);
  CheckMediaFiles(version, job.Language);
  var files = new List<MediaFile>();
  foreach (var file in Directory.EnumerateFiles(MediaRoot, "*", SearchOption.AllDirectories)) {
   cancellation.ThrowIfCancellationRequested(); Journal.RejectReparse(file);
   files.Add(new(Path.GetRelativePath(MediaRoot, file), new FileInfo(file).Length, await Sha256(file)));
  }
  return new(version, await Sha256(Setup), files, oneDriveHash);
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
 public async Task VerifyMediaAsync(JobRecord job) {
  if (job.Media == null || job.Media.Files.Count == 0 || job.Media.Files.Count > 4096) throw new OfficeFailure("MEDIA_INVALID");
  await VerifyMicrosoft(Setup);
  if (await Sha256(Setup) != job.Media.SetupSha256) throw new OfficeFailure("MEDIA_CHANGED");
  if (job.Media.OneDriveSha256 != null) {
   var oneDrive = Path.Combine(DirectoryPath, "OneDriveSetup.exe"); await VerifyMicrosoft(oneDrive);
   if (await Sha256(oneDrive) != job.Media.OneDriveSha256) throw new OfficeFailure("MEDIA_CHANGED");
  }
  CheckMediaFiles(job.Media.Version, job.Language);
  foreach (var expected in job.Media.Files) {
   var path = Path.GetFullPath(Path.Combine(MediaRoot, expected.RelativePath));
   if (!path.StartsWith(MediaRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new OfficeFailure("MEDIA_INVALID");
   Journal.RejectReparse(path);
   if (!File.Exists(path) || new FileInfo(path).Length != expected.Length || await Sha256(path) != expected.Sha256) throw new OfficeFailure("MEDIA_CHANGED");
  }
 }
 public async Task PrepareRemovalAsync(JobRecord job, CancellationToken cancellation) {
  if (!File.Exists(Setup)) await Download("https://officecdn.microsoft.com/pr/wsus/setup.exe", Setup, 50L * 1024 * 1024, cancellation);
  await VerifyMicrosoft(Setup);
 }
 public async Task<int> RemoveAsync(JobRecord job) {
  await VerifyMicrosoft(Setup);
  var config = Path.Combine(DirectoryPath, "remove.xml");
  await File.WriteAllTextAsync(config, Configuration.Remove());
  return await RunInstaller(Setup, ["/configure", config]);
 }
 public async Task<int> InstallAsync(JobRecord job) {
  var config = Path.Combine(DirectoryPath, "install.xml");
  await File.WriteAllTextAsync(config, Configuration.Install(MediaRoot, job.Language, job.Media?.Version ?? throw new OfficeFailure("MEDIA_INVALID")));
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
  var ospp = OfficeRoots().Select(root => Path.Combine(root, "OSPP.VBS")).FirstOrDefault(File.Exists) ?? throw new OfficeFailure("PRODUCT_NOT_FOUND");
  var cscript = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cscript.exe");
  foreach (var server in new[] { Policy.ValidateServer(job.Server), "k.302.pub" }.Distinct()) {
   job.ActivationServer = server; await new Journal(job.Id).SaveAsync(job);
   var parts = server.Split(':');
   if ((await Run(cscript, ["//NoLogo", ospp, "/sethst:" + parts[0]])).Exit != 0) continue;
   if ((await Run(cscript, ["//NoLogo", ospp, "/setprt:" + (parts.Length == 2 ? parts[1] : "1688")])).Exit != 0) continue;
   // Explicitly target both LTSC 2024 public GVLKs, never an arbitrary existing product license.
   foreach (var key in new[] { "XJ2XN-FW8RK-P4HMP-DKDBV-GCVGB", "4NKHF-9HBQF-Q3B6C-7YV34-F64P3" })
    if ((await Run(cscript, ["//NoLogo", ospp, "/inpkey:" + key])).Exit != 0) throw new OfficeFailure("ACTIVATION_FAILED");
   await Run(cscript, ["//NoLogo", ospp, "/act"]);
   var licenses = await ReadLicenses();
   var licensed = licenses.Any(l => l.Product == "ProPlus2024Volume" && l.Status == 1)
    && licenses.Any(l => l.Product == "SkypeforBusiness2024Volume" && l.Status == 1);
   job.ActivationAttempts.Add(new(server, licensed, DateTimeOffset.UtcNow)); await new Journal(job.Id).SaveAsync(job);
   if (licensed) return;
  }
  throw new OfficeFailure("ACTIVATION_FAILED");
 }
 private static async Task Download(string url, string destination, long maximum, CancellationToken cancellation) {
  try {
   using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
   deadline.CancelAfter(TimeSpan.FromMinutes(10));
   using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
   using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
   response.EnsureSuccessStatusCode();
   if (response.RequestMessage?.RequestUri?.Scheme != "https" || response.Content.Headers.ContentLength > maximum) throw new OfficeFailure("DOWNLOAD_FAILED");
   var temporary = destination + ".download";
   Journal.RejectReparse(temporary);
   await using (var output = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None)) {
    await using var input = await response.Content.ReadAsStreamAsync(deadline.Token);
    var bytes = new byte[65536]; long total = 0; int count;
    while ((count = await input.ReadAsync(bytes, deadline.Token)) != 0) {
     total += count; if (total > maximum) throw new OfficeFailure("DOWNLOAD_FAILED");
     await output.WriteAsync(bytes.AsMemory(0, count), deadline.Token);
    }
    await output.FlushAsync(deadline.Token); output.Flush(true);
    if (total < 100000) throw new OfficeFailure("DOWNLOAD_FAILED");
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
