package in.chinatech.phoneassistant;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.res.Configuration;
import java.util.Locale;
/** Localized context using this APK's compiled resources; existing private storage is retained. */
final class BridgeContext extends ContextWrapper {
 private Context app;
 BridgeContext(Context base){super(localized(base));}
 private static Context localized(Context base){String code=base.getSharedPreferences("chinatech-universal-ui",Context.MODE_PRIVATE).getString("language","");if(code.isEmpty())return base;Configuration c=new Configuration(base.getResources().getConfiguration());c.setLocale(Locale.forLanguageTag(code));return base.createConfigurationContext(c);}
 @Override public synchronized Context getApplicationContext(){if(app==null)app=new BridgeContext(getBaseContext().getApplicationContext(),true);return app;}
 private BridgeContext(Context base,boolean application){super(localized(base));app=this;}
}
