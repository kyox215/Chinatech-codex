package in.chinatech.smartswitchbridge;
import java.io.*;import java.security.*;
/** Per-64KiB acknowledgment propagates disk/provider rejection instead of endless reconnecting. */
final class ChunkTransport {
 static final int CHUNK=65536;
 static byte[] send(InputStream source,DataOutputStream wire,DataInputStream replies,long size,ProtocolCore.Check check)throws IOException {ProtocolCore.validateSize(size);MessageDigest hash=digest();byte[] b=new byte[CHUNK];long done=0;while(done<size){check.check();int n=source.read(b,0,(int)Math.min(CHUNK,size-done));check.check();if(n<0)throw new EOFException("SOURCE_TRUNCATED");if(n==0)continue;wire.writeInt(n);wire.write(b,0,n);wire.flush();check.check();if(!replies.readBoolean())throw new IOException("REMOTE_"+ProtocolCore.readString(replies,100));hash.update(b,0,n);done+=n;}check.check();return hash.digest();}
 static byte[] receive(DataInputStream wire,OutputStream target,DataOutputStream replies,long size,ProtocolCore.Check check)throws IOException {ProtocolCore.validateSize(size);MessageDigest hash=digest();byte[] b=new byte[CHUNK];long done=0;while(done<size){check.check();int n=wire.readInt();if(n<1||n>CHUNK||n>size-done)throw new IOException("CHUNK");wire.readFully(b,0,n);check.check();try{target.write(b,0,n);check.check();target.flush();check.check();}catch(IOException|RuntimeException e){try{replies.writeBoolean(false);ProtocolCore.writeString(replies,"WRITE",100);replies.flush();}catch(IOException ignored){}throw e;}hash.update(b,0,n);done+=n;replies.writeBoolean(true);replies.flush();}check.check();return hash.digest();}
 private static MessageDigest digest(){try{return MessageDigest.getInstance("SHA-256");}catch(NoSuchAlgorithmException e){throw new AssertionError(e);}}
 private ChunkTransport(){}
}
