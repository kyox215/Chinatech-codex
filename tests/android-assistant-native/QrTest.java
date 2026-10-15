package in.chinatech.phoneassistant;
import com.google.zxing.*;
import com.google.zxing.common.*;
import java.util.*;
/** Library-only synthetic pixels. Not proof of an Android camera, gallery, or hotspot. */
public final class QrTest {
 public static void main(String[] args)throws Exception {byte[] session=new byte[16],bytes=new byte[32];for(int i=0;i<bytes.length;i++){bytes[i]=(byte)i;if(i<session.length)session[i]=(byte)i;}long clock=1800000000000L;ProtocolCore.Pairing p=new ProtocolCore.Pairing("192.168.82.1",45123,Base64.getUrlEncoder().withoutPadding().encodeToString(session),clock+60000,bytes,ProtocolCore.hex(bytes),"CT-fixture","fixture-password","wpa2");String code=p.encode();BitMatrix matrix=new MultiFormatWriter().encode(code,BarcodeFormat.QR_CODE,768,768);int[] pixels=new int[768*768];for(int y=0;y<768;y++)for(int x=0;x<768;x++)pixels[y*768+x]=matrix.get(x,y)?0xff000000:0xffffffff;Map<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(BarcodeFormat.QR_CODE));String result=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(768,768,pixels))),hints).getText();if(!code.equals(result)||!ProtocolCore.Pairing.parse(result,clock).ssid.equals("CT-fixture"))throw new AssertionError("QR");System.out.println("{\"kind\":\"synthetic JVM QR encode/decode; not Android camera evidence\",\"assertions\":2,\"status\":\"passed\"}");}
}
