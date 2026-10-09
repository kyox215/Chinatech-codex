package in.chinatech.mimoverengine;

import java.util.*;
import java.io.IOException;

/** Each authorized traversal retains its own interruption fact until that scope is completed. */
final class ScanState {
 static final String NONE="none",INCOMPLETE="incomplete",COMPLETE="complete",PHONE="phone";
 private final Map<String,String> scopes;
 ScanState(Map<String,String> scopes){this.scopes=new LinkedHashMap<>(scopes);}
 ScanState begin(String scope,boolean replace){Map<String,String> next=replace?new LinkedHashMap<>():new LinkedHashMap<>(scopes);next.put(scope,INCOMPLETE);return new ScanState(next);}
 ScanState finish(String scope,ProtocolCore.Check check)throws IOException {check.check();if(!INCOMPLETE.equals(scopes.get(scope)))throw new IllegalStateException("Scan not started");Map<String,String> next=new LinkedHashMap<>(scopes);next.put(scope,COMPLETE);return new ScanState(next);}
 String state(){for(String value:scopes.values())if(!COMPLETE.equals(value))return INCOMPLETE;return scopes.isEmpty()?NONE:COMPLETE;}
 String phone(){String value=scopes.get(PHONE);return value==null?NONE:value;}
 boolean finished(){return COMPLETE.equals(state());}
 Map<String,String> scopes(){return Collections.unmodifiableMap(scopes);}
 private ScanState() {this(Collections.emptyMap());}
}
