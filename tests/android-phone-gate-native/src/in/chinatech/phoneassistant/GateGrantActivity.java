package in.chinatech.phoneassistant;
/** Only the separately installed test APK grants access to its synthetic provider. */
public final class GateGrantActivity extends android.app.Activity {
 @Override public void onCreate(android.os.Bundle state){super.onCreate(state);android.net.Uri tree=android.provider.DocumentsContract.buildTreeDocumentUri("in.chinatech.phoneassistantgatetest.documents","root");grantUriPermission("in.chinatech.phoneassistant",tree,android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION|android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION|android.content.Intent.FLAG_GRANT_PREFIX_URI_PERMISSION|android.content.Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);finish();}
}
