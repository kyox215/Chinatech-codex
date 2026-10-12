using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
namespace ChinaTech.OfficeAssistant;
public sealed class Journal(Guid id) : IJobStore {
#if OFFICE_NATIVE_CHECKS
 public static string Root => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ChinaTech.OfficeAssistant1.NativeChecks");
#else
 public static string Root => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ChinaTech.OfficeAssistant1");
#endif
 public string DirectoryPath => Path.Combine(Root, id.ToString("D"));
 public static string LockPath => Path.Combine(Root, "worker.lock");
 private static readonly SecurityIdentifier Administrators = new(WellKnownSidType.BuiltinAdministratorsSid, null);
 private static readonly SecurityIdentifier SystemAccount = new(WellKnownSidType.LocalSystemSid, null);
 public static void RejectReparse(string path) {
  var current = Path.GetFullPath(path);
  while (current != null) {
   if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
    throw new OfficeFailure("STORAGE_UNSAFE");
   current = Path.GetDirectoryName(current);
  }
 }
 public static void Initialize() {
  RejectReparse(Root);
  if (!Directory.Exists(Root)) {
   var security = new DirectorySecurity(); security.SetAccessRuleProtection(true, false); security.SetOwner(Administrators);
   var inherit = InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;
   security.AddAccessRule(new(Administrators, FileSystemRights.FullControl, inherit, PropagationFlags.None, AccessControlType.Allow));
   security.AddAccessRule(new(SystemAccount, FileSystemRights.FullControl, inherit, PropagationFlags.None, AccessControlType.Allow));
   security.AddAccessRule(new(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null), FileSystemRights.ReadAndExecute, inherit, PropagationFlags.None, AccessControlType.Allow));
   new DirectoryInfo(Root).Create(security);
  }
  ValidateProtection(Root);
 }
 private static void ValidateProtection(string path) {
  RejectReparse(path);
  var acl = new DirectoryInfo(path).GetAccessControl();
  var owner = acl.GetOwner(typeof(SecurityIdentifier)) as SecurityIdentifier ?? throw new OfficeFailure("STORAGE_UNSAFE");
  if (!owner.Equals(Administrators) && !owner.Equals(SystemAccount)) throw new OfficeFailure("STORAGE_UNSAFE");
  foreach (FileSystemAccessRule rule in acl.GetAccessRules(true, true, typeof(SecurityIdentifier)))
   if (rule.AccessControlType == AccessControlType.Allow && Policy.CanMutateFileSystem((int)rule.FileSystemRights)
    && !rule.IdentityReference.Equals(Administrators) && !rule.IdentityReference.Equals(SystemAccount)) throw new OfficeFailure("STORAGE_UNSAFE");
 }
 public void Create() {
  Initialize(); RejectReparse(DirectoryPath);
  if (!Directory.Exists(DirectoryPath)) {
   var security = new DirectoryInfo(Root).GetAccessControl();
   security.SetOwner(Administrators); new DirectoryInfo(DirectoryPath).Create(security);
  }
  ValidateProtection(DirectoryPath);
 }
 public static JobRecord? Latest() {
  RejectReparse(Root);
  var pointer = Path.Combine(Root, "latest");
  if (!File.Exists(pointer)) return null;
  RejectReparse(pointer);
  if (!Guid.TryParseExact(File.ReadAllText(pointer), "D", out var id)) throw new OfficeFailure("JOURNAL_INVALID");
  return new Journal(id).Read();
 }
 public JobRecord Read() {
  ValidateProtection(Root); ValidateProtection(DirectoryPath);
  var path = Path.Combine(DirectoryPath, "job.json"); RejectReparse(path);
  if (new FileInfo(path).Length > 4 * 1024 * 1024) throw new OfficeFailure("JOURNAL_INVALID");
  var job = JsonSerializer.Deserialize<JobRecord>(File.ReadAllText(path), Reports.Json) ?? throw new OfficeFailure("JOURNAL_INVALID");
  if (job.Schema != 1 || job.Id != id || !Enum.IsDefined(job.Stage) || !Enum.IsDefined(job.Status)) throw new OfficeFailure("JOURNAL_INVALID");
  Policy.Validate(new(job.Id, job.Action, job.Language, job.Server, job.ExpectedFingerprint));
  if (job.Progress != null) {
   ProgressPolicy.Validate(job.Progress);
   if (job.Status != JobStatus.Running) job.Progress = null;
   else if (ProgressPolicy.Current(job) == null) throw new OfficeFailure("JOURNAL_INVALID");
  }
  return job;
 }
 public async Task SaveAsync(JobRecord job) {
  if (job.Id != id) throw new OfficeFailure("JOURNAL_INVALID");
  if (job.Status != JobStatus.Running) job.Progress = null;
  else if (job.Progress != null && ProgressPolicy.Current(job) == null) throw new OfficeFailure("JOURNAL_INVALID");
  ValidateProtection(DirectoryPath);
  await Atomic(Path.Combine(DirectoryPath, "job.json"), JsonSerializer.Serialize(job, Reports.Json));
  await Atomic(Path.Combine(Root, "latest"), id.ToString("D"));
 }
 private static async Task Atomic(string path, string content) {
  RejectReparse(path); var temporary = path + ".new"; RejectReparse(temporary);
  var bytes = System.Text.Encoding.UTF8.GetBytes(content);
  await using (var file = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough)) {
   await file.WriteAsync(bytes); await file.FlushAsync(); file.Flush(true);
  }
  File.Move(temporary, path, true);
 }
 public static bool IsWorkerActive() {
  RejectReparse(LockPath);
  if (!File.Exists(LockPath)) return false;
  try { using var lease = new FileStream(LockPath, FileMode.Open, FileAccess.Read, FileShare.None); return false; }
  catch (IOException) { return true; }
  catch { throw new OfficeFailure("STORAGE_UNAVAILABLE"); }
 }
}
