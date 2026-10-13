package in.chinatech.phoneassistant;

import java.io.*;
import java.util.*;

/** The same production policies used by TransferStore/TransferEngine, with synthetic scope tokens. */
public final class RecoveryStateTest {
 static int assertions;
 static void ok(boolean yes,String message){if(!yes)throw new AssertionError(message);assertions++;}
 public static void main(String[] args)throws Exception {
  if(args.length>0&&"migration".equals(args[0])){for(String sql:TransferSchema.FROM_ONE)System.out.println(Base64.getEncoder().encodeToString(sql.getBytes("UTF-8")));System.out.println(Base64.getEncoder().encodeToString(TransferSchema.RETAIN_ABANDONED.getBytes("UTF-8")));return;}
  if(args.length>0&&"schema".equals(args[0])){for(String sql:new String[]{TransferSchema.ITEMS,TransferSchema.SELECTION,TransferSchema.CATEGORIES,TransferSchema.RECEIPTS,TransferSchema.pageSql(false),TransferSchema.pageSql(true),TransferSchema.COUNTS,TransferSchema.SELECT_ALL,TransferSchema.SELECT_CATEGORY})System.out.println(Base64.getEncoder().encodeToString(sql.getBytes("UTF-8")));return;}
  ok(ResidualPolicy.resolved(ResidualPolicy.Evidence.DELETED),"confirmed deletion clears active partial record");
  ok(ResidualPolicy.resolved(ResidualPolicy.Evidence.MISSING),"explicit absence can clear active partial record");
  ok(!ResidualPolicy.resolved(ResidualPolicy.Evidence.DENIED),"revoked permission retains unknown file");
  ok(!ResidualPolicy.resolved(ResidualPolicy.Evidence.UNKNOWN),"false/null/exception retain unknown file");
  ok("permission-denied".equals(ResidualPolicy.reason(ResidualPolicy.Evidence.DENIED)),"denial does not become missing");
  ok("unconfirmed".equals(ResidualPolicy.reason(ResidualPolicy.Evidence.UNKNOWN)),"unknown does not claim deletion");
  ok(ResidualPolicy.cleanupCurrent(new ResidualPolicy.Access(){public boolean delete(){return true;}public Boolean exists(){throw new AssertionError("successful delete must not query");}})==ResidualPolicy.Evidence.DELETED,"successful current deletion is confirmed without further access");
  ok(ResidualPolicy.cleanupCurrent(access(false,false,null))==ResidualPolicy.Evidence.MISSING,"delete false plus explicit provider absence is missing");
  ok(ResidualPolicy.cleanupCurrent(access(false,null,null))==ResidualPolicy.Evidence.UNKNOWN,"null provider query cannot mean missing");
  ok(ResidualPolicy.cleanupCurrent(access(false,true,null))==ResidualPolicy.Evidence.UNKNOWN,"existing unremoved file retained");
  ok(ResidualPolicy.cleanupCurrent(access(false,null,new SecurityException()))==ResidualPolicy.Evidence.DENIED,"revoked provider access cannot mean missing");
  ok(ResidualPolicy.cleanupCurrent(access(false,null,new FileNotFoundException()))==ResidualPolicy.Evidence.UNKNOWN,"provider file-not-found exception alone is not confirmed absence");
  ScanState initial=new ScanState(Collections.emptyMap());
  ok(ScanState.NONE.equals(initial.state())&&!initial.finished(),"initial state is not a completed scan");
  ok(ScanState.NONE.equals(initial.phone()),"manual file selection has no phone coverage");
  ScanState phone=initial.begin(ScanState.PHONE,true);
  ok(ScanState.INCOMPLETE.equals(phone.state())&&!phone.finished(),"phone start remains incomplete after process death");
  ScanState appended=phone.begin("tree:folder-b",false).finish("tree:folder-b",()->{});
  ok(ScanState.INCOMPLETE.equals(appended.phone())&&ScanState.INCOMPLETE.equals(appended.state()),"tree completion preserves interrupted phone fact");
  ok(!appended.finished(),"constructor must not treat interrupted state as completed");
  ScanState tree=initial.begin("tree:folder-a",false);
  ok(ScanState.INCOMPLETE.equals(tree.state()),"tree start is persisted before traversal");
  try{tree.finish("tree:folder-a",()->{throw new IOException("CANCELLED");});throw new AssertionError("cancelled scan completed");}catch(IOException expected){ok(ScanState.INCOMPLETE.equals(tree.state()),"cancel during completion retains incomplete state");}
  ScanState done=tree.finish("tree:folder-a",()->{});
  ok(done.finished()&&ScanState.NONE.equals(done.phone()),"completed directory is not phone scan coverage");
  ScanState phoneDone=phone.finish(ScanState.PHONE,()->{});
  ok(phoneDone.finished()&&ScanState.COMPLETE.equals(phoneDone.phone()),"completed phone fact restores accurately");
  ScanState otherTree=phoneDone.begin("tree:folder-c",false);
  ok(!otherTree.finished()&&ScanState.COMPLETE.equals(otherTree.phone()),"interrupted appended tree preserves phone completion but not whole-index completion");
  ok(otherTree.finish("tree:folder-c",()->{}).finished(),"rescanning same interrupted tree resolves its scope");
  ScanState legacy=new ScanState(Collections.singletonMap("legacy",ScanState.INCOMPLETE));
  ok(!legacy.begin("tree:new",false).finish("tree:new",()->{}).finished(),"legacy interrupted scan cannot be erased by appending a tree");
  ScanState replacement=appended.begin(ScanState.PHONE,true);
  ok(replacement.scopes().size()==1&&ScanState.INCOMPLETE.equals(replacement.phone()),"explicit rescan replaces prior task scopes only");
  ok(!new ScanState(Collections.singletonMap("legacy","unknown")).finished(),"unrecognized restored scope never claims complete");
  System.out.println("{\"kind\":\"production residual and per-scope scan policies JVM evidence; not Android provider/SQLite runtime evidence\",\"assertions\":"+assertions+",\"status\":\"passed\"}");
 }
 static ResidualPolicy.Access access(boolean deleted,Boolean exists,Exception failure){return new ResidualPolicy.Access(){public boolean delete(){return deleted;}public Boolean exists()throws Exception{if(failure!=null)throw failure;return exists;}};}
}
