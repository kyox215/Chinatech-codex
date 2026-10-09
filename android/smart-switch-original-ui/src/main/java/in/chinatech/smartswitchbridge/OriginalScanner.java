package in.chinatech.smartswitchbridge;
import android.view.View;import java.lang.reflect.*;
/** Adapts the existing APK barcode widget's verified ABI to the local pairing codec. */
final class OriginalScanner {
 interface Result{void found(String value);}
 private final Object barcode;private final Object wrapper;private final Class<?> mode;private boolean closed,active;
 OriginalScanner(View decorated,Result result)throws Exception{if(decorated==null)throw new IllegalStateException("SCANNER_VIEW");barcode=decorated.getClass().getMethod("getBarcodeView").invoke(decorated);ClassLoader loader=decorated.getContext().getClassLoader();Class<?> callback=Class.forName("h5.a",true,loader);Object proxy=Proxy.newProxyInstance(loader,new Class<?>[]{callback},(p,m,a)->{if(m.getName().equals("k")&&a!=null&&a.length==1&&!closed&&active){String raw=a[0].toString();try{ProtocolCore.Pairing.parse(raw,System.currentTimeMillis());closed=true;pause();result.found(raw);}catch(Exception invalid){}}if(m.getName().equals("toString"))return "OriginalPairingCallback";if(m.getName().equals("hashCode"))return System.identityHashCode(p);if(m.getName().equals("equals"))return p==a[0];return null;});Class<?> adapter=Class.forName("a1.t0",true,loader);wrapper=adapter.getConstructor(int.class,Object.class,boolean.class,Object.class).newInstance(18,decorated,false,proxy);mode=Class.forName("com.journeyapps.barcodescanner.BarcodeView$a",true,loader);}
 void resume(){if(closed)return;active=true;try{barcode.getClass().getField("C").set(barcode,mode.getField("CONTINUOUS").get(null));barcode.getClass().getField("E").set(barcode,wrapper);barcode.getClass().getMethod("c").invoke(barcode);barcode.getClass().getMethod("h").invoke(barcode);}catch(Exception error){pause();}}
 void close(){closed=true;pause();}
 void pause(){active=false;try{barcode.getClass().getMethod("g").invoke(barcode);}catch(Exception ignored){}}
}
