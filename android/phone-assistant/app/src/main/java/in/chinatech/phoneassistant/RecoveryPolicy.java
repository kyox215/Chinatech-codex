package in.chinatech.phoneassistant;
import java.io.*;import java.net.*;
/** Retry broken transport only; integrity, denied permissions and full disks require user attention. */
final class RecoveryPolicy {static final int MAX_RETRIES=5;static boolean retryable(Exception e){return e instanceof SocketException||e instanceof SocketTimeoutException||e instanceof EOFException||"WIFI".equals(e.getMessage());}static long delay(int attempt){return Math.min(10000,1000L<<Math.min(4,Math.max(0,attempt-1)));}private RecoveryPolicy(){}}
