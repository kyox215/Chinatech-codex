package in.chinatech.mimoverengine;
import android.content.Context;
/** Runs the original home controller and views with truthful localized permission labels. */
public final class EntryMainActivity extends com.miui.huanji.MainActivity {
 @Override protected void attachBaseContext(Context base){super.attachBaseContext(new BridgeContext(base));}
 @Override protected void onPostResume(){super.onPostResume();in.chinatech.mimover.ExperimentApplication.apply(this);}
}
