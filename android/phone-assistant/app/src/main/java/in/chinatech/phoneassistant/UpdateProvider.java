package in.chinatech.phoneassistant;
import android.content.*;import android.database.Cursor;import android.net.Uri;import android.os.ParcelFileDescriptor;import java.io.*;
/** Non-exported, grant-only, read-only access to one random private verified candidate. */
public final class UpdateProvider extends ContentProvider {
 public boolean onCreate(){return true;}
 private File candidate(Uri uri)throws FileNotFoundException {if(uri.getQuery()!=null||uri.getFragment()!=null||!uri.getAuthority().equals(getContext().getPackageName()+".updates")||!uri.getPath().matches("/candidate/[a-f0-9-]{36}\\.apk"))throw new FileNotFoundException();File directory=new File(getContext().getNoBackupFilesDir(),"updates"),file=new File(directory,uri.getLastPathSegment());try{if(!file.getCanonicalFile().getParentFile().equals(directory.getCanonicalFile())||!file.isFile())throw new FileNotFoundException();}catch(IOException e){throw new FileNotFoundException();}return file;}
 public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException {if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(candidate(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 public String getType(Uri uri){return "application/vnd.android.package-archive";}
 public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){try{File f=candidate(uri);android.database.MatrixCursor c=new android.database.MatrixCursor(new String[]{android.provider.OpenableColumns.DISPLAY_NAME,android.provider.OpenableColumns.SIZE});c.addRow(new Object[]{f.getName(),f.length()});return c;}catch(FileNotFoundException e){return null;}}
 public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}public int delete(Uri uri,String s,String[] a){throw new UnsupportedOperationException();}public int update(Uri uri,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
