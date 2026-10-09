package in.chinatech.phoneassistant;
import android.provider.DocumentsProvider;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.database.*;
import android.os.*;
import java.io.*;
/** Test APK only. This provider stores synthetic fixtures in the emulator test sandbox. */
public final class SyntheticDocuments extends DocumentsProvider {
 private File root;
 public boolean onCreate(){root=new File(getContext().getFilesDir(),"synthetic-documents");return root.exists()||root.mkdirs();}
 public Cursor queryRoots(String[] projection){MatrixCursor c=new MatrixCursor(projection==null?new String[]{Root.COLUMN_ROOT_ID,Root.COLUMN_DOCUMENT_ID,Root.COLUMN_TITLE,Root.COLUMN_FLAGS}:projection);MatrixCursor.RowBuilder r=c.newRow();for(String k:c.getColumnNames())r.add(k,k.equals(Root.COLUMN_ROOT_ID)||k.equals(Root.COLUMN_DOCUMENT_ID)?"root":k.equals(Root.COLUMN_TITLE)?"Synthetic transfer test":k.equals(Root.COLUMN_FLAGS)?Root.FLAG_SUPPORTS_CREATE:0);return c;}
 private File file(String id)throws FileNotFoundException{if(id.equals("root"))return root;if(!id.matches("fixture-[A-Za-z0-9_-]+"))throw new FileNotFoundException();return new File(root,id);}
 private void row(MatrixCursor c,String id)throws FileNotFoundException {File f=file(id);MatrixCursor.RowBuilder r=c.newRow();for(String k:c.getColumnNames())r.add(k,k.equals(Document.COLUMN_DOCUMENT_ID)?id:k.equals(Document.COLUMN_DISPLAY_NAME)?f.getName():k.equals(Document.COLUMN_MIME_TYPE)?(id.equals("root")?Document.MIME_TYPE_DIR:"application/octet-stream"):k.equals(Document.COLUMN_SIZE)?f.length():k.equals(Document.COLUMN_FLAGS)?(id.equals("root")?Document.FLAG_DIR_SUPPORTS_CREATE:Document.FLAG_SUPPORTS_WRITE|Document.FLAG_SUPPORTS_DELETE):0);}
 private String[] columns(String[] p){return p==null?new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE,Document.COLUMN_FLAGS}:p;}
 public Cursor queryDocument(String id,String[] p)throws FileNotFoundException{MatrixCursor c=new MatrixCursor(columns(p));row(c,id);return c;}
 public Cursor queryChildDocuments(String parent,String[] p,String sort)throws FileNotFoundException{MatrixCursor c=new MatrixCursor(columns(p));if(!parent.equals("root"))throw new FileNotFoundException();File[] a=root.listFiles();if(a!=null)for(File f:a)row(c,f.getName());return c;}
 public ParcelFileDescriptor openDocument(String id,String mode,CancellationSignal signal)throws FileNotFoundException{return ParcelFileDescriptor.open(file(id),ParcelFileDescriptor.parseMode(mode));}
 public String createDocument(String parent,String mime,String name)throws FileNotFoundException{if(!parent.equals("root"))throw new FileNotFoundException();String id="fixture-"+java.util.UUID.randomUUID();try{if(!file(id).createNewFile())throw new IOException();return id;}catch(IOException e){throw new FileNotFoundException();}}
 public void deleteDocument(String id)throws FileNotFoundException{if(id.equals("root")||!file(id).delete())throw new FileNotFoundException();}
 public boolean isChildDocument(String parent,String doc){return parent.equals("root")&&doc.startsWith("fixture-");}
}
