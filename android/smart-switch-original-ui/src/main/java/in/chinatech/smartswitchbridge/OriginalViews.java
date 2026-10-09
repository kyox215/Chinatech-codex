package in.chinatech.smartswitchbridge;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.ContextThemeWrapper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.text.format.Formatter;
import androidx.recyclerview.widget.RecyclerView;
import java.lang.reflect.InvocationTargetException;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Uses the preserved APK layouts; the controller supplies all transport facts. */
public final class OriginalViews {
    static final String RESOURCE_PACKAGE = "com.sec.android.easyMover";
    public enum Stage { CONNECTING, QR, SELECT, SENDING, RECEIVING,
                        COMPLETE_SENDER, COMPLETE_RECEIVER }

    public interface Callbacks {
        void back();
        void next();
        boolean toggleAll(boolean selected);
        boolean toggle(String key, boolean selected);
        void open(String key);
    }

    public static final class Row {
        public final String key, label;
        public final long count, bytes;
        public final boolean selected, enabled, failed;
        /** A negative count/bytes means unknown, never zero. */
        public Row(String key, String label, long count, long bytes,
                   boolean selected, boolean enabled, boolean failed) {
            if (key == null || key.isEmpty() || label == null) {
                throw new IllegalArgumentException("Missing row identity");
            }
            this.key = key; this.label = label; this.count = count; this.bytes = bytes;
            this.selected = selected; this.enabled = enabled; this.failed = failed;
        }
        Row withSelected(boolean value) {
            return new Row(key, label, count, bytes, value, enabled, failed);
        }
    }

    private final Context ordinary;
    private final Context transferring;
    private final Callbacks callbacks;
    private final List<View> animations = new ArrayList<>();
    private View root;
    private OriginalListAdapter categoryAdapter, copiedAdapter, failedAdapter;
    private boolean active = true;

    public OriginalViews(Activity host, Callbacks callbacks) {
        if (host == null || callbacks == null) throw new IllegalArgumentException("Missing host");
        host.setTheme(0x7f1201c6); // The APK's ThemeSmartSwitch.
        ordinary = new ContextThemeWrapper(host, 0x7f12012a);
        transferring = new ContextThemeWrapper(host, 0x7f1201ca);
        this.callbacks = callbacks;
    }

    public View render(Stage stage) {
        if (stage == null) throw new IllegalArgumentException("Missing stage");
        stopAnimations();
        categoryAdapter = copiedAdapter = failedAdapter = null;
        Context context = stage == Stage.SENDING || stage == Stage.RECEIVING
                ? transferring : ordinary;
        switch (stage) {
            case CONNECTING:
                root = inflate(context, 0x7f0c0054, null);
                embed(context, root, 0x7f0900e0, 0x7f0c0023);
                visible(0x7f0900e1, false);
                break;
            case QR:
                root = inflate(context, 0x7f0c0054, null);
                View single = embed(context, root, 0x7f0900e0, 0x7f0c0046);
                embed(context, single, 0x7f0900df, 0x7f0c0059);
                visible(0x7f0900e1, false);
                qr(null);
                break;
            case SELECT:
                root = inflate(context, 0x7f0c002c, null);
                embed(context, root, 0x7f090203, 0x7f0c0026);
                categoryAdapter = new OriginalListAdapter(ordinary, true, callbacks,
                                                         this::selectionState);
                recycler(0x7f090331).setAdapter(categoryAdapter);
                bindSelectAll();
                selectionState();
                break;
            case SENDING:
                root = inflate(context, 0x7f0c004a, null);
                visible(0x7f09024a, true);
                break;
            case RECEIVING:
                root = inflate(context, 0x7f0c004e, null);
                embed(context, root, 0x7f090249, 0x7f0c004a);
                embed(context, root, 0x7f09023f, 0x7f0c0044);
                visible(0x7f09023f, false);
                visible(0x7f09024a, true);
                break;
            case COMPLETE_SENDER:
                root = inflate(context, 0x7f0c0046, null);
                embed(context, root, 0x7f0900df, 0x7f0c0058);
                visible(0x7f0901e3, true);
                visible(0x7f090207, true);
                completedPhones();
                break;
            case COMPLETE_RECEIVER:
                root = inflate(context, 0x7f0c0021, null);
                copiedAdapter = new OriginalListAdapter(ordinary, false, callbacks, () -> { });
                failedAdapter = new OriginalListAdapter(ordinary, false, callbacks, () -> { });
                recycler(0x7f09026c).setAdapter(copiedAdapter);
                recycler(0x7f090271).setAdapter(failedAdapter);
                visible(id("group_copied_list"), false);
                visible(id("group_not_copied_list"), false);
                break;
            default: throw new IllegalArgumentException("Unknown stage");
        }
        // The original XML has no real transfer values at this point.
        for (String name : new String[]{"text_selected_item_count", "text_selected_item_size",
                "text_progress", "text_remaining_time", "text_sending_item_1",
                "text_sending_item_2", "text_sending_item_count", "text_restoring_item",
                "text_restoring_time", "text_restoring_desc", "text_total_count",
                "text_total_size", "text_data_transferred", "text_galaxy_device"}) {
            blank(name);
        }
        bindButton("button_footer_left", callbacks::back);
        bindButton("button_footer_right", callbacks::next);
        bindButton("sud_floating_back_button", callbacks::back);
        bindButton("button_show_more", () -> callbacks.open("results"));
        // Footer buttons remain hidden until the controller sets their actual labels.
        if (stage == Stage.SELECT) selectionState();
        registerAnimation("animation_connecting");
        registerAnimation("animation_organizing");
        return root;
    }

