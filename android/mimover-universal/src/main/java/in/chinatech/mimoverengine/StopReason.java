package in.chinatech.mimoverengine;
/** A later generic cancellation cannot erase a recorded failure reason. */
final class StopReason {
 static int keep(int current,int proposed,int cancelled){return current!=0&&proposed==cancelled?current:proposed;}
 private StopReason(){}
}
