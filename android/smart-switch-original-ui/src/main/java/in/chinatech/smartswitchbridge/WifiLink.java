package in.chinatech.smartswitchbridge;

import android.content.*;
import android.net.*;
import android.net.wifi.*;
import android.os.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/** Public Wi-Fi APIs only. No local MAC, hidden hotspot API, DNS, or process-wide binding. */
final class WifiLink {
 interface Callback {void ready();void failed();}
 interface FailureListener {void failed(IOException error);}
 private final Context context;
 private final FailureListener failures;
 private final Handler main=new Handler(Looper.getMainLooper());
 private volatile WifiManager.LocalOnlyHotspotReservation reservation;
 private ConnectivityManager.NetworkCallback callback;
 private volatile Network network;
 private volatile String connectedHost;
 private volatile boolean externalHotspot;
 volatile String ssid,password,security,host;
 volatile String lastFailure="";
 private volatile int generation;
 WifiLink(Context context){this(context,error->{});}
 WifiLink(Context context,FailureListener failures){this.context=context;this.failures=failures;}
 boolean hotspotActive(){return reservation!=null||externalHotspot;}
 boolean manuallyConfigured(){return externalHotspot;}
 synchronized void configureExternalHotspot(String name,String pass)throws IOException{ProtocolCore.validateHotspot(name,pass,"wpa2");close();externalHotspot=true;ssid=name;password=pass;security="wpa2";host=ProtocolCore.GATEWAY_HOST;}
 boolean connected(){return network!=null;}

 void startHotspot(Callback result){
  close();lastFailure="";final int attempt=++generation;WifiManager wifi=context.getSystemService(WifiManager.class);
  if(wifi==null){result.failed();return;}
  try{wifi.startLocalOnlyHotspot(new WifiManager.LocalOnlyHotspotCallback(){
   @Override public void onStarted(WifiManager.LocalOnlyHotspotReservation value){
    if(attempt!=generation){value.close();return;}
    try{
     String name,pass,type;
     if(Build.VERSION.SDK_INT>=30){SoftApConfiguration config=value.getSoftApConfiguration();if(config==null)throw new IOException("HOTSPOT");name=config.getSsid();pass=config.getPassphrase();int mode=config.getSecurityType();type=mode==SoftApConfiguration.SECURITY_TYPE_WPA2_PSK?"wpa2":mode==SoftApConfiguration.SECURITY_TYPE_WPA3_SAE?"wpa3":mode==SoftApConfiguration.SECURITY_TYPE_WPA3_SAE_TRANSITION?"wpa3-transition":"unsupported";}
     else{WifiConfiguration config=value.getWifiConfiguration();if(config==null)throw new IOException("HOTSPOT");name=config.SSID;pass=config.preSharedKey;type="wpa2";}
     ProtocolCore.validateHotspot(name,pass,type);
     synchronized(WifiLink.this){if(attempt!=generation){value.close();return;}reservation=value;ssid=name;password=pass;security=type;host=ProtocolCore.GATEWAY_HOST;}
     result.ready();
    }catch(Exception error){lastFailure=error.getClass().getSimpleName()+":"+String.valueOf(error.getMessage());value.close();failHotspot(attempt,result);}
   }
   @Override public void onStopped(){if(attempt==generation)lastFailure="STOPPED";failHotspot(attempt,result);}
   @Override public void onFailed(int reason){if(attempt==generation)lastFailure="SYSTEM_"+reason;failHotspot(attempt,result);}
  },main);}catch(RuntimeException error){failHotspot(attempt,result);}
  main.postDelayed(()->{if(attempt==generation&&reservation==null)failHotspot(attempt,result);},30000);
 }
 private void failHotspot(int attempt,Callback result){synchronized(this){if(attempt!=generation)return;close();}result.failed();}
 void setHostManually(String value)throws IOException {if(reservation==null)throw new IOException("HOTSPOT");ProtocolCore.validateHost(value);if(!addresses().contains(value))throw new IOException("HOST_NOT_LOCAL");host=value;}

