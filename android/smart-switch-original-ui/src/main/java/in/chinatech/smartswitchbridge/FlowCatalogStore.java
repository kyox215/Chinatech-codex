package in.chinatech.smartswitchbridge;
import android.content.*;import android.database.*;import android.database.sqlite.*;
import java.io.*;import java.util.*;
/** Bounded catalog projection and durable session-bound choice. */
final class FlowCatalogStore extends SQLiteOpenHelper {
 static final class Row {final long n;final FlowCatalogCodec.Entry entry;final boolean selected;Row(long n,FlowCatalogCodec.Entry e,boolean selected){this.n=n;entry=e;this.selected=selected;}}
 FlowCatalogStore(Context c){super(c,"original-flow-catalog.sqlite",null,2);}
 public void onCreate(SQLiteDatabase d){
  d.execSQL("CREATE TABLE entries(n INTEGER PRIMARY KEY AUTOINCREMENT,object TEXT UNIQUE NOT NULL,category TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,hash BLOB NOT NULL,selected INTEGER NOT NULL DEFAULT 0,seen TEXT NOT NULL)");
  d.execSQL("CREATE INDEX category_order ON entries(category,n)");d.execSQL("CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT NOT NULL)");d.execSQL("CREATE TABLE staged_choice(object TEXT PRIMARY KEY NOT NULL)");
 }
 public void onUpgrade(SQLiteDatabase d,int old,int next){
  if(old!=1||next!=2)throw new IllegalStateException("Unknown catalog schema");
  // Preserve old metadata, but never authorize an old row without a real hash.
  d.execSQL("ALTER TABLE entries ADD COLUMN hash BLOB");d.execSQL("CREATE TABLE staged_choice(object TEXT PRIMARY KEY NOT NULL)");d.execSQL("UPDATE meta SET v='invalidated' WHERE k='state'");
 }
 synchronized String get(String key){try(Cursor c=getReadableDatabase().rawQuery("SELECT v FROM meta WHERE k=?",new String[]{key})){return c.moveToFirst()?c.getString(0):null;}}
 synchronized void put(String key,String value){ContentValues v=new ContentValues();v.put("k",key);v.put("v",value);if(getWritableDatabase().insertWithOnConflict("meta",null,v,SQLiteDatabase.CONFLICT_REPLACE)<0)throw new SQLiteException("CATALOG_STORE");}
 synchronized boolean ready(String task,String session){return task.equals(get("task"))&&session.equals(get("catalog_session"))&&("ready".equals(get("state"))||"frozen".equals(get("state")));}
 synchronized void begin(String task,String session){
  SQLiteDatabase d=getWritableDatabase();d.beginTransaction();try{
   if(!task.equals(get("task"))||!session.equals(get("catalog_session"))){d.delete("entries",null,null);d.delete("meta","k LIKE 'frozen_%'",null);}
   d.delete("staged_choice",null,null);put("task",task);put("catalog_session",session);put("state","collecting");put("generation",ProtocolCore.token(16));d.setTransactionSuccessful();
  }finally{d.endTransaction();}
 }
 synchronized void add(FlowCatalogCodec.Entry e)throws IOException {
  if(!"collecting".equals(get("state")))throw new IOException("CATALOG_STATE");String generation=get("generation");
  try(Cursor c=getReadableDatabase().rawQuery("SELECT n,category,name,mime,size,hash,seen FROM entries WHERE object=?",new String[]{e.id})){
   ContentValues v=new ContentValues();v.put("seen",generation);
   if(c.moveToFirst()){
    if(generation.equals(c.getString(6)))throw new IOException("CATALOG_DUPLICATE");
    if(!e.category.equals(c.getString(1))||!e.name.equals(c.getString(2))||!e.mime.equals(c.getString(3))||e.size!=c.getLong(4)||!ProtocolCore.equal(e.hash,c.getBlob(5)))throw new IOException("CATALOG_CHANGED");
    if(getWritableDatabase().update("entries",v,"n=?",new String[]{Long.toString(c.getLong(0))})!=1)throw new IOException("CATALOG_STORE");
   }else{v.put("object",e.id);v.put("category",e.category);v.put("name",e.name);v.put("mime",e.mime);v.put("size",e.size);v.put("hash",e.hash);if(getWritableDatabase().insert("entries",null,v)<0)throw new IOException("CATALOG_STORE");}
  }
 }
 synchronized void complete(long expected,byte[] digest,String session)throws IOException {
  FlowCatalogCodec.checkCount(expected);String encoded=encoded(digest);
  if(!session.equals(get("catalog_session")))throw new IOException("CATALOG_SESSION");
  boolean prior=session.equals(get("frozen_session"))&&get("task").equals(get("frozen_task"));
  if(prior&&!encoded.equals(get("frozen_catalog")))throw new IOException("CATALOG_CHANGED");
  SQLiteDatabase d=getWritableDatabase();d.beginTransaction();try{
   d.delete("entries","seen<>?",new String[]{get("generation")});if(count(null,false)!=expected)throw new IOException("CATALOG_COUNT");
   put("catalog_digest",encoded);put("state",prior?"frozen":"ready");if(prior)verifyFrozenChoice(session);d.setTransactionSuccessful();
  }finally{d.endTransaction();}
 }
 synchronized long count(String category,boolean selected){String where=(category==null?"1=1":"category=?")+(selected?" AND selected=1":"");return DatabaseUtils.longForQuery(getReadableDatabase(),"SELECT count(*) FROM entries WHERE "+where,category==null?null:new String[]{category});}
 synchronized long bytes(String category,boolean selected){String where=(category==null?"1=1":"category=?")+(selected?" AND selected=1":"");return DatabaseUtils.longForQuery(getReadableDatabase(),"SELECT coalesce(sum(size),0) FROM entries WHERE "+where,category==null?null:new String[]{category});}
 synchronized boolean select(String category,boolean yes){if(!"ready".equals(get("state"))||category!=null&&!FlowCatalogCodec.TYPES.contains(category))return false;ContentValues v=new ContentValues();v.put("selected",yes?1:0);getWritableDatabase().update("entries",v,category==null?null:"category=?",category==null?null:new String[]{category});return true;}
 synchronized boolean selectObject(String id,boolean yes){if(!"ready".equals(get("state")))return false;ContentValues v=new ContentValues();v.put("selected",yes?1:0);return getWritableDatabase().update("entries",v,"object=?",new String[]{id})==1;}
 synchronized long freeze(String session)throws IOException {
  if(!"ready".equals(get("state"))||!session.equals(get("catalog_session")))throw new IOException("CATALOG_STATE");
  FlowCatalogCodec.Digest digest=choiceDigest();long count=digest.count();ProtocolCore.validateCount(count);
  SQLiteDatabase d=getWritableDatabase();d.beginTransaction();try{saveFrozen(session,count,digest.finish());d.setTransactionSuccessful();}finally{d.endTransaction();}return count;
 }
 synchronized boolean frozen(String session){return "frozen".equals(get("state"))&&session.equals(get("frozen_session"))&&session.equals(get("catalog_session"))&&Objects.equals(get("task"),get("frozen_task"))&&Objects.equals(get("catalog_digest"),get("frozen_catalog"));}
 synchronized long verifyFrozenChoice(String session)throws IOException {
  if(!frozen(session))throw new IOException("CHOICE_STATE");FlowCatalogCodec.Digest digest=choiceDigest();long count=digest.count();ProtocolCore.validateCount(count);
  if(!Long.toString(count).equals(get("frozen_count"))||!encoded(digest.finish()).equals(get("frozen_choice")))throw new IOException("CHOICE_CHANGED");return count;
 }
 synchronized void beginChoice()throws IOException {String state=get("state");if(!"ready".equals(state)&&!"frozen".equals(state))throw new IOException("CATALOG_STATE");getWritableDatabase().delete("staged_choice",null,null);}
 synchronized void stageChoice(String id)throws IOException {
  if(!contains(id))throw new IOException("CHOICE_UNKNOWN_OR_DUPLICATE");ContentValues v=new ContentValues();v.put("object",id);
  if(getWritableDatabase().insertWithOnConflict("staged_choice",null,v,SQLiteDatabase.CONFLICT_IGNORE)<0)throw new IOException("CHOICE_UNKNOWN_OR_DUPLICATE");
 }
 synchronized void acceptChoice(String session,long expected,byte[] digest)throws IOException {
  ProtocolCore.validateCount(expected);if(!session.equals(get("catalog_session")))throw new IOException("CATALOG_SESSION");
  if(DatabaseUtils.longForQuery(getReadableDatabase(),"SELECT count(*) FROM staged_choice",null)!=expected)throw new IOException("CHOICE");String encoded=encoded(digest);
  if(frozen(session)&&(!Long.toString(expected).equals(get("frozen_count"))||!encoded.equals(get("frozen_choice"))))throw new IOException("CHOICE_CHANGED");
  SQLiteDatabase d=getWritableDatabase();d.beginTransaction();try{
   d.execSQL("UPDATE entries SET selected=CASE WHEN object IN (SELECT object FROM staged_choice) THEN 1 ELSE 0 END");
   FlowCatalogCodec.Digest actual=choiceDigest();if(actual.count()!=expected||!encoded(actual.finish()).equals(encoded))throw new IOException("CHOICE");
   saveFrozen(session,expected,digest);d.delete("staged_choice",null,null);d.setTransactionSuccessful();
  }finally{d.endTransaction();}
 }
 private void saveFrozen(String session,long count,byte[] digest)throws IOException {put("frozen_session",session);put("frozen_task",get("task"));put("frozen_catalog",get("catalog_digest"));put("frozen_count",Long.toString(count));put("frozen_choice",encoded(digest));put("state","frozen");}
 private FlowCatalogCodec.Digest choiceDigest()throws IOException {FlowCatalogCodec.Digest digest=new FlowCatalogCodec.Digest();long after=0;Row row;while((row=next(after,null,true))!=null){digest.choice(row.entry.id);after=row.n;}return digest;}
 synchronized Row next(long after,String category,boolean selected)throws IOException {
  String where="n>?"+(category==null?"":" AND category=?")+(selected?" AND selected=1":"");String[] args=category==null?new String[]{Long.toString(after)}:new String[]{Long.toString(after),category};
  try(Cursor c=getReadableDatabase().rawQuery("SELECT n,object,category,name,mime,size,hash,selected FROM entries WHERE "+where+" ORDER BY n LIMIT 1",args)){
   return c.moveToFirst()?new Row(c.getLong(0),new FlowCatalogCodec.Entry(c.getString(1),c.getString(2),c.getString(3),c.getString(4),c.getLong(5),c.getBlob(6)),c.getInt(7)!=0):null;
  }
 }
 synchronized List<Row> page(String category,long after)throws IOException{List<Row> out=new ArrayList<>();Row row;while(out.size()<64&&(row=next(after,category,false))!=null){out.add(row);after=row.n;}return out;}
 synchronized boolean contains(String id){try(Cursor c=getReadableDatabase().rawQuery("SELECT 1 FROM entries WHERE object=?",new String[]{id})){return c.moveToFirst();}}
 synchronized boolean selected(ProtocolCore.Item item)throws IOException {
  if(!"frozen".equals(get("state")))return false;
  try(Cursor c=getReadableDatabase().rawQuery("SELECT name,mime,size,hash,selected FROM entries WHERE object=?",new String[]{item.id})){
   return c.moveToFirst()&&c.getInt(4)==1&&item.name.equals(c.getString(0))&&item.mime.equals(c.getString(1))&&item.size==c.getLong(2)&&ProtocolCore.equal(item.hash,c.getBlob(3));
  }
 }
 private static String encoded(byte[] digest)throws IOException{if(digest==null||digest.length!=32)throw new IOException("CATALOG_DIGEST");return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);}
}
