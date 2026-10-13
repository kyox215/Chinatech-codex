package in.chinatech.smartswitchbridge;
import android.content.*;import android.os.*;import android.Manifest;import android.content.pm.PackageManager;
import java.io.*;import java.security.*;import java.nio.charset.StandardCharsets;import java.util.*;import java.util.concurrent.*;
/** Pair -> actual source snapshot -> catalog -> remote choice -> source consent -> data. */
final class FlowTransfer {
 interface Observer{void phase(String state);void consent(boolean waiting);void scan();}
 interface CatalogPreparer{void prepare(DataOutputStream out,DataInputStream in,ProtocolCore.Check check,CancellationScope io)throws Exception;}
 final FlowCatalogStore catalog;private final Context c;private final TransferStore sources;private final Observer observer;
 volatile String phase="idle",peer="";volatile int scope,sdk;volatile long scanFailures;
 private volatile CompletableFuture<Boolean> choice,consent;private byte[] acceptedChoice;private String session=ProtocolCore.token(16);
 private boolean phoneScanPending,sourceCatalogReady;private CatalogPreparer preparer;
 FlowTransfer(Context c,TransferStore sources,Observer observer){this.c=c;this.sources=sources;this.observer=observer;catalog=new FlowCatalogStore(c);}
 void catalogPreparer(CatalogPreparer value){preparer=value;}
 void state(String state){phase=state;observer.phase(state);}
 /** New pairing only. Socket retries retain this session, catalog and accepted choice. */
 void resetSession(){cancel();session=ProtocolCore.token(16);acceptedChoice=null;sourceCatalogReady=false;phoneScanPending=false;peer="";scope=0;sdk=0;scanFailures=0;state("idle");}
 void prepareSource(){
  sourceCatalogReady=false;phoneScanPending=sources.count(false)==0||ScanState.INCOMPLETE.equals(sources.scanState().phone());
  if(phoneScanPending)sources.beginScan(ScanState.PHONE,true,scanDetails(0));scanFailures=savedFailures();state("pair");
 }
 private int grants(){
  int n=0;boolean old=Build.VERSION.SDK_INT<=32&&allowed(Manifest.permission.READ_EXTERNAL_STORAGE),partial=Build.VERSION.SDK_INT>=34&&allowed("android.permission.READ_MEDIA_VISUAL_USER_SELECTED");
  if(old||allowed("android.permission.READ_MEDIA_IMAGES")||partial)n|=1;if(old||allowed("android.permission.READ_MEDIA_VIDEO")||partial)n|=2;if(old||allowed("android.permission.READ_MEDIA_AUDIO"))n|=4;
  if(allowed(Manifest.permission.READ_CONTACTS))n|=8;if(allowed(Manifest.permission.READ_CALENDAR))n|=16;if(partial&&!(allowed("android.permission.READ_MEDIA_IMAGES")&&allowed("android.permission.READ_MEDIA_VIDEO")))n|=32;
  if(ScanState.COMPLETE.equals(sources.scanState().phone()))n|=64;return n;
 }
 private boolean allowed(String p){return c.checkSelfPermission(p)==PackageManager.PERMISSION_GRANTED;}
 private Map<String,String> scanDetails(long failures){int n=grants();Map<String,String> values=new LinkedHashMap<>();values.put("scanFailures",Long.toString(failures));values.put("scanPartial",Boolean.toString((n&32)!=0));values.put("scanMediaMissing",Boolean.toString((n&7)!=7||(n&32)!=0));values.put("scanContactsMissing",Boolean.toString((n&8)==0));values.put("scanCalendarMissing",Boolean.toString((n&16)==0));return values;}
 private long savedFailures(){try{return Math.max(0,Long.parseLong(sources.get("scanFailures")));}catch(RuntimeException ignored){return 0;}}
 boolean submit(){CompletableFuture<Boolean> f=choice;if(!"select".equals(phase)||f==null||f.isDone())return false;try{catalog.freeze(session);return f.complete(true);}catch(Exception e){return false;}}
 void approve(boolean value){CompletableFuture<Boolean> f=consent;if(f!=null)f.complete(value);}
 void cancel(){CompletableFuture<Boolean> f=choice;if(f!=null)f.complete(false);f=consent;if(f!=null)f.complete(false);}
 private void tick(DataOutputStream out,DataInputStream in,ProtocolCore.Check check)throws IOException{check.check();ProtocolCore.writeString(out,"SCAN_WAIT",20);out.flush();if(!"READY".equals(ProtocolCore.readString(in,20)))throw new IOException("CATALOG");}
 void offer(DataOutputStream out,DataInputStream in,ProtocolCore.Check check,CancellationScope io)throws Exception {
  state("discover");
  if(phoneScanPending){
   String fixedTask=sources.transfer();sources.beginScan(ScanState.PHONE,true,scanDetails(0));sources.put("transfer",fixedTask);
   final long[] next={0};final IOException[] failure={null};
   PhoneScanner scanner=new PhoneScanner(c,sources,io,(n,f)->{
    scanFailures=f;sources.put("scanFailures",Long.toString(f));observer.scan();
    if(SystemClock.elapsedRealtime()>=next[0]&&failure[0]==null)try{tick(out,in,check);next[0]=SystemClock.elapsedRealtime()+2000;}catch(IOException e){failure[0]=e;}
   },true,true,true);
   scanner.scan();check.check();if(failure[0]!=null)throw failure[0];scanFailures=scanner.failures;
   sources.completeScan(ScanState.PHONE,scanDetails(scanFailures),check);phoneScanPending=false;
  }
  String task=sources.transfer();
  if(!sourceCatalogReady){
   if(preparer==null)throw new IOException("CATALOG_UNPREPARED");
   // Measured source bytes/hash replace zero or estimated metadata before the receiver sees it.
   preparer.prepare(out,in,check,io);check.check();catalog.begin(task,session);
   long after=0;TransferStore.Row source;FlowCatalogCodec.Digest snapshot=new FlowCatalogCodec.Digest();
   while((source=sources.nextCatalog(after))!=null){
    check.check();FlowCatalogCodec.Entry entry=new FlowCatalogCodec.Entry(source.id,source.category,source.name,source.mime,source.size,source.hash);
    catalog.add(entry);snapshot.add(entry);after=source.n;if(snapshot.count()%64==0)tick(out,in,check);
   }
   catalog.complete(snapshot.count(),snapshot.finish(),session);sourceCatalogReady=true;
  }
  ProtocolCore.writeString(out,"CATALOG",20);ProtocolCore.writeString(out,(Build.MANUFACTURER+" "+Build.MODEL).replaceAll("[\\p{Cntrl}]","_"),120);
  out.writeInt(Build.VERSION.SDK_INT);out.writeInt(grants());out.writeLong(scanFailures);out.writeLong(catalog.count(null,false));out.flush();
  long after=0;FlowCatalogStore.Row row;FlowCatalogCodec.Digest snapshot=new FlowCatalogCodec.Digest();
  while((row=catalog.next(after,null,false))!=null){
   check.check();ProtocolCore.writeString(out,"ENTRY",20);FlowCatalogCodec.write(out,row.entry);snapshot.add(row.entry);after=row.n;
   if(snapshot.count()%64==0){out.flush();if(!"READY".equals(ProtocolCore.readString(in,20)))throw new IOException("CATALOG");}
  }
  byte[] snapshotDigest=snapshot.finish();ProtocolCore.writeString(out,"CATALOG_END",20);out.writeLong(snapshot.count());out.write(snapshotDigest);out.flush();state("wait_choice");long count;
  while(true){
   check.check();String frame=ProtocolCore.readString(in,20);
   if(frame.equals("SELECT_WAIT")){ProtocolCore.writeString(out,"READY",20);out.flush();continue;}
   if(!frame.equals("CHOICE"))throw new IOException("CHOICE");count=in.readLong();ProtocolCore.validateCount(count);if(count>catalog.count(null,false))throw new IOException("CHOICE");break;
  }
  // The staging table prevents a truncated or forged choice from mutating frozen selection.
  catalog.beginChoice();FlowCatalogCodec.Digest selected=new FlowCatalogCodec.Digest();
  for(long n=0;n<count;n++){check.check();String id=ProtocolCore.readString(in,30);ProtocolCore.validateObjectId(id);catalog.stageChoice(id);selected.choice(id);if((n+1)%64==0){ProtocolCore.writeString(out,"READY",20);out.flush();}}
  if(!"CHOICE_END".equals(ProtocolCore.readString(in,20))||in.readLong()!=count)throw new IOException("CHOICE");
  byte[] expected=new byte[32];in.readFully(expected);byte[] choiceDigest=selected.finish();if(!ProtocolCore.equal(expected,choiceDigest))throw new IOException("CHOICE");
  catalog.acceptChoice(session,count,choiceDigest);sources.resetSourceSelection();after=0;
  while((row=catalog.next(after,null,true))!=null){check.check();if(!sources.chooseSourceObject(row.entry.id))throw new IOException("CHOICE_UNKNOWN_OR_DUPLICATE");after=row.n;}
  if(sources.count(true)!=count)throw new IOException("CHOICE");byte[] binding=consentBinding(task,snapshotDigest,choiceDigest);
  if(!ProtocolCore.equal(binding,acceptedChoice==null?new byte[0]:acceptedChoice)){
   CompletableFuture<Boolean> f=new CompletableFuture<>();consent=f;state("review");observer.consent(true);
   try{while(!f.isDone()){tick(out,in,check);try{f.get(2,TimeUnit.SECONDS);}catch(TimeoutException wait){}}if(!f.get())throw new IOException("DECLINED");check.check();acceptedChoice=binding.clone();}
   finally{consent=null;observer.consent(false);}
  }
  state("prepare");
 }
 long receive(String task,DataInputStream in,DataOutputStream out,ProtocolCore.Check check)throws Exception {
  state("discover");long expected;
  while(true){
   check.check();String frame=ProtocolCore.readString(in,20);if(frame.equals("SCAN_WAIT")){ProtocolCore.writeString(out,"READY",20);out.flush();continue;}
   if(!frame.equals("CATALOG"))throw new IOException("CATALOG");peer=ProtocolCore.readString(in,120);sdk=in.readInt();scope=in.readInt();scanFailures=in.readLong();expected=in.readLong();
   if(sdk<26||sdk>100||scope<0||scope>127||scanFailures<0)throw new IOException("CATALOG");FlowCatalogCodec.checkCount(expected);break;
  }
  catalog.begin(task,session);FlowCatalogCodec.Digest snapshot=new FlowCatalogCodec.Digest();
  while(snapshot.count()<expected){
   check.check();if(!"ENTRY".equals(ProtocolCore.readString(in,20)))throw new IOException("CATALOG");FlowCatalogCodec.Entry entry=FlowCatalogCodec.read(in);catalog.add(entry);snapshot.add(entry);
   if(snapshot.count()%64==0){ProtocolCore.writeString(out,"READY",20);out.flush();observer.scan();}
  }
  if(!"CATALOG_END".equals(ProtocolCore.readString(in,20))||in.readLong()!=expected)throw new IOException("CATALOG_COUNT");byte[] remote=new byte[32];in.readFully(remote);byte[] actual=snapshot.finish();
  if(!ProtocolCore.equal(remote,actual))throw new IOException("CATALOG_DIGEST");catalog.complete(expected,actual,session);
  if(!catalog.frozen(session)){
   CompletableFuture<Boolean> f=new CompletableFuture<>();choice=f;state("select");
   try{while(!f.isDone()){check.check();ProtocolCore.writeString(out,"SELECT_WAIT",20);out.flush();if(!"READY".equals(ProtocolCore.readString(in,20)))throw new IOException("CHOICE");try{f.get(2,TimeUnit.SECONDS);}catch(TimeoutException wait){}}if(!f.get())throw new IOException("DECLINED");}
   finally{choice=null;}
  }
  check.check();long count=catalog.verifyFrozenChoice(session);ProtocolCore.writeString(out,"CHOICE",20);out.writeLong(count);
  FlowCatalogCodec.Digest selected=new FlowCatalogCodec.Digest();long after=0;FlowCatalogStore.Row row;
  while((row=catalog.next(after,null,true))!=null){
   check.check();ProtocolCore.writeString(out,row.entry.id,30);selected.choice(row.entry.id);after=row.n;
   if(selected.count()%64==0){out.flush();if(!"READY".equals(ProtocolCore.readString(in,20)))throw new IOException("CHOICE");}
  }
  if(selected.count()!=count)throw new IOException("CHOICE_CHANGED");ProtocolCore.writeString(out,"CHOICE_END",20);out.writeLong(count);out.write(selected.finish());out.flush();state("prepare");return count;
 }
 private byte[] consentBinding(String task,byte[] catalogDigest,byte[] selected)throws Exception {
  MessageDigest digest=MessageDigest.getInstance("SHA-256");digest.update(session.getBytes(StandardCharsets.US_ASCII));digest.update(task.getBytes(StandardCharsets.US_ASCII));digest.update(catalogDigest);digest.update(selected);return digest.digest();
 }
}
