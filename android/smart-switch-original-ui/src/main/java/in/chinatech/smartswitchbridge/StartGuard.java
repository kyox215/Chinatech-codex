package in.chinatech.smartswitchbridge;

/** Used for both the immediate service request and Android's deferred foreground promotion. */
final class StartGuard {
 static boolean run(Runnable action,Runnable failure){try{action.run();return true;}catch(RuntimeException e){failure.run();return false;}}
 private StartGuard(){}
}
