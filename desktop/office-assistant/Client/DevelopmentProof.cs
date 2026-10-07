// Compiled development builds only. Explicit action proofs run in the dedicated test VM.
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace ChinaTech.OfficeAssistant;
public static class DevelopmentProof {
 public static async Task<int> Run(bool installationProof=false,string? actionProof=null) {
  const string folder=@"C:\OfficeTest\OfficeDesktop";
  Directory.CreateDirectory(Path.Combine(folder,"Reports"));var checks=new List<string>();
  try {
   var runner=await File.ReadAllBytesAsync(Path.Combine(folder,"runner.ps1.txt"));if(Convert.ToHexStringLower(SHA256.HashData(runner))!=Fingerprint.RunnerSha256)throw new Exception("Test runner mismatch");
   var inventory=Native.Inspect();if((actionProof==null&&inventory.Products.Length!=0)||inventory.RestartRequired||inventory.OfficeOpen)throw new Exception("Read-only proof requires empty Office inventory and no pending restart");
   var installation=Native.Installation();if(Native.Installation()!=installation||Encoding.UTF8.GetString(Native.Unprotect(Native.Protect(Encoding.UTF8.GetBytes("synthetic"))))!="synthetic")throw new Exception("DPAPI failed");checks.Add("Real Windows DPAPI / installation persistence");
   using var listener=new HttpListener();listener.Prefixes.Add(Fingerprint.Server);listener.Start();
   async Task Respond() {
    while(listener.IsListening){HttpListenerContext context;try{context=await listener.GetContextAsync();}catch{break;}
     using var reader=new StreamReader(context.Request.InputStream);using var json=JsonDocument.Parse(await reader.ReadToEndAsync());
     var action=json.RootElement.GetProperty("action").GetString()!;var id=json.RootElement.GetProperty("requestId").GetString()!;var exp=DateTimeOffset.UtcNow.AddMinutes(4);var token=context.Request.Headers["Authorization"]![7..];
     var digest=Fingerprint.RunnerSha256;var nonce=RandomNumberGenerator.GetBytes(12);var tag=new byte[16];var ciphertext=new byte[runner.Length];var key=SHA256.HashData(Encoding.UTF8.GetBytes("chinatech-office-desktop:payload:v1\0"+token));var aad=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new object[]{1,action,"1",digest,exp.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),id},Protocol.Json));using(var aes=new AesGcm(key,16))aes.Encrypt(nonce,runner,ciphertext,tag,aad);
     var p=new Package(1,action,"1",digest,DateTimeOffset.Parse(exp.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")),id,Convert.ToBase64String(nonce),Convert.ToBase64String(tag),Convert.ToBase64String(ciphertext));var bytes=JsonSerializer.SerializeToUtf8Bytes(p,Protocol.Json);context.Response.ContentType="application/json";context.Response.ContentLength64=bytes.Length;await context.Response.OutputStream.WriteAsync(bytes);context.Response.Close();
    }
   }
   var server=Respond();
   async Task<Result> Job(string action) {
    var id=Guid.NewGuid().ToString("D");var pending=Native.Pending(id);Directory.CreateDirectory(pending);var request=new JobRequest(id,action,"en",Fingerprint.Server,installation,"synthetic-test-session",DateTimeOffset.UtcNow.AddMinutes(30),inventory.Products);await File.WriteAllBytesAsync(Path.Combine(pending,"request.dpapi"),Native.Protect(JsonSerializer.SerializeToUtf8Bytes(request,Protocol.Json)));
    using var pipe=new NamedPipeServerStream("ChinaTech.OfficeAssistant."+id,PipeDirection.In,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly|PipeOptions.FirstPipeInstance);using var cancel=new CancellationTokenSource(installationProof||actionProof!=null?TimeSpan.FromMinutes(90):TimeSpan.FromSeconds(45));var ready=pipe.WaitForConnectionAsync(cancel.Token);using var process=Process.Start(new ProcessStartInfo(Environment.ProcessPath!){UseShellExecute=false,ArgumentList={"--worker",id}})!;await ready;Native.VerifyPeer(pipe.SafePipeHandle,process.Id);using var reader=new StreamReader(pipe);Result? result=null;while(await reader.ReadLineAsync(cancel.Token) is { } line){using var record=JsonDocument.Parse(line);if(record.RootElement.TryGetProperty("result",out var final)){result=final.Deserialize<Result>(Protocol.Json);break;}}await process.WaitForExitAsync(cancel.Token);File.Delete(Path.Combine(pending,"request.dpapi"));if(result==null)throw new Exception("Missing result");if(process.ExitCode!=(result.Status is "success" or "installed_unlicensed"?0:1))throw new Exception("Exit result mismatch");return result;
   }
   if(actionProof!=null){var actual=await Job(actionProof);listener.Stop();await server;await File.WriteAllTextAsync(Path.Combine(folder,"Reports","action-"+actionProof+".json"),JsonSerializer.Serialize(new{passed=actual.Code!="UNEXPECTED_ERROR"&&actual.Code!="RESULT_UNKNOWN",checks,result=actual,inventory=Native.Inspect(),authorization="synthetic local test responder; actual Auth tested separately",production=false},Protocol.Json));return actual.Code is "UNEXPECTED_ERROR" or "RESULT_UNKNOWN"?1:0;}
   if(installationProof){var installed=await Job("install");if(installed.Status is not("success" or "installed_unlicensed"))throw new Exception("Installation result: "+installed.Code);checks.Add("Actual Microsoft ODT installation: "+installed.Code);var after=Native.Inspect();if(!after.Products.Contains("ProPlus2024Volume"))throw new Exception("Installed SKU absent");listener.Stop();await server;await File.WriteAllTextAsync(Path.Combine(folder,"Reports","installation-proof.json"),JsonSerializer.Serialize(new{passed=true,checks,result=installed,inventory=after,authorization="synthetic local test responder; actual Auth tested separately",production=false},Protocol.Json));return 0;}
   foreach(var action in new[]{"activate","uninstall"}){var result=await Job(action);if(result.Code!="PRODUCT_NOT_FOUND"||result.Status!="error")throw new Exception(action+": "+result.Code);checks.Add(action+": real worker / pipe peer / system PowerShell / no-product preflight");}
   var marker=Path.Combine(Path.GetDirectoryName(Native.WorkRoot)!,"unfinished.json");if(File.Exists(marker))throw new Exception("Existing recovery marker must be preserved");await File.WriteAllTextAsync(marker,"{\"syntheticProof\":true}");try{var blocked=await Job("activate");if(blocked.Code!="TASK_RECOVERY_REQUIRED"||!File.Exists(marker))throw new Exception("Unknown prior job was not blocked");checks.Add("Protected unfinished marker blocks next job and remains preserved");}finally{File.Delete(marker);}
   listener.Stop();await server;
   if(!Native.Inspect().Products.SequenceEqual(inventory.Products))throw new Exception("Office changed");checks.Add("Office products unchanged");
   await File.WriteAllTextAsync(Path.Combine(folder,"Reports","native-proof.json"),JsonSerializer.Serialize(new{passed=true,checks,authorization="synthetic local test responder; actual Auth tested separately",officeMutations=0},Protocol.Json));return 0;
  }catch(Exception e){await File.WriteAllTextAsync(Path.Combine(folder,"Reports",actionProof!=null?"action-"+actionProof+".json":installationProof?"installation-proof.json":"native-proof.json"),JsonSerializer.Serialize(new{passed=false,checks,error=e.Message},Protocol.Json));return 1;}
 }
}
