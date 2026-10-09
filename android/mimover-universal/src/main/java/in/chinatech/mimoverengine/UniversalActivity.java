package in.chinatech.mimoverengine;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import androidx.recyclerview.widget.RecyclerView;
import androidx.recyclerview.widget.LinearLayoutManager;
import java.util.*;

/** Original OEM layouts, driven only by the owned public-API transport and durable receipts. */
public final class UniversalActivity extends CoreActivity {
    static final String HOST="host", GUEST="guest", SELECT="select", PROGRESS="progress", FINISH="finish";
    private String page, category;
    private long after;
    private final List<Long> previous = new ArrayList<>();
    private View originalRoot;
    private Rows rows;
    private TextView uiStatus, uiCount, uiSsid, uiSummary;
    private Button uiSend;
    private ImageView originalQr;
    private boolean ready, changing;

    @Override public void onCreate(Bundle state) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(state);
        page = state == null ? (receiving ? HOST : GUEST) : state.getString("original-page", receiving ? HOST : GUEST);
        if (state != null) { category = state.getString("original-category"); after = state.getLong("original-after");long[] history=state.getLongArray("original-previous");if(history!=null)for(long cursor:history)previous.add(cursor); }
        ready = true;
        render(page);
        changed();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("original-page",page);state.putString("original-category",category);state.putLong("original-after",after);long[] history=new long[previous.size()];for(int i=0;i<history.length;i++)history[i]=previous.get(i);state.putLongArray("original-previous",history);
        super.onSaveInstanceState(state);
    }
    private int originalId(String name) { return getResources().getIdentifier(name,"id","com.miui.huanji"); }
    private View original(String name) { int id=originalId(name);return id==0?null:originalRoot.findViewById(id); }
    private void visible(String name, boolean yes) { View v=original(name);if(v!=null)v.setVisibility(yes?View.VISIBLE:View.GONE); }
    private void label(String name,String value) { View v=original(name);if(v instanceof TextView){((TextView)v).setText(value);v.setContentDescription(value);} }
    private void action(String name,int title,Runnable action) { View v=original(name);if(v==null)return;if(v instanceof TextView)((TextView)v).setText(title);v.setContentDescription(getString(title));v.setOnClickListener(w->safeAction(action));v.setVisibility(View.VISIBLE);v.setMinimumHeight(dp(44)); }
    private void header(int title) {
        visible("actionbar_phone",true);visible("actionbar_pad",false);
        label("title_phone",getString(title));label("title",getString(title));
        View backView=original("home_phone");if(backView==null)backView=original("home");if(backView==null)backView=original("home_pad");
        final View selectedBack=backView;
        for(String name:new String[]{"home","home_phone","home_pad"}){View v=original(name);if(v==null)continue;v.setVisibility(v==selectedBack?View.VISIBLE:View.GONE);if(v!=selectedBack)continue;v.setContentDescription(getString(R.string.close));v.setMinimumWidth(dp(44));v.setMinimumHeight(dp(44));ViewGroup.LayoutParams params=v.getLayoutParams();if(params!=null){if(params.width>=0)params.width=Math.max(params.width,dp(44));if(params.height>=0)params.height=Math.max(params.height,dp(44));v.setLayoutParams(params);}v.setOnClickListener(w->back());}
    }
    private void render(String next) {
        if(changing||isFinishing())return;changing=true;
        try {
            page=next;rows=null;uiStatus=null;uiCount=null;uiSsid=null;uiSummary=null;uiSend=null;originalQr=null;
            int layout=HOST.equals(next)?HostR.layout.activity_host:GUEST.equals(next)?HostR.layout.activity_guest:SELECT.equals(next)?HostR.layout.activity_scanner:PROGRESS.equals(next)?HostR.layout.activity_transfer:receiving?HostR.layout.activity_receiver_finish:HostR.layout.activity_sender_finish;
            originalRoot=getLayoutInflater().inflate(layout,null,false);
            if(SELECT.equals(next)||PROGRESS.equals(next)){
                // These original resources expect an Activity ActionBar. Reuse the OEM
                // phone header stub explicitly because this controller has no ActionBar.
                LinearLayout frame=column();
                int barLayout=getResources().getIdentifier("actionbar_stub_phone","layout","com.miui.huanji");
                View bar=getLayoutInflater().inflate(barLayout,frame,false);bar.setId(originalId("actionbar_phone"));
                frame.addView(bar,new LinearLayout.LayoutParams(-1,-2));
                frame.addView(originalRoot,new LinearLayout.LayoutParams(-1,0,1));originalRoot=frame;
            }
            setContentView(originalRoot);
            final int pl=originalRoot.getPaddingLeft(),pt=originalRoot.getPaddingTop(),pr=originalRoot.getPaddingRight(),pb=originalRoot.getPaddingBottom();
            originalRoot.setOnApplyWindowInsetsListener((v,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(pl+bars.left,pt+bars.top,pr+bars.right,pb+bars.bottom);}else v.setPadding(pl+insets.getSystemWindowInsetLeft(),pt+insets.getSystemWindowInsetTop(),pr+insets.getSystemWindowInsetRight(),pb+insets.getSystemWindowInsetBottom());return insets;});
            originalRoot.requestApplyInsets();
            if(HOST.equals(next))host();else if(GUEST.equals(next))guest();else if(SELECT.equals(next))selection();else if(PROGRESS.equals(next))progress();else finishPage();
        } finally {changing=false;}
        updateOriginal();
    }
    private void host() {
        header(R.string.original_host_title);visible("lyt_provision_btn",false);visible("background",false);
        uiStatus=(TextView)original("ap_name_hint");uiSsid=(TextView)original("ap_name");
        LinearLayout ap=(LinearLayout)original("ap_layout");
        originalQr=new ImageView(this);originalQr.setContentDescription(getString(R.string.qr_pairing));
        if(ap!=null){ap.setGravity(Gravity.CENTER);ap.addView(originalQr,0,new LinearLayout.LayoutParams(dp(224),dp(224)));originalQr.setOnClickListener(v->copyCode());}
        action("host_install_hint",R.string.choose_folder,()->folder.performClick());
        action("host_hint_message",R.string.original_connection_options,this::connectionOptions);
    }
    private void connectionOptions() {
        List<String> labels=new ArrayList<>(Arrays.asList(getString(R.string.create_hotspot),getString(R.string.manual_hotspot_pairing),getString(R.string.router_fallback),getString(R.string.restore_title),getString(R.string.stop)));
        if(engine.wifi.hotspotActive()&&engine.wifi.host==null&&!engine.isActive())labels.add(getString(R.string.confirm_hotspot_ip));
        new AlertDialog.Builder(this).setTitle(R.string.original_connection_options).setItems(labels.toArray(new String[0]),(d,n)->safeAction(()->{
            if(n==0)hotspot.performClick();else if(n==1)manualHotspotDialog();else if(n==2)router.performClick();else if(n==3)configureRestore();else if(n==4)stopPrompt();else manualAddress();
        })).setNegativeButton(R.string.close,null).show();
    }
    private void manualAddress(){
        if(engine.isActive()||restore.isActive()||!engine.wifi.hotspotActive()||engine.wifi.host!=null)return;
        EditText input=new EditText(this);input.setTextSize(16);input.setMinHeight(dp(48));input.setHint(R.string.hotspot_ip_input);input.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(R.string.confirm_hotspot_ip).setMessage(getString(R.string.hotspot_ip_candidates,android.text.TextUtils.join(", ",engine.wifi.localAddresses()))).setView(input).setNegativeButton(R.string.cancel,null).setPositiveButton(R.string.continue_action,null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->safeAction(()->{engine.setHotspotHost(input.getText().toString());if(engine.wifi.host!=null)dialog.dismiss();else input.setError(getString(R.string.hotspot_ip_invalid));})));dialog.show();
    }
    private void guest() {
        header(R.string.original_guest_title);
        for(String name:new String[]{"lottie_view_guest_search","guest_mask","search_view","ap_containner","entry_level_view"})visible(name,false);
        visible("guest_hint",true);label("guest_hint",getString(R.string.original_pair_help));
        uiStatus=(TextView)original("guest_hint");
        View anchor=original("ap_containner");ViewGroup area=anchor==null?null:(ViewGroup)anchor.getParent();
        if(area!=null){
            LinearLayout controls=column();controls.setGravity(Gravity.CENTER);controls.setPadding(dp(24),dp(8),dp(24),dp(8));
            controls.addView(originalAction(R.string.original_choose_data,()->render(SELECT)));
            controls.addView(originalAction(R.string.qr_camera,this::liveQr));
            controls.addView(originalAction(R.string.qr_image,()->launchQr(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),QR_IMAGE)));
            controls.addView(originalAction(R.string.original_pair_code_input,this::pairCode));
            area.addView(controls,new ViewGroup.LayoutParams(-1,-1));
        }
        action("guest_button_retry",R.string.start_transfer,this::connectSelected);
        action("install_new_app_link",R.string.original_more_actions,this::moreActions);
    }
    private void safeAction(Runnable action){try{action.run();}catch(RuntimeException error){Toast.makeText(this,R.string.action_failed,Toast.LENGTH_LONG).show();}}
    private Button originalAction(int title,Runnable run) {
        Button button=new Button(this,null,0,0x7f110001);button.setText(title);button.setTextSize(16);button.setAllCaps(false);button.setMinHeight(dp(48));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(6),0,dp(6));button.setLayoutParams(lp);button.setOnClickListener(v->safeAction(run));return button;
    }
    private void pairCode() {
        EditText code=new EditText(this);code.setTextSize(16);code.setMinLines(3);code.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS|android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);code.setHint(R.string.paste_code);
        new AlertDialog.Builder(this).setTitle(R.string.original_pair_code_input).setView(code).setNegativeButton(R.string.cancel,null).setPositiveButton(R.string.continue_action,(d,w)->{pairingIn.setText(code.getText());connectSelected();}).show();
    }
    private void selection() {
        header(R.string.original_choose_data);uiStatus=(TextView)original("sub_title");
        action("select_all",R.string.select_all,()->engine.chooseCategory(category,true));
        action("not_support_data_entry",R.string.original_more_actions,this::moreActions);
        uiSend=(Button)original("button_send");uiSend.setText(R.string.start_transfer);uiSend.setOnClickListener(v->{if(pairingIn.getText().length()>0)connectSelected();else render(GUEST);});
        RecyclerView list=(RecyclerView)original("scanner_list");list.setLayoutManager(new LinearLayoutManager(this));rows=new Rows(false);list.setAdapter(rows);
    }
    private void moreActions() {
        String[] labels={getString(R.string.scan_phone),getString(R.string.scan_directory),getString(R.string.choose_files),getString(R.string.select_none),getString(R.string.restore_title),"中文 / Italiano / English",getString(R.string.compatibility_check),getString(R.string.manual_send)};
        new AlertDialog.Builder(this).setTitle(R.string.original_more_actions).setItems(labels,(d,n)->{
            if(n==0){render(SELECT);requestScan();}else if(n==1){render(SELECT);tree.performClick();}else if(n==2){render(SELECT);choose.performClick();}else if(n==3)engine.chooseCategory(category,false);else if(n==4)configureRestore();else if(n==5)languages();else if(n==6)compatibilityCheck();else manualSend();
        }).setNegativeButton(R.string.close,null).show();
    }
    private void languages() {
        new AlertDialog.Builder(this).setItems(new String[]{"中文","Italiano","English"},(d,n)->{String code=new String[]{"zh","it","en"}[n];getSharedPreferences("mimover-universal-ui",MODE_PRIVATE).edit().putString("language",code).apply();if(android.os.Build.VERSION.SDK_INT>=33)getSystemService(android.app.LocaleManager.class).setApplicationLocales(android.os.LocaleList.forLanguageTags(code));recreate();}).show();
    }
    private void progress() {
        header(R.string.original_transfer_title);
        visible("transfer_single_group_view",false);visible("button_expand_list",false);
        uiStatus=(TextView)original("transfer_title");uiCount=(TextView)original("transfer_summary");uiSummary=(TextView)original("transfer_multiple_group_summary");
        label("transfer_multiple_group_title",getString(R.string.original_choose_data));((TextView)original("transfer_multiple_group_title")).setTextSize(20);
        action("button_cancel",R.string.stop,this::stopPrompt);
        action("button_exit",R.string.close,this::back);
        action("button_reconnect",R.string.continue_action,()->render(receiving?HOST:GUEST));
        View group=original("transfer_multiple_group_view");if(group!=null)group.setVisibility(View.VISIBLE);
        for(String decoration:new String[]{"back_view","top_back_view","up_back_view"})visible(decoration,false);
        ViewGroup stage=(ViewGroup)original("bottom_view");
        int background=getResources().getIdentifier("themed_white","color","com.miui.huanji");if(background!=0)stage.setBackgroundColor(getResources().getColor(background,getTheme()));
        LinearLayout content=column();content.setPadding(dp(16),dp(12),dp(16),dp(16));
        LinearLayout statusBlock=(LinearLayout)original("transfer_middle_view");View transfer=original("transfer_view"),failure=original("transfer_interrupt"),stop=original("button_cancel");
        for(View part:new View[]{statusBlock,transfer,failure,stop}){if(part!=null&&part.getParent() instanceof ViewGroup)((ViewGroup)part.getParent()).removeView(part);}
        statusBlock.setGravity(Gravity.TOP);statusBlock.setAlpha(1);content.addView(statusBlock,new LinearLayout.LayoutParams(-1,-2));
        // The OEM title was sized for a short percentage. It now holds a full status sentence.
        uiStatus.setTextSize(20);uiStatus.setAlpha(1);uiCount.setTextSize(16);uiCount.setAlpha(1);
        content.addView(transfer,new LinearLayout.LayoutParams(-1,0,1));content.addView(failure,new LinearLayout.LayoutParams(-1,0,1));
        Button stopButton=(Button)stop;int stopBackground=getResources().getIdentifier("transfer_phone_button_background","drawable","com.miui.huanji");if(stopBackground!=0)stopButton.setBackgroundResource(stopBackground);stopButton.setMinHeight(dp(48));stopButton.setTextSize(16);content.addView(stopButton,new LinearLayout.LayoutParams(-1,-2));
        stage.addView(content,new android.widget.FrameLayout.LayoutParams(-1,-1));
        RecyclerView list=(RecyclerView)original("transfer_list");if(list!=null){list.setLayoutManager(new LinearLayoutManager(this));rows=new Rows(true);list.setAdapter(rows);}
    }
    private void finishPage() {
        String title=receiving?"receiver_finish_title":"sender_finish_title",summary=receiving?"receiver_finish_summary":"sender_finish_summary";
        visible(title,true);visible(summary,true);visible("video_view",false);visible("tip_red_dot",false);
        uiStatus=(TextView)original(title);uiSummary=(TextView)original(summary);
        label(receiving?"receiver_finish_tips":"finish_tips",getString(R.string.support_scope));
        action(receiving?"receiver_finish_button":"sender_finish_button",R.string.close,this::back);
        if(receiving)action("receiver_finish_detail_button",R.string.original_details,this::details);
    }
    private boolean restorationIsCurrent(){String ready=engine.store.get("restore-ready"),dir=engine.store.get("restore-directory");return ready!=null&&dir!=null&&engine.directory!=null&&dir.equals(engine.directory.toString())&&restore.describes(ready+"|"+dir);}
    private String restorationForThisTransfer(){return restorationIsCurrent()?restorationText():getString(R.string.original_restore_unbound);}
    private void details() {
        AlertDialog.Builder dialog=new AlertDialog.Builder(this).setTitle(R.string.original_details).setMessage(status.getText()+"\n\n"+restorationForThisTransfer()+"\n\n"+residuals.getText()+"\n\n"+scanScope.getText()+"\n\n"+getString(R.string.unsupported_scope)).setNegativeButton(R.string.close,null);
        if(restore.needsInstallation()&&restorationIsCurrent())dialog.setPositiveButton(R.string.restore_install_continue,(d,w)->restore.repeatInstallation(this)).setNeutralButton(R.string.restore_install_skip,(d,w)->restore.skipInstallation());
        else dialog.setPositiveButton(R.string.restore_title,(d,w)->configureRestore());
        dialog.show();
    }
    @Override protected void connectSelected() {
        if(engine.selectedCount()==0){render(SELECT);Toast.makeText(this,R.string.original_no_items,Toast.LENGTH_LONG).show();return;}
        super.connectSelected();
    }
    @Override protected void manualSend(){if(engine.selectedCount()==0){render(SELECT);Toast.makeText(this,R.string.original_no_items,Toast.LENGTH_LONG).show();return;}super.manualSend();}
    @Override public void read(String code) { super.read(code);if(engine.selectedCount()==0)render(SELECT);else updateOriginal(); }
    @Override public void state(int message){super.state(message);if(ready&&!changing)updateOriginal();}
    @Override public void changed() {
        if(isFinishing()||isDestroyed())return;
        super.changed();if(!ready||changing)return;
        boolean done=engine.status==R.string.sender_complete||engine.status==R.string.receiver_complete;
        boolean transferring=engine.expectedCount>0||(!receiving&&engine.isActive()&&engine.clientPair!=null);
        if(done&&!FINISH.equals(page))render(FINISH);
        else if(transferring&&!FINISH.equals(page)&&!PROGRESS.equals(page))render(PROGRESS);
        else updateOriginal();
    }
    private void updateOriginal() {
        if(!ready||originalRoot==null)return;
        String current=status.getText().toString();
        if(uiStatus!=null)uiStatus.setText(current);
        if(SELECT.equals(page)&&uiStatus!=null)uiStatus.setText(selected.getText());
        if(SELECT.equals(page)){
            StringBuilder facts=new StringBuilder();
            if(ScanState.INCOMPLETE.equals(engine.scanState()))facts.append(getString(R.string.scan_interrupted));
            if(ScanState.NONE.equals(engine.phoneScanState())){if(facts.length()>0)facts.append("\n");facts.append(getString(R.string.phone_not_scanned));}
            if(engine.scanFailures>0){if(facts.length()>0)facts.append("\n");facts.append(getString(R.string.scan_errors,engine.scanFailures));}
            if(engine.residualCount()>0){if(facts.length()>0)facts.append("\n");facts.append(residuals.getText());}
            View tip=original("scanner_not_support_data_transfer_tip");if(tip instanceof TextView){tip.setVisibility(facts.length()>0?View.VISIBLE:View.GONE);((TextView)tip).setText(facts);}
        }
        if(uiSend!=null)uiSend.setEnabled(!engine.isActive()&&!restore.isActive()&&engine.selectedCount()>0);
        if(uiCount!=null)uiCount.setText(getString(receiving?R.string.original_receiving_files:R.string.original_sent_files,receiving?engine.receivedCount:progressDone(),receiving?engine.expectedCount:engine.store.sendingCount()));
        if(uiSummary!=null)uiSummary.setText(FINISH.equals(page)?(receiving?restorationForThisTransfer():status.getText()):getString(R.string.original_file_progress,receiving?engine.expectedCount:engine.selectedCount()));
        if(HOST.equals(page)){
            ProtocolCore.Pairing pair=engine.serverPair;
            if(uiSsid!=null)uiSsid.setText(pair==null?directory.getText():pair.ssid.isEmpty()?getString(R.string.router_qr_ready):pair.ssid);
            if(originalQr!=null){originalQr.setImageDrawable(qr.getDrawable());originalQr.setVisibility(pair==null?View.GONE:View.VISIBLE);}
        }
        if(GUEST.equals(page)&&uiStatus!=null)uiStatus.setText(engine.isActive()?current:getString(R.string.original_pair_help)+"\n"+selected.getText()+(qrState.getText().length()==0?"":"\n"+qrState.getText()));
        boolean failed=!engine.isActive()&&attentionStatus(engine.status);
        if(PROGRESS.equals(page)){visible("transfer_interrupt",failed);visible("transfer_view",!failed);if(failed){label("transfer_title_interrupt",current);label("transfer_summary_interrupt",getString(R.string.recovery_notice));}}
        if(rows!=null)rows.refresh();
    }
    private boolean attentionStatus(int value){return value==R.string.file_failed||value==R.string.partial_remains||value==R.string.service_start_failed||value==R.string.service_timeout||value==R.string.session_expired||value==R.string.action_failed||value==R.string.receiver_complete_unconfirmed||value==R.string.transfer_failed||value==R.string.integrity_failed||value==R.string.tls_failed||value==R.string.permission_denied||value==R.string.cancelled;}
    @Override protected void requestScan(){if(engine.isActive()||restore.isActive())return;category=null;after=0;previous.clear();render(SELECT);super.requestScan();}
    private long progressDone(){return engine.receiptProjection.acknowledged();}
    private void stopPrompt(){new AlertDialog.Builder(this).setMessage(R.string.stop).setNegativeButton(R.string.cancel,null).setPositiveButton(R.string.continue_action,(d,w)->{restore.stop();engine.stop();}).show();}
    private void back(){if(engine.isActive()||restore.isActive()){stopPrompt();return;}if(SELECT.equals(page)&&category!=null){category=null;after=0;previous.clear();render(SELECT);}else if(SELECT.equals(page)){render(GUEST);}else finish();}
    @Override public void onBackPressed(){back();}

    private final class RowData {
        final String category;final TransferStore.Row item;final int command;
        RowData(String c,TransferStore.Row i,int command){category=c;item=i;this.command=command;}
    }
    private final class Holder extends RecyclerView.ViewHolder { Holder(View view){super(view);} }
    private final class Rows extends RecyclerView.Adapter<Holder> {
        private final boolean transferring;
        private List<RowData> data=Collections.emptyList();
        private String lastFingerprint="";
        private boolean adjusting;
        Rows(boolean transfer){transferring=transfer;refresh();}
        void refresh(){
            String fingerprint=page+":"+category+":"+after+":"+engine.store.uiRevision()+":"+engine.scannedCount()+":"+engine.selectedCount()+":"+engine.receivedCount+":"+engine.status+":"+engine.isActive()+":"+restore.isActive();
            if(fingerprint.equals(lastFingerprint))return;lastFingerprint=fingerprint;
            List<RowData> next=new ArrayList<>();
            if(category==null||transferring){
                if(!transferring){next.add(new RowData(null,null,1));next.add(new RowData(null,null,2));next.add(new RowData(null,null,3));}
                for(String type:TYPES)next.add(new RowData(type,null,0));
            }else{
                List<TransferStore.Row> items=engine.page(category,after);for(TransferStore.Row row:items)next.add(new RowData(category,row,0));
                if(after>0)next.add(new RowData(null,null,4));if(items.size()==TransferStore.PAGE)next.add(new RowData(null,items.get(items.size()-1),5));
            }
            data=next;notifyDataSetChanged();
        }
        private void selectionChanged(CheckBox check,RowData row,boolean on){
            if(adjusting)return;
            boolean accepted=false;
            try{if(!restore.isActive())accepted=row.item!=null?engine.chooseItem(row.item.n,on):engine.chooseCategory(row.category,on,()->{lastFingerprint="";refresh();});}
            catch(RuntimeException error){Toast.makeText(UniversalActivity.this,R.string.action_failed,Toast.LENGTH_LONG).show();}
            if(!accepted){adjusting=true;try{check.setChecked(row.item!=null?engine.isSelected(row.item.n):engine.store.countCategory(row.category)>0&&engine.store.selectedCategoryCount(row.category)==engine.store.countCategory(row.category));}catch(RuntimeException error){check.setEnabled(false);Toast.makeText(UniversalActivity.this,R.string.action_failed,Toast.LENGTH_LONG).show();}finally{adjusting=false;}}
        }
        @Override public int getItemCount(){return data.size();}
        @Override public int getItemViewType(int n){return data.get(n).item!=null&&data.get(n).command==0?1:0;}
        @Override public Holder onCreateViewHolder(ViewGroup parent,int type){return new Holder(getLayoutInflater().inflate(type==1?HostR.layout.entry_item:transferring?HostR.layout.transfer_group_item:HostR.layout.group_item,parent,false));}
        @Override public void onBindViewHolder(Holder holder,int position){
            RowData row=data.get(position);View root=holder.itemView;TextView title=root.findViewById(HostR.id.title),summary=root.findViewById(HostR.id.summary);CheckBox check=root.findViewById(HostR.id.check_box);View icon=root.findViewById(HostR.id.icon),permission=root.findViewById(HostR.id.permission_summary);
            if(permission!=null)permission.setVisibility(View.GONE);if(icon!=null)icon.setVisibility(View.GONE);
            if(check!=null){check.setOnCheckedChangeListener(null);check.setVisibility(row.command==0&&!transferring?View.VISIBLE:View.GONE);check.setEnabled(!engine.isActive()&&!restore.isActive());}
            if(row.command!=0){
                int key=row.command==1?R.string.scan_phone:row.command==2?R.string.scan_directory:row.command==3?R.string.choose_files:row.command==4?R.string.previous_page:R.string.next_page;
                if(title!=null)title.setText(key);if(summary!=null)summary.setText("");
                root.setOnClickListener(v->{if(engine.isActive()||restore.isActive())return;if(row.command==1)requestScan();else if(row.command==2)tree.performClick();else if(row.command==3)choose.performClick();else if(row.command==4){after=previous.isEmpty()?0:previous.remove(previous.size()-1);render(SELECT);}else{previous.add(after);after=row.item.n;render(SELECT);}});return;
            }
            if(row.item!=null){
                if(title!=null)title.setText(row.item.name);if(summary!=null)summary.setText(android.text.format.Formatter.formatFileSize(UniversalActivity.this,row.item.size));
                boolean yes=engine.isSelected(row.item.n);if(check!=null){check.setChecked(yes);check.setOnCheckedChangeListener((button,on)->selectionChanged(check,row,on));}
                root.setOnClickListener(v->{if(!engine.isActive()&&!restore.isActive())safeAction(()->engine.chooseItem(row.item.n,!engine.isSelected(row.item.n)));});
            }else{
                int index=Arrays.asList(TYPES).indexOf(row.category);String name=getString(LABELS[index]);long count=transferring?(receiving?engine.receiptProjection.category(row.category):engine.store.selectedCategoryCount(row.category)):engine.store.countCategory(row.category);
                if(title!=null)title.setText(name);if(summary!=null)summary.setText(getString(R.string.category_count,name,count));
                if(permission instanceof TextView&&!transferring&&!ScanState.NONE.equals(engine.phoneScanState())){
                    int notice=0;
                    if(row.category.equals("contacts")&&engine.scanContactsMissing)notice=R.string.contacts_missing;
                    else if(row.category.equals("calendar")&&engine.scanCalendarMissing)notice=R.string.calendar_missing;
                    else if(Arrays.asList("photos","videos","audio").contains(row.category)&&engine.scanMediaMissing)notice=R.string.media_missing;
                    else if(Arrays.asList("photos","videos").contains(row.category)&&engine.scanPartial)notice=R.string.partial_media;
                    if(notice!=0){permission.setVisibility(View.VISIBLE);((TextView)permission).setText(notice);}
                }
                if(check!=null){check.setChecked(count>0&&engine.store.selectedCategoryCount(row.category)==count);check.setOnCheckedChangeListener((button,on)->selectionChanged(check,row,on));}
                root.setOnClickListener(v->{if(transferring||engine.isActive()||restore.isActive())return;category=row.category;after=0;previous.clear();render(SELECT);});
            }
            root.setMinimumHeight(dp(48));
        }
    }
}
