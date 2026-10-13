package androidx.recyclerview.widget;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;

/** Compile signatures only. Exclude this entire directory from the APK. */
public class RecyclerView extends ViewGroup {
    public RecyclerView(Context context) { super(context); }
    public void setAdapter(Adapter adapter) { throw new UnsupportedOperationException(); }
    @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        throw new UnsupportedOperationException();
    }
    public abstract static class Adapter<VH extends ViewHolder> {
        public Adapter() { }
        public abstract int getItemCount();
        public abstract VH onCreateViewHolder(ViewGroup parent, int viewType);
        public abstract void onBindViewHolder(VH holder, int position);
        public final void notifyDataSetChanged() { throw new UnsupportedOperationException(); }
    }
    public abstract static class ViewHolder {
        public final View itemView;
        public ViewHolder(View itemView) { this.itemView = itemView; }
    }
}
