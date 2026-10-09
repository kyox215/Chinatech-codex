package in.chinatech.mimoverengine;
public final class GrantActivity extends android.app.Activity {
 @Override public void onCreate(android.os.Bundle state){super.onCreate(state);android.net.Uri tree=android.provider.DocumentsContract.buildTreeDocumentUri("in.chinatech.mimoverruntimetest.documents","root");grantUriPermission("com.miui.huanji.chinatech",tree,android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION|android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION|android.content.Intent.FLAG_GRANT_PREFIX_URI_PERMISSION|android.content.Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);finish();}
}
