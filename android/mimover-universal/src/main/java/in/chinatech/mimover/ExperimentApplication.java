package in.chinatech.mimover;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import java.util.Locale;

/** Keeps the original application and views; supplies Italian labels for the exposed role flow. */
public final class ExperimentApplication extends com.miui.huanji.MainApplication {
    @Override public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            @Override public void onActivityResumed(Activity activity) {
                apply(activity);
                activity.getWindow().getDecorView().post(()->{if(!activity.isFinishing()&&!activity.isDestroyed())apply(activity);});
            }
            @Override public void onActivityCreated(Activity a, Bundle b) { }
            @Override public void onActivityStarted(Activity a) { }
            @Override public void onActivityPaused(Activity a) { }
            @Override public void onActivityStopped(Activity a) { }
            @Override public void onActivitySaveInstanceState(Activity a, Bundle b) { }
            @Override public void onActivityDestroyed(Activity a) { }
        });
    }

    public static void apply(Activity activity){localize(activity);bind(activity);in.chinatech.mimoverengine.Entry.originalNotice(activity);}

    private static void localize(Activity a) {
        android.content.res.Configuration config = a.getResources().getConfiguration();
        Locale locale = android.os.Build.VERSION.SDK_INT >= 24 ? config.getLocales().get(0) : config.locale;
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            android.app.LocaleManager manager = a.getSystemService(android.app.LocaleManager.class);
            if (manager != null && !manager.getApplicationLocales().isEmpty())
                locale = manager.getApplicationLocales().get(0);
        }
        String chosen=a.getSharedPreferences("mimover-universal-ui", MODE_PRIVATE).getString("language", "");
        if(!chosen.isEmpty())locale=Locale.forLanguageTag(chosen);
        String language = locale.getLanguage();
        if (!"it".equals(language) && !"zh".equals(language) && !"en".equals(language)) return;
        boolean en="en".equals(language);
        boolean it = "it".equals(language);
        String type = a.getClass().getName();
        if (("com.miui.huanji.MainActivity".equals(type)||"in.chinatech.mimoverengine.EntryMainActivity".equals(type))) {
            replaceText(a.findViewById(android.R.id.content),a.getString(0x7f10003f),en||it?"Mi Mover":"小米换机");
            text(a, "title_new", en ? "New" : it ? "Nuovo" : "新");
            text(a, "subtitle_new", en ? "Tap to receive items" : it ? "Tocca per ricevere i dati" : "我是新设备");
            text(a, "title_old", en ? "Old" : it ? "Vecchio" : "旧");
            text(a, "subtitle_old", en ? "Tap to send items" : it ? "Tocca per inviare i dati" : "我是旧设备");
            description(a, "btn_receiver", en ? "New phone. Tap to receive items" : it ? "Nuovo telefono. Tocca per ricevere i dati" : "新，我是新设备");
            description(a, "btn_sender", en ? "Old phone. Tap to send items" : it ? "Vecchio telefono. Tocca per inviare i dati" : "旧，我是旧设备");
            replaceText(a.findViewById(android.R.id.content), a.getString(0x7f100524),
                    en ? "Transfer items to a new device" : it ? "Trasferisci i dati al nuovo dispositivo" : "重要数据一键迁移，延续你的每份热爱");
        } else if ("com.miui.huanji.ui.SelectOldDeviceActivity".equals(type)) {
            String title = en ? "Select old device type" : it ? "Tipo di vecchio dispositivo" : "选择旧设备类型";
            a.setTitle(title);
            text(a, "title", title);
            text(a, "select_mi_title", en ? "Xiaomi" : it ? "Xiaomi" : "小米");
            text(a, "select_mi_summary", en ? "Xiaomi and Redmi" : it ? "Xiaomi e Redmi" : "小米、红米");
            text(a, "select_android_title", en ? "Android" : it ? "Android" : "安卓");
            text(a, "select_android_summary", en ? "Huawei, OPPO, vivo and more" : it ? "Huawei, OPPO, vivo e altri" : "华为、OPPO、vivo 等");
            text(a, "select_apple_title", en ? "Apple" : it ? "Apple" : "苹果");
            text(a, "select_apple_summary", "iPhone");
            description(a, "select_mi", en ? "Xiaomi. Xiaomi and Redmi" : it ? "Xiaomi. Xiaomi e Redmi" : "小米，小米、红米");
            description(a, "select_android", en ? "Android. Huawei, OPPO, vivo and more" : it ? "Android. Huawei, OPPO, vivo e altri" : "安卓，华为、OPPO、vivo 等");
            description(a, "select_apple", en ? "Apple. iPhone" : it ? "Apple. iPhone" : "苹果，iPhone");
        }
    }

    private static void replaceText(View view, String original, String replacement) {
        if (view instanceof TextView && original.contentEquals(((TextView) view).getText()))
            ((TextView) view).setText(replacement);
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) replaceText(group.getChildAt(i), original, replacement);
        }
    }

    private static void bind(Activity a) {
        String type=a.getClass().getName();
        if (("com.miui.huanji.MainActivity".equals(type)||"in.chinatech.mimoverengine.EntryMainActivity".equals(type))) {
            View fresh=view(a,"btn_receiver");
            if(fresh!=null){fresh.setOnTouchListener(null);fresh.setOnClickListener(v->in.chinatech.mimoverengine.Entry.source(a));}
            View old=view(a,"btn_sender");
            if(old!=null){old.setOnTouchListener(null);old.setOnClickListener(v->in.chinatech.mimoverengine.Entry.open(a,false));}
        } else if ("com.miui.huanji.ui.SelectOldDeviceActivity".equals(type)) {
            for(String name:new String[]{"select_mi","select_android"}) {
                View v=view(a,name);
                if(v!=null){v.setOnTouchListener(null);v.setOnClickListener(w->in.chinatech.mimoverengine.Entry.open(a,true));}
            }
            View apple=view(a,"select_apple");
            if(apple!=null){apple.setOnTouchListener(null);apple.setOnClickListener(v->in.chinatech.mimoverengine.Entry.unsupportedIos(a));}
        }
    }

    private static View view(Activity a, String name) {
        int id = a.getResources().getIdentifier(name, "id", "com.miui.huanji");
        return id == 0 ? null : a.findViewById(id);
    }
    private static void text(Activity a, String name, String value) {
        View v = view(a, name);
        if (v instanceof TextView) ((TextView) v).setText(value);
    }
    private static void description(Activity a, String name, String value) {
        View v = view(a, name);
        if (v != null) {
            v.setContentDescription(value);
            v.setAccessibilityDelegate(new View.AccessibilityDelegate() {
                @Override public void onInitializeAccessibilityNodeInfo(View host,
                        android.view.accessibility.AccessibilityNodeInfo info) {
                    super.onInitializeAccessibilityNodeInfo(host, info);
                    info.setContentDescription(value);
                    info.setClassName(android.widget.Button.class.getName());
                }
            });
        }
    }
}
