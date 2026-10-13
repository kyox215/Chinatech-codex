package in.chinatech.phoneassistant;

/** Permission callbacks may only consume the exact pending selection, including after Activity recreation. */
final class ScanConsent {
 private boolean[] pending;
 void request(boolean[] selected){if(selected==null||selected.length!=3)throw new IllegalArgumentException("SCAN_SCOPE");pending=selected.clone();}
 void restore(boolean[] selected){pending=selected!=null&&selected.length==3?selected.clone():null;}
 boolean[] saved(){return pending==null?null:pending.clone();}
 boolean[] consume(){boolean[] selected=saved();pending=null;return selected;}
}
