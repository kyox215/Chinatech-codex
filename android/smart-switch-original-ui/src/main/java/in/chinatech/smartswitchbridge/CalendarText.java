package in.chinatech.smartswitchbridge;
import java.io.IOException;
/** Recurrence syntax is not escaped as display text; rejects line injection rather than corrupting RRULE. */
final class CalendarText {static String rule(String value)throws IOException{if(value==null||value.indexOf('\r')>=0||value.indexOf('\n')>=0||value.indexOf('\0')>=0)throw new IOException("CALENDAR");return value;}private CalendarText(){}}
