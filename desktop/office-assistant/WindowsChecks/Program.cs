using ChinaTech.OfficeAssistant;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using System.Reflection;
using System.IO.Pipes;
int count = 0;
void Check(bool passed, string label) { if (!passed) throw new Exception(label); Console.WriteLine("PASS " + label); count++; }
Check(!Policy.CanMutateFileSystem((int)FileSystemRights.ReadAndExecute), "native ReadAndExecute accepted");
Check(Policy.CanMutateFileSystem((int)FileSystemRights.WriteData), "native WriteData rejected");
Check(Policy.CanMutateFileSystem((int)FileSystemRights.Delete), "native Delete rejected");
Check(Policy.CanMutateFileSystem((int)FileSystemRights.ChangePermissions), "native ACL modification rejected");
var store = new Journal(Guid.NewGuid()); store.Create();
// Restore only earlier fixtures from this isolated checker directory, using a fresh descriptor.
foreach (var path in Directory.GetDirectories(Journal.Root)) {
 Journal.RejectReparse(path);
 var restored = new DirectorySecurity();
 var sections = AccessControlSections.Access | AccessControlSections.Owner | AccessControlSections.Group;
 restored.SetSecurityDescriptorSddlForm(new DirectoryInfo(Journal.Root).GetAccessControl().GetSecurityDescriptorSddlForm(sections), sections);
 new DirectoryInfo(path).SetAccessControl(restored);
}
var inventory = await OfficePlatform.InspectAsync();
Console.WriteLine("INVENTORY " + JsonSerializer.Serialize(inventory, Reports.Json));
Check(inventory.Architecture is "Arm64" or "X64", "real Windows architecture read");
Check(inventory.Components.Length == 8, "all eight component observations present");
var job = new JobRecord { Id = Guid.Parse(Path.GetFileName(store.DirectoryPath)), ActorSid = WindowsIdentity.GetCurrent().User!.Value,
 ExpectedFingerprint = inventory.Fingerprint, Observation = inventory, Status = JobStatus.Completed, Code = "NATIVE_TEST_ONLY" };
await store.SaveAsync(job);
Check(store.Read().Id == job.Id, "protected atomic journal roundtrip");
Check(Journal.Latest()?.Id == job.Id, "protected latest pointer roundtrip");
using (var lease = new FileStream(Journal.LockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
 Check(Journal.IsWorkerActive(), "real exclusive machine lease blocks duplicate worker");
Check(!Journal.IsWorkerActive(), "closed lease permits next task");
var folder = new DirectoryInfo(store.DirectoryPath); var original = folder.GetAccessControl();
var unsafeAcl = folder.GetAccessControl();
unsafeAcl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null), FileSystemRights.WriteData, AccessControlType.Allow));
folder.SetAccessControl(unsafeAcl);
try { store.Read(); throw new Exception("accepted user-writable privileged journal"); }
catch (OfficeFailure e) { Check(e.Code == "STORAGE_UNSAFE", "real user-writable storage rejected"); }
finally {
 var restored = new DirectorySecurity(); var sections = AccessControlSections.Access | AccessControlSections.Owner | AccessControlSections.Group;
 restored.SetSecurityDescriptorSddlForm(original.GetSecurityDescriptorSddlForm(sections), sections); folder.SetAccessControl(restored);
}
Check(store.Read().Id == job.Id, "restored exact ACL permits read");
var method = typeof(Coordinator).GetMethod("ListenForCancel", BindingFlags.NonPublic | BindingFlags.Static)!;
using (var cancel = new CancellationTokenSource()) using (var stop = new CancellationTokenSource()) {
 var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); var id = Guid.NewGuid();
 var listen = (Task)method.Invoke(null, [id, WindowsIdentity.GetCurrent().User!, cancel, stop.Token, ready])!;
 await ready.Task.WaitAsync(TimeSpan.FromSeconds(10));
 Check(await Coordinator.RequestCancelAsync(id), "real cancellation pipe acknowledges bounded request");
 Check(cancel.IsCancellationRequested, "pipe triggers safe cancellation token");
 stop.Cancel(); try { await listen; } catch (OperationCanceledException) { }
}
using (var cancel = new CancellationTokenSource()) using (var stop = new CancellationTokenSource()) {
 var id = Guid.NewGuid(); using var occupied = new NamedPipeServerStream("ChinaTech.OfficeAssistant1.Cancel." + id.ToString("N"), PipeDirection.InOut);
 var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
 var listen = (Task)method.Invoke(null, [id, WindowsIdentity.GetCurrent().User!, cancel, stop.Token, ready])!;
 try { await ready.Task; throw new Exception("accepted preoccupied control pipe"); }
 catch (Exception e) when (e is UnauthorizedAccessException || e is IOException && e.HResult == unchecked((int)0x800700E7)) {
  Check(ready.Task.IsFaulted && listen.IsFaulted && !cancel.IsCancellationRequested, "preoccupied cancellation pipe prevents ready state");
 }
 try { await listen; }
 catch (Exception e) when (e is UnauthorizedAccessException || e is IOException && e.HResult == unchecked((int)0x800700E7)) { }
}
Console.WriteLine($"{count} native Windows checks passed. Office operations=0; GUI/UAC/activation acceptance=false.");
