package in.chinatech.phoneassistant;
import java.io.IOException;
/** Only unapproved admission expires. Approval is still tied to one nonce/task by the engine. */
final class JoinPolicy {static void check(boolean approved,long expires,long monotonicDeadline,long now,long monotonicNow)throws IOException{if(!approved&&(expires<=now||monotonicDeadline<=monotonicNow))throw new IOException("EXPIRED");}private JoinPolicy(){}}
