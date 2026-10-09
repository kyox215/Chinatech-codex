package in.chinatech.mimoverengine;

import java.io.*;
import java.nio.charset.*;
import java.util.*;

/** Bounded vCard/iCalendar reader. Unknown properties remain a reported partial restore. */
final class RestoreText {
 static final int MAX_RECORD=4*1024*1024;
 static final class Property {
  final String name,value;final Map<String,String> params;
  Property(String n,String v,Map<String,String> p){name=n;value=v;params=p;}
  String type(){return params.getOrDefault("TYPE","").toUpperCase(Locale.ROOT);}
  String decoded()throws IOException {String encoding=params.get("ENCODING");if(encoding==null||encoding.isEmpty()||encoding.equalsIgnoreCase("8BIT"))return value;if(encoding.equalsIgnoreCase("QUOTED-PRINTABLE"))return quoted(value,params.getOrDefault("CHARSET","UTF-8"));throw new IOException("RESTORE_ENCODING");}
  String text()throws IOException {return unescape(decoded());}
  byte[] binary()throws IOException {if(value.length()>MAX_RECORD)throw new IOException("RESTORE_LIMIT");try{return Base64.getMimeDecoder().decode(value);}catch(IllegalArgumentException e){throw new IOException("RESTORE_FORMAT");}}
 }
 static final class Record {final List<Property> fields=new ArrayList<>();int skippedComponents;Property first(String n){for(Property p:fields)if(p.name.equals(n))return p;return null;}
  String fingerprint()throws Exception {java.security.MessageDigest h=java.security.MessageDigest.getInstance("SHA-256");List<String> lines=new ArrayList<>();for(Property p:fields){if(p.name.equals("REV")||p.name.equals("DTSTAMP")||p.name.equals("PRODID")||p.name.equals("VERSION"))continue;Map<String,String> params=new TreeMap<>(p.params);params.remove("ENCODING");params.remove("CHARSET");lines.add(p.name+":"+params+":"+(p.name.equals("PHOTO")?p.value:p.decoded()));}Collections.sort(lines);for(String line:lines){byte[] bytes=line.getBytes(StandardCharsets.UTF_8);h.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.length).array());h.update(bytes);}h.update((byte)skippedComponents);return ProtocolCore.hex(h.digest());}
 }
 static final class Reader implements Closeable {
  private final BufferedReader input;private String pending;private boolean first=true;
  Reader(InputStream in){input=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)),65536);}
  private String physical()throws IOException {StringBuilder s=new StringBuilder();int c;while((c=input.read())!=-1){if(first){first=false;if(c==0xfeff)continue;}if(c=='\n')break;if(c!='\r')s.append((char)c);if(s.length()>MAX_RECORD)throw new IOException("RESTORE_LIMIT");}return c==-1&&s.length()==0?null:s.toString();}
  private String logical()throws IOException {String s=pending!=null?pending:physical();pending=null;if(s==null)return null;StringBuilder b=new StringBuilder(s);boolean qp=s.toUpperCase(Locale.ROOT).contains("ENCODING=QUOTED-PRINTABLE"),base64=s.toUpperCase(Locale.ROOT).contains("ENCODING=BASE64")||s.toUpperCase(Locale.ROOT).contains("ENCODING=B:")||s.toUpperCase(Locale.ROOT).contains("ENCODING=B;");String n;while((n=physical())!=null){if(qp&&b.length()>0&&b.charAt(b.length()-1)=='='){b.setLength(b.length()-1);b.append(n.startsWith(" ")||n.startsWith("\t")?n.substring(1):n);}else if(n.startsWith(" ")||n.startsWith("\t"))b.append(n.substring(1));else if(base64&&!n.isEmpty()&&n.matches("[A-Za-z0-9+/=]+"))b.append(n);else{pending=n;break;}if(b.length()>MAX_RECORD)throw new IOException("RESTORE_LIMIT");}return b.toString();}
  Record next(String component)throws IOException {String s;while((s=logical())!=null&&!s.equalsIgnoreCase("BEGIN:"+component)){}if(s==null)return null;Record r=new Record();int length=0,depth=0;while((s=logical())!=null){length+=s.length();if(length>MAX_RECORD||r.fields.size()>400||depth>8)throw new IOException("RESTORE_LIMIT");if(s.equalsIgnoreCase("END:"+component)&&depth==0)return r;if(s.isEmpty())continue;if(s.regionMatches(true,0,"BEGIN:",0,6)){if(!component.equals("VEVENT"))throw new IOException("RESTORE_FORMAT");depth++;r.skippedComponents++;continue;}if(depth>0){if(s.regionMatches(true,0,"END:",0,4))depth--;continue;}r.fields.add(property(s));}throw new IOException("RESTORE_FORMAT");}
  public void close()throws IOException {input.close();}
 }
 static Property property(String line)throws IOException {int colon=-1;boolean quote=false;for(int i=0;i<line.length();i++){char c=line.charAt(i);if(c=='"')quote=!quote;if(c==':'&&!quote){colon=i;break;}}if(colon<1)throw new IOException("RESTORE_FORMAT");String[] head=line.substring(0,colon).split(";");String name=head[0].toUpperCase(Locale.ROOT);int group=name.lastIndexOf('.');if(group>=0)name=name.substring(group+1);Map<String,String> p=new HashMap<>();for(int i=1;i<head.length;i++){int eq=head[i].indexOf('=');String key=eq<0?"TYPE":head[i].substring(0,eq).toUpperCase(Locale.ROOT);String v=eq<0?head[i]:head[i].substring(eq+1);if(v.length()>1&&v.startsWith("\"")&&v.endsWith("\""))v=v.substring(1,v.length()-1);p.put(key,p.containsKey(key)?p.get(key)+","+v:v);}return new Property(name,line.substring(colon+1),p);}
 static String unescape(String value){StringBuilder s=new StringBuilder();boolean escaped=false;for(char c:value.toCharArray()){if(escaped){s.append(c=='n'||c=='N'?'\n':c);escaped=false;}else if(c=='\\')escaped=true;else s.append(c);}if(escaped)s.append('\\');return s.toString();}
 static String[] parts(String value){List<String> p=new ArrayList<>();StringBuilder b=new StringBuilder();boolean escape=false;for(char c:value.toCharArray()){if(c==';'&&!escape){p.add(unescape(b.toString()));b.setLength(0);}else{b.append(c);}if(c=='\\'&&!escape)escape=true;else escape=false;}p.add(unescape(b.toString()));return p.toArray(new String[0]);}
 private static String quoted(String value,String charset)throws IOException {ByteArrayOutputStream out=new ByteArrayOutputStream();for(int i=0;i<value.length();i++){char c=value.charAt(i);if(c=='='){if(i+2>=value.length())throw new IOException("RESTORE_FORMAT");int a=Character.digit(value.charAt(++i),16),b=Character.digit(value.charAt(++i),16);if(a<0||b<0)throw new IOException("RESTORE_FORMAT");out.write(a*16+b);}else if(c<=255)out.write(c);else throw new IOException("RESTORE_FORMAT");}try{return Charset.forName(charset).newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(out.toByteArray())).toString();}catch(Exception e){throw new IOException("RESTORE_CHARSET");}}
 private RestoreText(){}
}
