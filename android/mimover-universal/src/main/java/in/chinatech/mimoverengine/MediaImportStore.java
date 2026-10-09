package in.chinatech.mimoverengine;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import android.net.Uri;

/** A separate durable journal: receiving a file and publishing it to the gallery are different facts. */
final class MediaImportStore extends SQLiteOpenHelper {
 MediaImportStore(Context c){super(c,"media-import-v1.sqlite",null,2);}
 @Override public void onCreate(SQLiteDatabase d){d.execSQL("CREATE TABLE imports(k TEXT PRIMARY KEY,dest TEXT NOT NULL,state TEXT NOT NULL,name TEXT NOT NULL)");}
 @Override public void onUpgrade(SQLiteDatabase d,int old,int next){if(old!=1||next!=2)throw new IllegalStateException("Unsupported media journal");boolean hasName=false;try(Cursor c=d.rawQuery("PRAGMA table_info(imports)",null)){while(c.moveToNext())if("name".equals(c.getString(1)))hasName=true;}if(!hasName)d.execSQL("ALTER TABLE imports ADD COLUMN name TEXT NOT NULL DEFAULT ''");}
 synchronized Entry get(String key){try(Cursor c=getReadableDatabase().rawQuery("SELECT dest,state,name FROM imports WHERE k=?",new String[]{key})){return c.moveToFirst()?new Entry(c.getString(0).isEmpty()?null:Uri.parse(c.getString(0)),c.getString(1),c.getString(2)):null;}}
 synchronized void intent(String key,String name){ContentValues v=new ContentValues();v.put("k",key);v.put("dest","");v.put("state","creating");v.put("name",name);if(getWritableDatabase().insertWithOnConflict("imports",null,v,SQLiteDatabase.CONFLICT_REPLACE)<0)throw new SQLiteException("MEDIA_JOURNAL_WRITE");}
 synchronized void put(String key,Uri dest,String state){ContentValues v=new ContentValues();v.put("dest",dest.toString());v.put("state",state);if(getWritableDatabase().update("imports",v,"k=?",new String[]{key})!=1)throw new SQLiteException("MEDIA_JOURNAL_WRITE");}
 synchronized void removed(String key){getWritableDatabase().delete("imports","k=?",new String[]{key});}
 static final class Entry{final Uri dest;final String state,name;Entry(Uri d,String s,String n){dest=d;state=s;name=n;}}
}
