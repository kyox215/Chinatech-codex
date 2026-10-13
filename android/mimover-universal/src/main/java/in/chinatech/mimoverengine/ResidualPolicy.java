package in.chinatech.mimoverengine;

/** Provider evidence is distinct from permission denial or an indeterminate response. */
final class ResidualPolicy {
 enum Evidence { DELETED, MISSING, DENIED, UNKNOWN }
 interface Access {boolean delete()throws Exception;Boolean exists()throws Exception;}
 static Evidence cleanupCurrent(Access access){try{if(access.delete())return Evidence.DELETED;Boolean exists=access.exists();if(Boolean.FALSE.equals(exists))return Evidence.MISSING;}catch(SecurityException denied){return Evidence.DENIED;}catch(Exception unknown){}return Evidence.UNKNOWN;}
 static boolean resolved(Evidence evidence){return evidence==Evidence.DELETED||evidence==Evidence.MISSING;}
 static String reason(Evidence evidence){return evidence==Evidence.DENIED?"permission-denied":"unconfirmed";}
 private ResidualPolicy(){}
}
