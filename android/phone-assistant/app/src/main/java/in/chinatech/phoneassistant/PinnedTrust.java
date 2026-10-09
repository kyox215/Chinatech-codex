package in.chinatech.phoneassistant;
import java.security.cert.*;
import javax.net.ssl.X509TrustManager;
/** Intentionally trusts only the precise out-of-band per-session leaf certificate. */
public final class PinnedTrust implements X509TrustManager {
 private final byte[] pin;
 public PinnedTrust(String hex)throws java.io.IOException {pin=ProtocolCore.unhex(hex);}
 public void checkClientTrusted(X509Certificate[] chain,String authType)throws CertificateException {throw new CertificateException("CLIENT_CERT_NOT_USED");}
 public void checkServerTrusted(X509Certificate[] chain,String authType)throws CertificateException {if(chain==null||chain.length!=1)throw new CertificateException("CERT_CHAIN");chain[0].checkValidity();try{if(!ProtocolCore.equal(pin,ProtocolCore.sha256(chain[0].getEncoded())))throw new CertificateException("PIN_MISMATCH");}catch(CertificateEncodingException e){throw new CertificateException("CERT_ENCODING");}}
 public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}
}
