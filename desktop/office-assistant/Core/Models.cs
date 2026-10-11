using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
namespace ChinaTech.OfficeAssistant;

public enum ActionKind { InstallActivate, Activate, Uninstall }
public enum Stage { Detect, Download, Remove, Install, Components, Activate, Finished }
public enum JobStatus { Running, AwaitingRestart, Cancelled, Failed, InstalledUnlicensed, ComponentMissing, Completed, NeedsReview }
public sealed record ComponentState(string Id, bool Present);
public sealed record LicenseState(string Product, int Status, int? GraceMinutes);
public sealed record Inventory(string Windows, string Architecture, string[] OfficeProducts, string[] MsiProducts,
 string[] RestartReasons, string[] OpenApps, string[] Installers, ComponentState[] Components, LicenseState[] Licenses, DateTimeOffset ObservedAt) {
 public bool HasOffice => OfficeProducts.Length != 0 || MsiProducts.Length != 0;
 public string Platform { get; init; } = "";
 public string OfficeVersion { get; init; } = "";
 public string[] SuiteLanguages { get; init; } = [];
 public string[] SkypeLanguages { get; init; } = [];
 public string LicenseError { get; init; } = "";
 public string[] IdleInstallerServices { get; init; } = [];
 public bool TargetInstalled => OfficeProducts.Contains("ProPlus2024Volume", StringComparer.OrdinalIgnoreCase)
  && OfficeProducts.Contains("SkypeforBusiness2024Volume", StringComparer.OrdinalIgnoreCase) && Platform.Equals("x64", StringComparison.OrdinalIgnoreCase);
 public bool MatchesPlan(JobRecord job) => TargetInstalled && SuiteLanguages.Contains(job.Language, StringComparer.OrdinalIgnoreCase)
  && SkypeLanguages.Contains(job.Language, StringComparer.OrdinalIgnoreCase) && (job.Media == null || OfficeVersion == job.Media.Version);
 public bool AllComponents => Policy.Components.All(id => Components.Any(c => c.Id == id && c.Present));
 public bool TargetLicensed => LicenseError.Length == 0 && Licenses.Any(l => l.Product == "ProPlus2024Volume" && l.Status == 1)
   && Licenses.Any(l => l.Product == "SkypeforBusiness2024Volume" && l.Status == 1);
 public string Fingerprint => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
   string.Join("|", OfficeProducts.Order(StringComparer.Ordinal)) + ":" + string.Join("|", MsiProducts.Order(StringComparer.Ordinal))
   + ":" + Platform + ":" + OfficeVersion + ":" + string.Join("|", SuiteLanguages.Order(StringComparer.Ordinal)) + ":" + string.Join("|", SkypeLanguages.Order(StringComparer.Ordinal)))));
}
public sealed record JobRequest(Guid Id, ActionKind Action, string Language, string Server, string ExpectedFingerprint, bool Resume = false);
public sealed record StageEvent(Stage Stage, string Code, DateTimeOffset At);
public sealed record ActivationAttempt(string Server, bool Licensed, DateTimeOffset At);
public sealed record MediaFile(string RelativePath, long Length, string Sha256);
public sealed record MediaState(string Version, string SetupSha256, List<MediaFile> Files, string? OneDriveSha256 = null);
public sealed class JobRecord {
 public int Schema { get; set; } = 1;
 public Guid Id { get; set; }
 public ActionKind Action { get; set; }
 public string Language { get; set; } = "en-us";
 public string Server { get; set; } = "k.302.pub";
 public string? ActivationServer { get; set; }
 public List<ActivationAttempt> ActivationAttempts { get; set; } = [];
 public string ExpectedFingerprint { get; set; } = "";
 public string ActorSid { get; set; } = "";
 public Stage Stage { get; set; } = Stage.Detect;
 public JobStatus Status { get; set; } = JobStatus.Running;
 public string Code { get; set; } = "STARTED";
 public bool Removed { get; set; }
 public bool RemovalStarted { get; set; }
 public bool OneDriveInitiallyPresent { get; set; }
 public bool Installed { get; set; }
 public string? InstallerBoot { get; set; }
 public bool InstallerStarted { get; set; }
 public string? RestartBoot { get; set; }
 public string? RestartVerifiedBoot { get; set; }
 public int? InstallerExitCode { get; set; }
 public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
 public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
 public MediaState? Media { get; set; }
 public Inventory? Observation { get; set; }
 public List<StageEvent> Events { get; set; } = [];
}
public sealed class OfficeFailure(string code, int? exitCode = null) : Exception(code) {
 public string Code { get; } = code;
 public int? ExitCode { get; } = exitCode;
}
public static partial class Policy {
 public const string Version = "1.0.1";
 public const string TermsUrl = "https://www.microsoft.com/licensing/terms/productoffering/OfficeDesktopApplications/all";
 public static readonly string[] Components = ["Access", "Excel", "OneDrive", "OneNote", "Outlook", "PowerPoint", "Lync", "Word"];
 public static readonly string[] Languages = ["zh-cn", "it-it", "en-us"];
 public static string DefaultLanguage(CultureInfo culture) => culture.TwoLetterISOLanguageName switch { "zh" => "zh-cn", "it" => "it-it", _ => "en-us" };
 [GeneratedRegex(@"\A(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*kms\.cx(?::[0-9]{1,5})?\z|\Ak\.302\.pub(?::[0-9]{1,5})?\z", RegexOptions.IgnoreCase)]
 private static partial Regex HostPattern();
 public static string ValidateServer(string server) {
  if (!HostPattern().IsMatch(server)) throw new OfficeFailure("SERVER_INVALID");
  var parts = server.Split(':');
  if (parts.Length == 2 && (!int.TryParse(parts[1], out var port) || port is < 1 or > 65535)) throw new OfficeFailure("SERVER_INVALID");
  return server.ToLowerInvariant();
 }
 public static void Validate(JobRequest request) {
  if (request.Id == Guid.Empty || !Enum.IsDefined(request.Action) || !Languages.Contains(request.Language)
   || request.ExpectedFingerprint.Length != 64 || !request.ExpectedFingerprint.All(Uri.IsHexDigit)) throw new OfficeFailure("REQUEST_INVALID");
  ValidateServer(request.Server);
 }
 public static bool RebootExit(int code) => code is 3010 or 1641;
 // Windows access masks: mutation bits only; ReadAndExecute and Synchronize are safe.
 public static bool CanMutateFileSystem(int rights) => (rights & (0x2 | 0x4 | 0x10 | 0x100 | 0x40 | 0x10000 | 0x40000 | 0x80000)) != 0;
 public static string? Blocker(Inventory i) => i.Architecture is not ("X64" or "Arm64") ? "ARCHITECTURE_UNSUPPORTED"
  : i.Installers.Length > 0 ? "INSTALLER_BUSY" : i.OpenApps.Length > 0 ? "APPS_OPEN" : null;
}
public static class Reports {
 public static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNameCaseInsensitive = false };
 public static string Export(Inventory? inventory, JobRecord? job, string locale) => JsonSerializer.Serialize(new {
  schema = 1, assistantVersion = Policy.Version, locale, exportedAt = DateTimeOffset.UtcNow,
  inventory, task = job == null ? null : new { job.Id, job.Action, job.Language, job.Server, job.ActivationServer, job.ActivationAttempts, job.Stage, job.Status, job.Code,
   job.Removed, job.RemovalStarted, job.Installed, job.StartedAt, job.UpdatedAt, job.InstallerExitCode, job.InstallerBoot, job.InstallerStarted, job.RestartBoot, job.RestartVerifiedBoot,
   mediaVersion = job.Media?.Version, job.Events, job.Observation }
 }, Json);
}
