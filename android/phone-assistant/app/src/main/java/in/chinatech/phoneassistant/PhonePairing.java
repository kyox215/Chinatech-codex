package in.chinatech.phoneassistant;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.JSONObject;

/** Three bounded QR messages; both phones obtain their own role grant before Wi-Fi changes. */
final class PhonePairing {
 final PhoneGate gate;
 PhonePairing(PhoneGate gate){this.gate=gate;}
 JSONObject offer(String directory)throws Exception {
  JSONObject current=gate.current();if(current!=null&&!PhoneGate.terminal(current)){if(!current.getBoolean("receiving"))throw new IOException("GATE_PENDING");return current;}
  gate.check();gate.requireNew();SessionTls tls=new SessionTls(System.currentTimeMillis()+2678460000L);JSONObject task=gate.newTask(true,tls);task.put("transfer",ProtocolCore.token(16));task.put("target",ProtocolCore.token(16));task.put("secret",PhoneGateCore.b64(ProtocolCore.random(32)));task.put("directory",directory);task.put("offerExpires",System.currentTimeMillis()+1800000L);gate.replaceCurrent(task);return task;
 }
 String offerCode(JSONObject t)throws Exception {if(t.has("plan"))return t.optString("output","");String code=String.join("|","CTPA5O",t.getString("transfer"),gate.installation(),t.getString("job"),t.getString("pin"),t.getString("target"),t.getString("secret"),Long.toString(t.getLong("offerExpires")));PhoneGateCore.code(code,"CTPA5O",8);return code;}
 JSONObject respond(String code,String manifest,long count,long bytes)throws Exception {
  String[] o=PhoneGateCore.code(code,"CTPA5O",8);PhoneGateCore.token(o[1]);PhoneGateCore.uuid(o[2]);PhoneGateCore.uuid(o[3]);PhoneGateCore.hashValue(o[4]);PhoneGateCore.token(o[5]);if(PhoneGateCore.un64(o[6],43).length!=32)throw PhoneGateCore.invalid();long expires;try{expires=Long.parseLong(o[7]);}catch(Exception e){throw PhoneGateCore.invalid();}if(expires<System.currentTimeMillis()||expires>System.currentTimeMillis()+1800000L)throw new IOException("EXPIRED");
  JSONObject t=gate.current();if(t!=null&&!PhoneGate.terminal(t)){if(t.getBoolean("receiving")||!code.equals(t.optString("offer")))throw new IOException("GATE_PENDING");if(!t.has("ownPermit"))gate.admit(t);return t;}
  gate.check();gate.requireNew();SessionTls tls=new SessionTls(System.currentTimeMillis()+2678460000L);t=gate.newTask(false,tls);
  PhoneGateCore.Plan p=new PhoneGateCore.Plan(String.join("|","CTPA5P",o[1],o[2],gate.installation(),o[3],t.getString("job"),o[4],tls.pin,o[5],PhoneGateCore.sha(PhoneGateCore.un64(o[6],43)),manifest,Long.toString(count),Long.toString(bytes)));
  t.put("plan",p.encode());t.put("offer",code);t.put("secret",o[6]);t.put("nonce",PhoneGateCore.b64(ProtocolCore.random(32)));gate.replaceCurrent(t);gate.admit(t);return t;
 }
 String responseCode(JSONObject t)throws Exception {String code="CTPA5S|"+PhoneGateCore.b64(t.getString("plan").getBytes(StandardCharsets.UTF_8))+"|"+t.getString("ownPermit");PhoneGateCore.code(code,"CTPA5S",3);return code;}
 JSONObject accept(String code)throws Exception {
  String[] r=PhoneGateCore.code(code,"CTPA5S",3);PhoneGateCore.Plan p=new PhoneGateCore.Plan(PhoneGateCore.utf8(PhoneGateCore.un64(r[1],1200)));JSONObject t=gate.current();if(t==null||!t.getBoolean("receiving")||PhoneGate.terminal(t)&&!"completed".equals(t.optString("terminal")))throw new IOException("GATE_PENDING");
  if(!p.receiver.equals(gate.installation())||!p.receiverJob.equals(t.getString("job"))||!p.receiverPin.equals(t.getString("pin"))||!p.transfer.equals(t.getString("transfer"))||!p.target.equals(t.getString("target"))||!p.secretHash.equals(PhoneGateCore.sha(PhoneGateCore.un64(t.getString("secret"),43)))||t.has("plan")&&!p.encode().equals(t.getString("plan")))throw PhoneGateCore.invalid();
  PhoneGateCore.permit(r[2],t.getString("release"),p.sender,p.senderJob,"send",p.scope(),null,PhoneGate.JSON,PhoneGateCore.trustedKeys(),System.currentTimeMillis()/1000);if(PhoneGate.terminal(t)&&!r[2].equals(t.optString("peerPermit")))throw PhoneGateCore.invalid();t.put("plan",p.encode());t.put("peerPermit",r[2]);gate.put(t);if(!t.has("ownPermit"))gate.admit(t);gate.validate(t,true);return t;
 }
 String finalCode(JSONObject t,ProtocolCore.Pairing transport)throws Exception {gate.validate(t,true);String code="CTPA5F|"+new PhoneGateCore.Plan(t.getString("plan")).scope()+"|"+t.getString("ownPermit")+"|"+PhoneGateCore.b64(transport.encode().getBytes(StandardCharsets.UTF_8));PhoneGateCore.code(code,"CTPA5F",4);t.put("output",code);gate.put(t);return code;}
 JSONObject connect(String code)throws Exception {
  String[] f=PhoneGateCore.code(code,"CTPA5F",4);JSONObject t=gate.current();if(t==null||t.getBoolean("receiving")||PhoneGate.terminal(t))throw new IOException("GATE_PENDING");PhoneGateCore.Plan p=new PhoneGateCore.Plan(t.getString("plan"));if(!p.scope().equals(f[1]))throw PhoneGateCore.invalid();
  PhoneGateCore.permit(f[2],t.getString("release"),p.receiver,p.receiverJob,"receive",p.scope(),null,PhoneGate.JSON,PhoneGateCore.trustedKeys(),System.currentTimeMillis()/1000);ProtocolCore.Pairing transport=ProtocolCore.Pairing.parse(PhoneGateCore.utf8(PhoneGateCore.un64(f[3],1000)),System.currentTimeMillis());if(!p.receiverPin.equals(transport.pin)||!p.transfer.equals(transport.session)||!p.secretHash.equals(PhoneGateCore.sha(transport.secret)))throw PhoneGateCore.invalid();t.put("peerPermit",f[2]);t.put("transport",transport.encode());gate.put(t);gate.validate(t,true);return t;
 }
}
