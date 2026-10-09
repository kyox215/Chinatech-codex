package in.chinatech.phoneassistant;

/** Android 12 precise-location requests require the paired coarse declaration/request. */
final class WifiPermissions {
 static String[] requestFor(int sdk) {
  return sdk>=33 ? new String[]{"android.permission.NEARBY_WIFI_DEVICES"}
   : new String[]{"android.permission.ACCESS_FINE_LOCATION","android.permission.ACCESS_COARSE_LOCATION"};
 }
 private WifiPermissions(){}
}
