package in.chinatech.mimoverengine;
import android.content.*;

/** Explicit, nonexported result receiver; session and unguessable callback token must both match. */
public final class InstallReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){try{RestoreCoordinator.get(c).installationResult(intent);}catch(RuntimeException failure){RestoreCoordinator.get(c).callbackFailed();}}
}
