package in.chinatech.mimoverengine;

import android.app.PendingIntent;
import android.content.*;
import android.content.pm.*;
import android.os.Build;
import java.io.*;
import java.util.*;
import java.util.zip.*;

/** Queued split APK installs through Android's installer. Existing packages are always left alone. */
final class AppInstaller {
 static final class Prepared {final String pkg;final int session;final String token;Prepared(String p,int s,String t){pkg=p;session=s;token=t;}}
 static Prepared prepare(Context c,CancellationScope io,RestoreLedger ledger,String key,File archive)throws Exception {
  File dir=new File(c.getNoBackupFilesDir(),"restore-work/app-"+ProtocolCore.token(8));if(!dir.mkdir())throw new IOException("WRITE");List<File> apks=new ArrayList<>();Set<String> seen=new HashSet<>();long total=0,max=Math.min(8L*1024*1024*1024,Math.addExact(Math.multiplyExact(archive.length(),32),64L*1024*1024));
  try{try(ZipInputStream z=new ZipInputStream(new FileInputStream(archive))){ZipEntry e;byte[] buffer=new byte[262144];int entries=0;while((e=z.getNextEntry())!=null){io.check();String name=e.getName();if(++entries>512||!seen.add(name)||e.isDirectory()||(!name.equals("INSTALLATION.txt")&&!name.equals("base.apk")&&!name.matches("split-[0-9]+\\.apk")))throw new IOException("APP_ARCHIVE");File out=new File(dir,name);long bytes=0;try(CancellationScope.Lease<OutputStream> lease=io.track(new FileOutputStream(out))){int n;while((n=z.read(buffer))!=-1){io.check();bytes+=n;total+=n;if(total>max||(name.equals("INSTALLATION.txt")&&bytes>16384))throw new IOException("APP_ARCHIVE_LIMIT");lease.value.write(buffer,0,n);}}z.closeEntry();if(name.endsWith(".apk")){if(bytes==0)throw new IOException("APP_ARCHIVE");apks.add(out);}}}
   File base=new File(dir,"base.apk");if(!base.isFile())throw new IOException("APP_ARCHIVE");PackageInfo info=c.getPackageManager().getPackageArchiveInfo(base.getPath(),0);if(info==null||info.packageName==null)throw new IOException("APP_INVALID");String pkg=info.packageName;
   if(pkg.equals(c.getPackageName())||installed(c,pkg)){ledger.put(key,"apps",pkg,"existing",-1,"");return new Prepared(pkg,-1,"");}
   if(!c.getPackageManager().canRequestPackageInstalls())throw new SecurityException("APP_PERMISSION");PackageInstaller installer=c.getPackageManager().getPackageInstaller();PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);params.setAppPackageName(pkg);if(Build.VERSION.SDK_INT>=31)params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);params.setSize(total);int id=installer.createSession(params);String token=ProtocolCore.token(16);
   boolean prepared=false;try(PackageInstaller.Session session=installer.openSession(id)){for(File apk:apks){io.check();try(InputStream in=new FileInputStream(apk);OutputStream out=session.openWrite(apk.getName(),0,apk.length())){byte[] b=new byte[262144];int n;while((n=in.read(b))!=-1){io.check();out.write(b,0,n);}session.fsync(out);}}io.check();ledger.put(key,"apps",pkg,"prepared",id,token);prepared=true;}finally{if(!prepared)try{installer.abandonSession(id);}catch(Exception ignored){}}return new Prepared(pkg,id,token);
  }finally{File[] files=dir.listFiles();if(files!=null)for(File f:files)f.delete();dir.delete();}
 }
 static boolean installed(Context c,String pkg){try{c.getPackageManager().getPackageInfo(pkg,0);return true;}catch(PackageManager.NameNotFoundException absent){return false;}}
 static void commit(Context c,String key,Prepared app)throws Exception {
  if(installed(c,app.pkg)){c.getPackageManager().getPackageInstaller().abandonSession(app.session);RestoreLedger ledger=new RestoreLedger(c);try{ledger.put(key,"apps",app.pkg,"existing",-1,"");}finally{ledger.close();}return;}
  Intent callback=new Intent(c,InstallReceiver.class).setData(android.net.Uri.parse("chinatech-install:"+app.token)).putExtra("restore-key",key).putExtra("restore-token",app.token);
  PendingIntent reply=PendingIntent.getBroadcast(c,app.session,callback,PendingIntent.FLAG_UPDATE_CURRENT| (Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));
  try(PackageInstaller.Session session=c.getPackageManager().getPackageInstaller().openSession(app.session)){session.commit(reply.getIntentSender());}
 }
 private AppInstaller(){}
}
