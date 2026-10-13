package in.chinatech.phoneassistant;

import android.Manifest;
import android.content.*;
import android.content.pm.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.*;

/** Only public APIs and explicit SAF grants; no app-private directory crawling. */
final class PhoneScanner {
 interface Progress{void update(long found,long failures);}
 private final Context c;private final TransferStore store;private final CancellationScope io;private final Progress progress;
 long failures;private long lastNotice;private final boolean useMedia,useContacts,useCalendar;
 PhoneScanner(Context c,TransferStore store,CancellationScope io,Progress p){this(c,store,io,p,true,true,true);}
 PhoneScanner(Context c,TransferStore store,CancellationScope io,Progress p,boolean media,boolean contacts,boolean calendar){this.c=c;this.store=store;this.io=io;progress=p;useMedia=media;useContacts=contacts;useCalendar=calendar;}
 boolean granted(String p){return c.checkSelfPermission(p)==PackageManager.PERMISSION_GRANTED;}
 private void note(){long now=android.os.SystemClock.elapsedRealtime();if(now-lastNotice>250){lastNotice=now;progress.update(store.count(false),failures);}}
 void scan()throws Exception {
  boolean legacy=useMedia&&Build.VERSION.SDK_INT<=32&&granted(Manifest.permission.READ_EXTERNAL_STORAGE),partial=useMedia&&Build.VERSION.SDK_INT>=34&&granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED);
  media(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,"photos",legacy||useMedia&&Build.VERSION.SDK_INT>=33&&granted(Manifest.permission.READ_MEDIA_IMAGES)||partial);
  media(MediaStore.Video.Media.EXTERNAL_CONTENT_URI,"videos",legacy||useMedia&&Build.VERSION.SDK_INT>=33&&granted(Manifest.permission.READ_MEDIA_VIDEO)||partial);
  media(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,"audio",legacy||useMedia&&Build.VERSION.SDK_INT>=33&&granted(Manifest.permission.READ_MEDIA_AUDIO));
  // Scoped storage exposes only permitted public rows; arbitrary documents require a SAF tree grant.
  if(legacy)media(MediaStore.Files.getContentUri("external"),"files",true,MediaStore.Files.FileColumns.MEDIA_TYPE+"=0");
  if(useContacts)contacts();if(useCalendar)calendar();apps();progress.update(store.count(false),failures);
 }
 private void media(Uri collection,String category,boolean allowed){media(collection,category,allowed,null);}
 private void media(Uri collection,String category,boolean allowed,String selection){if(!allowed)return;try(ProviderIo.Query q=ProviderIo.query(c.getContentResolver(),collection,new String[]{MediaStore.MediaColumns._ID,MediaStore.MediaColumns.DISPLAY_NAME,MediaStore.MediaColumns.MIME_TYPE,MediaStore.MediaColumns.SIZE},selection,null,io)){Cursor cur=q.cursor;if(cur==null)throw new IOException("SCAN");while(cur.moveToNext()){io.check();try{store.add(ContentUris.withAppendedId(collection,cur.getLong(0)),category,cur.getString(1),cur.getString(2),Math.max(0,cur.getLong(3)),false);}catch(Exception e){io.check();failures++;}note();}}catch(Exception e){try{io.check();}catch(IOException cancelled){return;}failures++;}}
 void tree(Uri root)throws Exception {store.resetDirectories();store.queueDirectory(DocumentsContract.buildDocumentUriUsingTree(root,DocumentsContract.getTreeDocumentId(root)));Uri parent;while((parent=store.nextDirectory())!=null){io.check();String id=DocumentsContract.getDocumentId(parent);Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(root,id);try(ProviderIo.Query q=ProviderIo.query(c.getContentResolver(),children,new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_SIZE},null,null,io)){Cursor cur=q.cursor;if(cur==null)throw new IOException("SCAN");while(cur.moveToNext()){io.check();try{Uri u=DocumentsContract.buildDocumentUriUsingTree(root,cur.getString(0));String mime=cur.getString(2);if(DocumentsContract.Document.MIME_TYPE_DIR.equals(mime))store.queueDirectory(u);else store.add(u,category(mime),cur.getString(1),mime,Math.max(0,cur.getLong(3)),false);}catch(Exception e){io.check();failures++;}note();}}catch(Exception e){io.check();failures++;}store.directoryDone(parent);}progress.update(store.count(false),failures);}
 private static String category(String mime){return mime!=null&&mime.startsWith("image/")?"photos":mime!=null&&mime.startsWith("video/")?"videos":mime!=null&&mime.startsWith("audio/")?"audio":"files";}
 private File export(String extension){File dir=new File(c.getNoBackupFilesDir(),"exports");if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("Export directory");return new File(dir,"ctpa-"+ProtocolCore.token(16)+extension);}
 private void contacts(){
  if(!granted(Manifest.permission.READ_CONTACTS))return;
  File f=export(".vcf");long count=0;boolean partial=false;
  String[] projection={ContactsContract.Contacts._ID,ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,ContactsContract.Contacts.LOOKUP_KEY};
  try(CancellationScope.Lease<OutputStream> combined=io.track(new FileOutputStream(f));
      ProviderIo.Query q=ProviderIo.query(c.getContentResolver(),ContactsContract.Contacts.CONTENT_URI,projection,null,null,io)){
   if(q.cursor==null)throw new IOException("CONTACTS");
   while(q.cursor.moveToNext()){
    checkContactAccess();File staged=export(".contact.tmp");
    try{
     try{systemContact(staged,q.cursor.getString(2));}
     catch(Exception systemFailure){
      // Revocation/cancellation stop the export, rather than using a cached or basic bypass.
      checkContactAccess();if("CONTACTS_CLOSE_UNCONFIRMED".equals(systemFailure.getMessage()))throw systemFailure;failures++;partial=true;
      try{basicContact(staged,q.cursor.getString(0),q.cursor.getString(1));}
      catch(Exception basicFailure){checkContactAccess();note();continue;}
     }
     appendContact(staged,combined.value);count++;note();
    }finally{if(staged.exists()&&!staged.delete())failures++;}
   }
   checkContactAccess();combined.value.flush();checkContactAccess();
  }catch(Exception e){f.delete();failures++;return;}
  try{checkContactAccess();if(count>0)store.add(Uri.fromFile(f),"contacts",partial?"contacts-partial.vcf":"contacts.vcf","text/x-vcard",f.length(),false);else f.delete();}
  catch(Exception e){f.delete();failures++;}
 }
 private void checkContactAccess()throws IOException {io.check();if(!granted(Manifest.permission.READ_CONTACTS))throw new SecurityException("SOURCE_PERMISSION_REVOKED");}
 private void systemContact(File staged,String lookup)throws Exception {
  checkContactAccess();if(lookup==null||lookup.isEmpty())throw new IOException("CONTACTS_LOOKUP");
  Uri uri=Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_VCARD_URI,lookup).buildUpon()
   .appendQueryParameter(ContactsContract.Contacts.QUERY_PARAMETER_VCARD_NO_PHOTO,"false").build();
  boolean copied=false;
  try(InputStream source=ProviderIo.input(c.getContentResolver(),uri,io);
      CancellationScope.Lease<OutputStream> output=io.track(new FileOutputStream(staged))){
   ContactExport.copy(source,output.value,this::checkContactAccess);copied=true;
  }catch(Exception e){if(copied||e.getSuppressed().length>0)throw new IOException("CONTACTS_CLOSE_UNCONFIRMED",e);throw e;}
 }
 private void basicContact(File staged,String id,String name)throws Exception {
  checkContactAccess();try(CancellationScope.Lease<Writer> output=io.track(new OutputStreamWriter(new FileOutputStream(staged),StandardCharsets.UTF_8))){
   Writer out=output.value;VCard.begin(out,name);
   contactRows(out,ContactsContract.CommonDataKinds.Phone.CONTENT_URI,ContactsContract.CommonDataKinds.Phone.CONTACT_ID,id,ContactsContract.CommonDataKinds.Phone.NUMBER,"TEL");
   contactRows(out,ContactsContract.CommonDataKinds.Email.CONTENT_URI,ContactsContract.CommonDataKinds.Email.CONTACT_ID,id,ContactsContract.CommonDataKinds.Email.ADDRESS,"EMAIL");
   VCard.end(out);checkContactAccess();out.flush();checkContactAccess();
  }
 }
 private void appendContact(File staged,OutputStream output)throws Exception {
  try(CancellationScope.Lease<InputStream> input=io.track(new FileInputStream(staged))){
   byte[] buffer=new byte[ContactExport.BUFFER];int n;
   while(true){checkContactAccess();n=input.value.read(buffer);checkContactAccess();if(n==-1)break;if(n>0)output.write(buffer,0,n);}
  }
 }
 private void contactRows(Writer out,Uri uri,String key,String id,String value,String kind)throws Exception {try(ProviderIo.Query q=ProviderIo.query(c.getContentResolver(),uri,new String[]{value},key+"=?",new String[]{id},io)){if(q.cursor==null)throw new IOException("CONTACTS");while(q.cursor.moveToNext()){io.check();String s=q.cursor.getString(0);if(s!=null&&!s.isEmpty())VCard.line(out,kind+":"+VCard.escape(s));}}}
 private static String date(long millis,boolean day){SimpleDateFormat f=new SimpleDateFormat(day?"yyyyMMdd":"yyyyMMdd'T'HHmmss'Z'",Locale.ROOT);f.setTimeZone(TimeZone.getTimeZone("UTC"));return f.format(new Date(millis));}
 private static void line(Writer out,String name,String value)throws IOException{if(value!=null&&!value.isEmpty())VCard.line(out,name+":"+VCard.escape(value));}
 private void calendar(){if(!granted(Manifest.permission.READ_CALENDAR))return;File f=export(".ics"),raw=export(".jsonl");long count=0,normal=0;String[] p={CalendarContract.Events._ID,CalendarContract.Events.TITLE,CalendarContract.Events.DESCRIPTION,CalendarContract.Events.EVENT_LOCATION,CalendarContract.Events.DTSTART,CalendarContract.Events.DTEND,CalendarContract.Events.DURATION,CalendarContract.Events.ALL_DAY,CalendarContract.Events.RRULE,CalendarContract.Events.RDATE,CalendarContract.Events.EXRULE,CalendarContract.Events.EXDATE,CalendarContract.Events.ORIGINAL_ID,CalendarContract.Events.ORIGINAL_INSTANCE_TIME,CalendarContract.Events.STATUS,CalendarContract.Events.EVENT_TIMEZONE,CalendarContract.Events.CALENDAR_ID};
  try(CancellationScope.Lease<Writer> w=io.track(new OutputStreamWriter(new FileOutputStream(f),StandardCharsets.UTF_8));CancellationScope.Lease<Writer> json=io.track(new OutputStreamWriter(new FileOutputStream(raw),StandardCharsets.UTF_8));ProviderIo.Query q=ProviderIo.query(c.getContentResolver(),CalendarContract.Events.CONTENT_URI,p,null,null,io)){Writer out=w.value;if(q.cursor==null)throw new IOException("CALENDAR");VCard.line(out,"BEGIN:VCALENDAR");VCard.line(out,"VERSION:2.0");VCard.line(out,"PRODID:-//ChinaTech//Phone Assistant//EN");while(q.cursor.moveToNext()){io.check();Cursor x=q.cursor;org.json.JSONObject row=new org.json.JSONObject();row.put("format","ChinaTechCalendarRaw1");row.put("task",store.transfer());for(int i=0;i<p.length;i++)row.put(p[i],x.isNull(i)?org.json.JSONObject.NULL:x.getString(i));json.value.write(row.toString());json.value.write("\n");count++;boolean recurring=!x.isNull(12)||!x.isNull(13);for(int i=8;i<=11;i++)recurring|=!x.isNull(i)&&!x.getString(i).isEmpty();if(recurring){failures++;continue;}boolean day=x.getInt(7)!=0;VCard.line(out,"BEGIN:VEVENT");line(out,"UID",store.transfer()+"-calendar-"+x.getString(16)+"-event-"+x.getString(0)+"@phone.chinatech.in");VCard.line(out,"DTSTAMP:"+date(System.currentTimeMillis(),false));line(out,"SUMMARY",x.getString(1));line(out,"DESCRIPTION",x.getString(2));line(out,"LOCATION",x.getString(3));if(!x.isNull(4))VCard.line(out,(day?"DTSTART;VALUE=DATE:":"DTSTART:")+date(x.getLong(4),day));if(!x.isNull(5))VCard.line(out,(day?"DTEND;VALUE=DATE:":"DTEND:")+date(x.getLong(5),day));else if(!x.isNull(6))VCard.line(out,"DURATION:"+CalendarText.rule(x.getString(6)));if(x.getInt(14)==CalendarContract.Events.STATUS_CANCELED)VCard.line(out,"STATUS:CANCELLED");VCard.line(out,"END:VEVENT");normal++;}VCard.line(out,"END:VCALENDAR");out.flush();json.value.flush();}
  catch(Exception e){f.delete();raw.delete();failures++;return;}
  try{io.check();if(count>0)store.add(Uri.fromFile(raw),"calendar","calendar-raw-fields.jsonl","application/x-ndjson",raw.length(),false);else raw.delete();if(normal>0)store.add(Uri.fromFile(f),"calendar","calendar-non-recurring.ics","text/calendar",f.length(),false);else f.delete();}catch(Exception e){failures++;}
 }
 private void apps(){PackageManager pm=c.getPackageManager();Intent launch=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);Set<String> seen=new HashSet<>();for(ResolveInfo info:pm.queryIntentActivities(launch,0)){try{io.check();String pkg=info.activityInfo.packageName;if(!seen.add(pkg)||pkg.equals(c.getPackageName()))continue;ApplicationInfo app=pm.getApplicationInfo(pkg,0);if((app.flags&ApplicationInfo.FLAG_SYSTEM)!=0)continue;PackageInfo version=pm.getPackageInfo(pkg,0);long size=new File(app.sourceDir).length();if(app.splitSourceDirs!=null)for(String split:app.splitSourceDirs)size=ProtocolCore.addBytes(size,new File(split).length());Uri ref=new Uri.Builder().scheme("ctpa-app").authority(pkg).appendPath(Long.toString(version.lastUpdateTime)).build();store.add(ref,"apps",pkg+"-ChinaTech-APK.zip","application/zip",size,false);note();}catch(Exception e){try{io.check();}catch(IOException stop){return;}failures++;}}}

}
