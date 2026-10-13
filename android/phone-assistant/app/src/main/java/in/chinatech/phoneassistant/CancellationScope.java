package in.chinatech.phoneassistant;

import java.io.Closeable;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

/** Tracks resources until close returns. Cancellation never closes a provider on the caller thread. */
final class CancellationScope {
 private final Executor cleanup;
 private final Runnable changed;
 private final Set<Lease<?>> resources=new HashSet<>();
 private volatile boolean cancelled;
 CancellationScope(Executor cleanup,Runnable changed){this.cleanup=cleanup;this.changed=changed;}
 void check()throws IOException {if(cancelled)throw new IOException("CANCELLED");}
 synchronized boolean hasResources(){return !resources.isEmpty();}
 <T extends Closeable> Lease<T> track(T value)throws IOException {
  Lease<T> lease=new Lease<>(value);
  synchronized(this){resources.add(lease);if(!cancelled)return lease;}
  cleanup.execute(lease::quietClose);throw new IOException("CANCELLED");
 }
 void cancel(){Lease<?>[] copy;synchronized(this){cancelled=true;copy=resources.toArray(new Lease<?>[0]);}for(Lease<?> lease:copy)cleanup.execute(lease::quietClose);changed.run();}
 final class Lease<T extends Closeable> implements Closeable {
  final T value;
  private final AtomicBoolean closing=new AtomicBoolean();
  Lease(T value){this.value=value;}
  public void close()throws IOException {if(!closing.compareAndSet(false,true))return;value.close();finished();} // A failed close remains unresolved; never permit a new writer.
  /** Only for a cancellation signal after its associated query/stream has finished. */
  void dismiss(){if(closing.compareAndSet(false,true))finished();}
  private void finished(){synchronized(CancellationScope.this){resources.remove(this);}changed.run();}
  private void quietClose(){try{close();}catch(Exception ignored){/* Completion does not assert persistence. */}}
 }
}
