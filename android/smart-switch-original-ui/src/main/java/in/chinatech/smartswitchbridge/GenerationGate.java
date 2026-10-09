package in.chinatech.smartswitchbridge;

/** Invalidated results cannot replace newer input, including after cancellation/lifecycle changes. */
final class GenerationGate {
 private long generation;
 synchronized long next(){return ++generation;}
 synchronized boolean current(long value){return value==generation;}
}
