package in.chinatech.phoneassistant;
import com.google.zxing.*;
import com.google.zxing.common.*;
import java.util.*;
/** Library-only synthetic pixels. Not proof of an Android camera, gallery, or hotspot. */
public final class QrTest {
 public static void main(String[] args)throws Exception {ProtocolCore.Pairing p=new ProtocolCore.Pairing("192.168.82.1",45123,ProtocolCore.token(16),System.currentTimeMillis()+60000,ProtocolCore.random(32),ProtocolCore.hex(ProtocolCore.random(32)),"CT-fixture","fixture-password","wpa2");String code=p.encode();BitMatrix matrix=new MultiFormatWriter().encode(code,BarcodeFormat.QR_CODE,768,768);int[] pixels=new int[768*768];for(int y=0;y<768;y++)for(int x=0;x<768;x++)pixels[y*768+x]=matrix.get(x,y)?0xff000000:0xffffffff;Map<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(BarcodeFormat.QR_CODE));String result=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(768,768,pixels))),hints).getText();if(!code.equals(result)||!ProtocolCore.Pairing.parse(result,System.currentTimeMillis()).ssid.equals("CT-fixture"))throw new AssertionError("QR");System.out.println("{\"kind\":\"synthetic JVM QR encode/decode; not Android camera evidence\",\"assertions\":2,\"status\":\"passed\"}");}
}
