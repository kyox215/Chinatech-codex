package in.chinatech.phoneassistant;

import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;
import java.io.*;
import java.net.URL;
import java.security.MessageDigest;
import java.util.*;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;

/** Signed same-origin APK, full byte/hash/package/certificate checks, then Android's own installer. */
final class PhoneUpdater {
 private static boolean busy;
 static synchronized void start(Activity activity,PhoneGate gate){if(busy)return;if(gate==null){Toast.makeText(activity,R.string.gate_storage,Toast.LENGTH_LONG).show();return;}if(TransferEngine.get(activity).isActive()){Toast.makeText(activity,R.string.gate_finish_first,Toast.LENGTH_LONG).show();return;}busy=true;Toast.makeText(activity,R.string.gate_downloading,Toast.LENGTH_LONG).show();new Thread(()->{File file=null;try{
  Map<String,Object> response=PhoneGate.http("/api/toolbox/client/v1/phone-assistant/update",null);String wire=PhoneGateCore.envelope(response);Map<String,Object> data=PhoneGateCore.verify(wire,"toolbox-v1-update",PhoneGate.JSON,PhoneGateCore.trustedKeys(),System.currentTimeMillis()/1000);String release=PhoneGateCore.string(data,"releaseId",96);PhoneGateCore.release(release);if(!release.equals(data.get("activeReleaseId")))throw PhoneGateCore.invalid();Object raw=data.get("files");if(!(raw instanceof JSONArray)||((JSONArray)raw).length()!=1)throw PhoneGateCore.invalid();Map<String,Object> item=PhoneGate.map(((JSONArray)raw).getJSONObject(0));String href=PhoneGateCore.string(item,"href",256),hash=PhoneGateCore.string(item,"sha256",64);PhoneGateCore.hashValue(hash);long bytes=PhoneGateCore.number(item,"bytes");if(bytes<1||bytes>268435456||!"any".equals(item.get("architecture"))||!href.equals(PhoneGateCore.ORIGIN+"/toolbox/phone-current/ChinaTech-Phone-Assistant.apk"))throw PhoneGateCore.invalid();
  File dir=new File(activity.getNoBackupFilesDir(),"updates");if(!dir.isDirectory()&&!dir.mkdir())throw new IOException("GATE_STORAGE");file=new File(dir,UUID.randomUUID().toString()+".apk");HttpsURLConnection c=(HttpsURLConnection)new URL(href).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setUseCaches(false);MessageDigest sha=MessageDigest.getInstance("SHA-256");long count=0;try{if(c.getResponseCode()!=200||c.getContentLengthLong()!=bytes)throw PhoneGateCore.invalid();try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(file)){byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1){count+=n;if(count>bytes)throw PhoneGateCore.invalid();sha.update(buffer,0,n);out.write(buffer,0,n);}out.getFD().sync();}}finally{c.disconnect();}if(count!=bytes||!hash.equals(ProtocolCore.hex(sha.digest())))throw PhoneGateCore.invalid();
  PackageManager pm=activity.getPackageManager();int flags=PackageManager.GET_META_DATA|(Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES);PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),flags),candidate=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||candidate.applicationInfo==null||candidate.applicationInfo.metaData==null||!release.equals(candidate.applicationInfo.metaData.getString("in.chinatech.releaseId"))||version(candidate)<=version(installed)||!signers(installed).equals(signers(candidate)))throw PhoneGateCore.invalid();
  final File verified=file;activity.runOnUiThread(()->{if(activity.isFinishing()||activity.isDestroyed())return;if(Build.VERSION.SDK_INT>=26&&!pm.canRequestPackageInstalls()){Toast.makeText(activity,R.string.gate_install_permission,Toast.LENGTH_LONG).show();activity.startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));return;}Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/candidate/"+verified.getName());Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri("APK",uri));try{activity.startActivity(intent);}catch(RuntimeException e){Toast.makeText(activity,R.string.gate_update_failed,Toast.LENGTH_LONG).show();}});
 }catch(Exception e){if(file!=null)file.delete();activity.runOnUiThread(()->Toast.makeText(activity,R.string.gate_update_failed,Toast.LENGTH_LONG).show());}finally{synchronized(PhoneUpdater.class){busy=false;}}},"ctpa-verified-update").start();}
 private static long version(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
 private static Set<String> signers(PackageInfo p)throws Exception {android.content.pm.Signature[] signatures=Build.VERSION.SDK_INT>=28?(p.signingInfo==null?null:p.signingInfo.getApkContentsSigners()):p.signatures;if(signatures==null||signatures.length!=1)throw PhoneGateCore.invalid();return Collections.singleton(PhoneGateCore.sha(signatures[0].toByteArray()));}
}
