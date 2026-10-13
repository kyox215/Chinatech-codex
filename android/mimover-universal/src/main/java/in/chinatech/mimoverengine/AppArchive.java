package in.chinatech.mimoverengine;
import android.content.*;import android.content.pm.*;import android.net.Uri;import java.io.*;import java.nio.charset.StandardCharsets;import java.util.zip.*;
/** No APK payload is read while scanning. Selected packages materialize only after approval. */
final class AppArchive {
 static Uri source(Context c,Uri uri,String object,CancellationScope io,ProtocolCore.Check heartbeat)throws Exception {
  if(!"ctpa-app".equals(uri.getScheme()))return uri;String pkg=uri.getHost();long expected=Long.parseLong(uri.getLastPathSegment());PackageManager pm=c.getPackageManager();PackageInfo version=pm.getPackageInfo(pkg,0);if(version.lastUpdateTime!=expected)throw new IOException("SOURCE_CHANGED");ApplicationInfo app=pm.getApplicationInfo(pkg,0);File dir=new File(c.getNoBackupFilesDir(),"exports");if(!dir.exists()&&!dir.mkdirs())throw new IOException("WRITE");File finalFile=new File(dir,"ctpa-app-"+object+".zip");if(finalFile.isFile())return Uri.fromFile(finalFile);File partial=new File(dir,"ctpa-app-"+object+".tmp");try{
   try(CancellationScope.Lease<ZipOutputStream> lease=io.track(new ZipOutputStream(new FileOutputStream(partial)))){ZipOutputStream out=lease.value;out.putNextEntry(entry("INSTALLATION.txt"));out.write(("ChinaTech custom ZIP (not Bundletool .apks)\nPackage: "+pkg+"\nVersion: "+version.versionName+"\nContains base and visible installed split APKs. No app data, login or installation.\n").getBytes(StandardCharsets.UTF_8));out.closeEntry();copy(out,new File(app.sourceDir),"base.apk",io,heartbeat);if(app.splitSourceDirs!=null)for(int i=0;i<app.splitSourceDirs.length;i++)copy(out,new File(app.splitSourceDirs[i]),"split-"+i+".apk",io,heartbeat);}
   io.check();if(pm.getPackageInfo(pkg,0).lastUpdateTime!=expected)throw new IOException("SOURCE_CHANGED");if(!partial.renameTo(finalFile))throw new IOException("WRITE");return Uri.fromFile(finalFile);
  }catch(Exception e){partial.delete();throw e;}
 }
 private static ZipEntry entry(String name){ZipEntry e=new ZipEntry(name);e.setTime(315532800000L);return e;}
 private static void copy(ZipOutputStream out,File file,String name,CancellationScope io,ProtocolCore.Check heartbeat)throws Exception {io.check();out.putNextEntry(entry(name));try(CancellationScope.Lease<InputStream> source=io.track(new FileInputStream(file))){byte[] buffer=new byte[65536];int n;while((n=source.value.read(buffer))!=-1){io.check();heartbeat.check();out.write(buffer,0,n);}}io.check();out.closeEntry();}
 private AppArchive(){}
}
