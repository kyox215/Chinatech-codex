package in.chinatech.smartswitchbridge;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.res.Configuration;
import android.content.res.Resources;
import java.io.File;
import java.util.Locale;
final class BridgeContext extends ContextWrapper {
 private final Resources resources;
 private Context app;
 BridgeContext(Context base){super(localized(base));resources=new BridgeResources(getBaseContext().getResources());}
 private static Context localized(Context base){return base;}
 @Override public Resources getResources(){return resources;}
 @Override public synchronized Context getApplicationContext(){if(app==null)app=new BridgeContext(getBaseContext().getApplicationContext(),true);return app;}
 private BridgeContext(Context base,boolean application){super(localized(base));resources=new BridgeResources(getBaseContext().getResources());app=this;}
 @Override public File getNoBackupFilesDir(){File f=new File(super.getNoBackupFilesDir(),"chinatech-original-flow-v4");if(!f.exists()&&!f.mkdirs())throw new IllegalStateException("Private directory unavailable");return f;}
 @Override public File getCacheDir(){File f=new File(super.getCacheDir(),"chinatech-original-flow-v4");if(!f.exists()&&!f.mkdirs())throw new IllegalStateException("Private cache unavailable");return f;}
}
