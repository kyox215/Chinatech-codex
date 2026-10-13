package in.chinatech.smartswitchbridge;
import android.security.keystore.*;
import java.io.IOException;
import java.math.BigInteger;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.*;
import javax.net.ssl.*;
import javax.security.auth.x500.X500Principal;

final class SessionTls implements java.io.Closeable {
 final String alias="ctpa-session-"+ProtocolCore.token(16);
 final SSLContext context; final String pin;
 SessionTls(long expiry)throws Exception {
  KeyPairGenerator gen=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");
  gen.initialize(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY)
   .setAlgorithmParameterSpec(new java.security.spec.ECGenParameterSpec("secp256r1"))
   .setDigests(KeyProperties.DIGEST_SHA256,KeyProperties.DIGEST_NONE).setCertificateSubject(new X500Principal("CN=ChinaTech temporary phone transfer"))
   .setCertificateSerialNumber(new BigInteger(1,ProtocolCore.random(16)))
   .setCertificateNotBefore(new Date(System.currentTimeMillis()-60000)).setCertificateNotAfter(new Date(expiry+60000)).build());
  gen.generateKeyPair();
  try {KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);X509Certificate cert=(X509Certificate)ks.getCertificate(alias);cert.checkValidity();cert.verify(cert.getPublicKey());pin=ProtocolCore.hex(ProtocolCore.sha256(cert.getEncoded()));
   KeyManager[] restricted=new KeyManager[]{new SessionKeyManager(ks,alias)};context=SSLContext.getInstance("TLS");context.init(restricted,null,new SecureRandom());
  } catch(Exception e){close();throw e;}
 }
 /** Restrict TLS selection to this temporary session identity. */
 private static final class SessionKeyManager extends X509ExtendedKeyManager {
  private final String alias;private final PrivateKey key;private final X509Certificate[] chain;
  SessionKeyManager(KeyStore store,String name)throws Exception{alias=name;key=(PrivateKey)store.getKey(name,null);java.security.cert.Certificate[] certificates=store.getCertificateChain(name);if(certificates==null||certificates.length==0||key==null)throw new IOException("TLS_UNAVAILABLE");chain=new X509Certificate[certificates.length];for(int i=0;i<chain.length;i++)chain[i]=(X509Certificate)certificates[i];}
  private boolean allowed(String type){return type!=null&&(type.equals("EC")||type.startsWith("EC_"));}
  public String[] getClientAliases(String type,Principal[] issuers){return null;}
  public String chooseClientAlias(String[] types,Principal[] issuers,java.net.Socket socket){return null;}
  public String[] getServerAliases(String type,Principal[] issuers){return allowed(type)?new String[]{alias}:null;}
  public String chooseServerAlias(String type,Principal[] issuers,java.net.Socket socket){return allowed(type)?alias:null;}
  public String chooseEngineServerAlias(String type,Principal[] issuers,SSLEngine engine){return allowed(type)?alias:null;}
  public X509Certificate[] getCertificateChain(String name){return alias.equals(name)?chain.clone():null;}
  public PrivateKey getPrivateKey(String name){return alias.equals(name)?key:null;}
 }
 static SSLContext pinned(String pin)throws Exception {SSLContext c=SSLContext.getInstance("TLS");c.init(null,new TrustManager[]{new PinnedTrust(pin)},new SecureRandom());return c;}
 static String[] protocols(String[] supported)throws IOException {List<String> p=new ArrayList<>();for(String s:supported)if(s.equals("TLSv1.3")||s.equals("TLSv1.2"))p.add(s);if(p.isEmpty())throw new IOException("TLS_UNAVAILABLE");return p.toArray(new String[0]);}
 public void close(){try{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);k.deleteEntry(alias);}catch(Exception ignored){/* No credentials in logs. Best effort cleanup is reported separately by stop state. */}}
 static void cleanupAbandoned()throws Exception {KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);Enumeration<String> a=k.aliases();while(a.hasMoreElements()){String n=a.nextElement();if(n.startsWith("ctpa-session-"))k.deleteEntry(n);}}
}
