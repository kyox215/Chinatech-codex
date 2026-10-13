package in.chinatech.smartswitchbridge;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

public final class TransferService extends Service {
 private static final String CHANNEL="chinatech-phone-transfer";
 public static void start(Context context) {context.startForegroundService(new Intent(context,TransferService.class));}
 @Override protected void attachBaseContext(Context base){super.attachBaseContext(new BridgeContext(base));}
 @Override public void onCreate(){super.onCreate();StartGuard.run(()->{NotificationManager m=getSystemService(NotificationManager.class);m.createNotificationChannel(new NotificationChannel(CHANNEL,getString(R.string.transfer_notification),NotificationManager.IMPORTANCE_LOW));
  Intent stop=new Intent(this,TransferService.class).setAction("STOP");PendingIntent cancel=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_IMMUTABLE);
  PendingIntent open=PendingIntent.getActivity(this,2,new Intent(this,OriginalFlowActivity.class).putExtra("receiving",TransferEngine.get(this).receivingMode).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification n=new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle(getString(R.string.app_name)).setContentText(getString(R.string.transfer_notification)).setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,getString(R.string.stop),cancel).build()).build();
  if(Build.VERSION.SDK_INT>=29)startForeground(1,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);else startForeground(1,n);
  if(!TransferEngine.get(this).foregroundReady())stopSelf();
  },()->{TransferEngine.get(this).serviceStartFailed();stopSelf();});
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){if(intent!=null&&"STOP".equals(intent.getAction())){TransferEngine.get(this).stop();stopSelf();}return START_NOT_STICKY;}
 @Override public void onTimeout(int startId,int fgsType){TransferEngine.get(this).timeout();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
 @Override public void onDestroy(){TransferEngine.get(this).serviceEnded();super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
}
