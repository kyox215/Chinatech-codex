package in.chinatech.smartswitchbridge;
import java.io.*;import java.security.*;
/** Hash canonical metadata in wire order without accumulating a manifest in memory. */
final class ManifestDigest {
 private final MessageDigest digest;
 private long count,total;
 ManifestDigest(){try{digest=MessageDigest.getInstance("SHA-256");}catch(NoSuchAlgorithmException e){throw new AssertionError(e);}}
 void add(ProtocolCore.Item item)throws IOException {if(count==Long.MAX_VALUE)throw new IOException("COUNT");ByteArrayOutputStream bytes=new ByteArrayOutputStream();ProtocolCore.writeItem(new DataOutputStream(bytes),item);digest.update(bytes.toByteArray());count++;total=ProtocolCore.addBytes(total,item.size);}
 long count(){return count;}long total(){return total;}byte[] finish(){return digest.digest();}
}
