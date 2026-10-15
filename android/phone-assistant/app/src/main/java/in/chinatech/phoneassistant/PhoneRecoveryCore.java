package in.chinatech.phoneassistant;
import java.io.IOException;import java.util.*;
/** Original journal bindings are checked before recovering an unknown admission result. */
final class PhoneRecoveryCore {
 private PhoneRecoveryCore(){}
 static PhoneGateCore.Plan identity(Map<String,Object> task,String installation)throws IOException {
  String id=PhoneGateCore.string(task,"id",36),job=PhoneGateCore.string(task,"job",36),pin=PhoneGateCore.string(task,"pin",64),alias=PhoneGateCore.string(task,"tls",100),release=PhoneGateCore.string(task,"release",96),version=PhoneGateCore.string(task,"version",96);PhoneGateCore.uuid(id);PhoneGateCore.uuid(job);PhoneGateCore.hashValue(pin);PhoneGateCore.release(release);
  if(version.isEmpty()||!alias.matches("ctpa-session-[A-Za-z0-9_-]{22}")||!(task.get("receiving") instanceof Boolean))throw PhoneGateCore.invalid();PhoneGateCore.Plan plan=new PhoneGateCore.Plan(PhoneGateCore.string(task,"plan",900));boolean receiving=(Boolean)task.get("receiving");if(!installation.equals(plan.ownId(receiving))||!job.equals(plan.ownJob(receiving))||!pin.equals(plan.ownPin(receiving)))throw PhoneGateCore.invalid();
  boolean request=task.containsKey("startRequest"),nonce=task.containsKey("startNonce");if(request!=nonce)throw PhoneGateCore.invalid();if(request){PhoneGateCore.uuid(PhoneGateCore.string(task,"startRequest",36));if(PhoneGateCore.un64(PhoneGateCore.string(task,"startNonce",43),43).length!=32)throw PhoneGateCore.invalid();}return plan;
 }
 static void frozen(Map<String,Object> original,Map<String,Object> pending)throws IOException {
  if(original==null)throw PhoneGateCore.invalid();for(String field:new String[]{"id","job","plan","receiving","version","release","tls","pin"})if(!original.containsKey(field)||!Objects.equals(original.get(field),pending.get(field)))throw PhoneGateCore.invalid();
  for(String field:new String[]{"startRequest","startNonce","peerPermit"})if(original.containsKey(field)&&!Objects.equals(original.get(field),pending.get(field)))throw PhoneGateCore.invalid();
  if(!Objects.equals(original.get("terminal"),pending.get("terminal")))throw new IOException("GATE_TERMINAL");
 }
 static boolean canStartOriginal(Map<String,Object> task){return PhoneGateCore.RELEASE.equals(task.get("release"))&&PhoneGateCore.VERSION.equals(task.get("version"));}
}