    public void text(String resourceName, String value) {
        if (root == null) return;
        final int target = id(resourceName);
        if (target == 0) throw new IllegalArgumentException("Unknown original id: " + resourceName);
        each(root, target, view -> {
            if (!(view instanceof TextView)) throw new IllegalArgumentException("Not a text view");
            ((TextView) view).setText(value == null ? "" : value);
            view.setVisibility(value == null || value.isEmpty() ? View.GONE : View.VISIBLE);
            if (value != null && !value.isEmpty()) showAncestors(view);
        });
    }

    public void qr(Bitmap value) {
        if (root == null) return;
        View image = root.findViewById(0x7f0901a3);
        if (image != null) {
            ((ImageView) image).setImageBitmap(value);
            image.setVisibility(value == null ? View.GONE : View.VISIBLE);
        }
        visible(0x7f090323, value == null);
        visible(0x7f090329, false); // Retained scanner is separately controlled by the Activity.
    }

    /** Progress is the APK's native percentage in [0,100]. */
    public void progress(float percentage) {
        if (root == null) return;
        if (Float.isNaN(percentage) || Float.isInfinite(percentage) || percentage < 0) {
            blank("text_progress");
            return;
        }
        float value = Math.max(0, Math.min(100, percentage));
        each(root, 0x7f0900cf, view -> call(view, "setProgress", float.class, value));
        text("text_progress", NumberFormat.getPercentInstance().format(value / 100d));
    }

    public void categories(List<Row> rows) {
        if (categoryAdapter == null) throw new IllegalStateException("Not a selection page");
        categoryAdapter.submit(checked(rows, 7));
        selectionState();
    }

    public void details(List<Row> rows) {
        if (categoryAdapter == null) throw new IllegalStateException("Not a selection page");
        categoryAdapter.submit(checked(rows, 64)); selectionState();
    }
    public void qrIdle() { visible(0x7f0901a3, false); visible(0x7f090323, false); visible(0x7f090329, false); }
    public void qrScanner() { visible(0x7f0901a3, false); visible(0x7f090323, false); visible(0x7f090329, true); }

    /** Receives a bounded category/page projection, never queries the source catalog. */
    public void results(List<Row> rows) {
        if (copiedAdapter == null) throw new IllegalStateException("Not a results page");
        List<Row> copied = new ArrayList<>(), failed = new ArrayList<>();
        for (Row row : checked(rows, 100)) (row.failed ? failed : copied).add(row);
        copiedAdapter.submit(copied);
        failedAdapter.submit(failed);
        visible(id("group_copied_list"), !copied.isEmpty());
        visible(id("group_not_copied_list"), !failed.isEmpty());
        resultGraph(copied);
    }

