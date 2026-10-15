package in.chinatech.phoneassistant;

import java.io.IOException;
import java.nio.*;
import java.nio.charset.*;
import java.security.*;
import java.security.interfaces.ECPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;

/** Shared wire/identity checks. No Android, network, files or customer logging. */
public final class PhoneGateCore {
 public static final String ORIGIN="https://www.chinatech.in",TOOL="phone-assistant",VERSION="0.5.0-test",RELEASE="phone-assistant-0.5.0";
 public static final int VERSION_CODE=5,MAX_CODE_BYTES=2200;
 public static final String KEY_ID="office-v3-20261013",PUBLIC_KEY="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoHieiLBa/Im3OqTwwDEMtygbpqs0U18RkelP70y3ERAFiJDZrVSkQKXNN3dp73VJPouyS2fgAcn0qL16RyMxhA==";
 public interface Json { Map<String,Object> read(String value)throws Exception;String write(Map<String,Object> value)throws Exception; }
 private PhoneGateCore(){}
 static IOException invalid(){return new IOException("GATE_INVALID");}
 public static String b64(byte[] bytes){return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 public static byte[] un64(String value,int max)throws IOException {
  try{if(value==null||value.length()>max||!value.matches("[A-Za-z0-9_-]+"))throw invalid();byte[] b=Base64.getUrlDecoder().decode(value);if(!b64(b).equals(value))throw invalid();return b;}catch(IllegalArgumentException e){throw invalid();}
 }
 public static String utf8(byte[] bytes)throws IOException {try{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}catch(CharacterCodingException e){throw invalid();}}
 public static String sha(byte[] bytes){return ProtocolCore.hex(ProtocolCore.sha256(bytes));}
 public static String hash(String text){return sha(text.getBytes(StandardCharsets.UTF_8));}
 public static String string(Map<String,Object> data,String key,int max)throws IOException {Object v=data.get(key);if(!(v instanceof String)||((String)v).length()>max)throw invalid();return (String)v;}
 public static long number(Map<String,Object> data,String key)throws IOException {Object v=data.get(key);if(!(v instanceof Long)&&!(v instanceof Integer))throw invalid();return ((Number)v).longValue();}
 public static void hashValue(String value)throws IOException {if(value==null||!value.matches("[a-f0-9]{64}"))throw invalid();}
 public static void uuid(String value)throws IOException {if(value==null||!value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")||value.equals("00000000-0000-0000-0000-000000000000"))throw invalid();}
 static void token(String value)throws IOException {if(value==null||!value.matches("[A-Za-z0-9_-]{22}"))throw invalid();}
 static void release(String value)throws IOException {if(value==null||!value.matches("[a-z0-9][a-z0-9.-]{0,95}"))throw invalid();}
 public static String canonical(String path,String payload,Map<String,Object> body)throws IOException {
  return String.join("\n","CT-TOOLBOX-V1","POST",path,string(body,"requestId",36),string(body,"installationId",36),Long.toString(number(body,"timestamp")),string(body,"nonce",43),sha(un64(payload,12000)),hash(""));
 }
 public static byte[] derToRaw(byte[] der)throws IOException {
  if(der==null||der.length<8||der.length>72||der[0]!=48||(der[1]&255)!=der.length-2)throw invalid();byte[] raw=new byte[64];int offset=2;
  for(int side=0;side<2;side++){
   if(offset+2>der.length||der[offset++]!=2)throw invalid();int count=der[offset++]&255;
   if(count<1||count>33||offset+count>der.length||(der[offset]&128)!=0)throw invalid();
   if(count>1&&der[offset]==0){if((der[offset+1]&128)==0)throw invalid();offset++;count--;}
   if(count>32)throw invalid();System.arraycopy(der,offset,raw,side*32+32-count,count);offset+=count;
  }
  if(offset!=der.length)throw invalid();return raw;
 }
 public static byte[] rawToDer(byte[] raw)throws IOException {
  if(raw==null||raw.length!=64)throw invalid();byte[][] integers=new byte[2][];
  for(int side=0;side<2;side++){int first=side*32,end=first+32;while(first<end-1&&raw[first]==0)first++;int pad=(raw[first]&128)!=0?1:0;byte[] integer=new byte[end-first+pad];System.arraycopy(raw,first,integer,pad,end-first);integers[side]=integer;}
  byte[] der=new byte[6+integers[0].length+integers[1].length];int i=0;der[i++]=48;der[i++]=(byte)(der.length-2);
  for(byte[] integer:integers){der[i++]=2;der[i++]=(byte)integer.length;System.arraycopy(integer,0,der,i,integer.length);i+=integer.length;}return der;
 }
 public static String envelope(Map<String,Object> wire)throws IOException {String kid=string(wire,"kid",64),payload=string(wire,"payload",10000),signature=string(wire,"signature",86);if(!kid.matches("[A-Za-z0-9_-]{1,64}")||un64(signature,86).length!=64)throw invalid();un64(payload,10000);return kid+"."+payload+"."+signature;}
 public static Map<String,Object> verify(String encoded,String audience,Json json,Map<String,String> keys,long now)throws Exception {
  if(encoded==null||encoded.length()>12000)throw invalid();String[] p=encoded.split("\\.",-1);if(p.length!=3||!keys.containsKey(p[0]))throw invalid();
  PublicKey key=KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(keys.get(p[0]))));
  if(!(key instanceof ECPublicKey)||((ECPublicKey)key).getParams().getCurve().getField().getFieldSize()!=256)throw invalid();
  Signature verifier=Signature.getInstance("SHA256withECDSA");verifier.initVerify(key);verifier.update(("CT-OFFICE-V3-UPDATE\n"+p[1]).getBytes(StandardCharsets.UTF_8));if(!verifier.verify(rawToDer(un64(p[2],86))))throw invalid();
  Map<String,Object> data=json.read(utf8(un64(p[1],10000)));long issued=number(data,"issuedAt"),expires=number(data,"expiresAt");
  long bound=audience.equals("toolbox-v1-task")?2592000:300;
  if(number(data,"v")!=1||!ORIGIN.equals(string(data,"iss",100))||!audience.equals(string(data,"aud",100))||!TOOL.equals(string(data,"toolId",100))||issued>now+300||expires<=now||expires<=issued||expires-issued>bound)throw invalid();return data;
 }
 public static Map<String,Object> permit(String encoded,String releaseId,String installation,String job,String role,String scope,String expectedKeyHash,Json json,Map<String,String> keys,long now)throws Exception {
  Map<String,Object> data=verify(encoded,"toolbox-v1-task",json,keys,now);
  if(!releaseId.equals(string(data,"releaseId",96))||!installation.equals(string(data,"installationId",36))||!job.equals(string(data,"jobId",36))||!role.equals(string(data,"action",10))||!scope.equals(string(data,"scopeHash",64)))throw invalid();
  String keyHash=string(data,"keyHash",64);hashValue(keyHash);if(expectedKeyHash!=null&&!expectedKeyHash.equals(keyHash))throw invalid();return data;
 }
 public static final class Plan {
  public final String transfer,receiver,sender,receiverJob,senderJob,receiverPin,senderPin,target,secretHash,manifest;
  public final long count,bytes;
  public Plan(String value)throws IOException {
   if(value==null||value.length()>900)throw invalid();String[] p=value.split("\\|",-1);if(p.length!=13||!p[0].equals("CTPA5P"))throw invalid();
   transfer=p[1];receiver=p[2];sender=p[3];receiverJob=p[4];senderJob=p[5];receiverPin=p[6];senderPin=p[7];target=p[8];secretHash=p[9];manifest=p[10];
   token(transfer);uuid(receiver);uuid(sender);uuid(receiverJob);uuid(senderJob);token(target);for(String hash:new String[]{receiverPin,senderPin,secretHash,manifest})hashValue(hash);
   if(receiver.equals(sender)||receiverJob.equals(senderJob)||!p[11].matches("[1-9][0-9]{0,18}")||!p[12].matches("0|[1-9][0-9]{0,18}"))throw invalid();
   try{count=Long.parseLong(p[11]);bytes=Long.parseLong(p[12]);}catch(NumberFormatException e){throw invalid();}
  }
  public String encode(){return String.join("|","CTPA5P",transfer,receiver,sender,receiverJob,senderJob,receiverPin,senderPin,target,secretHash,manifest,Long.toString(count),Long.toString(bytes));}
  public String scope(){return hash(encode());}
  public String ownId(boolean receiving){return receiving?receiver:sender;}public String ownJob(boolean receiving){return receiving?receiverJob:senderJob;}public String ownPin(boolean receiving){return receiving?receiverPin:senderPin;}
  public String peerId(boolean receiving){return receiving?sender:receiver;}public String peerJob(boolean receiving){return receiving?senderJob:receiverJob;}public String peerPin(boolean receiving){return receiving?senderPin:receiverPin;}
 }
 public static String[] code(String value,String prefix,int count)throws IOException {if(value==null||value.getBytes(StandardCharsets.UTF_8).length>MAX_CODE_BYTES)throw invalid();String[] p=value.split("\\|",-1);if(p.length!=count||!p[0].equals(prefix))throw new IOException("GATE_NEW_PEER_REQUIRED");return p;}
 public static boolean isCode(String value){return value!=null&&(value.startsWith("CTPA5O|")||value.startsWith("CTPA5S|")||value.startsWith("CTPA5F|"));}
 public static Map<String,String> trustedKeys(){return Collections.singletonMap(KEY_ID,PUBLIC_KEY);}
}
