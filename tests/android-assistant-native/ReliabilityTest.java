package in.chinatech.phoneassistant;

import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Executes production helpers and stream boundaries; no Android lifecycle/provider claims. */
public final class ReliabilityTest {
 static int assertions;
 static void ok(boolean value,String label){if(!value)throw new AssertionError(label);assertions++;}
 static void cancelled(ProtocolTest.Checked action,String label)throws Exception {try{action.run();throw new AssertionError(label);}catch(IOException e){ok("CANCELLED".equals(e.getMessage()),label);}}
 static final class ObservedOutput extends ByteArrayOutputStream {int flushes;public void flush(){flushes++;}}
 public static void main(String[] args)throws Exception {
  ok(Arrays.equals(WifiPermissions.requestFor(31),new String[]{"android.permission.ACCESS_FINE_LOCATION","android.permission.ACCESS_COARSE_LOCATION"}),"Android 12 precise request includes coarse");
  ok(Arrays.equals(WifiPermissions.requestFor(32),WifiPermissions.requestFor(31)),"Android 12L uses paired location request");
  ok(Arrays.equals(WifiPermissions.requestFor(26),WifiPermissions.requestFor(31)),"legacy Wi-Fi location remains paired");
  ok(Arrays.equals(WifiPermissions.requestFor(33),new String[]{"android.permission.NEARBY_WIFI_DEVICES"}),"modern Wi-Fi does not request location");
  final AtomicBoolean stop=new AtomicBoolean();ObservedOutput output=new ObservedOutput();AtomicBoolean ack=new AtomicBoolean();
  InputStream lastRead=new ByteArrayInputStream(new byte[]{7}){public synchronized int read(byte[] b,int offset,int size){int count=super.read(b,offset,size);stop.set(true);return count;}};
  cancelled(()->{ProtocolCore.copyExactly(lastRead,output,1,()->{if(stop.get())throw new IOException("CANCELLED");});ack.set(true);},"cancel during final read rejected");
  ok(output.size()==0,"final read cancellation did not write");ok(output.flushes==0,"final read cancellation did not flush");ok(!ack.get(),"cancelled copy did not reach success/ACK continuation");
  AtomicInteger checks=new AtomicInteger();ObservedOutput beforeFlush=new ObservedOutput();
  cancelled(()->ProtocolCore.copyExactly(new ByteArrayInputStream(new byte[]{1}),beforeFlush,1,()->{if(checks.incrementAndGet()==3)throw new IOException("CANCELLED");}),"cancel before flush rejected");
  ok(beforeFlush.size()==1&&beforeFlush.flushes==0,"cancel before flush cannot publish final flush");
  ExecutorService cleanup=Executors.newFixedThreadPool(3);ExecutorService worker=Executors.newSingleThreadExecutor();
  try{
   AtomicInteger changed=new AtomicInteger();CancellationScope scope=new CancellationScope(cleanup,changed::incrementAndGet);
   CountDownLatch reading=new CountDownLatch(1),closed=new CountDownLatch(1);AtomicBoolean didClose=new AtomicBoolean();
   InputStream blocked=new InputStream(){public int read()throws IOException {reading.countDown();try{if(!closed.await(3,TimeUnit.SECONDS))throw new AssertionError("close did not unblock input");}catch(InterruptedException e){throw new IOException(e);}throw new IOException("CLOSED");}public void close(){didClose.set(true);closed.countDown();}};
   CancellationScope.Lease<InputStream> lease=scope.track(blocked);
   Future<Boolean> stopped=worker.submit(()->{try( CancellationScope.Lease<InputStream> resource=lease){resource.value.read();return false;}catch(IOException expected){return true;}});
   ok(reading.await(1,TimeUnit.SECONDS),"synthetic read entered blocking provider");scope.cancel();
   ok(stopped.get(2,TimeUnit.SECONDS)&&didClose.get(),"cancel actively closed/unblocked synthetic stream");
   awaitDrained(scope);ok(!scope.hasResources(),"closed input lease drained");cancelled(scope::check,"scope stays cancelled");
   CancellationScope slow=new CancellationScope(cleanup,()->{});CountDownLatch closing=new CountDownLatch(1),permitClose=new CountDownLatch(1),fullyClosed=new CountDownLatch(1);
   slow.track((Closeable)()->{closing.countDown();try{if(!permitClose.await(3,TimeUnit.SECONDS))throw new IOException("UNRESPONSIVE");}catch(InterruptedException e){throw new IOException(e);}fullyClosed.countDown();});
   slow.cancel();ok(closing.await(1,TimeUnit.SECONDS),"provider close scheduled off caller thread");ok(slow.hasResources(),"pending provider close cannot be called stopped or retried");
   permitClose.countDown();ok(fullyClosed.await(1,TimeUnit.SECONDS),"provider close allowed to finish");awaitDrained(slow);ok(!slow.hasResources(),"retry only becomes possible after close returns");
   CancellationScope failedClose=new CancellationScope(cleanup,()->{});CountDownLatch failed=new CountDownLatch(1);
   failedClose.track((Closeable)()->{failed.countDown();throw new IOException("CLOSE_UNCONFIRMED");});failedClose.cancel();ok(failed.await(1,TimeUnit.SECONDS)&&failedClose.hasResources(),"failed close remains unresolved instead of enabling new writer");
   CancellationScope late=new CancellationScope(cleanup,()->{});late.cancel();CountDownLatch lateClosed=new CountDownLatch(1);
   cancelled(()->late.track((Closeable)lateClosed::countDown),"late resource acquisition rejected");ok(lateClosed.await(1,TimeUnit.SECONDS),"late returned resource closed in background");awaitDrained(late);
  }finally{cleanup.shutdown();worker.shutdown();ok(cleanup.awaitTermination(3,TimeUnit.SECONDS)&&worker.awaitTermination(3,TimeUnit.SECONDS),"synthetic cleanup workers exited");}
  AtomicInteger failures=new AtomicInteger(),work=new AtomicInteger();
  boolean started=StartGuard.run(()->{throw new SecurityException("synthetic start service rejection");},failures::incrementAndGet);if(started)work.incrementAndGet();
  ok(!started&&failures.get()==1&&work.get()==0,"sync service denial prevents work continuation");
  ok(!StartGuard.run(()->{throw new IllegalStateException("synthetic deferred startForeground rejection");},failures::incrementAndGet)&&failures.get()==2,"deferred foreground denial handled");
  ok(StartGuard.run(work::incrementAndGet,failures::incrementAndGet)&&work.get()==1&&failures.get()==2,"normal service promotion continues once");
  ok(StopReason.keep(41,10,10)==41,"late cancellation does not mask recorded service failure");ok(StopReason.keep(0,10,10)==10,"initial cancellation remains visible");
  GenerationGate generation=new GenerationGate();long old=generation.next();ok(generation.current(old),"current QR generation accepted");long edited=generation.next();ok(!generation.current(old)&&generation.current(edited),"manual input invalidates old QR result");generation.next();ok(!generation.current(edited),"stop/lifecycle invalidates QR result");long next=generation.next();ok(generation.current(next)&&!generation.current(old),"new session cannot consume previous QR result");
  System.out.println("{\"kind\":\"production cancellation/start/generation helpers and adversarial copy JVM evidence; not Android lifecycle/provider evidence\",\"assertions\":"+assertions+",\"status\":\"passed\"}");
 }
 static void awaitDrained(CancellationScope scope)throws Exception {long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(1);while(scope.hasResources()&&System.nanoTime()<until)Thread.yield();if(scope.hasResources())throw new AssertionError("lease did not drain");}
}
