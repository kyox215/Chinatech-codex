package in.chinatech.phoneassistant;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.*;
import java.util.*;
import java.util.concurrent.*;
import javax.net.ssl.*;

public final class ProtocolTest {
 static int assertions;
 interface Checked {void run()throws Exception;}
 static void ok(boolean condition,String name){if(!condition)throw new AssertionError(name);assertions++;}
 static void rejects(Checked c,String name)throws Exception {try{c.run();throw new AssertionError("Accepted "+name);}catch(IOException|CertificateException|IllegalArgumentException expected){assertions++;}}
 static DataInputStream input(byte[] b){return new DataInputStream(new ByteArrayInputStream(b));}
 static ProtocolCore.Item item(String id)throws Exception {return new ProtocolCore.Item(id,"fixture.txt","text/plain",3,ProtocolCore.sha256(new byte[]{1,2,3}));}
 public static void main(String[] args)throws Exception {
  long now=System.currentTimeMillis();ProtocolCore.Pairing pair=new ProtocolCore.Pairing("192.168.88.1",43111,ProtocolCore.token(16),now+60000,ProtocolCore.random(32),ProtocolCore.hex(ProtocolCore.random(32)));
  ok(ProtocolCore.Pairing.parse(pair.encode(),now).host.equals(pair.host),"pair round trip");
  ProtocolCore.Pairing hotspot=new ProtocolCore.Pairing(pair.host,pair.port,pair.session,pair.expires,pair.secret,pair.pin,"CT fixture Wi-Fi","fixture-password","wpa2");
  ProtocolCore.Pairing parsed=ProtocolCore.Pairing.parse(hotspot.encode(),now);ok(parsed.ssid.equals(hotspot.ssid)&&parsed.password.equals(hotspot.password),"hotspot round trip");
  rejects(()->ProtocolCore.Pairing.parse(pair.encode(),pair.expires),"expired pairing");
  rejects(()->ProtocolCore.Pairing.parse(pair.encode().replace("|43111|","|80|"),now),"privileged port");
  rejects(()->ProtocolCore.Pairing.parse(pair.encode().replace(pair.host,"evil.example"),now),"DNS target");
  for(String host:new String[]{"127.0.0.1","8.8.8.8","169.254.1.1","224.0.0.1","192.168.1.256","192.168.1.0","192.168.01.1","10.0.0.1/path","::1","10.0.0.1:443"})rejects(()->ProtocolCore.validateHost(host),"unsafe host");
  ProtocolCore.validateHost("10.5.1.1");ProtocolCore.validateHost("172.31.8.5");ok(true,"private host variants");
  rejects(()->ProtocolCore.validateHotspot("ssid","short","wpa2"),"short Wi-Fi password");
  rejects(()->ProtocolCore.validateHotspot("ssid","valid-password","open"),"open hotspot");
  rejects(()->ProtocolCore.validateHotspot("x\nssid","valid-password","wpa2"),"Wi-Fi controls");
  rejects(()->ProtocolCore.validateHotspot(String.join("",Collections.nCopies(33,"s")),"valid-password","wpa2"),"SSID bound");
  for(String name:new String[]{"../a","folder/a","a\\b","..",".","a\n.txt",""})rejects(()->ProtocolCore.validateName(name),"unsafe filename");
  ok(ProtocolCore.safeName("../../evil.txt").indexOf('/')==-1,"sender name sanitization");
  String id=ProtocolCore.token(16);ByteArrayOutputStream b=new ByteArrayOutputStream();ProtocolCore.writeManifest(new DataOutputStream(b),Arrays.asList(item(id)));List<ProtocolCore.Item> items=ProtocolCore.readManifest(input(b.toByteArray()));ok(items.size()==1&&items.get(0).id.equals(id),"manifest round trip");
  b.reset();ProtocolCore.writeManifest(new DataOutputStream(b),Arrays.asList(item(id),item(id)));byte[] duplicate=b.toByteArray();rejects(()->ProtocolCore.readManifest(input(duplicate)),"duplicate object ids");
  b.reset();new DataOutputStream(b).writeInt(ProtocolCore.MAX_PAGE_ITEMS+1);byte[] overflow=b.toByteArray();rejects(()->ProtocolCore.readManifest(input(overflow)),"individual manifest page bound");
  rejects(()->new ProtocolCore.Item(id,"x","text/plain",-1,new byte[32]),"negative size");
  rejects(()->new ProtocolCore.Item(id,"x","text/plain",ProtocolCore.MAX_FILE_BYTES+1,new byte[32]),"file size bound");
  rejects(()->new ProtocolCore.Item(id,"x","text/plain\nINJECT",1,new byte[32]),"MIME injection");
  rejects(()->new ProtocolCore.Item("../../x","x","text/plain",1,new byte[32]),"path object id");
  byte[] malformed={0,0,0,2,(byte)0xc3,0x28};rejects(()->ProtocolCore.readString(input(malformed),10),"malformed UTF8");
  rejects(()->ProtocolCore.readString(input(new byte[]{127,0,0,0}),512),"string length bound");
  byte[] payload=new byte[333333];new Random(11).nextBytes(payload);ByteArrayOutputStream dest=new ByteArrayOutputStream();byte[] hash=ProtocolCore.copyExactly(new ByteArrayInputStream(payload),dest,payload.length,()->{});ok(Arrays.equals(payload,dest.toByteArray())&&ProtocolCore.equal(hash,ProtocolCore.sha256(payload)),"stream checksum");
  rejects(()->ProtocolCore.copyExactly(new ByteArrayInputStream(new byte[3]),new ByteArrayOutputStream(),4,()->{}),"truncated stream");
  rejects(()->ProtocolCore.copyExactly(new ByteArrayInputStream(payload),new ByteArrayOutputStream(),payload.length,()->{throw new IOException("CANCELLED");}),"cancelled stream");
  byte[] changed=payload.clone();changed[13]^=1;ok(!ProtocolCore.equal(ProtocolCore.sha256(changed),hash),"source mutation detected");
  byte[] pin=ProtocolCore.unhex(pair.pin);ok(pin.length==32,"pin bytes");rejects(()->ProtocolCore.unhex("00"),"short pin");
  byte[] nonce=ProtocolCore.random(32);ok(ProtocolCore.confirmation(pair.secret,nonce).length()==12,"human device check length");ok(!ProtocolCore.confirmation(pair.secret,nonce).equals(ProtocolCore.confirmation(pair.secret,ProtocolCore.random(32))),"peer nonce distinguishes devices");
  vcard();tls(args[0]);pair.erase();ok(Arrays.equals(pair.secret,new byte[32]),"secret zeroized");
  System.out.println("{\"kind\":\"pure JVM protocol/TLS evidence; not Android device evidence\",\"assertions\":"+assertions+",\"status\":\"passed\"}");
 }
 static void vcard()throws Exception {
  String name=String.join("",Collections.nCopies(80,"中文🙂"))+";\n,\\";StringWriter out=new StringWriter();VCard.begin(out,name);VCard.phone(out,"+39 123");VCard.phone(out,"+86 456");VCard.email(out,"fixture@example.invalid");VCard.end(out);String text=out.toString();ok(text.contains("N:;;;;\r\n"),"required N without guessed surname");for(String line:text.split("\r\n"))ok(line.getBytes(StandardCharsets.UTF_8).length<=75,"UTF8 vCard folding bound");String unfolded=text.replace("\r\n ","");ok(unfolded.contains("FN:"+VCard.escape(name)+"\r\n"),"long Unicode contact preserved");ok(unfolded.contains("TEL:+39 123\r\n")&&unfolded.contains("TEL:+86 456\r\n"),"multiple phones preserved");ok(VCard.escape("A;B,C\\D\r\nE").equals("A\\;B\\,C\\\\D\\nE"),"vCard text escaping");rejects(()->VCard.escape("bad\ud800"),"malformed contact Unicode");String id=ProtocolCore.token(16);ok(ProtocolCore.uniqueDestinationName("photo.jpg",id,"abcdefgh").endsWith(".jpg"),"photo extension preserved");ok(ProtocolCore.uniqueDestinationName("contacts.vcf",id,"abcdefgh").endsWith(".vcf"),"VCF extension preserved");ok(!ProtocolCore.uniqueDestinationName("photo.jpg",id,"abcdefgh").equals("photo.jpg"),"filename does not target original");
 }
 static void tls(String keystore)throws Exception {
  KeyStore ks=KeyStore.getInstance("PKCS12");try(InputStream f=new FileInputStream(keystore)){ks.load(f,"android".toCharArray());}X509Certificate cert=(X509Certificate)ks.getCertificate("candidate");String pin=ProtocolCore.hex(ProtocolCore.sha256(cert.getEncoded()));PinnedTrust trust=new PinnedTrust(pin);trust.checkServerTrusted(new X509Certificate[]{cert},"RSA");ok(true,"exact cert accepted");rejects(()->new PinnedTrust(ProtocolCore.hex(new byte[32])).checkServerTrusted(new X509Certificate[]{cert},"RSA"),"wrong cert rejected");rejects(()->trust.checkServerTrusted(new X509Certificate[]{cert,cert},"RSA"),"unexpected chain rejected");rejects(()->trust.checkClientTrusted(new X509Certificate[]{cert},"RSA"),"client chain unused");
  KeyManagerFactory km=KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());km.init(ks,"android".toCharArray());SSLContext serverContext=SSLContext.getInstance("TLS");serverContext.init(km.getKeyManagers(),null,new SecureRandom());SSLContext clientContext=SSLContext.getInstance("TLS");clientContext.init(null,new TrustManager[]{trust},new SecureRandom());
  ExecutorService executor=Executors.newSingleThreadExecutor();try(SSLServerSocket server=(SSLServerSocket)serverContext.getServerSocketFactory().createServerSocket(0,1,java.net.InetAddress.getLoopbackAddress())){server.setEnabledProtocols(new String[]{"TLSv1.2"});server.setSoTimeout(10000);Future<Boolean> sent=executor.submit(()->{try(SSLSocket socket=(SSLSocket)server.accept()){socket.setSoTimeout(10000);socket.startHandshake();DataOutputStream out=new DataOutputStream(socket.getOutputStream());ProtocolCore.writeString(out,"synthetic-local-metadata",100);out.flush();return socket.getInputStream().read()==7;}});try(SSLSocket client=(SSLSocket)clientContext.getSocketFactory().createSocket(java.net.InetAddress.getLoopbackAddress(),server.getLocalPort())){client.setEnabledProtocols(new String[]{"TLSv1.2"});client.setSoTimeout(10000);client.startHandshake();ok(ProtocolCore.readString(new DataInputStream(client.getInputStream()),100).equals("synthetic-local-metadata"),"real pinned TLS transport");client.getOutputStream().write(7);client.getOutputStream().flush();}ok(sent.get(10,TimeUnit.SECONDS),"TLS sender acknowledgment");}finally{executor.shutdownNow();}
 }
}
