using System.IO;
using System.Diagnostics;
using System.IO.Pipes;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;
namespace ChinaTech.OfficeAssistant;
public static class Program {
 [STAThread] public static int Main(string[] args) {
#if !OFFICE_DEVELOPMENT
  if(!string.Equals(Fingerprint.Server,"https://www.chinatech.in/",StringComparison.Ordinal)||Fingerprint.Development)return 2;
#endif
#if OFFICE_DEVELOPMENT
  if(args.Length==1&&args[0]=="--installation-proof"&&Fingerprint.Development)return DevelopmentProof.Run(true).GetAwaiter().GetResult();
  if(args.Length==2&&args[0]=="--action-proof"&&Fingerprint.Development&&Protocol.Actions.Contains(args[1]))return DevelopmentProof.Run(actionProof:args[1]).GetAwaiter().GetResult();
  if(args.Length==1&&args[0]=="--self-test"&&Fingerprint.Development)return DevelopmentProof.Run().GetAwaiter().GetResult();
#endif
  if(args.Length==2&&args[0]=="--worker")return Native.WorkerEntry(args[1]);
  if(args.Length==2&&args[0]=="--diagnose"&&Fingerprint.Development) {try{var diagnostic=Path.GetFullPath(args[1]);if(!diagnostic.StartsWith(@"C:\OfficeTest\OfficeDesktop\Reports\",StringComparison.OrdinalIgnoreCase))return 2;Native.RejectReparse(Path.GetDirectoryName(diagnostic)!);Directory.CreateDirectory(Path.GetDirectoryName(diagnostic)!);File.WriteAllText(diagnostic,JsonSerializer.Serialize(Native.Inspect(),Protocol.Json));return 0;}catch{return 1;}}
  string server=Fingerprint.Server;
  if(args.Length==2&&args[0]=="--server")server=args[1];else if(args.Length!=0)return 2;
  try{_ = Protocol.TrustedServer(server);}catch{MessageBox.Show("Invalid license service / 授权服务地址无效 / Servizio non valido");return 2;}
  using var identity=System.Security.Principal.WindowsIdentity.GetCurrent();using var instance=new Mutex(true,@"Global\ChinaTech.OfficeAssistant.UI."+identity.User!.Value,out var created);
  if(!created)return 3;
  new Application().Run(new MainWindow(server));return 0;
 }
}
public sealed class MainWindow : Window {
 private readonly Dictionary<string,string[]> messages;
 private readonly string server;
 private string locale="zh-CN",installation="",stage="inspect",error="";
 private Session? session;private Inventory? inventory;private Result? result;
 private RecordedRun? recordedRun;private object? unfinishedJob;private DateTimeOffset? inspectedAt;
 private bool recovering;private readonly System.Windows.Threading.DispatcherTimer expiryTimer=new(){Interval=TimeSpan.FromSeconds(1)};
 private bool busy,executing,cancelRequested;
 private bool? acceptingNewSessions;
 private bool checkingService;
 private string serviceError="";
 private EventWaitHandle? stop;
 private PasswordBox? input;
 private readonly List<object> events=[];
 private readonly Brush purple=new SolidColorBrush(Color.FromRgb(95,87,255));
 private readonly Brush muted=new SolidColorBrush(Color.FromRgb(87,96,106));
 public MainWindow(string origin) {
  server=origin;
  var resource=Assembly.GetExecutingAssembly().GetManifestResourceNames().Single(n=>n.EndsWith("messages.json",StringComparison.Ordinal));
  using var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)!;
  messages=JsonSerializer.Deserialize<Dictionary<string,string[]>>(stream)!;
  var workArea=SystemParameters.WorkArea;Width=Math.Min(1060,workArea.Width);Height=Math.Min(820,workArea.Height);MinWidth=Math.Min(780,workArea.Width);MinHeight=Math.Min(580,workArea.Height);FontSize=16;FontFamily=new FontFamily("Segoe UI, Microsoft YaHei UI");Background=new SolidColorBrush(Color.FromRgb(246,247,249));WindowStartupLocation=WindowStartupLocation.CenterScreen;
  Closing+=(_,e)=>{if(executing){e.Cancel=true;RequestStop();MessageBox.Show(T("CloseBusy"),T("Title"));}else session=null;};
  Loaded+=async(_,_)=>{try{LoadPrevious();installation=Native.Installation();}catch(ToolException e){error=e.Code;}catch{error="LOCAL_STATE_INVALID";}await Inspect();await CheckService();};
  expiryTimer.Tick+=(_,_)=>{if(!busy&&!executing&&session!=null&&session.ExpiresAt<=DateTimeOffset.UtcNow){session=null;acceptingNewSessions=null;error="SESSION_EXPIRED";Render();_=CheckService();}};expiryTimer.Start();Closed+=(_,_)=>expiryTimer.Stop();
  Render();
 }
 private static string LocalText(string name){var path=Path.Combine(Native.Root,name);if(new FileInfo(path).Length>262144)throw new ToolException("LOCAL_STATE_INVALID");return File.ReadAllText(path);}
 private void LoadPrevious(){
  if(File.Exists(Path.Combine(Native.Root,"last-job.json"))){recovering=true;error="Recover";unfinishedJob=new{state="unreadable"};using var pending=JsonDocument.Parse(LocalText("last-job.json"));var id=pending.RootElement.GetProperty("id").GetString();var action=pending.RootElement.GetProperty("action").GetString();if(!Guid.TryParseExact(id,"D",out _)||action==null||!Protocol.Actions.Contains(action))throw new ToolException("LOCAL_STATE_INVALID");unfinishedJob=new{id,action};}
  if(File.Exists(Path.Combine(Native.Root,"last-result.json"))){using var json=JsonDocument.Parse(LocalText("last-result.json"));
   recordedRun=json.RootElement.TryGetProperty("result",out _)?json.RootElement.Deserialize<RecordedRun>(Protocol.Json):new RecordedRun("0.1.0",null,null,null,File.GetLastWriteTimeUtc(Path.Combine(Native.Root,"last-result.json")),json.RootElement.Deserialize<Result>(Protocol.Json)??throw new ToolException("LOCAL_STATE_INVALID"),[]);
   result=recordedRun?.Result;if(result==null||string.IsNullOrEmpty(result.Code)||!messages.ContainsKey(result.Code)||string.IsNullOrEmpty(result.Stage)||!new[]{"success","installed_unlicensed","error","cancelled","restart_required"}.Contains(result.Status)){result=null;recordedRun=null;throw new ToolException("LOCAL_STATE_INVALID");}stage=result.Stage;
  }
  if(recovering){result=new("error","RESULT_UNKNOWN","inspect");stage=result.Stage;}
 }
 private void RecordResult(string id,string action){
  if(result==null)return;
  if(!File.Exists(Path.Combine(Native.Root,"last-job.json"))){recovering=true;unfinishedJob=new{id,action};throw new ToolException("LOCAL_STATE_INVALID");}
  if(File.Exists(Path.Combine(Native.Root,"last-job.json"))){using var prior=JsonDocument.Parse(LocalText("last-job.json"));var priorId=prior.RootElement.GetProperty("id").GetString();var priorAction=prior.RootElement.GetProperty("action").GetString();if(priorId!=id||priorAction!=action){recovering=true;unfinishedJob=Guid.TryParseExact(priorId,"D",out _)&&priorAction!=null&&Protocol.Actions.Contains(priorAction)?new{id=priorId,action=priorAction}:new{state="unreadable"};throw new ToolException("LOCAL_STATE_INVALID");}}
  recordedRun=new("0.1.2",Fingerprint.RunnerSha256,id,action,DateTimeOffset.UtcNow,result,events.Select(x=>JsonSerializer.SerializeToElement(x,Protocol.Json)).ToArray());
  var temporary=Path.Combine(Native.Root,"last-result."+id+".tmp");File.WriteAllText(temporary,JsonSerializer.Serialize(recordedRun,Protocol.Json));File.Move(temporary,Path.Combine(Native.Root,"last-result.json"),true);
  recovering=result.Code is "RESULT_UNKNOWN" or "UNEXPECTED_ERROR";unfinishedJob=recovering?new{id,action}:null;
  if(!recovering&&File.Exists(Path.Combine(Native.Root,"last-job.json")))File.Delete(Path.Combine(Native.Root,"last-job.json"));
 }
 private void AcknowledgeRecovery(){
  if(MessageBox.Show(T("RecoveryConfirmBody"),T("Confirm"),MessageBoxButton.YesNo,MessageBoxImage.Warning,MessageBoxResult.No)!=MessageBoxResult.Yes)return;
  try{if(File.Exists(Path.Combine(Native.Root,"last-job.json"))){var archived=Path.Combine(Native.Root,"Recovery");Directory.CreateDirectory(archived);File.Move(Path.Combine(Native.Root,"last-job.json"),Path.Combine(archived,"job-"+Guid.NewGuid().ToString("D")+".json"));}recovering=false;unfinishedJob=null;error="";Render();}catch{error="LOCAL_STATE_INVALID";Render();}
 }
 private string T(string key)=>messages.TryGetValue(key,out var values)?values[locale=="it"?1:locale=="en"?2:0]:messages["UNEXPECTED_ERROR"][locale=="it"?1:locale=="en"?2:0];
 private TextBlock Text(string content,double size=16,Brush? color=null)=>new(){Text=content,FontSize=size,Foreground=color??new SolidColorBrush(Color.FromRgb(36,41,47)),TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,0,0,10)};
 private Button Button(string key,RoutedEventHandler action,bool primary=false,bool enabled=true) {var b=new Button{Content=new TextBlock{Text=T(key),TextWrapping=TextWrapping.Wrap,TextAlignment=TextAlignment.Center},Padding=new Thickness(16,10,16,10),MinHeight=44,Margin=new Thickness(0,0,10,8),Background=primary?purple:Brushes.White,Foreground=primary?Brushes.White:new SolidColorBrush(Color.FromRgb(36,41,47)),BorderBrush=new SolidColorBrush(Color.FromRgb(220,224,229)),BorderThickness=new Thickness(1),IsEnabled=enabled&&!busy};System.Windows.Automation.AutomationProperties.SetName(b,T(key));b.Click+=action;return b;}
 private Border Panel(UIElement child)=>new(){Child=child,Padding=new Thickness(22),Margin=new Thickness(0,0,0,16),Background=Brushes.White,CornerRadius=new CornerRadius(12),BorderBrush=new SolidColorBrush(Color.FromRgb(220,224,229)),BorderThickness=new Thickness(1)};
 private void Render() {
  Title=T("Title");var root=new StackPanel{Margin=new Thickness(24)};
  var header=new DockPanel();var languages=new ComboBox{Width=150,Height=44,Margin=new Thickness(10,0,0,0),IsEnabled=!busy,ItemsSource=new[]{"中文","Italiano","English"},SelectedIndex=locale=="it"?1:locale=="en"?2:0};DockPanel.SetDock(languages,Dock.Right);header.Children.Add(languages);languages.SelectionChanged+=(_,_)=>{locale=languages.SelectedIndex==1?"it":languages.SelectedIndex==2?"en":"zh-CN";Render();};header.Children.Add(Text(T("Title"),24));root.Children.Add(header);
  root.Children.Add(Text(T("Server")+": "+server,14,muted));
  if(session==null) {
   var login=new StackPanel();login.Children.Add(Text(T("Locked"),20));login.Children.Add(Text(T("LicenseNotice"),14,muted));login.Children.Add(Text(T(serviceError.Length>0?serviceError:acceptingNewSessions==true?"ServiceReady":checkingService?"ServiceCheck":"ServiceUnknown"),14,muted));login.Children.Add(Text(T("Key")));
   input=new PasswordBox{MinHeight=44,FontSize=16,Padding=new Thickness(10),Margin=new Thickness(0,0,0,16),IsEnabled=!busy&&acceptingNewSessions==true};System.Windows.Automation.AutomationProperties.SetName(input,T("Key"));login.Children.Add(input);
   login.Children.Add(Button("Unlock",async(_,_)=>await Unlock(),true,acceptingNewSessions==true));login.Children.Add(Button("CheckService",async(_,_)=>await CheckService()));root.Children.Add(Panel(login));
  }else{root.Children.Add(Button("Lock",async(_,_)=>{session=null;acceptingNewSessions=null;error="";Render();await CheckService();}));}
  if(inventory!=null) {
   var facts=new StackPanel();facts.Children.Add(Text(T("Inventory"),20));facts.Children.Add(Text(inventory.System+" · "+inventory.Architecture));facts.Children.Add(Text(inventory.Products.Length==0?T("NoOffice"):string.Join(" · ",inventory.Products)));
   facts.Children.Add(Text(T("LicenseUnknown"),14,muted));if(inventory.RestartRequired)facts.Children.Add(Text(T("Restart")));if(inventory.OfficeOpen)facts.Children.Add(Text(T("OfficeOpen")));if(!inventory.Supported)facts.Children.Add(Text(T("UNSUPPORTED_SYSTEM")));facts.Children.Add(Button("Inspect",async(_,_)=>await Inspect()));root.Children.Add(Panel(facts));
   if(session!=null){var operations=new StackPanel();operations.Children.Add(Text(T("Operations"),20));var sameAccount=Native.HasAdministratorAccount();if(!sameAccount)operations.Children.Add(Text(T("ADMIN_ACCOUNT_REQUIRED")));var grid=new System.Windows.Controls.Primitives.UniformGrid{Columns=2};
   var suites=SuiteProducts(inventory.Products);foreach(var action in Protocol.Actions){var applicable=action=="install"?suites.Length==0:action=="activate"?inventory.Products.Contains("ProPlus2024Volume"):action=="reinstall"||suites.Length>0;var card=new StackPanel{Margin=new Thickness(0,0,12,12)};card.Children.Add(Button(action,async(_,_)=>await Start(action),true,session.Actions.Contains(action)&&applicable&&sameAccount&&inventory.Supported&&!inventory.RestartRequired&&!inventory.OfficeOpen&&!recovering));card.Children.Add(Text(T(action+"Info"),14,muted));if(!applicable)card.Children.Add(Text(T(action=="install"?"InstallExistsHint":"InstalledRequiredHint"),14,muted));grid.Children.Add(card);}operations.Children.Add(grid);root.Children.Add(Panel(operations));}
  }
  if(error.Length>0){var message=new StackPanel();message.Children.Add(Text(T(error),16,new SolidColorBrush(Color.FromRgb(160,35,35))));root.Children.Add(Panel(message));}
  if(executing||result!=null){var progress=new StackPanel();progress.Children.Add(Text(T("Progress"),20));progress.Children.Add(Text(T(stage is "activate" or "install" or "uninstall"?stage+"Stage":stage)));if(executing){progress.Children.Add(new ProgressBar{IsIndeterminate=true,Height=5,Foreground=purple,Margin=new Thickness(0,0,0,16)});var cancel=Button("Cancel",(_,_)=>RequestStop(),enabled:!cancelRequested);cancel.IsEnabled=!cancelRequested;progress.Children.Add(cancel);if(cancelRequested)progress.Children.Add(Text(T("CancelPending")));}if(result!=null){progress.Children.Add(Text(T(result.Code)));if(result.Licensed==true)progress.Children.Add(Text(T("LicensedReported"),14,muted));progress.Children.Add(Text(result.Code+" · "+result.Stage,14,muted));}root.Children.Add(Panel(progress));}
  var footer=new WrapPanel();if(recovering)footer.Children.Add(Button("RecoveryChecked",(_,_)=>AcknowledgeRecovery()));footer.Children.Add(Button("Export",(_,_)=>Export(),enabled:result!=null||inventory!=null||recordedRun!=null));footer.Children.Add(Button("Tutorials",(_,_)=>Process.Start(new ProcessStartInfo("https://www.chinatech.in/toolbox/office#office-tutorials"){UseShellExecute=true})));root.Children.Add(footer);
  Content=new ScrollViewer{Content=root,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled};
 }
 private async Task Inspect() {busy=true;Render();try{inventory=await Task.Run(Native.Inspect);inspectedAt=DateTimeOffset.UtcNow;}catch{error="UNEXPECTED_ERROR";}finally{busy=false;Render();}}
 private async Task<bool> ReadService(Gateway gateway) {
  var state=await gateway.Get<ServiceStatus>("/api/toolbox/office-desktop/status");
  if(state.AcceptingNewSessions is not bool enabled)throw new ToolException("SERVICE_UNAVAILABLE");
  acceptingNewSessions=enabled;
  if(!enabled)throw new ToolException("DESKTOP_PAUSED");
  return true;
 }
 private async Task CheckService() {
  if(busy||executing||session!=null)return;
  busy=true;checkingService=true;acceptingNewSessions=null;serviceError="";Render();
  try{using var gateway=new Gateway(Protocol.TrustedServer(server));await ReadService(gateway);}
  catch(ToolException e){serviceError=e.Code;}catch{serviceError="SERVICE_UNAVAILABLE";}finally{checkingService=false;busy=false;Render();}
 }
 private async Task Unlock() {
  if(busy||input==null||acceptingNewSessions!=true)return;var key=input.Password;input.Clear();busy=true;error="";serviceError="";Render();
  try{if(installation=="")installation=Native.Installation();using var gateway=new Gateway(Protocol.TrustedServer(server));await ReadService(gateway);var next=await gateway.Post<Session>("/api/toolbox/office-desktop/session",new{key,installationId=installation,language=locale});if(next.ExpiresAt<=DateTimeOffset.UtcNow||next.Actions==null||next.Actions.Length==0||next.Actions.Any(a=>!Protocol.Actions.Contains(a))||string.IsNullOrWhiteSpace(next.SessionToken))throw new ToolException("SESSION_INVALID");session=next;inventory=await Task.Run(Native.Inspect);inspectedAt=DateTimeOffset.UtcNow;}
  catch(ToolException e){error=e.Code;if(e.Code=="DESKTOP_PAUSED")acceptingNewSessions=false;}catch{error="UNEXPECTED_ERROR";}finally{key="";busy=false;Render();}
 }
 private void RequestStop(){if(stop!=null){stop.Set();cancelRequested=true;Render();}}
 private static string[] SuiteProducts(string[] products)=>products.Where(p=>System.Text.RegularExpressions.Regex.IsMatch(p,"^(ProPlus|Standard|O365ProPlus|O365Business|O365HomePrem|O365SmallBusPrem|O365EduCloud|Professional|HomeBusiness|HomeStudent|Personal)[A-Za-z0-9]*$")).ToArray();
 private async Task Start(string action) {
  if(busy||session==null||recovering)return;
  busy=true;Render();
  if(!Native.HasAdministratorAccount()){error="ADMIN_ACCOUNT_REQUIRED";busy=false;Render();return;}
  if(session.ExpiresAt<=DateTimeOffset.UtcNow){session=null;error="SESSION_EXPIRED";busy=false;Render();return;}
  Inventory current;try{current=await Task.Run(Native.Inspect);inventory=current;}catch{busy=false;error="UNEXPECTED_ERROR";Render();return;}
  if(!current.Supported||current.RestartRequired||current.OfficeOpen){error=!current.Supported?"UNSUPPORTED_SYSTEM":current.RestartRequired?"RESTART_REQUIRED":"SAVE_DOCUMENTS";busy=false;Render();return;}
  var suites=SuiteProducts(current.Products);
  if(MessageBox.Show(T(action)+"\n\n"+T("Confirm"+char.ToUpperInvariant(action[0])+action[1..])+"\n\n"+string.Join("\n",suites),T("Confirm"),MessageBoxButton.YesNo,MessageBoxImage.Warning,MessageBoxResult.No)!=MessageBoxResult.Yes){busy=false;Render();return;}
  busy=true;executing=true;cancelRequested=false;error="";result=null;events.Clear();stage="authorize";Render();
  var id=Guid.NewGuid().ToString("D");var pending=Native.Pending(id);
  using var wait=new CancellationTokenSource();Process? worker=null;
  try {
   Directory.CreateDirectory(pending);Native.RejectReparse(pending);
   stop=new EventWaitHandle(false,EventResetMode.ManualReset,@"Global\ChinaTech.OfficeAssistant.Cancel."+id);
   using var pipe=new NamedPipeServerStream("ChinaTech.OfficeAssistant."+id,PipeDirection.In,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly|PipeOptions.FirstPipeInstance);
   var request=new JobRequest(id,action,locale,server,installation,session.SessionToken,session.ExpiresAt,current.Products);
   await File.WriteAllTextAsync(Path.Combine(Native.Root,"last-job.json"),JsonSerializer.Serialize(new{id,action},Protocol.Json));
   await File.WriteAllBytesAsync(Path.Combine(pending,"request.dpapi"),Native.Protect(JsonSerializer.SerializeToUtf8Bytes(request,Protocol.Json)));
   var ready=pipe.WaitForConnectionAsync(wait.Token);
   var executable=Environment.ProcessPath??throw new ToolException("START_FAILED");
   worker=Process.Start(new ProcessStartInfo(executable){UseShellExecute=true,Verb="runas",Arguments="--worker "+id})??throw new ToolException("START_FAILED");
   var finish=worker.WaitForExitAsync();var first=await Task.WhenAny(ready,finish,Task.Delay(35000));if(first!=ready)throw new ToolException("RESULT_UNKNOWN");await ready;Native.VerifyPeer(pipe.SafePipeHandle,worker.Id);
   using var reader=new StreamReader(pipe,new UTF8Encoding(false));
   while(await reader.ReadLineAsync() is { } line){if(line.Length>16384)throw new ToolException("RESULT_UNKNOWN");using var record=JsonDocument.Parse(line);if(record.RootElement.TryGetProperty("result",out var final)){result=final.Deserialize<Result>(Protocol.Json);break;}if(record.RootElement.TryGetProperty("stage",out var next)){stage=next.GetString()??"execute";var code=record.RootElement.GetProperty("code").GetString();if(code=="SLOW_STEP")error="SLOW_STEP";events.Add(new{stage,code});Render();}}
   await finish;if(!Protocol.ValidResult(result,worker.ExitCode,action))throw new ToolException("RESULT_UNKNOWN");
   try{inventory=await Task.Run(Native.Inspect);inspectedAt=DateTimeOffset.UtcNow;}catch{error="INSPECTION_FAILED";}
  }catch(System.ComponentModel.Win32Exception e)when(e.NativeErrorCode==1223){result=new("error","UAC_CANCELLED","authorize");}
  catch(ToolException e){result=new("error",e.Code,stage);}
  catch{result=new("error","RESULT_UNKNOWN",stage);}
  finally{wait.Cancel();if(worker!=null&&!worker.HasExited){stop?.Set();cancelRequested=true;Render();try{await worker.WaitForExitAsync();}catch{result=new("error","RESULT_UNKNOWN",stage);}}worker?.Dispose();if(result!=null&&Protocol.RequiresUnlock(result.Code))session=null;try{RecordResult(id,action);}catch{error="LOCAL_STATE_INVALID";recovering=true;}try{File.Delete(Path.Combine(pending,"request.dpapi"));}catch{}stop?.Dispose();stop=null;executing=false;busy=false;Render();}
 }
 private void Export() {
  if(result==null&&inventory==null&&recordedRun==null)return;var save=new SaveFileDialog{Title=T("Export"),Filter="JSON (*.json)|*.json",FileName="ChinaTech-Office-report-"+DateTime.Now.ToString("yyyyMMdd-HHmm")+".json"};
  if(save.ShowDialog()!=true)return;
  try{File.WriteAllText(save.FileName,JsonSerializer.Serialize(new{appVersion="0.1.2",currentRunnerSha256=Fingerprint.RunnerSha256,currentInspection=new{capturedAt=inspectedAt,inventory},recordedRun,result,events,unfinishedJob,recoveryRequired=recovering,errorCode=error.Length>0?error:null},new JsonSerializerOptions(Protocol.Json){WriteIndented=true}));}catch{error="LOCAL_STATE_INVALID";Render();}
 }
}
