package in.chinatech.mimoverengine;
import android.graphics.Bitmap;
import in.chinatech.mimoverzxing.*;
import in.chinatech.mimoverzxing.common.*;
import in.chinatech.mimoverzxing.qrcode.decoder.ErrorCorrectionLevel;
import java.util.*;
/** Fixed ZXing core 3.5.3. No network or GMS. Bitmap decoding is bounded before allocation. */
final class QrCodec {
 static Bitmap encode(String code)throws Exception {Map<EncodeHintType,Object> hints=new EnumMap<>(EncodeHintType.class);hints.put(EncodeHintType.CHARACTER_SET,"UTF-8");hints.put(EncodeHintType.ERROR_CORRECTION,ErrorCorrectionLevel.M);hints.put(EncodeHintType.MARGIN,4);BitMatrix matrix=new MultiFormatWriter().encode(code,BarcodeFormat.QR_CODE,768,768,hints);int[] pixels=new int[768*768];for(int y=0;y<768;y++)for(int x=0;x<768;x++)pixels[y*768+x]=matrix.get(x,y)?0xff000000:0xffffffff;return Bitmap.createBitmap(pixels,768,768,Bitmap.Config.ARGB_8888);}
 static String decode(Bitmap bitmap)throws Exception {int width=bitmap.getWidth(),height=bitmap.getHeight();if(width<=0||height<=0||(long)width*height>4194304)throw new java.io.IOException("IMAGE_LIMIT");int[] pixels=new int[width*height];bitmap.getPixels(pixels,0,width,0,0,width,height);Map<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(BarcodeFormat.QR_CODE));hints.put(DecodeHintType.TRY_HARDER,true);BinaryBitmap image=new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(width,height,pixels)));Result result;try{result=new MultiFormatReader().decode(image,hints);}catch(NotFoundException noDetection){hints.put(DecodeHintType.PURE_BARCODE,true);result=new MultiFormatReader().decode(image,hints);}String text=result.getText();ProtocolCore.Pairing.parse(text,System.currentTimeMillis());return text;}
}
