package in.chinatech.smartswitchbridge;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.ContextThemeWrapper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.ImageView;
import android.widget.TextView;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.WeakHashMap;

/** Permission introduction only. System permission checks remain the engine's authority. */
public final class OriginalPermissionController {
    private static final String RESOURCE_PACKAGE = "com.sec.android.easyMover";
    private static final String PERMISSION_ACTIVITY =
            "com.sec.android.easyMover.ui.RuntimePermissionActivity";
    private static final String PREFERENCES = "ct_original_permission_intro";
    private static final String HANDLED = "read_intro_v1_handled";
    private static final int REQUEST_READ = 0x4350;
    private static final Map<Activity, OriginalPermissionController> CONTROLLERS = new WeakHashMap<>();
    private final WeakReference<Activity> activity;
    private final boolean informationOnly;
    private boolean awaitingResult;
    private boolean reviewedResult;

    private OriginalPermissionController(Activity host) {
        activity = new WeakReference<>(host);
        informationOnly = host.getIntent().getIntExtra("PermissionViewMode", 0) == 1;
    }

    public static boolean attach(Activity host, Bundle saved) {
        if (host == null || host.isFinishing()) return false;
        OriginalPermissionController controller = CONTROLLERS.get(host);
        if (controller == null) {
            controller = new OriginalPermissionController(host);
            // No saved boolean is accepted as proof of a permission grant.
            CONTROLLERS.put(host, controller);
        }
        controller.render();
        return true;
    }

    /** True means the introduction was completed, never that a system grant exists. */
    public static boolean isHandled(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getBoolean(HANDLED, false);
    }

    public static void onResult(Activity host, int request, String[] permissions, int[] grants) {
        if (request != REQUEST_READ) return;
        OriginalPermissionController controller = CONTROLLERS.get(host);
        if (controller == null || controller.informationOnly || host.isFinishing()) return;
        controller.awaitingResult = false;
        controller.reviewedResult = true;
        // Reread the system state. Empty/interrupted callbacks do not imply authorization.
        controller.render();
    }

    public static boolean configured(Activity host) {
        OriginalPermissionController controller = CONTROLLERS.get(host);
        if (controller == null || host.isFinishing()) return false;
        controller.render();
        return true;
    }

    public static void destroy(Activity host) { CONTROLLERS.remove(host); }

    /** Opens the original Activity. The calling navigation owner decides whether to finish itself. */
    public static void launch(Activity host, Intent target) {
        Intent intent = new Intent().setClassName(host, PERMISSION_ACTIVITY);
        if (target != null) intent.putExtra("target_intent", new Intent(target));
        host.startActivity(intent);
    }

    private void render() {
        Activity host = activity.get();
        if (host == null || host.isFinishing()) return;
        host.setTheme(0x7f1201c6);
        host.setContentView(0x7f0c0048); // Preserved activity_runtime_permission.
        text(host, 0x7f090484, tr(host, "heading"));
        hide(host, 0x7f0903b8); // Expanded and collapsed labels otherwise overlap in this layout.
        applyInsets(host);
        text(host, 0x7f09046d, tr(host, "optional"));
        hide(host, 0x7f090480); // No special-sensitive/all-files authorization is needed.
        hide(host, 0x7f09024d);
        hide(host, 0x7f09009c); // Original scroll-more button does not request permissions.
        ViewGroup list = host.findViewById(0x7f090233);
        if (list == null) throw new IllegalStateException("Missing original permission list");
        list.removeAllViews();
        row(host, list, "media_title", "media_desc", "winset_perm_group_photos_and_videos", mediaState(host));
        row(host, list, "contacts_title", "contacts_desc", "winset_perm_group_contacts",
                grantState(host, Manifest.permission.READ_CONTACTS));
        row(host, list, "calendar_title", "calendar_desc", "winset_perm_group_calendar",
                grantState(host, Manifest.permission.READ_CALENDAR));
        row(host, list, "wifi_title", "wifi_desc", "winset_perm_group_nearby_devices", null);
        row(host, list, "camera_title", "camera_desc", "winset_perm_group_camera", null);
        row(host, list, "notifications_title", "notifications_desc", "winset_perm_group_notifications", null);
        View allow = host.findViewById(0x7f090086);
        View deny = host.findViewById(0x7f09008b);
        if (allow == null || deny == null) throw new IllegalStateException("Missing original permission buttons");
        allow.setVisibility(View.VISIBLE);
        allow.setEnabled(!awaitingResult);
        deny.setEnabled(!awaitingResult);
        if (informationOnly) {
            ((TextView) allow).setText(tr(host, "back"));
            allow.setOnClickListener(v -> host.finish());
            deny.setVisibility(View.GONE);
        } else {
            deny.setVisibility(View.VISIBLE);
            ((TextView) allow).setText(tr(host, reviewedResult ? "continue" : "allow"));
            ((TextView) deny).setText(tr(host, reviewedResult ? "retry" : "skip"));
            allow.setOnClickListener(v -> { if (reviewedResult) complete(); else requestRead(); });
            deny.setOnClickListener(v -> { if (reviewedResult) requestRead(); else complete(); });
        }
        reserveFooter(host);
    }

