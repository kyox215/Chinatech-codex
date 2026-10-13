package in.chinatech.mimoverengine;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** Streaming framing check; preserves complete provider vCard sequences and all unknown fields. */
final class ContactExport {
 static final int BUFFER=16384;
 private ContactExport(){}

 /** Write to a private staging file: the caller publishes it only after this method succeeds. */
 static long copy(InputStream source,OutputStream staged,ProtocolCore.Check check)throws IOException {
  byte[] buffer=new byte[BUFFER];Framing framing=new Framing();long bytes=0;int n;
  while(true){check.check();n=source.read(buffer);check.check();if(n==-1)break;if(n==0)continue;
   for(int i=0;i<n;i++)framing.accept(buffer[i]);
   bytes=ProtocolCore.addBytes(bytes,n);staged.write(buffer,0,n);
  }
  check.check();framing.finish();check.check();
  // A provider may omit the last newline. Keep its bytes and separate the next card safely.
  if(!framing.terminated){staged.write('\r');staged.write('\n');}
  check.check();staged.flush();check.check();return bytes;
 }

 /** Fixed memory even when a provider emits an unfolded multi-megabyte PHOTO line. */
 private static final class Framing {
  final byte[] prefix=new byte[16];int length;boolean longLine,inside,seen,version,property,terminated;
  void accept(byte value)throws IOException {
   if(value=='\n'){line();terminated=true;return;}
   terminated=false;if(length<prefix.length)prefix[length++]=value;else longLine=true;
  }
  boolean matches(String value){int end=length;if(!longLine&&end>0&&prefix[end-1]=='\r')end--;
   if(longLine||end!=value.length())return false;
   for(int i=0;i<end;i++){int b=prefix[i]&255;char c=value.charAt(i);if(b>='a'&&b<='z')b-=32;if(b!=c)return false;}return true;
  }
  void line()throws IOException {
   boolean blank=matches("");
   // One aggregated Android contact can export several constituent raw-contact cards.
   if(matches("BEGIN:VCARD")){if(inside)throw new IOException("CONTACTS_VCARD");inside=true;seen=true;version=false;property=false;}
   else if(matches("END:VCARD")){if(!inside||!version||!property)throw new IOException("CONTACTS_VCARD");inside=false;}
   else if(inside){if(matches("VERSION:2.1")||matches("VERSION:3.0")||matches("VERSION:4.0"))version=true;else if(!blank)property=true;}
   else if(!blank)throw new IOException("CONTACTS_VCARD");
   length=0;longLine=false;
  }
  void finish()throws IOException {if(length!=0||longLine)line();if(!seen||inside||!version||!property)throw new IOException("CONTACTS_VCARD");}
 }
}
