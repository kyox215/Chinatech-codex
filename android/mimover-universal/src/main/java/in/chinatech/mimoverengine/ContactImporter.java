package in.chinatech.mimoverengine;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds.*;
import java.io.*;
import java.util.*;

/** Creates local contacts only. Atomic provider markers recover a commit made before the journal write. */
final class ContactImporter {
 static final String MARKER="vnd.android.cursor.item/vnd.in.chinatech.restore";
 static final class Result {long imported,existing,partial,failed;}
 private final Context c;private final CancellationScope io;private final RestoreLedger ledger;
 ContactImporter(Context c,CancellationScope io,RestoreLedger ledger){this.c=c;this.io=io;this.ledger=ledger;}
 Result run(File file,String source,RestoreCoordinator.Progress progress)throws Exception {
  Result result=new Result();long index=0;Map<String,Integer> occurrences=new HashMap<>();
  try(RestoreText.Reader reader=new RestoreText.Reader(new FileInputStream(file))){RestoreText.Record record;while((record=reader.next("VCARD"))!=null){io.check();index++;String fingerprint=record.fingerprint();int occurrence=occurrences.getOrDefault(fingerprint,0)+1;occurrences.put(fingerprint,occurrence);String key="contact:"+fingerprint+":"+occurrence;try{requirePermission();long prior=marked(key);if(prior>=0){result.existing++;RestoreLedger.Entry priorEntry=ledger.get(key);boolean wasPartial=fields(record,new ArrayList<>())>0||(priorEntry!=null&&priorEntry.state.equals("partial"));if(wasPartial)result.partial++;ledger.put(key,"contacts",Long.toString(prior),wasPartial?"partial":"done",-1,"");}else{ArrayList<ContentProviderOperation> ops=new ArrayList<>();ops.add(ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI).withValue(ContactsContract.RawContacts.AGGREGATION_MODE,ContactsContract.RawContacts.AGGREGATION_MODE_DISABLED).withValue(ContactsContract.RawContacts.ACCOUNT_NAME,null).withValue(ContactsContract.RawContacts.ACCOUNT_TYPE,null).build());ops.add(data(MARKER).withValue(ContactsContract.Data.DATA1,key).build());int missing=fields(record,ops);if(ops.size()==2)throw new IOException("CONTACT_EMPTY");io.check();requirePermission();ContentProviderResult[] saved=c.getContentResolver().applyBatch(ContactsContract.AUTHORITY,ops);if(saved.length!=ops.size()||saved[0].uri==null)throw new IOException("CONTACT_WRITE");long id=ContentUris.parseId(saved[0].uri);ledger.put(key,"contacts",Long.toString(id),missing>0?"partial":"done",-1,"");result.imported++;if(missing>0)result.partial++;}}catch(SecurityException denied){throw denied;}catch(Exception error){result.failed++;}progress.update("contacts",result.imported,result.existing,result.partial,result.failed);}}
  if(index==0)throw new IOException("RESTORE_FORMAT");return result;
 }
 private void requirePermission(){if(c.checkSelfPermission(Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED||c.checkSelfPermission(Manifest.permission.WRITE_CONTACTS)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException("CONTACT_PERMISSION");}
 private long marked(String key)throws Exception {try(ProviderIo.Query q=ProviderIo.query(c.getContentResolver(),ContactsContract.Data.CONTENT_URI,new String[]{ContactsContract.Data.RAW_CONTACT_ID},ContactsContract.Data.MIMETYPE+"=? AND "+ContactsContract.Data.DATA1+"=?",new String[]{MARKER,key},io)){if(q.cursor==null)throw new IOException("CONTACT_QUERY");if(!q.cursor.moveToFirst())return -1;long id=q.cursor.getLong(0);if(q.cursor.moveToNext())throw new IOException("CONTACT_AMBIGUOUS");return id;}}
 private static ContentProviderOperation.Builder data(String mime){return ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI).withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID,0).withValue(ContactsContract.Data.MIMETYPE,mime);}
 private int fields(RestoreText.Record card,ArrayList<ContentProviderOperation> ops)throws Exception {
  int partial=0;RestoreText.Property fn=card.first("FN"),name=card.first("N");ContentProviderOperation.Builder n=data(StructuredName.CONTENT_ITEM_TYPE);
  if(fn!=null)n.withValue(StructuredName.DISPLAY_NAME,fn.text());if(name!=null){String[] parts=RestoreText.parts(name.decoded());String[] cols={StructuredName.FAMILY_NAME,StructuredName.GIVEN_NAME,StructuredName.MIDDLE_NAME,StructuredName.PREFIX,StructuredName.SUFFIX};for(int i=0;i<Math.min(parts.length,cols.length);i++)n.withValue(cols[i],parts[i]);}if(fn!=null||name!=null)ops.add(n.build());
  for(RestoreText.Property p:card.fields){String v;ContentProviderOperation.Builder b;switch(p.name){
   case "VERSION":case "FN":case "N":case "UID":case "REV":case "PRODID":break;
   case "TEL":v=p.text();if(v.startsWith("tel:"))v=v.substring(4);b=data(Phone.CONTENT_ITEM_TYPE).withValue(Phone.NUMBER,v);type(b,Phone.TYPE,Phone.LABEL,p,true);ops.add(b.build());break;
   case "EMAIL":b=data(Email.CONTENT_ITEM_TYPE).withValue(Email.ADDRESS,p.text());type(b,Email.TYPE,Email.LABEL,p,false);ops.add(b.build());break;
   case "ADR":String[] a=RestoreText.parts(p.decoded());b=data(StructuredPostal.CONTENT_ITEM_TYPE);String[] cols={StructuredPostal.POBOX,StructuredPostal.NEIGHBORHOOD,StructuredPostal.STREET,StructuredPostal.CITY,StructuredPostal.REGION,StructuredPostal.POSTCODE,StructuredPostal.COUNTRY};for(int i=0;i<Math.min(a.length,cols.length);i++)b.withValue(cols[i],a[i]);type(b,StructuredPostal.TYPE,StructuredPostal.LABEL,p,false);ops.add(b.build());break;
   case "ORG":String[] org=RestoreText.parts(p.decoded());b=data(Organization.CONTENT_ITEM_TYPE).withValue(Organization.COMPANY,org[0]).withValue(Organization.TYPE,Organization.TYPE_WORK);if(org.length>1)b.withValue(Organization.DEPARTMENT,String.join(";",Arrays.copyOfRange(org,1,org.length)));RestoreText.Property title=card.first("TITLE");if(title!=null)b.withValue(Organization.TITLE,title.text());ops.add(b.build());break;
   case "TITLE":if(card.first("ORG")==null)ops.add(data(Organization.CONTENT_ITEM_TYPE).withValue(Organization.TITLE,p.text()).withValue(Organization.TYPE,Organization.TYPE_WORK).build());break;
   case "NOTE":ops.add(data(Note.CONTENT_ITEM_TYPE).withValue(Note.NOTE,p.text()).build());break;
   case "NICKNAME":ops.add(data(Nickname.CONTENT_ITEM_TYPE).withValue(Nickname.NAME,p.text()).withValue(Nickname.TYPE,Nickname.TYPE_DEFAULT).build());break;
   case "URL":ops.add(data(Website.CONTENT_ITEM_TYPE).withValue(Website.URL,p.text()).withValue(Website.TYPE,Website.TYPE_OTHER).build());break;
   case "BDAY":case "ANNIVERSARY":ops.add(data(Event.CONTENT_ITEM_TYPE).withValue(Event.START_DATE,p.text()).withValue(Event.TYPE,p.name.equals("BDAY")?Event.TYPE_BIRTHDAY:Event.TYPE_ANNIVERSARY).build());break;
   case "PHOTO":if(!"B".equalsIgnoreCase(p.params.get("ENCODING"))&&!"BASE64".equalsIgnoreCase(p.params.get("ENCODING"))){partial++;break;}byte[] bytes=p.binary();if(bytes.length>262144){partial++;break;}ops.add(data(Photo.CONTENT_ITEM_TYPE).withValue(Photo.PHOTO,bytes).build());break;
   case "X-SIP":case "IMPP":v=p.text();if(v.startsWith("sip:")||p.name.equals("X-SIP")){ops.add(data(SipAddress.CONTENT_ITEM_TYPE).withValue(SipAddress.SIP_ADDRESS,v.startsWith("sip:")?v.substring(4):v).withValue(SipAddress.TYPE,SipAddress.TYPE_OTHER).build());}else partial++;break;
   case "X-ANDROID-CUSTOM":String[] custom=RestoreText.parts(p.decoded());Set<String> allowed=new HashSet<>(Arrays.asList(Relation.CONTENT_ITEM_TYPE,Event.CONTENT_ITEM_TYPE,Im.CONTENT_ITEM_TYPE,Nickname.CONTENT_ITEM_TYPE,Organization.CONTENT_ITEM_TYPE,Website.CONTENT_ITEM_TYPE));if(custom.length<2||!allowed.contains(custom[0])){partial++;break;}b=data(custom[0]);for(int i=1;i<custom.length&&i<=14;i++)if(!custom[i].isEmpty())b.withValue("data"+i,custom[i]);ops.add(b.build());break;
   default:partial++;
  }}return partial;
 }
 private static void type(ContentProviderOperation.Builder b,String col,String label,RestoreText.Property p,boolean phone){String t=p.type();int value=t.contains("HOME")?1:t.contains("WORK")?2:phone&&t.contains("CELL")?2:phone?Phone.TYPE_OTHER:Email.TYPE_OTHER;if(phone&&t.contains("WORK"))value=Phone.TYPE_WORK;if(phone&&t.contains("FAX"))value=t.contains("HOME")?Phone.TYPE_FAX_HOME:Phone.TYPE_FAX_WORK;if(t.isEmpty()||t.equals("VOICE")||t.equals("PREF"))b.withValue(col,value);else if(t.contains("HOME")||t.contains("WORK")||phone&&t.contains("CELL"))b.withValue(col,value);else b.withValue(col,0).withValue(label,t);if(t.contains("PREF")||"1".equals(p.params.get("PREF")))b.withValue(ContactsContract.Data.IS_PRIMARY,1);}
}
