package in.chinatech.phoneassistant;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

/** Production streaming helper tests; no Android ContactsProvider/runtime evidence. */
public final class ContactExportTest {
 static int assertions;
 interface Checked{void run()throws Exception;}
 static void ok(boolean value,String message){if(!value)throw new AssertionError(message);assertions++;}
 static void rejects(Checked action,String code)throws Exception {
  try{action.run();throw new AssertionError("Accepted "+code);}catch(IOException expected){ok(code.equals(expected.getMessage()),"expected "+code);}
 }
 static byte[] utf8(String text){return text.getBytes(StandardCharsets.UTF_8);}
 static byte[] copy(String text)throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();ContactExport.copy(new ByteArrayInputStream(utf8(text)),out,()->{});return out.toByteArray();}
 public static void main(String[] args)throws Exception {
  String card="BEGIN:VCARD\r\nVERSION:3.0\r\nN:王;小明;;;\r\nFN:王小明\r\nTEL;TYPE=CELL:+390001\r\nTEL;TYPE=WORK:+390002\r\nADR;TYPE=HOME:;;Via Test;Roma;;00100;Italia\r\nORG:ChinaTech\r\nNOTE:line one\\nline two\r\nBDAY:2000-01-02\r\nPHOTO;ENCODING=b;TYPE=JPEG:YWJj\r\nX-ANDROID-CUSTOM:unknown;preserved\r\nEND:VCARD\r\n";
  ok(Arrays.equals(utf8(card),copy(card)),"structure/types/address/org/note/birthday/photo and unknown fields preserve original bytes");
  String noNewline="begin:vcard\nversion:2.1\nFN:Test\nend:vcard";
  ok(Arrays.equals(utf8(noNewline+"\r\n"),copy(noNewline)),"case-insensitive framing and missing terminal newline safely separated");
  ok(Arrays.equals(utf8("\n"+card+"\r\n"),copy("\n"+card+"\r\n")),"provider blank separators preserved");
  rejects(()->copy(""),"CONTACTS_VCARD");
  rejects(()->copy("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:cut\r\n"),"CONTACTS_VCARD");
  ok(Arrays.equals(utf8(card+card),copy(card+card)),"aggregated provider contact preserves multiple complete raw-contact cards");
  rejects(()->copy(card+"BEGIN:VCARD\nFN:truncated second card\n"),"CONTACTS_VCARD");
  rejects(()->copy(card+"BEGIN:VCARD\nFN:no version in second card\nEND:VCARD\n"),"CONTACTS_VCARD");
  rejects(()->copy("BEGIN:VCARD\nVERSION:5.0\nFN:Test\nEND:VCARD\n"),"CONTACTS_VCARD");
  rejects(()->copy("BEGIN:VCARD\nVERSION:3.0\nEND:VCARD\n"),"CONTACTS_VCARD");
  rejects(()->copy(card+"provider error"),"CONTACTS_VCARD");
  rejects(()->copy("BEGIN:VCARD\nVERSION:3.0\nBEGIN:VCARD\nFN:Test\nEND:VCARD\n"),"CONTACTS_VCARD");
  rejects(()->copy("END:VCARD\n"),"CONTACTS_VCARD");

  AtomicBoolean cancelled=new AtomicBoolean();ByteArrayOutputStream cancelledOut=new ByteArrayOutputStream();
  InputStream finalRead=new ByteArrayInputStream(utf8(card)){
   @Override public synchronized int read(byte[] b,int off,int length){int n=super.read(b,off,length);cancelled.set(true);return n;}
  };
  rejects(()->ContactExport.copy(finalRead,cancelledOut,()->{if(cancelled.get())throw new IOException("CANCELLED");}),"CANCELLED");
  ok(cancelledOut.size()==0,"cancel after read never writes staging bytes");
  OutputStream denied=new OutputStream(){public void write(int b)throws IOException{throw new IOException("WRITE");}public void write(byte[] b,int off,int length)throws IOException{throw new IOException("WRITE");}};
  rejects(()->ContactExport.copy(new ByteArrayInputStream(utf8(card)),denied,()->{}),"WRITE");

  largePhoto();sourcePolicy();
  System.out.println("{\"kind\":\"production vCard framing/preservation/bounded streaming/cancellation JVM evidence; not Android contacts or cross-brand evidence\",\"assertions\":"+assertions+",\"status\":\"passed\"}");
 }
 static void sourcePolicy()throws Exception {
  File exports=new File(System.getProperty("java.io.tmpdir"),"ctpa-policy-not-created/exports"),contact=new File(exports,"ctpa-synthetic.vcf");
  ok("android.permission.READ_CONTACTS".equals(SourceAccess.requiredPermission("contacts","file",exports,contact)),"private contact export requires current contacts permission");
  ok("android.permission.READ_CALENDAR".equals(SourceAccess.requiredPermission("calendar","file",exports,new File(exports,"ctpa-synthetic.ics"))),"private calendar export requires current calendar permission");
  ok(SourceAccess.requiredPermission("files","file",exports,contact)==null,"manual VCF is not a contacts-source permission request");
  ok(SourceAccess.requiredPermission("files","content",exports,contact)==null,"manual content VCF remains subject to its provider grant");
  ok(SourceAccess.requiredPermission("contacts","content",exports,contact)==null,"provider URI authorization remains with ProviderIo");
  ok(SourceAccess.requiredPermission("apps","file",exports,new File(exports,"ctpa-app-test.zip"))==null,"APK archive does not require contacts permission");
  scopeRejects(()->SourceAccess.requiredPermission("contacts","file",exports,new File(exports,"../ctpa-outside.vcf")));
  scopeRejects(()->SourceAccess.requiredPermission("calendar","file",exports,new File(exports,"nested/ctpa-nested.ics")));
  scopeRejects(()->SourceAccess.requiredPermission("contacts","file",exports,new File(exports,"foreign.vcf")));
  scopeRejects(()->SourceAccess.requiredPermission("contacts","file",exports,null));
 }
 static void scopeRejects(Checked action)throws Exception {try{action.run();throw new AssertionError("foreign private source accepted");}catch(SecurityException expected){ok("SOURCE_EXPORT_SCOPE".equals(expected.getMessage()),"foreign export path rejected");}}
 static void largePhoto()throws Exception {
  byte[] start=utf8("BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Photo\r\nPHOTO:data:image/jpeg;base64,"),end=utf8("\r\nEND:VCARD\r\n");
  final int total=4*1024*1024;final int[] maxRequest={0};
  InputStream photo=new InputStream(){int at;public int read(){return at++<total?'A':-1;}
   public int read(byte[] b,int off,int len){maxRequest[0]=Math.max(maxRequest[0],len);if(at>=total)return -1;int n=Math.min(len,total-at);Arrays.fill(b,off,off+n,(byte)'A');at+=n;return n;}
  };
  MessageDigest actual=MessageDigest.getInstance("SHA-256");final long[] written={0};
  OutputStream sink=new OutputStream(){public void write(int b){actual.update((byte)b);written[0]++;}public void write(byte[] b,int off,int len){actual.update(b,off,len);written[0]+=len;}};
  InputStream sequence=new SequenceInputStream(new ByteArrayInputStream(start),new SequenceInputStream(photo,new ByteArrayInputStream(end)));
  long copied=ContactExport.copy(sequence,sink,()->{});
  MessageDigest expected=MessageDigest.getInstance("SHA-256");expected.update(start);byte[] chunk=new byte[4096];Arrays.fill(chunk,(byte)'A');for(int n=0;n<total;n+=chunk.length)expected.update(chunk);expected.update(end);
  ok(copied==start.length+(long)total+end.length&&written[0]==copied,"large provider photo has no total-byte truncation");
  ok(Arrays.equals(expected.digest(),actual.digest()),"multi-megabyte unfolded photo remains exact");
  ok(maxRequest[0]<=ContactExport.BUFFER,"provider reads remain bounded without whole-contact buffer");
 }
}
