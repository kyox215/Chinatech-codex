package in.chinatech.phoneassistant;

import android.content.ContentResolver;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import java.io.*;

/** SAF descriptor/stream and query cancellation leases stay registered until local close completes. */
final class ProviderIo {
 static InputStream input(ContentResolver resolver,Uri uri,CancellationScope scope)throws IOException {
  if("file".equals(uri.getScheme())){CancellationScope.Lease<InputStream> lease=scope.track(new FileInputStream(uri.getPath()));return new FilterInputStream(lease.value){public void close()throws IOException {lease.close();}};}
  CancellationSignal signal=new CancellationSignal();CancellationScope.Lease<Closeable> cancel=scope.track(signal::cancel);
  CancellationScope.Lease<AssetFileDescriptor> fd=null;CancellationScope.Lease<InputStream> stream=null;
  try{scope.check();AssetFileDescriptor descriptor=resolver.openAssetFileDescriptor(uri,"r",signal);if(descriptor==null)throw new IOException("READ");fd=scope.track(descriptor);scope.check();stream=scope.track(descriptor.createInputStream());scope.check();
   final CancellationScope.Lease<AssetFileDescriptor> ownedFd=fd;final CancellationScope.Lease<InputStream> ownedStream=stream;
   return new FilterInputStream(stream.value){public void close()throws IOException {try{ownedStream.close();}finally{try{ownedFd.close();}finally{cancel.dismiss();}}}};
  }catch(IOException|RuntimeException e){try{if(stream!=null)stream.close();}finally{try{if(fd!=null)fd.close();}finally{cancel.dismiss();}}throw e;}
 }
 static OutputStream output(ContentResolver resolver,Uri uri,CancellationScope scope)throws IOException {
  CancellationSignal signal=new CancellationSignal();CancellationScope.Lease<Closeable> cancel=scope.track(signal::cancel);
  CancellationScope.Lease<AssetFileDescriptor> fd=null;CancellationScope.Lease<OutputStream> stream=null;
  try{scope.check();AssetFileDescriptor descriptor=resolver.openAssetFileDescriptor(uri,"w",signal);if(descriptor==null)throw new IOException("WRITE");fd=scope.track(descriptor);scope.check();stream=scope.track(descriptor.createOutputStream());scope.check();
   final CancellationScope.Lease<AssetFileDescriptor> ownedFd=fd;final CancellationScope.Lease<OutputStream> ownedStream=stream;
   return new FilterOutputStream(stream.value){public void write(byte[] b,int offset,int length)throws IOException {out.write(b,offset,length);}public void close()throws IOException {try{ownedStream.close();}finally{try{ownedFd.close();}finally{cancel.dismiss();}}}};
  }catch(IOException|RuntimeException e){try{if(stream!=null)stream.close();}finally{try{if(fd!=null)fd.close();}finally{cancel.dismiss();}}throw e;}
 }
 static Query query(ContentResolver resolver,Uri uri,String[] projection,String selection,String[] args,CancellationScope scope)throws IOException {
  CancellationSignal signal=new CancellationSignal();CancellationScope.Lease<Closeable> cancel=scope.track(signal::cancel);
  CancellationScope.Lease<Cursor> cursor=null;
  try{scope.check();Cursor result=resolver.query(uri,projection,selection,args,null,signal);if(result!=null)cursor=scope.track(result);scope.check();return new Query(cursor,cancel);
  }catch(IOException|RuntimeException e){try{if(cursor!=null)cursor.close();}finally{cancel.dismiss();}throw e;}
 }
 static final class Query implements Closeable {
  final Cursor cursor;
  private final CancellationScope.Lease<Cursor> lease;
  private final CancellationScope.Lease<Closeable> signal;
  Query(CancellationScope.Lease<Cursor> lease,CancellationScope.Lease<Closeable> signal){this.lease=lease;this.signal=signal;cursor=lease==null?null:lease.value;}
  public void close()throws IOException {try{if(lease!=null)lease.close();}finally{signal.dismiss();}}
 }
 private ProviderIo(){}
}
