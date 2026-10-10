using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Text.Json;
using ChinaTech.OfficeAssistant;
var root=Path.GetFullPath(args[0]);
using var fixture=JsonDocument.Parse(File.ReadAllBytes(Path.Combine(root,".local/office-desktop/proof/protocol-fixture.json")));
var p=fixture.RootElement.GetProperty("package").Deserialize<Package>(Protocol.Json)!;
var token=fixture.RootElement.GetProperty("token").GetString()!;
var clock=fixture.RootElement.GetProperty("clock").GetDateTimeOffset();
var script=File.ReadAllBytes(Path.Combine(root,"server-assets/office-desktop/runner.ps1.txt"));
var digest=Convert.ToHexStringLower(SHA256.HashData(script));int count=0;
void Reject(Action run,string code){try{run();throw new Exception("Unexpected acceptance");}catch(ToolException e)when(e.Code==code){count++;}}
if(!Protocol.Unseal(p,token,"install",p.JobId,digest,clock).SequenceEqual(script))throw new Exception("TypeScript / C# AES mismatch");count++;
foreach(var edit in new[]{p with{Action="uninstall"},p with{Version="5"},p with{ExpiresAt=p.ExpiresAt.AddMilliseconds(1)},p with{Tag=Convert.ToBase64String(new byte[16])},p with{Ciphertext=Convert.ToBase64String(new byte[131073])},p with{V=2},p with{Digest=new string('f',64)},p with{Nonce="invalid"},p with{Version="0"}})Reject(()=>Protocol.Unseal(edit,token,"install",p.JobId,digest,clock),"SOURCE_INVALID");
Reject(()=>Protocol.Unseal(p,"other session","install",p.JobId,digest,clock),"SOURCE_INVALID");
Reject(()=>Protocol.Unseal(p,token,"install",Guid.NewGuid().ToString("D"),digest,clock),"SOURCE_INVALID");
Reject(()=>Protocol.Unseal(p,token,"install",p.JobId,digest,p.ExpiresAt),"SOURCE_INVALID");
Reject(()=>Protocol.Unseal(p,token,"install",p.JobId,digest,clock.AddMinutes(-10)),"SOURCE_INVALID");
Reject(()=>Protocol.TrustedServer("https://malicious.example/"),"INVALID_SERVER");
foreach(var uri in new[]{"http://malicious.example/","https://user:pass@www.chinatech.in/","https://www.chinatech.in/path","https://www.chinatech.in/?key=secret","https://www.chinatech.in/#bad"})Reject(()=>Protocol.Server(uri),"INVALID_SERVER");
if(Protocol.TrustedServer(Fingerprint.Server).AbsoluteUri!=Fingerprint.Server)throw new Exception("Trusted origin mismatch");count++;
foreach(var code in new[]{"SESSION_INVALID","SESSION_EXPIRED","SESSION_REVOKED","KEY_INVALID","TOOLBOX_DISABLED","ACTION_NOT_ALLOWED","NO_ACCESS"}){if(!Protocol.RequiresUnlock(code))throw new Exception("Stale authorization remained usable: "+code);count++;}
foreach(var code in new[]{"NETWORK_ERROR","SOURCE_INVALID","LICENSE_REQUIRED","CANCELLED"}){if(Protocol.RequiresUnlock(code))throw new Exception("Unrelated error discards session: "+code);count++;}
var complete=new Result("success","COMPLETED","verify",Licensed:true);
foreach(var sample in new[]{(complete,0,"install"),(new Result("success","COMPLETED","verify"),0,"uninstall"),(new Result("installed_unlicensed","INSTALLED_UNLICENSED","verify",Licensed:false),0,"install"),(new Result("cancelled","CANCELLED","download"),1,"reinstall"),(new Result("restart_required","RESTART_REQUIRED","uninstall"),3010,"uninstall"),(new Result("error","NETWORK_ERROR","authorize"),1,"activate")}){if(!Protocol.ValidResult(sample.Item1,sample.Item2,sample.Item3))throw new Exception("Valid result rejected");count++;}
foreach(var bad in new[]{complete with{Code=null!},complete with{Stage=null!},complete with{Status=null!},complete with{Code=""},complete with{Stage=""},complete with{Status="invented"},complete with{Code="NETWORK_ERROR"},complete with{Licensed=false},new Result("installed_unlicensed","INSTALLED_UNLICENSED","verify",Licensed:null),new Result("cancelled","COMPLETED","download"),new Result("restart_required","COMPLETED","uninstall")}){if(Protocol.ValidResult(bad,0,"install"))throw new Exception("Malformed completion accepted");count++;}
if(Protocol.ValidResult(complete,1,"install")||Protocol.ValidResult(null,0))throw new Exception("Unknown process result accepted");count+=2;
Console.WriteLine($"Protocol checks passed: {count}; TypeScript / C# interop and tamper rejection.");

