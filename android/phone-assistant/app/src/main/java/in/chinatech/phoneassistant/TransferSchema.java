package in.chinatech.phoneassistant;

/** Additive migration: old object identities, selected items, receipts and unknown residuals survive. */
final class TransferSchema {
 static final int VERSION=2;
 static final int PAGE=50;
 static final String ITEMS="CREATE TABLE items(n INTEGER PRIMARY KEY AUTOINCREMENT,uri TEXT UNIQUE NOT NULL,object TEXT UNIQUE NOT NULL,category TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,hash BLOB,selected INTEGER NOT NULL DEFAULT 0)";
 static final String SELECTION="CREATE INDEX selection ON items(selected,n)",CATEGORIES="CREATE INDEX categories ON items(category,selected,n)";
 static final String RECEIPTS="CREATE TABLE receipts(transfer TEXT NOT NULL,object TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,hash BLOB NOT NULL,dest TEXT NOT NULL,directory TEXT NOT NULL,PRIMARY KEY(transfer,object))";
 static final String COUNTS="SELECT category,count(*),sum(selected) FROM items GROUP BY category";
 static final String SELECT_ALL="UPDATE items SET selected=?",SELECT_CATEGORY="UPDATE items SET selected=? WHERE category=?";
 static String pageSql(boolean category){return "SELECT n,uri,object,name,mime,size,hash,selected,category FROM items WHERE n>?"+(category?" AND category=?":"")+" ORDER BY n LIMIT "+PAGE;}
 static final String RESIDUALS="CREATE TABLE residuals(token TEXT PRIMARY KEY,transfer TEXT NOT NULL,object TEXT NOT NULL,dest TEXT NOT NULL,directory TEXT NOT NULL,reason TEXT NOT NULL)";
 static final String SCOPES="CREATE TABLE scan_scopes(scope TEXT PRIMARY KEY,state TEXT NOT NULL)";
 static final String RETAIN_ABANDONED="INSERT INTO residuals SELECT lower(hex(randomblob(16))),transfer,object,dest,directory,CASE WHEN directory='' THEN 'legacy-scope-unknown' ELSE 'interrupted' END FROM pending";
 static final String[] FROM_ONE={
  "ALTER TABLE pending ADD COLUMN directory TEXT NOT NULL DEFAULT ''",
  RESIDUALS,
  "INSERT INTO residuals SELECT lower(hex(randomblob(16))),transfer,object,dest,directory,'legacy-scope-unknown' FROM pending",
  "DELETE FROM pending",
  SCOPES,
  "INSERT INTO scan_scopes SELECT 'legacy',v FROM meta WHERE k='scanState' AND v IN ('incomplete','complete')"
 };
 private TransferSchema(){}
}
