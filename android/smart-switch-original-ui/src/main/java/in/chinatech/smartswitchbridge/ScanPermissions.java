package in.chinatech.smartswitchbridge;
import java.util.*;
/** Runtime scan permissions, independent of Android for regression testing. */
final class ScanPermissions {
 static String[] media(int sdk){if(sdk<=32)return new String[]{"android.permission.READ_EXTERNAL_STORAGE"};List<String> p=new ArrayList<>(Arrays.asList("android.permission.READ_MEDIA_IMAGES","android.permission.READ_MEDIA_VIDEO","android.permission.READ_MEDIA_AUDIO"));if(sdk>=34)p.add("android.permission.READ_MEDIA_VISUAL_USER_SELECTED");return p.toArray(new String[0]);}
 private ScanPermissions(){}
}
