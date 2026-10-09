package in.chinatech.mimoverengine;

import android.database.Cursor;
import android.net.Uri;
import java.io.*;
import java.security.MessageDigest;
import android.content.Context;

/** Reads only durable, verified receipts. A private, checked copy pins bytes before parsing/installing. */
final class RestoreCatalog {
 static TransferStore.MediaReceipt next(TransferStore store,Uri directory,long after)throws IOException {
  try(Cursor c=store.getReadableDatabase().rawQuery("SELECT rowid,object,name,mime,size,hash,dest FROM receipts WHERE directory=? AND rowid>? ORDER BY rowid LIMIT 1",new String[]{directory.toString(),Long.toString(after)})){
   return c.moveToFirst()?new TransferStore.MediaReceipt(c.getLong(0),new ProtocolCore.Item(c.getString(1),c.getString(2),c.getString(3),c.getLong(4),c.getBlob(5)),Uri.parse(c.getString(6))):null;
  }
 }
 static String kind(ProtocolCore.Item item){String n=item.name.toLowerCase(java.util.Locale.ROOT),m=item.mime;
  if(m.startsWith("image/")||m.startsWith("video/")||m.startsWith("audio/"))return "media";
  if(m.equals("text/x-vcard")||m.equals("text/vcard")||n.endsWith(".vcf"))return "contacts";
  if(m.equals("text/calendar")||n.endsWith(".ics"))return "calendar";
  if(n.endsWith("-chinatech-apk.zip")&&m.equals("application/zip"))return "apps";
  return "files";
 }
 static File checkedCopy(Context context,TransferStore.MediaReceipt row,CancellationScope io)throws Exception {
  File dir=new File(context.getNoBackupFilesDir(),"restore-work");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("WRITE");
  File tmp=File.createTempFile("verified-",".bin",dir);boolean ok=false;
  try{try(InputStream in=ProviderIo.input(context.getContentResolver(),row.source,io);CancellationScope.Lease<OutputStream> lease=io.track(new FileOutputStream(tmp))){
   MessageDigest hash=MessageDigest.getInstance("SHA-256");long size=0;byte[] b=new byte[262144];int n;
   while(true){io.check();n=in.read(b);io.check();if(n<0)break;if(n==0)continue;size=ProtocolCore.addBytes(size,n);if(size>row.item.size)throw new IOException("SOURCE_CHANGED");hash.update(b,0,n);lease.value.write(b,0,n);}
   if(size!=row.item.size||!ProtocolCore.equal(hash.digest(),row.item.hash))throw new IOException("DISK_VERIFY");
  }ok=true;}finally{if(!ok)tmp.delete();}return tmp;
 }
 private RestoreCatalog(){}
}
