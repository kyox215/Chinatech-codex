package in.chinatech.smartswitchbridge;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import java.io.InputStream;
import java.io.IOException;
import java.lang.ref.WeakReference;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** One bounded decode task. Deadline/cancel invalidates the result even if an unknown provider ignores it. */
final class QrReader {
 interface Listener {void read(String code);void state(int resource);}
 interface Decode {String run(CancellationScope scope)throws Exception;}
 private static QrReader instance;
 static synchronized QrReader get(Context context,Listener listener){if(instance==null)instance=new QrReader(context);if(instance.listener.get()!=listener)instance.cancel();instance.listener=new WeakReference<>(listener);return instance;}
 private final Context context;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final ExecutorService cleanup=Executors.newFixedThreadPool(3);
 private final AtomicInteger tasks=new AtomicInteger();
 private final GenerationGate generation=new GenerationGate();
 private volatile CancellationScope scope=new CancellationScope(cleanup,()->{});
 private volatile WeakReference<Listener> listener=new WeakReference<>(null);
 private QrReader(Context context){this.context=context.getApplicationContext();}
 boolean busy(){return tasks.get()>0||scope.hasResources();}
 void image(Uri uri){submit(s->decodeImage(uri,s));}
 void bitmap(Bitmap image){submit(s->{try{s.check();String code=QrCodec.decode(image);s.check();return code;}finally{image.recycle();}});}
 void cancel(){generation.next();scope.cancel();}
 void detach(Listener owner){if(listener.get()==owner){listener=new WeakReference<>(null);cancel();}} // App-scoped worker prevents Activity recreation from bypassing a stuck provider.
 private void submit(Decode decode){
  if(busy()){Listener l=listener.get();if(l!=null)l.state(R.string.qr_stopping);return;}
  final long token=generation.next();final CancellationScope current=new CancellationScope(cleanup,()->{});scope=current;tasks.incrementAndGet();
  Listener l=listener.get();if(l!=null)l.state(R.string.qr_reading);
  final Runnable timeout=()->{if(generation.current(token)&&tasks.get()>0){generation.next();current.cancel();Listener target=listener.get();if(target!=null)target.state(R.string.qr_timeout);}};
  main.postDelayed(timeout,30000);
  worker.execute(()->{String result=null;int error=0;try{result=decode.run(current);current.check();}catch(Exception e){error=R.string.qr_failed;}finally{tasks.decrementAndGet();main.removeCallbacks(timeout);}
   final String value=result;final int failure=error;main.post(()->{Listener target=listener.get();if(target==null||!generation.current(token))return;if(failure!=0)target.state(current.hasResources()?R.string.qr_stopping:failure);else target.read(value);});
  });
 }
 private String decodeImage(Uri uri,CancellationScope scope)throws Exception {
  BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
  try(InputStream in=ProviderIo.input(context.getContentResolver(),uri,scope)){scope.check();BitmapFactory.decodeStream(in,null,options);scope.check();}
  if(options.outWidth<=0||options.outHeight<=0||options.outWidth>50000||options.outHeight>50000)throw new IOException("IMAGE_LIMIT");
  options.inSampleSize=1;while((long)(options.outWidth/options.inSampleSize)*(options.outHeight/options.inSampleSize)>4194304)options.inSampleSize*=2;
  options.inJustDecodeBounds=false;scope.check();Bitmap image;
  try(InputStream in=ProviderIo.input(context.getContentResolver(),uri,scope)){image=BitmapFactory.decodeStream(in,null,options);}
  if(image==null)throw new IOException("IMAGE");try{scope.check();String code=QrCodec.decode(image);scope.check();return code;}finally{image.recycle();}
 }
}
