package in.chinatech.mimoverengine;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.res.Configuration;
import android.content.res.Resources;
import java.io.File;
import java.util.Locale;
/** The engine owns private string IDs and private recovery state inside the modified APK. */
final class BridgeContext extends ContextWrapper {
 private final Resources resources; private Context app;
 BridgeContext(Context base){super(localized(base));resources=getBaseContext().getResources();}
 private static Context localized(Context base){String code=base.getSharedPreferences("mimover-universal-ui",Context.MODE_PRIVATE).getString("language","");Configuration c=new Configuration(base.getResources().getConfiguration());if(!code.isEmpty())c.setLocale(Locale.forLanguageTag(code));else if(android.os.Build.VERSION.SDK_INT>=33){android.app.LocaleManager m=base.getSystemService(android.app.LocaleManager.class);if(m!=null&&!m.getApplicationLocales().isEmpty())c.setLocales(m.getApplicationLocales());}return base.createConfigurationContext(c);}
 @Override public Resources getResources(){return resources;}
 @Override public synchronized Context getApplicationContext(){if(app==null)app=new BridgeContext(getBaseContext().getApplicationContext(),true);return app;}
 private BridgeContext(Context base,boolean ignored){super(localized(base));resources=getBaseContext().getResources();app=this;}
 @Override public File getNoBackupFilesDir(){File f=new File(super.getNoBackupFilesDir(),"mimover-universal-v2");if(!f.exists()&&!f.mkdirs())throw new IllegalStateException("Private directory unavailable");return f;}
 @Override public File getCacheDir(){File f=new File(super.getCacheDir(),"mimover-universal-v2");if(!f.exists()&&!f.mkdirs())throw new IllegalStateException("Private cache unavailable");return f;}
}
