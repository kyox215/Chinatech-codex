package in.chinatech.smartswitchbridge;

import java.io.*;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.security.*;
import java.util.*;

/** Wire contract shared by Android and deterministic JVM security tests. No customer logging. */
public final class ProtocolCore {
    public static final String LAN_MAGIC = "CTSS5", HOTSPOT_MAGIC = "CTSS6", GATEWAY_HOST = "gateway";
    public static final int MAX_PAGE_ITEMS = 64, MAX_NAME_BYTES = 512;
    public static final long PAIR_TTL_MS = 10 * 60 * 1000L, MAX_FILE_BYTES = Long.MAX_VALUE;
    private static final SecureRandom RANDOM = new SecureRandom();
    private ProtocolCore() {}
    public static byte[] random(int n) { byte[] b = new byte[n]; RANDOM.nextBytes(b); return b; }
    public static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for(byte x:b)s.append(String.format(Locale.ROOT,"%02x",x & 255)); return s.toString(); }
    public static byte[] unhex(String s) throws IOException { if(s.length()!=64 || !s.matches("[0-9a-f]{64}"))throw new IOException("PIN"); byte[] b=new byte[32];for(int i=0;i<32;i++)b[i]=(byte)Integer.parseInt(s.substring(i*2,i*2+2),16);return b; }
    public static String token(int n) { return Base64.getUrlEncoder().withoutPadding().encodeToString(random(n)); }
    public static boolean equal(byte[] a, byte[] b) { return MessageDigest.isEqual(a,b); }
    public static byte[] sha256(byte[] bytes) { try {return MessageDigest.getInstance("SHA-256").digest(bytes);}catch(NoSuchAlgorithmException e){throw new AssertionError(e);} }
    public static String confirmation(byte[] secret, byte[] nonce) { byte[] b=new byte[secret.length+nonce.length];System.arraycopy(secret,0,b,0,secret.length);System.arraycopy(nonce,0,b,secret.length,nonce.length);return hex(sha256(b)).substring(0,12); }
    public static void writeString(DataOutputStream out,String s,int max) throws IOException {byte[] b=s.getBytes(StandardCharsets.UTF_8);if(b.length>max)throw new IOException("STRING_LIMIT");out.writeInt(b.length);out.write(b);}
    public static String readString(DataInputStream in,int max) throws IOException {int n=in.readInt();if(n<0||n>max)throw new IOException("STRING_LIMIT");byte[] b=new byte[n];in.readFully(b);try{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString();}catch(CharacterCodingException e){throw new IOException("UTF8");}}
    public static String readVerifiedControl(DataInputStream input,Check check)throws IOException {while(true){check.check();String frame=readString(input,20);if(!frame.equals("VERIFY_PROGRESS"))return frame;}}
    public static void writeFinish(DataOutputStream out,long count,byte[] digest)throws IOException {if(count<1||digest.length!=32)throw new IOException("INCOMPLETE");writeString(out,"FINISH",20);out.writeLong(count);out.write(digest);out.flush();}
    public static void readFinish(DataInputStream in,long expectedCount,byte[] expectedDigest)throws IOException {if(!"FINISH".equals(readString(in,20))||in.readLong()!=expectedCount)throw new IOException("INCOMPLETE");byte[] actual=new byte[32];in.readFully(actual);if(!equal(actual,expectedDigest))throw new IOException("MANIFEST_CHANGED");}
    public static String safeName(String name) { String s=name==null?"file":name.replaceAll("[\\\\/\\p{Cntrl}]","_").trim();if(s.equals(".")||s.equals("..")||s.isEmpty())s="file";while(s.getBytes(StandardCharsets.UTF_8).length>220)s=s.substring(0,s.length()-1);return s; }
    public static String uniqueDestinationName(String original,String objectId,String randomSuffix)throws IOException {validateName(original);validateObjectId(objectId);if(!randomSuffix.matches("[A-Za-z0-9_-]{8}"))throw new IOException("NAME");String safe=safeName(original);String suffix=" [CT-"+objectId.substring(0,8)+"-"+randomSuffix+"]";int dot=safe.lastIndexOf('.');return dot>0&&dot<safe.length()-1?safe.substring(0,dot)+suffix+safe.substring(dot):safe+suffix;}
    public static void validateName(String s)throws IOException {if(s.isEmpty()||s.equals(".")||s.equals("..")||s.contains("/")||s.contains("\\")||s.matches(".*[\\p{Cntrl}].*"))throw new IOException("NAME");if(s.getBytes(StandardCharsets.UTF_8).length>MAX_NAME_BYTES)throw new IOException("NAME");}
    public static void validateObjectId(String s)throws IOException {if(!s.matches("[A-Za-z0-9_-]{22}"))throw new IOException("OBJECT");}
    public static void validateSize(long n)throws IOException {if(n<0||n>MAX_FILE_BYTES)throw new IOException("SIZE");}
    /** Only numeric private IPv4 addresses. No DNS, loopback, public Internet, or URL injection. */
    public static void validateHost(String host)throws IOException {String[] p=host.split("\\.",-1);if(p.length!=4)throw new IOException("HOST");int[] v=new int[4];for(int i=0;i<4;i++){if(!p[i].matches("0|[1-9][0-9]{0,2}"))throw new IOException("HOST");v[i]=Integer.parseInt(p[i]);if(v[i]>255)throw new IOException("HOST");}if(!(v[0]==10||v[0]==192&&v[1]==168||v[0]==172&&v[1]>=16&&v[1]<=31)||v[3]==0||v[3]==255)throw new IOException("HOST");}
    /** Resolve only an actual, on-link private DHCP server or an unambiguous default gateway. */
    public static String selectGateway(String dhcp,List<String> gateways,java.util.function.Predicate<String> onLink)throws IOException {
        if(privateOnLink(dhcp,onLink))return dhcp;
        Set<String> valid=new LinkedHashSet<>();for(String gateway:gateways)if(privateOnLink(gateway,onLink))valid.add(gateway);
        if(valid.size()!=1)throw new IOException("WIFI_GATEWAY");return valid.iterator().next();
    }
    private static boolean privateOnLink(String host,java.util.function.Predicate<String> onLink){if(host==null)return false;try{validateHost(host);return onLink.test(host);}catch(IOException|RuntimeException e){return false;}}
    private static String b64(String value){return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));}
    private static String unb64(String value)throws IOException {if(!value.matches("[A-Za-z0-9_-]+"))throw new IOException("HOTSPOT");byte[] b=Base64.getUrlDecoder().decode(value);try{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString();}catch(CharacterCodingException e){throw new IOException("UTF8");}}
    public static void validateHotspot(String ssid,String password,String security)throws IOException {if(ssid==null||password==null||security==null||ssid.isEmpty()||ssid.getBytes(StandardCharsets.UTF_8).length>32||ssid.matches(".*[\\p{Cntrl}].*")||!password.matches("[\\x20-\\x7E]{8,63}")||!(security.equals("wpa2")||security.equals("wpa3")||security.equals("wpa3-transition")))throw new IOException("HOTSPOT");}
    public static final class Pairing {
        public final String host,session,pin,ssid,password,security; public final int port; public final long expires; public final byte[] secret;
        public Pairing(String host,int port,String session,long expires,byte[] secret,String pin)throws IOException {this(host,port,session,expires,secret,pin,"","","");}
        public Pairing(String host,int port,String session,long expires,byte[] secret,String pin,String ssid,String password,String security)throws IOException {if(host==null||session==null||secret==null||pin==null||ssid==null||password==null||security==null)throw new IOException("PAIR");if(GATEWAY_HOST.equals(host)){if(ssid.isEmpty())throw new IOException("HOST");}else validateHost(host);if(port<1024||port>65535||!session.matches("[A-Za-z0-9_-]{22}")||secret.length!=32)throw new IOException("PAIR");unhex(pin);this.host=host;this.port=port;this.session=session;this.expires=expires;this.secret=secret.clone();this.pin=pin;this.ssid=ssid;this.password=password;this.security=security;if(!ssid.isEmpty())validateHotspot(ssid,password,security);else if(!password.isEmpty()||!security.isEmpty())throw new IOException("HOTSPOT");}
        public boolean usesGateway(){return GATEWAY_HOST.equals(host);}
        public String magic(){return ssid.isEmpty()?LAN_MAGIC:HOTSPOT_MAGIC;}
        public boolean acceptsMagic(String value){return magic().equals(value);}
        public String encode(){String base=host+"|"+port+"|"+session+"|"+expires+"|"+Base64.getUrlEncoder().withoutPadding().encodeToString(secret)+"|"+pin;return ssid.isEmpty()?LAN_MAGIC+"|"+base:HOTSPOT_MAGIC+"|"+base+"|hotspot|"+b64(ssid)+"|"+security+"|"+b64(password);}
        public static Pairing parse(String code,long now)throws IOException {try{if(code==null||code.length()>512)throw new IOException("PAIR");String[] p=code.trim().split("\\|",-1);boolean hotspot=p.length==11&&p[0].equals(HOTSPOT_MAGIC)&&p[7].equals("hotspot");if(!(p.length==7&&p[0].equals(LAN_MAGIC)||hotspot)||!p[5].matches("[A-Za-z0-9_-]{43}"))throw new IOException("PAIR");long expiry=Long.parseLong(p[4]);if(expiry<=now||expiry>now+PAIR_TTL_MS+30000)throw new IOException("EXPIRED");return new Pairing(p[1],Integer.parseInt(p[2]),p[3],expiry,Base64.getUrlDecoder().decode(p[5]),p[6],hotspot?unb64(p[8]):"",hotspot?unb64(p[10]):"",hotspot?p[9]:"");}catch(IllegalArgumentException e){throw new IOException("PAIR");}}
        public void erase(){Arrays.fill(secret,(byte)0);}
    }
    public static final class Item {
        public final String id,name,mime; public final long size; public final byte[] hash;
        public Item(String id,String name,String mime,long size,byte[] hash)throws IOException {validateObjectId(id);validateName(name);validateSize(size);if(hash.length!=32||mime.length()>100||!mime.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+"))throw new IOException("MANIFEST");this.id=id;this.name=name;this.mime=mime;this.size=size;this.hash=hash.clone();}
    }
    public static void writeManifest(DataOutputStream out,List<Item> items)throws IOException {if(items.size()>MAX_PAGE_ITEMS)throw new IOException("COUNT");out.writeInt(items.size());for(Item i:items){writeString(out,i.id,30);writeString(out,i.name,MAX_NAME_BYTES);writeString(out,i.mime,100);out.writeLong(i.size);out.write(i.hash);}out.flush();}
    public static List<Item> readManifest(DataInputStream in)throws IOException {int n=in.readInt();if(n<1||n>MAX_PAGE_ITEMS)throw new IOException("COUNT");List<Item> a=new ArrayList<>();Set<String> ids=new HashSet<>();long total=0;for(int x=0;x<n;x++){String id=readString(in,30),name=readString(in,MAX_NAME_BYTES),mime=readString(in,100);long size=in.readLong();byte[] hash=new byte[32];in.readFully(hash);Item item=new Item(id,name,mime,size,hash);if(!ids.add(id))throw new IOException("DUPLICATE_OBJECT");try{total=Math.addExact(total,size);}catch(ArithmeticException e){throw new IOException("SIZE");}a.add(item);}return Collections.unmodifiableList(a);}
    public static void writeItem(DataOutputStream out,Item i)throws IOException {writeString(out,i.id,30);writeString(out,i.name,MAX_NAME_BYTES);writeString(out,i.mime,100);out.writeLong(i.size);out.write(i.hash);out.flush();}
    public static Item readItem(DataInputStream in)throws IOException {String id=readString(in,30),name=readString(in,MAX_NAME_BYTES),mime=readString(in,100);long size=in.readLong();byte[] hash=new byte[32];in.readFully(hash);return new Item(id,name,mime,size,hash);}
    public static long addBytes(long total,long size)throws IOException {validateSize(size);try{return Math.addExact(total,size);}catch(ArithmeticException e){throw new IOException("SIZE");}}
    public static void validateCount(long count)throws IOException {if(count<1)throw new IOException("COUNT");}
    public interface Check {void check()throws IOException;}
    /** Exact length copy: no huge in-memory buffers; EOF/overrun/checksum failure cannot become success. */
    public static byte[] copyExactly(InputStream in,OutputStream out,long size,Check check)throws IOException {validateSize(size);MessageDigest digest;try{digest=MessageDigest.getInstance("SHA-256");}catch(NoSuchAlgorithmException e){throw new AssertionError(e);}byte[] b=new byte[65536];long done=0;while(done<size){check.check();int n=in.read(b,0,(int)Math.min(b.length,size-done));check.check();if(n<0)throw new EOFException("TRUNCATED");if(n==0)continue;out.write(b,0,n);digest.update(b,0,n);done+=n;}check.check();out.flush();check.check();return digest.digest();}
}
