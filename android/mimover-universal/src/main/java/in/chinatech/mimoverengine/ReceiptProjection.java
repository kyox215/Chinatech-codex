package in.chinatech.mimoverengine;

import java.util.*;
/** UI counts only verified SAVED acknowledgments, never preparation or retry counters. */
final class ReceiptProjection {
 private final Set<String> acknowledged=new HashSet<>(), received=new HashSet<>();
 private final Map<String,Long> categories=new HashMap<>();
 synchronized void clear(){acknowledged.clear();received.clear();categories.clear();}
 synchronized void receivingPass(){received.clear();categories.clear();}
 synchronized void acknowledged(String object){acknowledged.add(object);}
 synchronized long acknowledged(){return acknowledged.size();}
 synchronized void received(ProtocolCore.Item item){
  if(!received.add(item.id))return;
  String category=item.mime.startsWith("image/")?"photos":item.mime.startsWith("video/")?"videos":item.mime.startsWith("audio/")?"audio":RestoreCatalog.kind(item);
  if(category.equals("media"))category="files";
  categories.merge(category,1L,Long::sum);
 }
 synchronized long category(String kind){Long n=categories.get(kind);return n==null?0:n;}
}
