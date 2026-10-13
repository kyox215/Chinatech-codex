package in.chinatech.mimoverengine;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;

/** The original role and source-device cards enter the owned, brand-independent controller. */
public final class Entry {
    private Entry() { }
    public static void source(Activity activity) {
        BridgeContext context=new BridgeContext(activity);
        if(TransferEngine.get(context).isActive()||RestoreCoordinator.get(context).isActive()){open(activity,true);return;}
        activity.startActivity(new Intent().setClassName(activity,"com.miui.huanji.ui.SelectOldDeviceActivity"));
    }
    public static void open(Activity activity, boolean receiving) {
        BridgeContext context=new BridgeContext(activity);
        TransferEngine engine=TransferEngine.get(context);
        RestoreCoordinator restore=RestoreCoordinator.get(context);
        boolean role=receiving;
        if(!engine.isActive()&&!restore.isActive())engine.resetDisplay();
        if(engine.isActive()||restore.isActive())role=context.getSharedPreferences("mimover-universal-ui",Context.MODE_PRIVATE).getBoolean("receiving",false);
        activity.startActivity(new Intent(activity,UniversalActivity.class).putExtra("receiving",role));
    }
    public static void originalNotice(Activity activity) {
        Context context=new BridgeContext(activity);
        MapNotice[] notices={
            new MapNotice("dialog_request_permission_message_extra_title",R.string.original_permission_scope),
            new MapNotice("dialog_request_permission_message_extra_summary",R.string.original_permission_intro),
            new MapNotice("permission_bluetooth_title",R.string.original_permission_categories),
            new MapNotice("permission_bluetooth_summary",R.string.original_permission_prompt),
            new MapNotice("permission_bluetooth_summary_new",R.string.original_permission_prompt),
            new MapNotice("permission_wifi_title_new_china",R.string.original_local_connection),
            new MapNotice("permission_wifi_summary",R.string.original_local_connection_hint),
            new MapNotice("permission_wifi_summary_new",R.string.original_local_connection_hint)
        };
        android.view.View root=activity.findViewById(android.R.id.content);
        for(MapNotice n:notices){int id=activity.getResources().getIdentifier(n.original,"string","com.miui.huanji");if(id!=0)replace(root,activity.getString(id),context.getString(n.replacement));}
        if(android.os.Build.VERSION.SDK_INT>=33)for(String key:new String[]{"permission_locale_title","permission_locale_title_new"}){int id=activity.getResources().getIdentifier(key,"string","com.miui.huanji");if(id!=0)replace(root,activity.getString(id),context.getString(R.string.original_wifi_devices));}
    }
    private static final class MapNotice {final String original;final int replacement;MapNotice(String o,int r){original=o;replacement=r;}}
    private static void replace(android.view.View view,String from,String to){
        if(view instanceof android.widget.TextView&&from.contentEquals(((android.widget.TextView)view).getText()))((android.widget.TextView)view).setText(to);
        if(view instanceof android.view.ViewGroup){android.view.ViewGroup g=(android.view.ViewGroup)view;for(int i=0;i<g.getChildCount();i++)replace(g.getChildAt(i),from,to);}
    }
    public static void unsupportedIos(Activity activity) {
        Context context=new BridgeContext(activity);
        new AlertDialog.Builder(context).setMessage(R.string.original_unsupported_ios).setPositiveButton(R.string.close,null).show();
    }
}
