package in.chinatech.smartswitchbridge;
import android.app.Activity;import android.content.*;
/** Narrow navigation adapters. They do not grant or simulate any Android permission. */
public final class Entry {
 private static final String PREF="chinatech-original-flow-ui";
 public static void noteRole(Activity a,boolean receiving){a.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putBoolean("receiving",receiving).apply();}
 public static void wireless(Activity a){boolean receiving=a.getSharedPreferences(PREF,Context.MODE_PRIVATE).getBoolean("receiving",false);TransferEngine engine=TransferEngine.get(new BridgeContext(a));boolean active=engine.hasTransferSession();if(active)receiving=engine.receivingMode;a.startActivity(new Intent(a,OriginalFlowActivity.class).putExtra("receiving",receiving).putExtra("fresh",!active));a.finish();}
 public static void mainPermission(Activity a){if(!OriginalPermissionController.isHandled(a))OriginalPermissionController.launch(a,new Intent(a,a.getClass()));}
 public static boolean permissionsReviewed(){Context c;try{Class<?> m=Class.forName("com.sec.android.easyMover.host.ManagerHost");c=(Context)m.getMethod("getContext").invoke(null);}catch(Exception e){return false;}return c!=null&&OriginalPermissionController.isHandled(c);}
}