 /** API29+ system consent joins the exact SSID; returned sockets stay on this Network. */
 Network connect(ProtocolCore.Pairing pair,ProtocolCore.Check check)throws Exception {
  if(Build.VERSION.SDK_INT<29)throw new IOException("MANUAL_WIFI");ProtocolCore.validateHotspot(pair.ssid,pair.password,pair.security);disconnect();final int attempt=++generation;
  WifiNetworkSpecifier.Builder spec=new WifiNetworkSpecifier.Builder().setSsid(pair.ssid);
  if(pair.security.equals("wpa3"))spec.setWpa3Passphrase(pair.password);else spec.setWpa2Passphrase(pair.password);
  NetworkRequest request=new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).setNetworkSpecifier(spec.build()).build();
  CompletableFuture<Network> ready=new CompletableFuture<>();ConnectivityManager manager=context.getSystemService(ConnectivityManager.class);
  if(manager==null)throw new IOException("WIFI");
  ConnectivityManager.NetworkCallback cb=new ConnectivityManager.NetworkCallback(){
   private void accept(Network n,LinkProperties properties){
    if(attempt!=generation)return;
    try{String target=targetHost(pair,properties);boolean changed=false;synchronized(WifiLink.this){if(attempt!=generation)return;if(network!=null&&network.equals(n)&&connectedHost!=null&&!connectedHost.equals(target))changed=true;else{network=n;connectedHost=target;ready.complete(n);}}if(changed)lost(n);}
    catch(IOException error){if(network!=null&&network.equals(n))lost(n);else if(!"WIFI_GATEWAY".equals(error.getMessage()))ready.completeExceptionally(error);}
    catch(RuntimeException error){ready.completeExceptionally(new IOException("WIFI",error));if(network!=null&&network.equals(n))lost(n);}
   }
   private void lost(Network n){boolean wasConnected=false;synchronized(WifiLink.this){if(attempt!=generation)return;if(network!=null&&network.equals(n)){wasConnected=true;network=null;connectedHost=null;}}IOException error=new IOException("WIFI");ready.completeExceptionally(error);if(wasConnected)failures.failed(error);}
   @Override public void onAvailable(Network n){if(attempt!=generation)return;try{LinkProperties p=manager.getLinkProperties(n);if(p!=null)accept(n,p);}catch(RuntimeException error){ready.completeExceptionally(new IOException("WIFI",error));}}
   @Override public void onLinkPropertiesChanged(Network n,LinkProperties p){accept(n,p);}
   @Override public void onUnavailable(){if(attempt==generation)ready.completeExceptionally(new IOException("WIFI"));}
   @Override public void onLost(Network n){lost(n);}
  };
  synchronized(this){if(attempt!=generation)throw new IOException("CANCELLED");callback=cb;}
  long deadline=SystemClock.elapsedRealtime()+120000;
  try{synchronized(this){if(attempt!=generation)throw new IOException("CANCELLED");manager.requestNetwork(request,cb,120000);}while(SystemClock.elapsedRealtime()<deadline){check.check();if(attempt!=generation)throw new IOException("CANCELLED");try{return ready.get(500,TimeUnit.MILLISECONDS);}catch(TimeoutException ignored){}}throw new IOException("WIFI");}
  catch(Exception error){disconnect();if(error instanceof ExecutionException&&error.getCause() instanceof Exception)throw (Exception)error.getCause();throw error;}
 }
 private static boolean onLink(LinkProperties properties,String host){try{InetAddress target=InetAddress.getByName(host);for(RouteInfo route:properties.getRoutes())if(!route.isDefaultRoute()&&route.matches(target))return true;}catch(Exception ignored){}return false;}
 private static String targetHost(ProtocolCore.Pairing pair,LinkProperties properties)throws IOException {
  if(pair.usesGateway()){
   String dhcp=null;if(Build.VERSION.SDK_INT>=30&&properties.getDhcpServerAddress()!=null)dhcp=properties.getDhcpServerAddress().getHostAddress();
   List<String> gateways=new ArrayList<>();for(RouteInfo route:properties.getRoutes())if(route.isDefaultRoute()&&route.getGateway() instanceof Inet4Address)gateways.add(route.getGateway().getHostAddress());
   return ProtocolCore.selectGateway(dhcp,gateways,target->onLink(properties,target));
  }
  ProtocolCore.validateHost(pair.host);if(!onLink(properties,pair.host))throw new IOException("WIFI_GATEWAY");return pair.host;
 }
 /** API26–28 uses the Wi-Fi the user joined, and its real DHCP/default gateway. */
 void useExistingNetwork(ProtocolCore.Pairing pair)throws Exception {
  disconnect();final int attempt=++generation;ConnectivityManager manager=context.getSystemService(ConnectivityManager.class);if(manager==null)throw new IOException("WIFI");
  if(!pair.ssid.isEmpty()){
   WifiManager wifi=context.getSystemService(WifiManager.class);WifiInfo info=null;try{info=wifi==null?null:wifi.getConnectionInfo();}catch(SecurityException unavailable){}String joined=info==null?null:info.getSSID();
   if(joined!=null&&!joined.equals(WifiManager.UNKNOWN_SSID)&&!pair.ssid.equals(unquote(joined)))throw new IOException("WIFI");
  }
  Network found=null;String target=null;
  for(Network n:manager.getAllNetworks()){
   NetworkCapabilities caps=manager.getNetworkCapabilities(n);LinkProperties properties=manager.getLinkProperties(n);if(caps==null||properties==null||!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)||caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN))continue;
   String candidate;try{candidate=targetHost(pair,properties);}catch(IOException unavailable){continue;}
   if(found!=null)throw new IOException("WIFI");found=n;target=candidate;
  }
  if(found==null)throw new IOException("WIFI");final Network chosen=found;final String chosenHost=target;
  ConnectivityManager.NetworkCallback cb=new ConnectivityManager.NetworkCallback(){
   @Override public void onLost(Network n){boolean lost=false;synchronized(WifiLink.this){if(attempt==generation&&chosen.equals(n)){network=null;connectedHost=null;lost=true;}}if(lost)failures.failed(new IOException("WIFI"));}
   @Override public void onLinkPropertiesChanged(Network n,LinkProperties p){if(attempt!=generation||!chosen.equals(n))return;try{if(!chosenHost.equals(targetHost(pair,p)))onLost(n);}catch(IOException lost){onLost(n);}}
  };
  try{synchronized(this){if(attempt!=generation)throw new IOException("CANCELLED");network=chosen;connectedHost=chosenHost;callback=cb;manager.registerNetworkCallback(new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build(),cb);}}catch(RuntimeException error){disconnect();throw error;}
 }
 private static String unquote(String value){return value.length()>=2&&value.startsWith("\"")&&value.endsWith("\"")?value.substring(1,value.length()-1):value;}
 String resolvedHost(ProtocolCore.Pairing pair)throws IOException {String value=connectedHost;if(network==null||value==null)throw new IOException("WIFI");ProtocolCore.validateHost(value);if(!pair.usesGateway()&&!pair.host.equals(value))throw new IOException("WIFI");return value;}
 Network currentNetwork(){return network;}
 List<String> localAddresses(){return new ArrayList<>(addresses());}
 private static Set<String> addresses(){Set<String> result=new LinkedHashSet<>();try{Enumeration<NetworkInterface> interfaces=NetworkInterface.getNetworkInterfaces();while(interfaces.hasMoreElements()){NetworkInterface ni=interfaces.nextElement();if(!ni.isUp()||ni.isLoopback()||ni.isVirtual())continue;Enumeration<InetAddress> addresses=ni.getInetAddresses();while(addresses.hasMoreElements()){String h=addresses.nextElement().getHostAddress();try{ProtocolCore.validateHost(h);result.add(h);}catch(IOException ignored){}}}}catch(Exception ignored){}return result;}
 synchronized void disconnect(){generation++;ConnectivityManager.NetworkCallback cb=callback;callback=null;network=null;connectedHost=null;if(cb!=null)try{ConnectivityManager m=context.getSystemService(ConnectivityManager.class);if(m!=null)m.unregisterNetworkCallback(cb);}catch(RuntimeException ignored){}}
 synchronized void close(){disconnect();externalHotspot=false;WifiManager.LocalOnlyHotspotReservation value=reservation;reservation=null;if(value!=null)try{value.close();}catch(RuntimeException ignored){}ssid=null;password=null;security=null;host=null;}
}
