package in.chinatech.phoneassistant;

import android.content.*;
import android.security.keystore.*;
import android.util.AtomicFile;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.*;

/** Current-user Android Keystore identity, encrypted durable task journal and bounded HTTPS API. */
final class PhoneGate {
 static final PhoneGateCore.Json JSON=new PhoneGateCore.Json(){
  public Map<String,Object> read(String value)throws Exception{return map(new JSONObject(value));}
  public String write(Map<String,Object> value){return new JSONObject(value).toString();}
 };
 static Map<String,Object> map(JSONObject o)throws JSONException {Map<String,Object> out=new LinkedHashMap<>();Iterator<String> it=o.keys();while(it.hasNext()){String k=it.next();Object v=o.get(k);out.put(k,v instanceof JSONObject?map((JSONObject)v):v);}return out;}
 private static final String DEVICE="ctpa-device-v1",STORAGE="ctpa-journal-v1";
 private final Context context;private final AtomicFile file;private final KeyStore keys;
 private JSONObject journal;private String installation;
 volatile boolean allowed;volatile int state=R.string.gate_checking;
 PhoneGate(Context c)throws Exception {
  context=c;file=new AtomicFile(new File(c.getNoBackupFilesDir(),"gate-v1.enc"));keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
  if(!keys.containsAlias(STORAGE)){if((file.getBaseFile().exists()||new File(file.getBaseFile().getPath()+".bak").exists()))throw new IOException("GATE_STORAGE");KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(STORAGE,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}
  if((file.getBaseFile().exists()||new File(file.getBaseFile().getPath()+".bak").exists()))journal=read();else{journal=new JSONObject();journal.put("installationId",UUID.randomUUID().toString());journal.put("tasks",new JSONArray());save();}
  installation=journal.getString("installationId");PhoneGateCore.uuid(installation);
  if(!keys.containsAlias(DEVICE)){if(journal.getJSONArray("tasks").length()!=0)throw new IOException("GATE_STORAGE");KeyPairGenerator g=KeyPairGenerator.getInstance("EC","AndroidKeyStore");g.initialize(new KeyGenParameterSpec.Builder(DEVICE,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());g.generateKeyPair();}
 }
 private JSONObject read()throws Exception {byte[] input=file.readFully();if(input.length<30||input.length>1048576||input[0]!=1)throw new IOException("GATE_STORAGE");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,keys.getKey(STORAGE,null),new GCMParameterSpec(128,Arrays.copyOfRange(input,1,13)));return new JSONObject(PhoneGateCore.utf8(c.doFinal(Arrays.copyOfRange(input,13,input.length))));}
 private synchronized void save()throws Exception {Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,keys.getKey(STORAGE,null));byte[] bytes=journal.toString().getBytes(StandardCharsets.UTF_8),sealed=c.doFinal(bytes);if(sealed.length>1048500)throw new IOException("GATE_STORAGE");FileOutputStream out=file.startWrite();try{out.write(1);out.write(c.getIV());out.write(sealed);file.finishWrite(out);}catch(Exception e){file.failWrite(out);throw e;}}
 synchronized String installation(){return installation;}
 String publicKey()throws Exception{return PhoneGateCore.b64(keys.getCertificate(DEVICE).getPublicKey().getEncoded());}
 String keyHash()throws Exception{return PhoneGateCore.sha(keys.getCertificate(DEVICE).getPublicKey().getEncoded());}
 private Map<String,Object> request(String operation,JSONObject task,String terminal,String checkpoint)throws Exception {
  String path="/api/toolbox/client/v1/phone-assistant/jobs/"+operation;
  Map<String,Object> b=new LinkedHashMap<>();b.put("requestId",operation.equals("start")?task.getString("startRequest"):UUID.randomUUID().toString());b.put("installationId",installation);b.put("appVersion",task.optString("version",PhoneGateCore.VERSION));b.put("releaseId",task.optString("release",PhoneGateCore.RELEASE));b.put("timestamp",System.currentTimeMillis()/1000);b.put("nonce",operation.equals("start")?task.getString("startNonce"):PhoneGateCore.b64(ProtocolCore.random(32)));b.put("publicKey",publicKey());b.put("jobId",task.getString("job"));b.put("action",task.getBoolean("receiving")?"receive":"send");b.put("scopeHash",new PhoneGateCore.Plan(task.getString("plan")).scope());
  if(terminal!=null){b.put("status",terminal);b.put("checkpointHash",checkpoint);}
  String payload=PhoneGateCore.b64(JSON.write(b).getBytes(StandardCharsets.UTF_8));Signature signature=Signature.getInstance("SHA256withECDSA");signature.initSign((PrivateKey)keys.getKey(DEVICE,null));signature.update(PhoneGateCore.canonical(path,payload,b).getBytes(StandardCharsets.UTF_8));Map<String,Object> wire=new LinkedHashMap<>();wire.put("payload",payload);wire.put("signature",PhoneGateCore.b64(PhoneGateCore.derToRaw(signature.sign())));return http(path,JSON.write(wire));
 }
 static Map<String,Object> http(String path,String body)throws Exception {
  if(!path.startsWith("/api/toolbox/client/v1/phone-assistant/"))throw PhoneGateCore.invalid();HttpsURLConnection c=(HttpsURLConnection)new URL(PhoneGateCore.ORIGIN+path).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setUseCaches(false);c.setRequestProperty("Accept","application/json");
  try{if(body!=null){byte[] bytes=body.getBytes(StandardCharsets.UTF_8);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
   int status=c.getResponseCode();if(status!=200){if(status==409||status==426)throw new IOException("GATE_UPDATE");if(status==403)throw new IOException("GATE_PAUSED");if(status==401)throw new IOException("GATE_NOT_FOUND");throw new IOException("GATE_NETWORK");}try(InputStream in=c.getInputStream()){return JSON.read(PhoneGateCore.utf8(bounded(in,65536)));}
  }finally{c.disconnect();}
 }
 static byte[] bounded(InputStream in,int limit)throws IOException {ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){if(out.size()>limit-n)throw new IOException("GATE_INVALID");out.write(buffer,0,n);}return out.toByteArray();}
 void check() {try{flush();Map<String,Object> d=http("/api/toolbox/client/v1/phone-assistant/status",null);allowed=Boolean.TRUE.equals(d.get("enabled"))&&Boolean.TRUE.equals(d.get("ready"))&&PhoneGateCore.RELEASE.equals(d.get("activeReleaseId"));state=allowed?R.string.gate_ready:PhoneGateCore.RELEASE.equals(d.get("activeReleaseId"))?R.string.gate_paused:R.string.gate_update;}catch(Exception e){allowed=false;state=R.string.gate_offline;}}
 void requireNew()throws IOException {if(!allowed)throw new IOException("GATE_BLOCKED");}
 synchronized JSONObject current()throws Exception {String id=journal.optString("current","");JSONArray tasks=journal.getJSONArray("tasks");for(int i=0;i<tasks.length();i++){JSONObject t=tasks.getJSONObject(i);if(id.equals(t.getString("id")))return new JSONObject(t.toString());}return null;}
 synchronized boolean pending(){try{JSONObject t=current();return t!=null&&!terminal(t);}catch(Exception e){return true;}}
 static boolean terminal(JSONObject t){return !t.optString("terminal","").isEmpty();}
 synchronized void put(JSONObject task)throws Exception {JSONArray tasks=journal.getJSONArray("tasks");for(int i=0;i<tasks.length();i++)if(tasks.getJSONObject(i).getString("id").equals(task.getString("id"))){JSONObject old=tasks.getJSONObject(i);if(terminal(old)&&(!old.getString("terminal").equals(task.optString("terminal"))||!old.getString("checkpoint").equals(task.optString("checkpoint"))))throw new IOException("GATE_TERMINAL");tasks.put(i,new JSONObject(task.toString()));save();return;}tasks.put(new JSONObject(task.toString()));journal.put("current",task.getString("id"));save();}
 synchronized void replaceCurrent(JSONObject task)throws Exception {if(pending())throw new IOException("GATE_PENDING");put(task);journal.put("current",task.getString("id"));save();}
 JSONObject newTask(boolean receiving,SessionTls tls)throws Exception {requireNew();if(pending())throw new IOException("GATE_PENDING");JSONObject t=new JSONObject();t.put("id",UUID.randomUUID().toString());t.put("job",UUID.randomUUID().toString());t.put("receiving",receiving);t.put("version",PhoneGateCore.VERSION);t.put("release",PhoneGateCore.RELEASE);t.put("tls",tls.alias);t.put("pin",tls.pin);t.put("expires",System.currentTimeMillis()+2592000000L);return t;}
 private synchronized void frozenPlan(JSONObject task)throws Exception {JSONObject original=null;JSONArray all=journal.getJSONArray("tasks");for(int i=0;i<all.length();i++){JSONObject row=all.getJSONObject(i);if(row.getString("id").equals(task.getString("id"))){original=row;break;}}PhoneRecoveryCore.frozen(original==null?null:map(original),map(task));}
 private PhoneGateCore.Plan originalIdentity(JSONObject task)throws Exception {frozenPlan(task);PhoneGateCore.Plan plan=PhoneRecoveryCore.identity(map(task),installation);SessionTls tls=new SessionTls(task.getString("tls"));if(!plan.ownPin(task.getBoolean("receiving")).equals(tls.pin))throw PhoneGateCore.invalid();return plan;}
 /** Repair only this frozen record. The original release/version, job and request identity survive updates. */
 void restoreAdmission(JSONObject task)throws Exception {originalIdentity(task);if("cancelled".equals(task.optString("terminal")))throw new IOException("GATE_TERMINAL");if(!task.has("ownPermit")){if(terminal(task))throw new IOException("GATE_TERMINAL");if(task.getBoolean("receiving"))peerPermit(task,new PhoneGateCore.Plan(task.getString("plan")));task.put("admissionAttempt",true);put(task);admit(task);}validate(task,false);}
 void admit(JSONObject task)throws Exception {
  PhoneGateCore.Plan plan=originalIdentity(task);if(terminal(task))throw new IOException("GATE_TERMINAL");Map<String,Object> response=null;
  if(task.optBoolean("admissionAttempt")){try{response=request("resume",task,null,null);}catch(IOException e){if(!"GATE_NOT_FOUND".equals(e.getMessage()))throw e;}}
  if(response==null){if(!PhoneRecoveryCore.canStartOriginal(map(task)))throw new IOException("GATE_UPDATE");check();requireNew();if(!task.has("startRequest")){task.put("startRequest",UUID.randomUUID().toString());task.put("startNonce",PhoneGateCore.b64(ProtocolCore.random(32)));}task.put("admissionAttempt",true);put(task);response=request("start",task,null,null);}
  Object p=response.get("permit");if(!(p instanceof Map))throw PhoneGateCore.invalid();@SuppressWarnings("unchecked")String encoded=PhoneGateCore.envelope((Map<String,Object>)p);boolean r=task.getBoolean("receiving");Map<String,Object> claims=PhoneGateCore.permit(encoded,task.getString("release"),installation,task.getString("job"),r?"receive":"send",plan.scope(),keyHash(),JSON,PhoneGateCore.trustedKeys(),System.currentTimeMillis()/1000);frozenPlan(task);task.put("ownPermit",encoded);task.put("expires",PhoneGateCore.number(claims,"expiresAt")*1000);put(task);
 }
 private void peerPermit(JSONObject task,PhoneGateCore.Plan p)throws Exception {boolean r=task.getBoolean("receiving");PhoneGateCore.permit(task.getString("peerPermit"),task.getString("release"),p.peerId(r),p.peerJob(r),r?"send":"receive",p.scope(),null,JSON,PhoneGateCore.trustedKeys(),System.currentTimeMillis()/1000);}
 void validate(JSONObject task,boolean both)throws Exception {PhoneGateCore.Plan p=PhoneRecoveryCore.identity(map(task),installation);boolean r=task.getBoolean("receiving");PhoneGateCore.permit(task.getString("ownPermit"),task.getString("release"),installation,p.ownJob(r),r?"receive":"send",p.scope(),keyHash(),JSON,PhoneGateCore.trustedKeys(),System.currentTimeMillis()/1000);if(both)peerPermit(task,p);}
 synchronized void finish(JSONObject task,String terminal)throws Exception {if(terminal(task)){if(!terminal.equals(task.getString("terminal")))throw new IOException("GATE_TERMINAL");return;}String checkpoint=PhoneGateCore.hash(task.getString("id")+"\n"+task.optString("plan","")+"\n"+terminal+"\n"+task.optBoolean("verified")+"\n"+task.optBoolean("peerAck"));task.put("terminal",terminal);task.put("checkpoint",checkpoint);task.put("pendingOutcome",task.has("ownPermit")||task.optBoolean("admissionAttempt")&&task.has("plan"));put(task);}
 synchronized List<JSONObject> records()throws Exception {List<JSONObject> out=new ArrayList<>();JSONArray a=journal.getJSONArray("tasks");for(int i=a.length()-1;i>=0;i--)out.add(new JSONObject(a.getJSONObject(i).toString()));return out;}
 synchronized JSONObject select(String id)throws Exception {for(JSONObject t:records())if(id.equals(t.getString("id"))){JSONObject old=current();if(old!=null&&!terminal(old)&&!old.getString("id").equals(id))throw new IOException("GATE_PENDING");journal.put("current",id);save();return t;}throw new IOException("GATE_PENDING");}
 synchronized Set<String> retainedTls()throws Exception {Set<String> out=new HashSet<>();JSONArray a=journal.getJSONArray("tasks");for(int i=0;i<a.length();i++){JSONObject t=a.getJSONObject(i);if(t.optLong("expires",Long.MAX_VALUE)>System.currentTimeMillis())out.add(t.getString("tls"));}return out;}
 void flush(){List<JSONObject> pending=new ArrayList<>();try{synchronized(this){JSONArray a=journal.getJSONArray("tasks");for(int i=0;i<a.length()&&pending.size()<4;i++){JSONObject t=a.getJSONObject(i);if(t.optBoolean("pendingOutcome"))pending.add(new JSONObject(t.toString()));}}for(JSONObject copy:pending){try{Map<String,Object> response=request("outcome",copy,copy.getString("terminal"),copy.getString("checkpoint"));if(!copy.getString("terminal").equals(response.get("status")))continue;synchronized(this){JSONArray a=journal.getJSONArray("tasks");for(int i=0;i<a.length();i++){JSONObject t=a.getJSONObject(i);if(t.getString("id").equals(copy.getString("id"))&&t.optString("terminal").equals(copy.getString("terminal"))&&t.optString("checkpoint").equals(copy.getString("checkpoint"))){t.put("pendingOutcome",false);save();break;}}}}catch(Exception ignored){/* Exact original result remains pending. Never create a new task to retry it. */}}}catch(Exception ignored){}}
}
