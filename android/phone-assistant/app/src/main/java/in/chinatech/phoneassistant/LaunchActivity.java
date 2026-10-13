package in.chinatech.phoneassistant;
import android.app.Activity;
import android.content.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
/** ChinaTech standalone launcher. No data is read before a user chooses a role. */
public final class LaunchActivity extends Activity {
 @Override protected void attachBaseContext(Context base){super.attachBaseContext(new BridgeContext(base));}
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);ScrollView scroll=new ScrollView(this);LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);int padding=Math.round(24*getResources().getDisplayMetrics().density);box.setPadding(padding,padding*2,padding,padding);scroll.addView(box);TextView title=new TextView(this);title.setText(R.string.app_name);title.setTextSize(25);box.addView(title);TextView notice=new TextView(this);notice.setText(R.string.alpha_notice);notice.setTextSize(16);notice.setPadding(0,padding,0,padding);box.addView(notice);for(boolean receiving:new boolean[]{false,true}){Button b=new Button(this);b.setText(receiving?R.string.receiver_title:R.string.sender_title);b.setTextSize(18);b.setAllCaps(false);b.setMinHeight(Math.round(56*getResources().getDisplayMetrics().density));box.addView(b,new LinearLayout.LayoutParams(-1,-2));b.setOnClickListener(v->{boolean role=receiving;TransferEngine engine=TransferEngine.get(this);if(engine.isActive())role=getSharedPreferences("chinatech-universal-ui",MODE_PRIVATE).getBoolean("receiving",false);startActivity(new Intent(this,MainActivity.class).putExtra("receiving",role));});}setContentView(scroll);}
}
