package in.chinatech.mimoverengine;
import android.app.*;
import android.content.*;
import android.os.*;

/** Keeps already-approved local restore work visible while system installation dialogs are open. */
public final class RestoreService extends Service {
 @Override protected void attachBaseContext(Context base){super.attachBaseContext(new BridgeContext(base));}
 public IBinder onBind(Intent i){return null;}
 public int onStartCommand(Intent i,int flags,int id){try{NotificationManager m=getSystemService(NotificationManager.class);m.createNotificationChannel(new NotificationChannel("restore",getString(R.string.restore_title),NotificationManager.IMPORTANCE_LOW));Intent open=new Intent(this,UniversalActivity.class).putExtra("receiving",true);PendingIntent pi=PendingIntent.getActivity(this,402,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);startForeground(402,new Notification.Builder(this,"restore").setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle(getString(R.string.restore_title)).setContentText(getString(R.string.restore_notification)).setContentIntent(pi).setOngoing(true).build());RestoreCoordinator.get(this).serviceReady();}catch(RuntimeException failure){RestoreCoordinator.get(this).serviceFailed();stopSelf();}return START_NOT_STICKY;}
 public void onTimeout(int id,int type){RestoreCoordinator.get(this).stop();stopSelf();}
}
