package in.chinatech.mimoverengine;
import java.io.*;
import java.nio.charset.StandardCharsets;
/** vCard 3.0 subset: displayed name, all selected phone/email rows. No guessed surname or merging. */
public final class VCard {
 private VCard(){}
 public static void begin(Writer out,String displayName)throws IOException {line(out,"BEGIN:VCARD");line(out,"VERSION:3.0");line(out,"N:;;;;");line(out,"FN:"+escape(displayName));}
 public static void phone(Writer out,String value)throws IOException {line(out,"TEL:"+escape(value));}
 public static void email(Writer out,String value)throws IOException {line(out,"EMAIL:"+escape(value));}
 public static void end(Writer out)throws IOException {line(out,"END:VCARD");}
 public static String escape(String value)throws IOException {if(value==null)return "";if(value.length()>16384)throw new IOException("CONTACTS_LIMIT");for(int i=0;i<value.length();i++){char c=value.charAt(i);if(Character.isHighSurrogate(c)){if(i+1>=value.length()||!Character.isLowSurrogate(value.charAt(++i)))throw new IOException("UTF8");}else if(Character.isLowSurrogate(c))throw new IOException("UTF8");}return value.replace("\\","\\\\").replace("\r\n","\\n").replace("\n","\\n").replace("\r","\\n").replace(";","\\;").replace(",","\\,");}
 /** RFC2426: UTF-8 lines <=75 octets; continuation has a single leading space, never splitting a code point. */
 public static void line(Writer out,String value)throws IOException {int used=0;for(int i=0;i<value.length();){int cp=value.codePointAt(i);String next=new String(Character.toChars(cp));int bytes=next.getBytes(StandardCharsets.UTF_8).length;if(used+bytes>75){out.write("\r\n ");used=1;}out.write(next);used+=bytes;i+=Character.charCount(cp);}out.write("\r\n");}
}
