package in.chinatech.smartswitchbridge;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import java.io.File;
import java.io.IOException;

/** Revoking provider access also disables sending this assistant's cached sensitive exports. */
final class SourceAccess {
 private SourceAccess(){}
 static void check(Context context,TransferStore.Row row)throws IOException {
  String path=row.uri.getPath();
  String permission=requiredPermission(row.category,row.uri.getScheme(),
   new File(context.getNoBackupFilesDir(),"exports"),path==null?null:new File(path));
  if(permission!=null&&context.checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException("SOURCE_PERMISSION_REVOKED");
 }
 static String requiredPermission(String category,String scheme,File exports,File source)throws IOException {
  String permission="contacts".equals(category)?Manifest.permission.READ_CONTACTS:
   "calendar".equals(category)?Manifest.permission.READ_CALENDAR:null;
  // A manually selected VCF/ICS has category files and keeps its explicit SAF read grant.
  if(permission==null||!"file".equals(scheme))return null;
  if(source==null)throw new SecurityException("SOURCE_EXPORT_SCOPE");
  exports=exports.getCanonicalFile();source=source.getCanonicalFile();
  if(!exports.equals(source.getParentFile())||!source.getName().startsWith("ctpa-"))throw new SecurityException("SOURCE_EXPORT_SCOPE");
  return permission;
 }
}
