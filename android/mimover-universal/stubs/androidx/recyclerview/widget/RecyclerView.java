package androidx.recyclerview.widget;
/** Compile-only public API declarations; the original APK supplies these classes. */
public class RecyclerView extends android.view.ViewGroup {
 public RecyclerView(android.content.Context c){super(c);}
 @Override protected void onLayout(boolean c,int l,int t,int r,int b){}
 public void setAdapter(Adapter adapter){} public void setLayoutManager(LayoutManager manager){}
 public abstract static class LayoutManager { }
 public abstract static class ViewHolder { public final android.view.View itemView;public ViewHolder(android.view.View v){itemView=v;} }
 public abstract static class Adapter<VH extends ViewHolder> {
  public abstract VH onCreateViewHolder(android.view.ViewGroup parent,int type);
  public abstract void onBindViewHolder(VH holder,int position);
  public abstract int getItemCount();
  public void notifyDataSetChanged(){} public void setHasStableIds(boolean value){}
  public long getItemId(int position){return -1;}public int getItemViewType(int position){return 0;}
 }
}