    private void completedPhones() {
        // These are the original generic phone-to-phone completion drawables, not model assets.
        ((ImageView) root.findViewById(0x7f0901a1)).setImageResource(0x7f08014d); // img_old_phone
        ((ImageView) root.findViewById(0x7f0901a0)).setImageResource(0x7f080148); // img_new_phone
        ((ImageView) root.findViewById(0x7f09018b)).setImageResource(0x7f08011d); // ic_all_done
        root.findViewById(0x7f0901e3).setContentDescription(ordinary.getString(0x7f110ab4));
    }

    private void resultGraph(List<Row> copied) {
        LinearLayout graph = root.findViewById(0x7f090241);
        if (graph == null) throw new IllegalStateException("Missing original result graph");
        graph.removeAllViews();
        double bytes = 0, count = 0;
        boolean bytesKnown = true, countKnown = true;
        for (Row row : copied) {
            if (row.bytes < 0) bytesKnown = false; else bytes += row.bytes;
            if (row.count < 0) countKnown = false; else count += row.count;
        }
        boolean byBytes = bytesKnown && bytes > 0;
        double total = byBytes ? bytes : countKnown ? count : 0;
        graph.setWeightSum(1f);
        if (total > 0) {
            for (Row row : copied) {
                double value = byBytes ? row.bytes : row.count;
                if (value <= 0) continue;
                // The original CompletedActivity builds this same plain-View weighted strip.
                View portion = new View(ordinary);
                portion.setBackgroundColor(ordinary.getResources().getColor(graphColor(row.key), ordinary.getTheme()));
                portion.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
                graph.addView(portion, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT,
                        (float) (value / total)));
            }
        }
        graph.setContentDescription(byBytes
                ? graphText("Transferred bytes by category", "Byte trasferiti per categoria", "按类别显示已传输字节")
                : total > 0
                ? graphText("Transferred items by category", "Elementi trasferiti per categoria", "按类别显示已传输项目数")
                : graphText("No byte distribution available", "Distribuzione dei byte non disponibile", "暂无可用字节分布"));
        if (!byBytes) {
            String actualSize = bytesKnown ? Formatter.formatShortFileSize(ordinary, 0)
                    : graphText("Unknown size", "Dimensione ignota", "大小未知");
            text("text_total_size", actualSize + (total > 0
                    ? " · " + graphText("items", "elementi", "项目数") : ""));
        }
    }

    private int graphColor(String key) {
        switch (key) {
            case "photos": return 0x7f060400;
            case "videos": return 0x7f060405;
            case "audio": return 0x7f0603f8;
            case "contacts": return 0x7f0603fa;
            case "calendar": return 0x7f0603f9;
            case "apps": return 0x7f0603f7;
            case "files": return 0x7f0603fd;
            default: return 0x7f0603fc;
        }
    }

    private String graphText(String en, String it, String zh) {
        Locale locale = ordinary.getResources().getConfiguration().getLocales().get(0);
        return "zh".equals(locale.getLanguage()) ? zh : "it".equals(locale.getLanguage()) ? it : en;
    }

    public void pause() {
        active = false;
        for (View animation : animations) call(animation, "b");
    }

    public void resume() {
        active = true;
        for (View animation : animations) resumeMeasured(animation);
    }

    private void bindSelectAll() {
        CheckBox check = root.findViewById(0x7f0900c7);
        check.setOnCheckedChangeListener((button, selected) -> categoryAdapter.toggleAll(selected));
        View area = root.findViewById(0x7f090248);
        area.setOnClickListener(v -> { if (check.isEnabled()) check.setChecked(!check.isChecked()); });
    }

    private void selectionState() {
        if (categoryAdapter == null) return;
        boolean anyEnabled = false, all = true, anySelected = false;
        for (Row row : categoryAdapter.snapshot()) {
            if (row.enabled) { anyEnabled = true; all &= row.selected; }
            anySelected |= row.enabled && row.selected;
        }
        CheckBox check = root.findViewById(0x7f0900c7);
        check.setOnCheckedChangeListener(null);
        check.setEnabled(anyEnabled);
        check.setChecked(anyEnabled && all);
        check.setOnCheckedChangeListener((button, selected) -> categoryAdapter.toggleAll(selected));
        // The controller owns the primary action: sender review rows are read-only.
    }

    private void bindButton(String name, Runnable action) {
        each(root, id(name), view -> view.setOnClickListener(v -> action.run()));
        if (name.equals("sud_floating_back_button")) visible(id(name), true);
    }

    private void registerAnimation(String name) {
        each(root, id(name), view -> {
            animations.add(view);
            if (view.getClass().getSimpleName().equals("OrganizingAnimationView")) {
                try {
                    Class<?> listener = Class.forName("ag.p0", true, view.getContext().getClassLoader());
                    android.view.ViewTreeObserver.OnGlobalLayoutListener original =
                        (android.view.ViewTreeObserver.OnGlobalLayoutListener) listener
                        .getConstructor(android.view.KeyEvent.Callback.class, int.class).newInstance(view, 2);
                    view.getViewTreeObserver().addOnGlobalLayoutListener(original);
                } catch (ReflectiveOperationException failure) {
                    throw new IllegalStateException("Original organizing initializer unavailable", failure);
                }
            } else call(view, "d"); // Connecting view registers its own measured initialization.
            view.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
                @Override public void onViewAttachedToWindow(View v) {
                    v.post(() -> resumeMeasured(v));
                }
                @Override public void onViewDetachedFromWindow(View v) { call(v, "b"); }
            });
        });
    }

    private void resumeMeasured(View view) {
        if (active && view.getWidth() > 0 && view.getHeight() > 0 && view.isShown()) call(view, "c");
    }

    private void stopAnimations() {
        for (View animation : animations) call(animation, "b");
        animations.clear();
    }

    private View inflate(Context context, int layout, ViewGroup parent) {
        return LayoutInflater.from(context).inflate(layout, parent, false);
    }

    private View embed(Context context, View within, int frameId, int layout) {
        ViewGroup frame = within.findViewById(frameId);
        if (frame == null) throw new IllegalStateException("Missing original frame");
        View child = inflate(context, layout, frame);
        frame.addView(child);
        frame.setVisibility(View.VISIBLE);
        return child;
    }

    private RecyclerView recycler(int resource) {
        View view = root.findViewById(resource);
        if (!(view instanceof RecyclerView)) throw new IllegalStateException("Missing original list");
        return (RecyclerView) view;
    }

    private int id(String name) {
        return ordinary.getResources().getIdentifier(name, "id", RESOURCE_PACKAGE);
    }

    private void blank(String name) {
        each(root, id(name), view -> { if (view instanceof TextView) ((TextView) view).setText(""); });
    }

    private void visible(int target, boolean value) {
        each(root, target, view -> view.setVisibility(value ? View.VISIBLE : View.GONE));
    }

    private void showAncestors(View view) {
        // The controller owns shell frame visibility (receiving versus restoring).
        // Reveal only the original optional fact/footer container for this text.
        while (view.getParent() instanceof View && view != root) {
            view = (View) view.getParent();
            int resource = view.getId();
            if (resource == 0x7f09020f || resource == 0x7f09024a
                    || resource == 0x7f09024b || resource == 0x7f090207) {
                view.setVisibility(View.VISIBLE);
            }
        }
    }

    private static List<Row> checked(List<Row> rows, int limit) {
        if (rows == null) return Collections.emptyList();
        if (rows.size() > limit) throw new IllegalArgumentException("Unbounded original UI rows");
        Set<String> keys = new HashSet<>();
        List<Row> result = new ArrayList<>(rows.size());
        for (Row row : rows) {
            if (row == null || !keys.add(row.key)) throw new IllegalArgumentException("Invalid row projection");
            result.add(row);
        }
        return result;
    }

    private interface Action { void accept(View view); }
    private static void each(View view, int target, Action action) {
        if (view == null || target == 0) return;
        if (view.getId() == target) action.accept(view);
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) each(group.getChildAt(i), target, action);
        }
    }

    private static void call(View view, String method) { call(view, method, null, null); }
    private static void call(View view, String method, Class<?> type, Object argument) {
        try {
            if (type == null) view.getClass().getMethod(method).invoke(view);
            else view.getClass().getMethod(method, type).invoke(view, argument);
        } catch (InvocationTargetException exception) {
            throw new IllegalStateException("Original view method failed: " + method, exception.getCause());
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException("Original view ABI mismatch: " + method, exception);
        }
    }
}
