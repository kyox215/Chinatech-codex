package in.chinatech.mimoverengine;

import android.app.Activity;
import android.content.*;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.*;
import java.io.*;
import java.util.concurrent.*;

/** One approved restore queue, separate from network completion. No UI launch from a background receiver. */
final class RestoreCoordinator {
 interface Listener{void changed();}
 interface Progress{void update(String kind,long imported,long existing,long partial,long failed);}
 private static RestoreCoordinator instance;
 static synchronized RestoreCoordinator get(Context c){if(instance==null)instance=new RestoreCoordinator(c.getApplicationContext());return instance;}
 private final Context c;private final SharedPreferences prefs;private final ExecutorService worker=Executors.newSingleThreadExecutor(),cleanup=Executors.newSingleThreadExecutor();private final Handler main=new Handler(Looper.getMainLooper());
 private final java.util.concurrent.atomic.AtomicBoolean redrawQueued=new java.util.concurrent.atomic.AtomicBoolean();private volatile Listener listener;private volatile boolean active,stopping;private volatile CancellationScope io;private volatile Intent confirmation;private volatile boolean confirmationLaunched;private volatile long lastSignal;
 volatile String kind="",failure="";volatile long imported,existing,partial,failed,files;private volatile String pendingKey;
 private CompletableFuture<Boolean> foreground;
 private RestoreCoordinator(Context c){this.c=c;prefs=c.getSharedPreferences("restore-queue-v1",Context.MODE_PRIVATE);pendingKey=prefs.getString("pending",null);imported=prefs.getLong("last-imported",0);existing=prefs.getLong("last-existing",0);partial=prefs.getLong("last-partial",0);failed=prefs.getLong("last-failed",0);files=prefs.getLong("last-files",0);kind=prefs.getString("last-kind","");failure=prefs.getBoolean("unfinished",false)?"RESTORE_INTERRUPTED":prefs.getString("last-failure","");}
 void attach(Listener l){listener=l;signal();}void detach(Listener l){if(listener==l)listener=null;}
 boolean isActive(){CancellationScope current=io;return active||(current!=null&&current.hasResources());}boolean needsResume(){return !active&&prefs.getBoolean("unfinished",false);}
 boolean describes(String completion){return completion!=null&&completion.equals(prefs.getString("completion",null));}
 boolean automatically(){return prefs.getBoolean("auto",false);}
 boolean[] choices(){return new boolean[]{prefs.getBoolean("media",true),prefs.getBoolean("contacts",true),prefs.getBoolean("calendar",true),prefs.getBoolean("apps",true)};}
 long calendar(){return prefs.getLong("calendar-id",-1);}
 void beginSetup(){prefs.edit().putBoolean("setup",true).commit();}
 boolean configured(){return prefs.getBoolean("configured",false);}
 void finishSetup(){prefs.edit().putBoolean("setup",false).putBoolean("configured",true).commit();}
 void configure(boolean[] choices,long calendar,boolean auto){prefs.edit().putBoolean("media",choices[0]).putBoolean("contacts",choices[1]).putBoolean("calendar",choices[2]).putBoolean("apps",choices[3]).putLong("calendar-id",calendar).putBoolean("auto",auto).apply();}
 void observeCompletion(TransferEngine engine){if(!configured()||!automatically()||prefs.getBoolean("setup",false)||active||engine.isActive()||needsResume())return;String ready=engine.store.get("restore-ready"),dir=engine.store.get("restore-directory");if(ready==null||dir==null||engine.directory==null||!dir.equals(engine.directory.toString()))return;String done=prefs.getString("auto-done","");if(!(ready+"|"+dir).equals(done))start(engine.directory,ready+"|"+dir);}
 synchronized void start(Uri directory,String completion){if(isActive()||directory==null||TransferEngine.get(c).isActive())return;if(pendingKey!=null){RestoreLedger old=new RestoreLedger(c);try{abandonInterrupted(old,pendingKey);}finally{old.close();}pendingKey=null;prefs.edit().remove("pending").commit();}active=true;stopping=false;failure="";kind="";imported=existing=partial=failed=files=0;confirmation=null;confirmationLaunched=false;io=new CancellationScope(cleanup,this::signal);prefs.edit().putString("directory",directory.toString()).putString("completion",completion).putBoolean("unfinished",true).commit();foreground=new CompletableFuture<>();signal();try{c.startForegroundService(new Intent(c,RestoreService.class));}catch(RuntimeException e){serviceFailed();}worker.execute(()->run(directory));}
 void resume(){String directory=prefs.getString("directory",null);if(directory!=null)start(Uri.parse(directory),prefs.getString("completion","manual"));}
 synchronized void serviceReady(){if(foreground!=null)foreground.complete(true);}
 synchronized void serviceFailed(){failure="RESTORE_SERVICE";if(foreground!=null)foreground.complete(false);signal();}
 private void run(Uri directory){boolean complete=false;RestoreLedger ledger=new RestoreLedger(c);MediaImporter media=new MediaImporter(c,io);try{if(!foreground.get(15,TimeUnit.SECONDS))throw new IOException("RESTORE_SERVICE");clearStaging();boolean[] selected=choices();long after=0;TransferStore.MediaReceipt row;while((row=RestoreCatalog.next(TransferEngine.get(c).store,directory,after))!=null){io.check();after=row.n;String type=RestoreCatalog.kind(row.item);kind=type;File checked=null;try{
   if(type.equals("files")){files++;continue;}
   int choice=type.equals("media")?0:type.equals("contacts")?1:type.equals("calendar")?2:3;if(!selected[choice]){files++;continue;}
   if(type.equals("media")){if(media.publish(row))imported++;else existing++;continue;}
   checked=RestoreCatalog.checkedCopy(c,row,io);String hash=ProtocolCore.hex(row.item.hash);
   if(type.equals("contacts")||type.equals("calendar")){final long baseImported=imported,baseExisting=existing,basePartial=partial,baseFailed=failed;Progress progress=(k,n,e,p,f)->{kind=k;imported=baseImported+n;existing=baseExisting+e;partial=basePartial+p;failed=baseFailed+f;progressSignal();};if(type.equals("contacts"))new ContactImporter(c,io,ledger).run(checked,hash,progress);else CalendarImporter.run(c,io,ledger,checked,hash,calendar(),progress);}
   else{String key="app:"+hash;abandonInterrupted(ledger,key);AppInstaller.Prepared app=AppInstaller.prepare(c,io,ledger,key,checked);if(app.session<0){existing++;continue;}pendingKey=key;prefs.edit().putString("pending",key).commit();io.check();AppInstaller.commit(c,key,app);kind="install";signal();while(true){io.check();RestoreLedger.Entry entry=ledger.get(key);if(entry==null)throw new IOException("APP_RESULT");if(entry.state.equals("done")){imported++;break;}if(entry.state.equals("existing")){existing++;break;}if(entry.state.equals("failed")){failed++;break;}Thread.sleep(250);}pendingKey=null;prefs.edit().remove("pending").commit();confirmation=null;confirmationLaunched=false;}
  }catch(SecurityException denied){failed++;failure=type.equals("apps")?"APP_PERMISSION":"RESTORE_PERMISSION";}catch(Exception error){io.check();failed++;failure="RESTORE_ITEM";}finally{if(type.equals("apps")&&pendingKey!=null){abandonInterrupted(ledger,pendingKey);pendingKey=null;prefs.edit().remove("pending").commit();}if(checked!=null)checked.delete();progressSignal();}}
  complete=true;
 }catch(Exception error){failure=stopping?"RESTORE_STOPPED":"RESTORE_INTERRUPTED";}finally{if(pendingKey!=null)abandonInterrupted(ledger,pendingKey);media.close();ledger.close();prefs.edit().putLong("last-imported",imported).putLong("last-existing",existing).putLong("last-partial",partial).putLong("last-failed",failed).putLong("last-files",files).putString("last-kind",kind).putString("last-failure",failure).commit();if(complete)prefs.edit().putBoolean("unfinished",false).putString("auto-done",prefs.getString("completion","manual")).commit();active=false;stopping=io.hasResources();confirmation=null;confirmationLaunched=false;try{c.stopService(new Intent(c,RestoreService.class));}catch(RuntimeException ignored){}signal();}}
 private void clearStaging()throws IOException {File dir=new File(c.getNoBackupFilesDir(),"restore-work");File[] children=dir.listFiles();if(children==null)return;for(File f:children){io.check();if(f.isFile()&&f.getName().startsWith("verified-")&&f.getName().endsWith(".bin")){if(!f.delete())throw new IOException("RESTORE_CLEANUP");}else if(f.isDirectory()&&f.getName().startsWith("app-")){File[] parts=f.listFiles();if(parts!=null)for(File part:parts){if(!part.isFile()||!part.delete())throw new IOException("RESTORE_CLEANUP");}if(!f.delete())throw new IOException("RESTORE_CLEANUP");}}}
 private void abandonOwned(int session){try{PackageInstaller installer=c.getPackageManager().getPackageInstaller();for(PackageInstaller.SessionInfo mine:installer.getMySessions())if(mine.getSessionId()==session){installer.abandonSession(session);break;}}catch(RuntimeException expired){failure="APP_RESULT";}}
 void callbackFailed(){failure="APP_RESULT";signal();}
 private void abandonInterrupted(RestoreLedger ledger,String key){RestoreLedger.Entry old=ledger.get(key);if(old==null||old.session<0||old.state.equals("done")||old.state.equals("existing"))return;try{PackageInstaller installer=c.getPackageManager().getPackageInstaller();for(PackageInstaller.SessionInfo mine:installer.getMySessions())if(mine.getSessionId()==old.session){installer.abandonSession(old.session);break;}ledger.installation(key,old.session,old.token,"interrupted");}catch(Exception error){failure="APP_RESULT";}}
 void installationResult(Intent intent){String key=intent.getStringExtra("restore-key"),token=intent.getStringExtra("restore-token");if(key==null||token==null)return;RestoreLedger ledger=new RestoreLedger(c);try{RestoreLedger.Entry e=ledger.get(key);int session=intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID,-1);if(e==null||session!=e.session||!token.equals(e.token)||!(e.state.equals("prepared")||e.state.equals("waiting")))return;int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  if(status==PackageInstaller.STATUS_PENDING_USER_ACTION&&AppInstaller.installed(c,e.dest)){abandonOwned(session);ledger.installation(key,session,e.token,"existing");if(key.equals(pendingKey)){confirmation=null;confirmationLaunched=false;}}
  else if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){Intent action=intent.getParcelableExtra(Intent.EXTRA_INTENT);if(action==null){ledger.installation(key,session,e.token,"failed");}else{if(ledger.installation(key,session,e.token,"waiting")&&active&&key.equals(pendingKey)){confirmation=action;confirmationLaunched=false;kind="install";}}}
  else{ledger.installation(key,session,e.token,status==PackageInstaller.STATUS_SUCCESS?"done":"failed");if(key.equals(pendingKey)){confirmation=null;confirmationLaunched=false;}}signal();
 }finally{ledger.close();}}
 void showInstallation(Activity activity){Intent action=confirmation;if(!active||action==null||confirmationLaunched||activity.isFinishing()||activity.isDestroyed())return;confirmationLaunched=true;try{if(pendingKey!=null){RestoreLedger ledger=new RestoreLedger(c);try{RestoreLedger.Entry e=ledger.get(pendingKey);if(e!=null&&AppInstaller.installed(c,e.dest)){abandonOwned(e.session);ledger.installation(pendingKey,e.session,e.token,"existing");confirmation=null;return;}}finally{ledger.close();}}activity.startActivityForResult(action,42);}catch(RuntimeException error){confirmationLaunched=false;failure="APP_CONFIRMATION";signal();}}
 void installationReturned(){signal();}
 boolean needsInstallation(){return active&&confirmation!=null;}
 void repeatInstallation(Activity activity){confirmationLaunched=false;showInstallation(activity);}
 void skipInstallation(){String key=pendingKey;if(key==null)return;RestoreLedger ledger=new RestoreLedger(c);try{abandonInterrupted(ledger,key);RestoreLedger.Entry e=ledger.get(key);if(e!=null&&e.state.equals("interrupted")){ContentValues v=new ContentValues();v.put("state","failed");ledger.getWritableDatabase().update("restored",v,"k=? AND state=?",new String[]{key,"interrupted"});}confirmation=null;confirmationLaunched=false;}finally{ledger.close();}signal();}
 void stop(){stopping=true;CancellationScope scope=io;if(scope!=null)scope.cancel();signal();}
 private void progressSignal(){long now=SystemClock.elapsedRealtime();if(now-lastSignal<250)return;lastSignal=now;signal();}
 private void signal(){if(!redrawQueued.compareAndSet(false,true))return;main.post(()->{redrawQueued.set(false);Listener l=listener;if(l!=null)l.changed();});}
}