    private static void applyInsets(Activity host) {
        ViewGroup content = host.findViewById(android.R.id.content);
        if (content == null || content.getChildCount() == 0) return;
        View root = content.getChildAt(0);
        final int left = root.getPaddingLeft(), top = root.getPaddingTop();
        final int right = root.getPaddingRight(), bottom = root.getPaddingBottom();
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int systemLeft, systemTop, systemRight, systemBottom;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                systemLeft = safe.left; systemTop = safe.top;
                systemRight = safe.right; systemBottom = safe.bottom;
            } else {
                systemLeft = insets.getSystemWindowInsetLeft(); systemTop = insets.getSystemWindowInsetTop();
                systemRight = insets.getSystemWindowInsetRight(); systemBottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left + systemLeft, top + systemTop, right + systemRight, bottom + systemBottom);
            // The original children already inherit this safe content rectangle.
            return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        root.post(root::requestApplyInsets);
    }

    private static void reserveFooter(Activity host) {
        View scroll = host.findViewById(0x7f09034f);
        View footer = host.findViewById(0x7f09020f);
        if (scroll == null || footer == null) return;
        final int left = scroll.getPaddingLeft(), top = scroll.getPaddingTop();
        final int right = scroll.getPaddingRight(), bottom = scroll.getPaddingBottom();
        Runnable update = () -> scroll.setPadding(left, top, right, bottom + footer.getHeight());
        footer.addOnLayoutChangeListener((view, l, t, r, b, oldL, oldT, oldR, oldB) -> update.run());
        scroll.post(update);
    }

    private void row(Activity host, ViewGroup list, String title, String description,
                     String iconName, String state) {
        Context context = new ContextThemeWrapper(host, 0x7f12012a);
        View row = LayoutInflater.from(context).inflate(0x7f0c009c, list, false);
        row.setId(View.generateViewId());
        ImageView icon = row.findViewById(0x7f09017f);
        int drawable = host.getResources().getIdentifier(iconName, "drawable", RESOURCE_PACKAGE);
        icon.setImageResource(drawable);
        text(row, 0x7f090497, tr(host, title));
        String details = tr(host, description);
        if (state != null) details += "\n" + tr(host, "state") + state;
        text(row, 0x7f0900f4, details);
        list.addView(row);
    }

    private void requestRead() {
        Activity host = activity.get();
        if (host == null || informationOnly || awaitingResult || host.isFinishing()) return;
        Set<String> required = new LinkedHashSet<>();
        for (String permission : ScanPermissions.media(Build.VERSION.SDK_INT)) required.add(permission);
        required.add(Manifest.permission.READ_CONTACTS);
        required.add(Manifest.permission.READ_CALENDAR);
        ArrayList<String> missing = new ArrayList<>();
        for (String permission : required) {
            if (!granted(host, permission)) missing.add(permission);
        }
        if (missing.isEmpty()) {
            reviewedResult = true;
            render();
            return;
        }
        awaitingResult = true;
        render();
        try {
            host.requestPermissions(missing.toArray(new String[0]), REQUEST_READ);
        } catch (RuntimeException failure) {
            // No request error can manufacture a permission grant or block the skip path.
            awaitingResult = false;
            reviewedResult = true;
            render();
        }
    }

    private void complete() {
        Activity host = activity.get();
        if (host == null || informationOnly || awaitingResult || host.isFinishing()) return;
        // This preference records only that the person reviewed or skipped the introduction.
        host.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putBoolean(HANDLED, true).apply();
        Intent target;
        if (Build.VERSION.SDK_INT >= 33) target = host.getIntent().getParcelableExtra("target_intent", Intent.class);
        else target = host.getIntent().getParcelableExtra("target_intent");
        if (target != null) {
            host.startActivity(new Intent(target).addFlags(0x24000000));
        } else {
            host.setResult(Activity.RESULT_OK);
        }
        destroy(host);
        host.finish();
    }

    private static boolean granted(Context context, String permission) {
        return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private String grantState(Activity host, String permission) {
        return tr(host, granted(host, permission) ? "authorized" : "not_authorized");
    }

    private String mediaState(Activity host) {
        int sdk = Build.VERSION.SDK_INT;
        if (sdk <= 32) return grantState(host, Manifest.permission.READ_EXTERNAL_STORAGE);
        boolean images = granted(host, "android.permission.READ_MEDIA_IMAGES");
        boolean video = granted(host, "android.permission.READ_MEDIA_VIDEO");
        boolean audio = granted(host, "android.permission.READ_MEDIA_AUDIO");
        if (images && video && audio) return tr(host, "authorized");
        boolean selected = sdk >= 34 && granted(host, "android.permission.READ_MEDIA_VISUAL_USER_SELECTED");
        if (selected && !(images && video)) {
            return tr(host, "selected_media") + " " + tr(host, audio ? "audio_authorized" : "audio_denied");
        }
        if (images || video || audio) return tr(host, "partial_media");
        return tr(host, "not_authorized");
    }

    private static void text(Activity host, int id, String value) { text(host.findViewById(id), value); }
    private static void text(View row, int id, String value) { text(row.findViewById(id), value); }
    private static void text(View view, String value) {
        if (!(view instanceof TextView)) throw new IllegalStateException("Missing original permission text");
        ((TextView) view).setText(value);
        view.setVisibility(View.VISIBLE);
    }
    private static void hide(Activity host, int id) {
        View view = host.findViewById(id);
        if (view != null) view.setVisibility(View.GONE);
    }

    private static String tr(Context context, String key) {
        Locale locale = context.getResources().getConfiguration().getLocales().get(0);
        int language = "zh".equals(locale.getLanguage()) ? 2 : "it".equals(locale.getLanguage()) ? 1 : 0;
        String[] values;
        switch (key) {
            case "heading": values = new String[]{"Choose access for your data", "Accesso ai tuoi dati", "授权读取所选资料"}; break;
            case "optional": values = new String[]{"Optional reading permissions", "Permessi di lettura facoltativi", "可选读取权限"}; break;
            case "media_title": values = new String[]{"Photos, videos and audio", "Foto, video e audio", "照片、视频和音频"}; break;
            case "media_desc": values = new String[]{"Read only the media Android allows. You can allow selected photos and videos where Android offers this option. Denied categories stay unavailable; you can still select files using the system file picker.", "Legge solo i contenuti consentiti da Android. Quando disponibile, puoi autorizzare solo foto e video selezionati. Le categorie negate restano indisponibili; puoi scegliere file dal selettore di sistema.", "只读取 Android 实际允许的媒体。系统提供时，可仅授权选定照片和视频。拒绝的类别不可读取；仍可通过系统文件选择器选文件。"}; break;
            case "contacts_title": values = new String[]{"Contacts", "Contatti", "联系人"}; break;
            case "contacts_desc": values = new String[]{"Read authorized contacts to create a local VCF for transfer. This permission does not let the assistant add or edit contacts. You can continue without it.", "Legge i contatti autorizzati per creare un VCF locale da trasferire. Non consente all'assistente di aggiungere o modificare contatti. Puoi continuare senza questo permesso.", "读取已授权联系人，生成本地 VCF 用于传输。本权限不允许助手新增或修改联系人；拒绝后仍可继续。"}; break;
            case "calendar_title": values = new String[]{"Calendar", "Calendario", "日历"}; break;
            case "calendar_desc": values = new String[]{"Read authorized calendar events and export their available fields locally. This permission does not let the assistant add or edit calendar events. You can continue without it.", "Legge gli eventi autorizzati ed esporta localmente i campi disponibili. Non consente all'assistente di aggiungere o modificare eventi. Puoi continuare senza questo permesso.", "读取已授权日历事件，并在本地导出实际可用字段。本权限不允许助手新增或修改事件；拒绝后仍可继续。"}; break;
            case "wifi_title": values = new String[]{"Wi-Fi connection", "Connessione Wi-Fi", "Wi-Fi 连接"}; break;
            case "wifi_desc": values = new String[]{"Requested only when creating or joining a local hotspot. Android 12 and earlier may require location permission and location enabled; the assistant does not read your location. If denied, use phones already on the same Wi-Fi.", "Richiesto solo per creare o collegarsi a un hotspot locale. Android 12 e precedenti possono richiedere il permesso e l'attivazione della posizione; l'assistente non legge la tua posizione. Se negato, collega prima i telefoni alla stessa rete Wi-Fi.", "仅在创建或加入本地热点时申请。Android 12 及更早版本可能要求位置权限和开启位置；助手不读取位置。拒绝后可将两部手机先接入同一 Wi-Fi。"}; break;
            case "camera_title": values = new String[]{"Camera", "Fotocamera", "相机"}; break;
            case "camera_desc": values = new String[]{"Requested only when you open QR scanning. Used to read the pairing code, not to transfer camera contents. You can use another supported pairing method if denied.", "Richiesto solo quando apri la scansione QR. Serve a leggere il codice di abbinamento, non a trasferire i contenuti della fotocamera. Se negato, puoi usare un altro metodo di abbinamento disponibile.", "仅在打开二维码扫描时申请，用于读取配对码，不用于传输相机内容。拒绝后可使用其他已支持的配对方式。"}; break;
            case "notifications_title": values = new String[]{"Notifications", "Notifiche", "通知"}; break;
            case "notifications_desc": values = new String[]{"Requested at the transfer operation to show progress and a stop action. You may continue if notifications are denied. Android background restrictions still apply.", "Richiesto durante il trasferimento per mostrare avanzamento e comando di arresto. Puoi continuare se le notifiche sono negate. Restano valide le limitazioni di Android in background.", "在传输操作时申请，用于显示进度和停止操作。拒绝通知后仍可继续；Android 的后台限制仍然适用。"}; break;
            case "state": values = new String[]{"Current system access: ", "Accesso attuale di sistema: ", "当前系统授权："}; break;
            case "authorized": values = new String[]{"Authorized", "Autorizzato", "已授权"}; break;
            case "not_authorized": values = new String[]{"Not authorized", "Non autorizzato", "未授权"}; break;
            case "selected_media": values = new String[]{"Access includes only selected photos/videos for restricted categories.", "Per le categorie limitate sono accessibili solo foto/video selezionati.", "受限类别仅可访问系统选定的照片或视频。"}; break;
            case "partial_media": values = new String[]{"Some media categories are authorized; others remain unavailable", "Alcune categorie multimediali sono autorizzate; le altre restano indisponibili", "部分媒体类别已授权，其他类别仍不可读取"}; break;
            case "audio_authorized": values = new String[]{"Audio is authorized.", "L'audio è autorizzato.", "音频已授权。"}; break;
            case "audio_denied": values = new String[]{"Audio is not authorized.", "L'audio non è autorizzato.", "音频未授权。"}; break;
            case "allow": values = new String[]{"Allow", "Consenti", "允许"}; break;
            case "skip": values = new String[]{"Skip", "Salta", "跳过"}; break;
            case "continue": values = new String[]{"Continue", "Continua", "继续"}; break;
            case "retry": values = new String[]{"Retry", "Riprova", "重试"}; break;
            case "waiting": values = new String[]{"Waiting for Android", "In attesa di Android", "等待 Android 确认"}; break;
            case "back": values = new String[]{"Back", "Indietro", "返回"}; break;
            default: throw new IllegalArgumentException("Unknown permission introduction text");
        }
        return values[language];
    }
}