if(args.Length>1){
 var rid=args[1];var build=Path.Combine(root,"desktop/office-assistant/Client/bin/Release/net10.0-windows",rid,"ChinaTech.OfficeAssistant.dll");using var pe=new PEReader(File.OpenRead(build));var metadata=pe.GetMetadataReader();if(metadata.TypeDefinitions.Any(handle=>metadata.GetString(metadata.GetTypeDefinition(handle).Name)=="DevelopmentProof"))throw new Exception("Development proof leaked into release");
 var type=metadata.TypeDefinitions.Select(handle=>metadata.GetTypeDefinition(handle)).Single(t=>metadata.GetString(t.Name)=="Fingerprint");var constants=type.GetFields().Select(handle=>metadata.GetFieldDefinition(handle)).ToDictionary(f=>metadata.GetString(f.Name),f=>metadata.GetConstant(f.GetDefaultValue()));
 string StringValue(string field)=>System.Text.Encoding.Unicode.GetString(metadata.GetBlobBytes(constants[field].Value));
 if(metadata.GetBlobBytes(constants["Development"].Value)[0]!=0||StringValue("Server")!="https://www.chinatech.in/"||StringValue("RunnerSha256")!=digest)throw new Exception("Release constants invalid");
 var manifest=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,".local/office-desktop/dist",rid,"manifest.json")));using var executable=new PEReader(File.OpenRead(Path.Combine(root,".local/office-desktop/dist",rid,"ChinaTech.OfficeAssistant.exe")));if(executable.PEHeaders.CoffHeader.Machine!=(rid=="win-x64"?Machine.Amd64:Machine.Arm64))throw new Exception("Wrong PE architecture");if(manifest.RootElement.GetProperty("development").GetBoolean())throw new Exception("Dev manifest");Console.WriteLine("Release metadata verified: "+rid+" / official origin / pinned runner / no test class");
}

// Real loopback HTTP checks exercise the shared GET/POST transport without keys.
using(var portFinder=new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback,0)){
 portFinder.Start();var port=((System.Net.IPEndPoint)portFinder.LocalEndpoint).Port;portFinder.Stop();
 using var listener=new System.Net.HttpListener();listener.Prefixes.Add($"http://127.0.0.1:{port}/");listener.Start();
 async Task Respond(int status,string body){var context=await listener.GetContextAsync();if(context.Request.HttpMethod!="GET"||context.Request.HasEntityBody||context.Request.Headers["Authorization"]!=null)throw new Exception("Startup GET sent credentials or body");context.Response.StatusCode=status;if(status==302)context.Response.RedirectLocation=$"http://127.0.0.1:{port}/unexpected";var bytes=System.Text.Encoding.UTF8.GetBytes(body);context.Response.ContentLength64=bytes.Length;await context.Response.OutputStream.WriteAsync(bytes);context.Response.Close();}
 using var gateway=new Gateway(Protocol.Server($"http://127.0.0.1:{port}/"));
 var pending=Respond(200,"{\"acceptingNewSessions\":true}");var enabled=await gateway.Get<ServiceStatus>("/api/toolbox/office-desktop/status");await pending;if(enabled.AcceptingNewSessions!=true)throw new Exception("Available service GET rejected");count++;
 pending=Respond(200,"{\"acceptingNewSessions\":false}");var paused=await gateway.Get<ServiceStatus>("/api/toolbox/office-desktop/status");await pending;if(paused.AcceptingNewSessions!=false)throw new Exception("Paused service GET rejected");count++;
 pending=Respond(302,"{}");try{await gateway.Get<ServiceStatus>("/api/toolbox/office-desktop/status");throw new Exception("Redirect accepted");}catch(ToolException e)when(e.Code=="SERVICE_UNAVAILABLE"){count++;}await pending;
 pending=Respond(200,new string('x',262145));try{await gateway.Get<ServiceStatus>("/api/toolbox/office-desktop/status");throw new Exception("Oversized GET accepted");}catch(ToolException e)when(e.Code=="SERVICE_UNAVAILABLE"){count++;}await pending;
}
if(Protocol.RequiresUnlock("DESKTOP_PAUSED"))throw new Exception("Admission pause revokes existing sessions");count++;
Console.WriteLine($"Protocol and native HTTP checks passed: {count}; no Office execution.");

foreach(var pair in new[]{("0.9.0","0.10.0"),("1.2.9","1.2.10"),("0.2.0","0.2.1")}){if(Protocol.CompareVersions(pair.Item1,pair.Item2)>=0)throw new Exception("Versions were compared lexicographically");count++;}
foreach(var bad in new[]{"0.02.0","0.2","0.2.0-dev","0.2.0 ","-1.0.0","0.2.65536","1000000000.0.0"})Reject(()=>Protocol.CompareVersions(bad,"0.2.0"),"SERVICE_UNAVAILABLE");
Protocol.ValidateService(new ServiceStatus(true,"0.0.0","0.1.1"));count++; // New binary may precede public release readiness.
Reject(()=>Protocol.ValidateService(new ServiceStatus(true,"0.3.0","0.3.0")),"UPDATE_REQUIRED");
Reject(()=>Protocol.ValidateService(new ServiceStatus(false,"0.2.0","0.2.0")),"DESKTOP_PAUSED");
Reject(()=>Protocol.ValidateService(new ServiceStatus(null,"0.0.0","0.2.0")),"SERVICE_UNAVAILABLE");
Reject(()=>Protocol.ValidateService(new ServiceStatus(true,"0.3.0","0.2.0")),"SERVICE_UNAVAILABLE");
var publicClock=DateTimeOffset.UtcNow;var validPublic=new Session("synthetic-session",publicClock.AddMinutes(30),["install"],Guid.NewGuid().ToString("D"),"4");Protocol.ValidateSession(validPublic,publicClock);count++;
foreach(var malformed in new[]{validPublic with{GrantId="bad"},validPublic with{SessionToken=""},validPublic with{ExpiresAt=publicClock},validPublic with{ExpiresAt=publicClock.AddHours(2)},validPublic with{Actions=["unknown"]},validPublic with{Actions=["install","install"]},validPublic with{Actions=[]},validPublic with{Epoch="0"}})Reject(()=>Protocol.ValidateSession(malformed,publicClock),"SESSION_INVALID");
Console.WriteLine($"Protocol, startup policy and native HTTP checks passed: {count}; no Office execution.");
