using System.IO;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
namespace ChinaTech.OfficeAssistant;
public sealed record Inventory(string System,string Architecture,string[] Products,bool RestartRequired,bool OfficeOpen,bool Supported);
public static class Native {
 public static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"ChinaTech","OfficeAssistant");
 public static readonly string WorkRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"ChinaTechOfficeAssistant","Jobs");
 public static bool HasAdministratorAccount(){using var identity=WindowsIdentity.GetCurrent();return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)||(identity.Groups?.Contains(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null))??false);}
 public static Inventory Inspect() {
  using var hklm=RegistryKey.OpenBaseKey(RegistryHive.LocalMachine,RegistryView.Registry64);
  using var config=hklm.OpenSubKey(@"SOFTWARE\Microsoft\Office\ClickToRun\Configuration");
  var products=(config?.GetValue("ProductReleaseIds") as string??"").Split(',',StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries).Distinct().Order(StringComparer.Ordinal).ToArray();
  var pending=Exists(hklm,@"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending")||Exists(hklm,@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired");
  using var manager=hklm.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Session Manager");var renames=manager?.GetValue("PendingFileRenameOperations") as string[]??[];
  var roots=new List<string>();foreach(var folder in new[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)})if(folder.Length>0){roots.Add(Path.Combine(folder,"Microsoft Office"));roots.Add(Path.Combine(folder,@"Common Files\Microsoft Shared\ClickToRun"));}
  for(int i=0;i<renames.Length;i+=2){var source=renames[i].Replace(@"\??\","").Replace(@"\\?\","");var target=i+1<renames.Length?renames[i+1].TrimStart('!').Replace(@"\??\","").Replace(@"\\?\",""):"";if((File.Exists(source)||(target.Length>0&&Directory.Exists(source)))&&new[]{source,target}.Any(path=>roots.Any(root=>path.Equals(root,StringComparison.OrdinalIgnoreCase)||path.StartsWith(root+"\\",StringComparison.OrdinalIgnoreCase))))pending=true;}
  var open=false;foreach(var name in new[]{"WINWORD","EXCEL","POWERPNT","OUTLOOK","MSACCESS","ONENOTE","VISIO","WINPROJ","LYNC"}){var processes=Process.GetProcessesByName(name);open|=processes.Length>0;foreach(var p in processes)p.Dispose();}
  return new((Environment.OSVersion.Version.Build>=22000?"Windows 11":"Windows 10")+" · "+Environment.OSVersion.Version,RuntimeInformation.OSArchitecture.ToString(),products,pending,open,Environment.OSVersion.Version.Build>=22000&&Environment.Is64BitProcess);
 }
 private static bool Exists(RegistryKey root,string path){using var k=root.OpenSubKey(path);return k!=null;}
 public static string Installation() {
  Directory.CreateDirectory(Root);var path=Path.Combine(Root,"installation.dpapi");
  if(File.Exists(path)){var value=Encoding.UTF8.GetString(Unprotect(File.ReadAllBytes(path)));if(Guid.TryParseExact(value,"D",out _))return value;throw new ToolException("LOCAL_STATE_INVALID");}
  var id=Guid.NewGuid().ToString("D");var bytes=Protect(Encoding.UTF8.GetBytes(id));
  try{using var file=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None);file.Write(bytes);}catch(IOException)when(File.Exists(path)){return Installation();}
  return id;
 }
 public static string ExistingInstallation() {
  RejectReparse(Root);var path=Path.Combine(Root,"installation.dpapi");if(!File.Exists(path)||(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new ToolException("LOCAL_STATE_INVALID");
  var id=Encoding.UTF8.GetString(Unprotect(File.ReadAllBytes(path)));if(!Guid.TryParseExact(id,"D",out _))throw new ToolException("LOCAL_STATE_INVALID");return id;
 }
 public static string Pending(string id) {
  if(!Guid.TryParseExact(id,"D",out _))throw new ToolException("INVALID_REQUEST");
  return Path.Combine(Root,"Pending",id);
 }
 public static void RejectReparse(string path) {
  for(var directory=new DirectoryInfo(path);directory!=null;directory=directory.Parent)if(directory.Exists&&(directory.Attributes&FileAttributes.ReparsePoint)!=0)throw new ToolException("LOCAL_STATE_INVALID");
 }
 public static void ProtectDirectory(string path) {
  RejectReparse(path);Directory.CreateDirectory(path);RejectReparse(path);
  var security=new DirectorySecurity();security.SetAccessRuleProtection(true,false);security.SetOwner(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null));
  security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null),FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
  security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
  new DirectoryInfo(path).SetAccessControl(security);
 }
 [StructLayout(LayoutKind.Sequential)]private struct Blob{public int Size;public IntPtr Data;}
 [DllImport("crypt32.dll",SetLastError=true,CharSet=CharSet.Unicode)]private static extern bool CryptProtectData(ref Blob input,string? description,IntPtr entropy,IntPtr reserved,IntPtr prompt,uint flags,out Blob output);
 [DllImport("crypt32.dll",SetLastError=true,CharSet=CharSet.Unicode)]private static extern bool CryptUnprotectData(ref Blob input,IntPtr description,IntPtr entropy,IntPtr reserved,IntPtr prompt,uint flags,out Blob output);
 [DllImport("kernel32.dll")]private static extern IntPtr LocalFree(IntPtr memory);
 private static byte[] Dpapi(byte[] bytes,bool protect) {
  var input=new Blob{Size=bytes.Length,Data=Marshal.AllocHGlobal(bytes.Length)};Marshal.Copy(bytes,0,input.Data,bytes.Length);
  try{Blob output;var ok=protect?CryptProtectData(ref input,"ChinaTech Office task",IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,1,out output):CryptUnprotectData(ref input,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,1,out output);
   if(!ok)throw new ToolException("LOCAL_STATE_INVALID");try{var result=new byte[output.Size];Marshal.Copy(output.Data,result,0,result.Length);return result;}finally{LocalFree(output.Data);}
  }finally{Marshal.FreeHGlobal(input.Data);}
 }
 [DllImport("kernel32.dll",SetLastError=true)]private static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe,out uint pid);
 public static void VerifyPeer(SafePipeHandle handle,int expectedPid){if(!GetNamedPipeClientProcessId(handle,out var pid)||pid!=(uint)expectedPid)throw new ToolException("SOURCE_INVALID");}
 public static byte[] Protect(byte[] bytes)=>Dpapi(bytes,true);
 public static byte[] Unprotect(byte[] bytes)=>Dpapi(bytes,false);
 public static int WorkerEntry(string id) {
  using var mutex=new Mutex(false,@"Global\ChinaTech.OfficeAssistant.Execution");bool locked=false;
  try{try{locked=mutex.WaitOne(0);}catch(AbandonedMutexException){locked=true;}return Worker(id,locked).GetAwaiter().GetResult();}
  catch{return 1;}finally{if(locked)mutex.ReleaseMutex();}
 }
 private static async Task<int> Worker(string id,bool locked) {
  var pending=Pending(id);RejectReparse(pending);var stage="authorize";
  using var pipe=new NamedPipeClientStream(".","ChinaTech.OfficeAssistant."+id,PipeDirection.Out,PipeOptions.Asynchronous);
  await pipe.ConnectAsync(30000);using var writer=new StreamWriter(pipe,new UTF8Encoding(false)){AutoFlush=true};
  using var cancellation=new EventWaitHandle(false,EventResetMode.ManualReset,@"Global\ChinaTech.OfficeAssistant.Cancel."+id);
  using var authorizationCancel=new CancellationTokenSource();
  var cancelRegistration=ThreadPool.RegisterWaitForSingleObject(cancellation,static(state,_)=>{try{((CancellationTokenSource)state!).Cancel();}catch(ObjectDisposedException){}},authorizationCancel,Timeout.Infinite,true);
  Process? ownedProcess=null;string? activeMarker=null;bool childStarted=false,verified=false;
  async Task Emit(string text){try{await writer.WriteLineAsync(text);}catch(IOException){cancellation.Set();}}
  try {
   var identity=WindowsIdentity.GetCurrent();if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw new ToolException("ADMIN_REQUIRED");
   if(!locked)throw new ToolException("ANOTHER_TASK");
   var bytes=File.ReadAllBytes(Path.Combine(pending,"request.dpapi"));if(bytes.Length>65536)throw new ToolException("INVALID_REQUEST");
   var request=JsonSerializer.Deserialize<JobRequest>(Unprotect(bytes),Protocol.Json)??throw new ToolException("INVALID_REQUEST");
   if(request.Id!=id||!Protocol.Actions.Contains(request.Action)||request.Language is not("zh-CN" or "it" or "en")||request.SessionExpiresAt<=DateTimeOffset.UtcNow||request.InstallationId!=ExistingInstallation())throw new ToolException("SESSION_INVALID");
   using var gateway=new Gateway(Protocol.TrustedServer(request.Server));
   if(cancellation.WaitOne(0))throw new ToolException("CANCELLED");
   var package=await gateway.Post<Package>("/api/toolbox/office-desktop/package",new{action=request.Action,requestId=id},request.SessionToken,request.InstallationId,authorizationCancel.Token);
   var runner=Protocol.Unseal(package,request.SessionToken,request.Action,id,Fingerprint.RunnerSha256);
   if(cancellation.WaitOne(0))throw new ToolException("CANCELLED");
   var working=Path.Combine(WorkRoot,id);if(Directory.Exists(working))throw new ToolException("LOCAL_STATE_INVALID");ProtectDirectory(Path.GetDirectoryName(WorkRoot)!);ProtectDirectory(WorkRoot);
   var marker=Path.Combine(Path.GetDirectoryName(WorkRoot)!,"unfinished.json");if(File.Exists(marker))throw new ToolException("TASK_RECOVERY_REQUIRED");activeMarker=marker;
   ProtectDirectory(working);
   var script=Path.Combine(working,"runner.ps1");await File.WriteAllBytesAsync(script,runner);
   await File.WriteAllTextAsync(Path.Combine(working,"job.json"),JsonSerializer.Serialize(new{id,action=request.Action,language=request.Language,products=request.Products,packageExpiresAt=package.ExpiresAt},Protocol.Json));
   if(Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(await File.ReadAllBytesAsync(script)))!=Fingerprint.RunnerSha256)throw new ToolException("SOURCE_INVALID");
   // System32 resolves to the current native system directory. All arguments are fixed or generated UUID paths.
   var start=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe")){UseShellExecute=false,CreateNoWindow=true};
   start.Environment["PSModulePath"]=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\Modules");
   start.Environment["PSExecutionPolicyPreference"]="Bypass";
   foreach(var arg in new[]{"-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script,"-Action",request.Action,"-JobDirectory",working})start.ArgumentList.Add(arg);
   await File.WriteAllTextAsync(activeMarker,JsonSerializer.Serialize(new{id,working,startedAt=DateTimeOffset.UtcNow},Protocol.Json));
   var process=Process.Start(start)??throw new ToolException("START_FAILED");ownedProcess=process;childStarted=true;stage="execute";
   var events=Path.Combine(working,"events.jsonl");string sent="";
   async Task PublishEvents(){
    try{if(!File.Exists(events))return;using var input=new FileStream(events,FileMode.Open,FileAccess.Read,FileShare.ReadWrite);using var read=new StreamReader(input,Encoding.UTF8);var text=await read.ReadToEndAsync();var end=text.LastIndexOf('\n');if(end<0)return;text=text[..(end+1)];if(text.Length>sent.Length){foreach(var line in text[sent.Length..].Split('\n',StringSplitOptions.RemoveEmptyEntries))await Emit(line);sent=text;}}
    catch(IOException){} // Progress sharing cannot change the installation result.
   }
   while(!process.HasExited){await PublishEvents();await Emit("{\"heartbeat\":true}");await Task.Delay(500);}
   await process.WaitForExitAsync();await PublishEvents();
   var resultPath=Path.Combine(working,"result.json");if(!File.Exists(resultPath))throw new ToolException("RESULT_UNKNOWN");
   var result=JsonSerializer.Deserialize<Result>(await File.ReadAllTextAsync(resultPath),Protocol.Json)??throw new ToolException("RESULT_UNKNOWN");
   if(!Protocol.ValidResult(result,process.ExitCode,request.Action))throw new ToolException("RESULT_UNKNOWN");
   verified=result.Code!="UNEXPECTED_ERROR";if(verified)File.Delete(activeMarker);
   await Emit(JsonSerializer.Serialize(new{result},Protocol.Json));
   // Media and immutable result remain under administrator ACL for recovery diagnosis; no blind resume.
   return result.Status is "success" or "installed_unlicensed"?0:1;
  }catch(Exception e){var code=e is ToolException t?t.Code:"UNEXPECTED_ERROR";var result=new Result(code=="CANCELLED"?"cancelled":"error",code,stage,FinishedAt:DateTimeOffset.UtcNow);try{await Emit(JsonSerializer.Serialize(new{result},Protocol.Json));}catch{}return 1;}
  finally{cancelRegistration.Unregister(null);if(ownedProcess!=null){try{if(!ownedProcess.HasExited)await ownedProcess.WaitForExitAsync();}catch(InvalidOperationException){}}ownedProcess?.Dispose();if(activeMarker!=null&&(!childStarted||verified)){try{File.Delete(activeMarker);}catch{}}}
 }
}
