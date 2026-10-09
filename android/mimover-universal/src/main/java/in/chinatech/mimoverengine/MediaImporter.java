package in.chinatech.mimoverengine;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import java.io.*;
import java.security.MessageDigest;

/** User-confirmed gallery copies of verified receipts. Never edits the source or an existing gallery item. */
final class MediaImporter {
 interface Progress{void update(long imported,long skipped,long failed);}
 static final class Result{long imported,skipped,failed;String lastFailure="";}
 private final Context context;private final CancellationScope io;private final MediaImportStore journal;
 MediaImporter(Context c,CancellationScope s){context=c;io=s;journal=new MediaImportStore(c);}
 void close(){journal.close();}
 Result run(TransferStore received,Uri directory,Progress progress)throws Exception {
  if(Build.VERSION.SDK_INT<29&&context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException("MEDIA_PERMISSION");
  Result result=new Result();long after=0;
  try{TransferStore.MediaReceipt row;while((row=received.nextMedia(directory,after))!=null){after=row.n;io.check();try{if(publish(row))result.imported++;else result.skipped++;}catch(Exception error){io.check();result.failed++;String code=error.getMessage();result.lastFailure=error.getClass().getSimpleName()+":"+(code!=null&&code.matches("[A-Z_]{1,80}")?code:"");}progress.update(result.imported,result.skipped,result.failed);}return result;}finally{journal.close();}
 }
 boolean publish(TransferStore.MediaReceipt row)throws Exception {
  ProtocolCore.Item item=row.item;String key=ProtocolCore.hex(item.hash)+":"+item.size+":"+item.mime;
  boolean image=item.mime.startsWith("image/"),audio=item.mime.startsWith("audio/");Uri collection=image?MediaStore.Images.Media.EXTERNAL_CONTENT_URI:audio?MediaStore.Audio.Media.EXTERNAL_CONTENT_URI:MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
  MediaImportStore.Entry previous=journal.get(key);
  String intended=previous!=null&&"creating".equals(previous.state)?previous.name:null;
  if(previous!=null&&previous.dest==null){Uri recovered=recoverCreation(collection,previous.name);if(recovered!=null){journal.put(key,recovered,"pending");previous=journal.get(key);}else previous=null;}
  if(previous!=null){
   if(valid(previous.dest,item)){
    if(!"published".equals(previous.state))makeVisible(previous.dest);
    journal.put(key,previous.dest,"published");return false;
   }
   // Only URIs created and journaled by this importer are eligible for cleanup. Unknown deletion blocks retry.
   if(exists(previous.dest)){
    if(!"pending".equals(previous.state)||!hiddenAndOwned(previous.dest))throw new IOException("MEDIA_CHANGED");
    if(context.getContentResolver().delete(previous.dest,null,null)!=1)throw new IOException("MEDIA_CLEANUP");
   }
   journal.removed(key);
  }
  String name=intended==null?"CT-"+ProtocolCore.token(16)+"-"+ProtocolCore.safeName(item.name):intended;
  journal.intent(key,name);
  ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,name);values.put(MediaStore.MediaColumns.MIME_TYPE,item.mime);
  if(Build.VERSION.SDK_INT>=29){values.put(MediaStore.MediaColumns.RELATIVE_PATH,(image?"Pictures":audio?"Music":"Movies")+"/ChinaTech/");values.put(MediaStore.MediaColumns.IS_PENDING,1);}
  io.check();Uri dest=context.getContentResolver().insert(collection,values);if(dest==null)throw new IOException("MEDIA_WRITE");
  // Journal before opening the destination. A killed process can verify and finish this exact pending row.
  journal.put(key,dest,"pending");
  try(InputStream in=ProviderIo.input(context.getContentResolver(),row.source,io);OutputStream out=ProviderIo.output(context.getContentResolver(),dest,io)){
   byte[] bytes=new byte[65536];long count=0;MessageDigest hash=MessageDigest.getInstance("SHA-256");int n;
   while(true){io.check();n=in.read(bytes);io.check();if(n<0)break;count=ProtocolCore.addBytes(count,n);if(count>item.size)throw new IOException("SOURCE_CHANGED");hash.update(bytes,0,n);out.write(bytes,0,n);}
   out.flush();if(count!=item.size||!ProtocolCore.equal(hash.digest(),item.hash))throw new IOException("SOURCE_CHANGED");
  }
  io.check();journal.put(key,dest,"publishing");makeVisible(dest);journal.put(key,dest,"published");return true;
 }
 private boolean exists(Uri uri)throws Exception {try(ProviderIo.Query query=ProviderIo.query(context.getContentResolver(),uri,new String[]{MediaStore.MediaColumns._ID},null,null,io)){if(query.cursor==null)throw new IOException("MEDIA_QUERY");return query.cursor.moveToFirst();}}
 private Uri recoverCreation(Uri collection,String name)throws Exception {
  if(name==null||name.length()<26||!name.startsWith("CT-"))throw new IOException("MEDIA_INTENT");
  String selection=MediaStore.MediaColumns.DISPLAY_NAME+" GLOB ?";String[] args={name.substring(0,26)+"*"};
  if(Build.VERSION.SDK_INT>=29){selection+=" AND "+MediaStore.MediaColumns.OWNER_PACKAGE_NAME+"=?";args=new String[]{args[0],context.getPackageName()};}
  Uri candidates=Build.VERSION.SDK_INT>=29?MediaStore.setIncludePending(collection):collection;
  try(ProviderIo.Query query=ProviderIo.query(context.getContentResolver(),candidates,new String[]{MediaStore.MediaColumns._ID},selection,args,io)){if(query.cursor==null)throw new IOException("MEDIA_QUERY");Cursor c=query.cursor;if(!c.moveToFirst())return null;Uri found=ContentUris.withAppendedId(collection,c.getLong(0));if(c.moveToNext())throw new IOException("MEDIA_INTENT_AMBIGUOUS");return found;}
 }
 private boolean hiddenAndOwned(Uri uri)throws Exception {if(Build.VERSION.SDK_INT<29)return false;try(ProviderIo.Query query=ProviderIo.query(context.getContentResolver(),uri,new String[]{MediaStore.MediaColumns.IS_PENDING,MediaStore.MediaColumns.OWNER_PACKAGE_NAME},null,null,io)){if(query.cursor==null)throw new IOException("MEDIA_QUERY");return query.cursor.moveToFirst()&&query.cursor.getInt(0)==1&&context.getPackageName().equals(query.cursor.getString(1));}}
 private void makeVisible(Uri uri)throws Exception {io.check();if(Build.VERSION.SDK_INT>=29){ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.IS_PENDING,0);if(context.getContentResolver().update(uri,values,null,null)!=1)throw new IOException("MEDIA_PUBLISH");}if(!exists(uri))throw new IOException("MEDIA_PUBLISH");}
 private boolean valid(Uri uri,ProtocolCore.Item expected)throws Exception {
  try(InputStream in=ProviderIo.input(context.getContentResolver(),uri,io)){MessageDigest hash=MessageDigest.getInstance("SHA-256");long size=0;byte[] bytes=new byte[65536];int n;while(true){io.check();n=in.read(bytes);io.check();if(n<0)break;size=ProtocolCore.addBytes(size,n);if(size>expected.size)return false;hash.update(bytes,0,n);}return size==expected.size&&ProtocolCore.equal(hash.digest(),expected.hash);}
  catch(FileNotFoundException absent){return false;}
 }
}
