package in.chinatech.smartswitchbridge;

import android.content.Context;
import android.text.format.Formatter;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.recyclerview.widget.RecyclerView;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/** Binds bounded projections to the APK's actual row layouts. Owns no transfer data. */
final class OriginalListAdapter extends RecyclerView.Adapter<OriginalListAdapter.Holder> {
    private final Context context;
    private final boolean category;
    private final OriginalViews.Callbacks callbacks;
    private final Runnable selectionChanged;
    private List<OriginalViews.Row> rows = Collections.emptyList();
    private long revision;

    OriginalListAdapter(Context context, boolean category, OriginalViews.Callbacks callbacks,
                        Runnable selectionChanged) {
        this.context = context;
        this.category = category;
        this.callbacks = callbacks;
        this.selectionChanged = selectionChanged;
    }

    void submit(List<OriginalViews.Row> value) {
        rows = new ArrayList<>(value);
        revision++;
        notifyDataSetChanged();
    }

    List<OriginalViews.Row> snapshot() { return new ArrayList<>(rows); }

    void toggleAll(boolean requested) {
        long before = revision;
        boolean accepted = callbacks.toggleAll(requested);
        if (revision == before && accepted) {
            List<OriginalViews.Row> changed = new ArrayList<>(rows.size());
            for (OriginalViews.Row row : rows) {
                changed.add(row.enabled ? row.withSelected(requested) : row);
            }
            rows = changed;
            revision++;
        }
        // Always rebind authoritative state, including callback refusal.
        notifyDataSetChanged();
        selectionChanged.run();
    }

    @Override public int getItemCount() { return rows.size(); }

    @Override public Holder onCreateViewHolder(ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(category ? 0x7f0c0088 : 0x7f0c0086,
                                                       parent, false);
        return new Holder(view);
    }

    @Override public void onBindViewHolder(final Holder holder, int position) {
        final OriginalViews.Row row = rows.get(position);
        View root = holder.itemView;
        TextView name = root.findViewById(category ? 0x7f0904bb : 0x7f0903ef);
        TextView size = root.findViewById(category ? 0x7f0904bc : 0x7f0903f0);
        name.setText(row.label);
        name.setEnabled(row.enabled);
        String facts = facts(row);
        size.setText(facts);
        size.setVisibility(facts.isEmpty() ? View.GONE : View.VISIBLE);
        size.setEnabled(row.enabled);
        ImageView icon = root.findViewById(category ? 0x7f0901b0 : 0x7f090199);
        icon.setImageResource(icon(row.key));
        if (category) {
            View header = root.findViewById(0x7f090251);
            if (header != null) header.setVisibility(View.GONE);
            View title = root.findViewById(0x7f0904ae);
            if (title != null) title.setVisibility(View.GONE);
            final CheckBox check = root.findViewById(0x7f0900d0);
            check.setOnCheckedChangeListener(null);
            check.setChecked(row.selected);
            check.setEnabled(row.enabled);
            check.setContentDescription(row.label);
            check.setOnCheckedChangeListener((button, checked) -> change(row, check, checked));
            View checkArea = root.findViewById(0x7f09021e);
            checkArea.setEnabled(row.enabled);
            checkArea.setOnClickListener(v -> {
                if (row.enabled) check.setChecked(!check.isChecked());
            });
            View arrow = root.findViewById(0x7f090237);
            arrow.setEnabled(row.enabled);
            arrow.setContentDescription(row.label);
            arrow.setOnClickListener(v -> callbacks.open(row.key));
        } else {
            View fail = root.findViewById(0x7f0901ae);
            fail.setVisibility(row.failed ? View.VISIBLE : View.GONE);
            View expand = root.findViewById(0x7f090193);
            expand.setEnabled(row.enabled);
            expand.setVisibility(row.enabled ? View.VISIBLE : View.INVISIBLE);
            expand.setContentDescription(row.label);
            expand.setOnClickListener(v -> callbacks.open(row.key));
            root.setEnabled(row.enabled);
            root.setOnClickListener(row.enabled ? v -> callbacks.open(row.key) : null);
        }
    }

    private void change(OriginalViews.Row row, CheckBox check, boolean requested) {
        long before = revision;
        boolean accepted = row.enabled && callbacks.toggle(row.key, requested);
        if (revision == before) {
            List<OriginalViews.Row> changed = new ArrayList<>(rows);
            for (int i = 0; i < changed.size(); i++) {
                if (changed.get(i).key.equals(row.key)) {
                    changed.set(i, row.withSelected(accepted ? requested : row.selected));
                    break;
                }
            }
            rows = changed;
            revision++;
        }
        // Rejected clicks are reverted synchronously, before RecyclerView's next frame.
        boolean actual = row.selected;
        for (OriginalViews.Row value : rows) if (value.key.equals(row.key)) actual = value.selected;
        check.setOnCheckedChangeListener(null);
        check.setChecked(actual);
        check.setOnCheckedChangeListener((button, checked) -> {
            OriginalViews.Row current = current(row.key);
            if (current != null) change(current, check, checked);
        });
        selectionChanged.run();
    }

    private OriginalViews.Row current(String key) {
        for (OriginalViews.Row value : rows) if (value.key.equals(key)) return value;
        return null;
    }

    private String facts(OriginalViews.Row row) {
        String count = "";
        if (row.count >= 0) {
            int plural = context.getResources().getIdentifier("number_of_item", "plurals",
                                                             OriginalViews.RESOURCE_PACKAGE);
            count = context.getResources().getQuantityString(plural,
                    (int) Math.min(Integer.MAX_VALUE, row.count), row.count);
        }
        String bytes = row.bytes < 0 ? "" : Formatter.formatShortFileSize(context, row.bytes);
        return count.isEmpty() ? bytes : bytes.isEmpty() ? count : count + " · " + bytes;
    }

    private int icon(String key) {
        String normalized = key.toLowerCase(Locale.ROOT);
        String drawable;
        switch (normalized) {
            case "contacts": case "contact": drawable = "category_contact"; break;
            case "calendar": case "calendars": drawable = "category_calendar"; break;
            case "images": case "photos": case "image": drawable = "category_image"; break;
            case "videos": case "video": drawable = "category_video"; break;
            case "audio": case "music": drawable = "category_audio"; break;
            case "apps": case "app": drawable = "category_apps"; break;
            default: drawable = "category_doc";
        }
        return context.getResources().getIdentifier(drawable, "drawable",
                                                    OriginalViews.RESOURCE_PACKAGE);
    }

    static final class Holder extends RecyclerView.ViewHolder {
        Holder(View view) { super(view); }
    }
}
