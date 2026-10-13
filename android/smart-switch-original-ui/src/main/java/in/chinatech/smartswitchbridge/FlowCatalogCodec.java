package in.chinatech.smartswitchbridge;
import java.io.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** Authenticated catalog includes actual content hashes; no source URI is sent. */
final class FlowCatalogCodec {
 static final Set<String> TYPES=Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList("photos","videos","audio","files","contacts","calendar","apps")));
 static final class Entry {
  final String id,category,name,mime;final long size;final byte[] hash;
  Entry(String id,String category,String name,String mime,long size,byte[] hash)throws IOException {
   if(!TYPES.contains(category))throw new IOException("CATALOG");
   if(hash==null)throw new IOException("CATALOG_UNPREPARED");
   ProtocolCore.Item item=new ProtocolCore.Item(id,name,mime,size,hash);
   this.id=item.id;this.category=category;this.name=item.name;this.mime=item.mime;this.size=item.size;this.hash=item.hash.clone();
  }
 }
 static void write(DataOutputStream out,Entry e)throws IOException {
  ProtocolCore.writeString(out,e.id,30);ProtocolCore.writeString(out,e.category,20);
  ProtocolCore.writeString(out,e.name,ProtocolCore.MAX_NAME_BYTES);ProtocolCore.writeString(out,e.mime,100);
  out.writeLong(e.size);out.write(e.hash);
 }
 static Entry read(DataInputStream in)throws IOException {
  String id=ProtocolCore.readString(in,30),category=ProtocolCore.readString(in,20),name=ProtocolCore.readString(in,ProtocolCore.MAX_NAME_BYTES),mime=ProtocolCore.readString(in,100);
  long size=in.readLong();byte[] hash=new byte[32];in.readFully(hash);return new Entry(id,category,name,mime,size,hash);
 }
 static void checkCount(long n)throws IOException{if(n<0)throw new IOException("CATALOG_COUNT");}
 static final class Digest {
  private final MessageDigest h;private long count;
  Digest(){try{h=MessageDigest.getInstance("SHA-256");}catch(NoSuchAlgorithmException e){throw new AssertionError(e);}}
  void add(Entry e)throws IOException {
   DataOutputStream out=new DataOutputStream(new OutputStream(){public void write(int b){h.update((byte)b);}public void write(byte[] b,int off,int len){h.update(b,off,len);}});
   write(out,e);count=ProtocolCore.addBytes(count,1);
  }
  void choice(String id)throws IOException{ProtocolCore.validateObjectId(id);h.update(id.getBytes(StandardCharsets.US_ASCII));count=ProtocolCore.addBytes(count,1);}
  long count(){return count;}byte[] finish(){return h.digest();}
 }
 private FlowCatalogCodec(){}
}
