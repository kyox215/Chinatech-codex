package in.chinatech.mimoverengine;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;

/** Marker-based provider recovery and session identities survive activity/process recreation. */
final class RestoreLedger extends SQLiteOpenHelper {
 RestoreLedger(Context c){super(c,"restore-v1.sqlite",null,1);}
 public void onCreate(SQLiteDatabase d){d.execSQL("CREATE TABLE restored(k TEXT PRIMARY KEY,kind TEXT NOT NULL,dest TEXT NOT NULL,state TEXT NOT NULL,session INTEGER NOT NULL DEFAULT -1,token TEXT NOT NULL DEFAULT '')");}
 public void onUpgrade(SQLiteDatabase d,int a,int b){throw new IllegalStateException("Unsupported restore journal");}
 synchronized Entry get(String k){try(Cursor c=getReadableDatabase().rawQuery("SELECT kind,dest,state,session,token FROM restored WHERE k=?",new String[]{k})){return c.moveToFirst()?new Entry(c.getString(0),c.getString(1),c.getString(2),c.getInt(3),c.getString(4)):null;}}
 synchronized void put(String k,String kind,String dest,String state,int session,String token){ContentValues v=new ContentValues();v.put("k",k);v.put("kind",kind);v.put("dest",dest);v.put("state",state);v.put("session",session);v.put("token",token);if(getWritableDatabase().insertWithOnConflict("restored",null,v,SQLiteDatabase.CONFLICT_REPLACE)<0)throw new SQLiteException("RESTORE_JOURNAL_WRITE");}
 synchronized boolean installation(String k,int session,String token,String state){ContentValues v=new ContentValues();v.put("state",state);return getWritableDatabase().update("restored",v,"k=? AND session=? AND token=? AND state IN ('prepared','waiting')",new String[]{k,Integer.toString(session),token})==1;}
 static final class Entry {final String kind,dest,state,token;final int session;Entry(String k,String d,String s,int n,String t){kind=k;dest=d;state=s;session=n;token=t;}}
}
