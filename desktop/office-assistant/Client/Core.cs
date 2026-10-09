using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
namespace ChinaTech.OfficeAssistant;
public sealed class ToolException(string code) : Exception(code) { public string Code { get; } = code; }
public sealed record ServiceStatus(bool? AcceptingNewSessions);
public sealed record Session(string SessionToken, DateTimeOffset ExpiresAt, string[] Actions, string LicenseId, string Epoch);
public sealed record Package(int V, string Action, string Version, string Digest, DateTimeOffset ExpiresAt, string JobId, string Nonce, string Tag, string Ciphertext);
public static class Protocol {
 public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
 public static readonly string[] Actions=["install","activate","uninstall","reinstall"];
 public static bool RequiresUnlock(string code)=>code is "SESSION_INVALID" or "SESSION_EXPIRED" or "SESSION_REVOKED" or "KEY_INVALID" or "TOOLBOX_DISABLED" or "ACTION_NOT_ALLOWED" or "NO_ACCESS";
 public static bool ValidResult(Result? result,int processExit,string? action=null){
  if(result==null||string.IsNullOrEmpty(result.Code)||!System.Text.RegularExpressions.Regex.IsMatch(result.Code,"^[A-Z][A-Z0-9_]{1,63}$")||string.IsNullOrEmpty(result.Stage)||!System.Text.RegularExpressions.Regex.IsMatch(result.Stage,"^[a-z][a-z_]{1,31}$")||!new[]{"success","installed_unlicensed","error","cancelled","restart_required"}.Contains(result.Status))return false;
  if((result.Status is "success" or "installed_unlicensed")!=(processExit==0))return false;
  return result.Status switch{"success"=>result.Code=="COMPLETED"&&(action is not("install" or "reinstall" or "activate")||result.Licensed==true),"installed_unlicensed"=>result.Code=="INSTALLED_UNLICENSED"&&result.Licensed==false,"cancelled"=>result.Code=="CANCELLED","restart_required"=>result.Code=="RESTART_REQUIRED",_=>true};
 }
 public static Uri Server(string value) {
  if(!Uri.TryCreate(value,UriKind.Absolute,out var uri)||!string.IsNullOrEmpty(uri.UserInfo)||uri.AbsolutePath!="/"||!string.IsNullOrEmpty(uri.Query)||!string.IsNullOrEmpty(uri.Fragment)||!(uri.Scheme=="https"||(uri.Scheme=="http"&&(uri.Host=="localhost"||uri.Host=="127.0.0.1"))))throw new ToolException("INVALID_SERVER");
  return uri;
 }
 public static Uri TrustedServer(string value) {var uri=Server(value);if(uri.AbsoluteUri!=Fingerprint.Server)throw new ToolException("INVALID_SERVER");return uri;}
 public static byte[] Unseal(Package p,string token,string action,string requestId,string pinnedDigest,DateTimeOffset? clock=null) {
  var now=clock??DateTimeOffset.UtcNow;
  if(p.V!=1||!Actions.Contains(action)||p.Action!=action||p.JobId!=requestId||!Guid.TryParseExact(p.JobId,"D",out _)||p.ExpiresAt<=now||p.ExpiresAt>now.AddMinutes(5.1)||p.Digest!=pinnedDigest||p.Version.Length==0||p.Version[0]=='0'||p.Version.Length>19||!p.Version.All(char.IsAsciiDigit))throw new ToolException("SOURCE_INVALID");
  try {
   var nonce=Convert.FromBase64String(p.Nonce);var tag=Convert.FromBase64String(p.Tag);var ciphertext=Convert.FromBase64String(p.Ciphertext);
   if(nonce.Length!=12||tag.Length!=16||ciphertext.Length<32||ciphertext.Length>131072)throw new ToolException("SOURCE_INVALID");
   var key=SHA256.HashData(Encoding.UTF8.GetBytes("chinatech-office-desktop:payload:v1\0"+token));
   // ISO timestamp must match JavaScript's canonical Date.toISOString(), including 3 millisecond digits.
   var aad=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new object[]{1,p.Action,p.Version,p.Digest,p.ExpiresAt.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),p.JobId},Json));
   var plaintext=new byte[ciphertext.Length];using(var aes=new AesGcm(key,16))aes.Decrypt(nonce,ciphertext,tag,plaintext,aad);
   CryptographicOperations.ZeroMemory(key);
   if(Convert.ToHexStringLower(SHA256.HashData(plaintext))!=pinnedDigest)throw new ToolException("SOURCE_INVALID");
   return plaintext;
  }catch(ToolException){throw;}catch{throw new ToolException("SOURCE_INVALID");}
 }
}
public sealed class Gateway : IDisposable {
 private readonly HttpClient client;
 public Gateway(Uri server) {client=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false}){BaseAddress=server,Timeout=Timeout.InfiniteTimeSpan};}
 public Task<T> Get<T>(string path,CancellationToken cancel=default)=>Send<T>(path,null,null,null,cancel);
 public Task<T> Post<T>(string path,object body,string? token=null,string? installation=null,CancellationToken cancel=default)=>Send<T>(path,body,token,installation,cancel);
 private async Task<T> Send<T>(string path,object? body,string? token,string? installation,CancellationToken cancel) {
  using var deadline=CancellationTokenSource.CreateLinkedTokenSource(cancel);deadline.CancelAfter(TimeSpan.FromSeconds(30));var requestCancel=deadline.Token;
  using var request=new HttpRequestMessage(body==null?HttpMethod.Get:HttpMethod.Post,path);
  if(body!=null)request.Content=new StringContent(JsonSerializer.Serialize(body,Protocol.Json),Encoding.UTF8,"application/json");
  if(token!=null)request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
  if(installation!=null)request.Headers.Add("X-CT-Installation-ID",installation);
  try {
   using var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,requestCancel);
   if(response.Content.Headers.ContentLength>262144)throw new ToolException("SERVICE_UNAVAILABLE");
   using var stream=await response.Content.ReadAsStreamAsync(requestCancel);using var buffer=new MemoryStream();var chunk=new byte[8192];int read;
   while((read=await stream.ReadAsync(chunk,requestCancel))>0){if(buffer.Length+read>262144)throw new ToolException("SERVICE_UNAVAILABLE");buffer.Write(chunk,0,read);}
   if(!response.IsSuccessStatusCode){try{using var error=JsonDocument.Parse(buffer.ToArray());throw new ToolException(error.RootElement.GetProperty("code").GetString()??"SERVICE_UNAVAILABLE");}catch(ToolException){throw;}catch{throw new ToolException("SERVICE_UNAVAILABLE");}}
   return JsonSerializer.Deserialize<T>(buffer.ToArray(),Protocol.Json)??throw new ToolException("SERVICE_UNAVAILABLE");
  }catch(ToolException){throw;}catch(OperationCanceledException){throw new ToolException(cancel.IsCancellationRequested?"CANCELLED":"NETWORK_ERROR");}catch{throw new ToolException("NETWORK_ERROR");}
 }
 public void Dispose()=>client.Dispose();
}
public sealed record JobRequest(string Id,string Action,string Language,string Server,string InstallationId,string SessionToken,DateTimeOffset SessionExpiresAt,string[] Products);
public sealed record Result(string Status,string Code,string Stage,int? ExitCode=null,bool? Licensed=null,DateTimeOffset? StartedAt=null,DateTimeOffset? FinishedAt=null,string[]? ProductsBefore=null,string[]? ProductsAfter=null);
public sealed record RecordedRun(string AppVersion,string? RunnerSha256,string? JobId,string? Action,DateTimeOffset RecordedAt,Result Result,JsonElement[] Events);
