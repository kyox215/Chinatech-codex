"""Production SQL on desktop SQLite with synthetic data; not Android runtime evidence."""
from pathlib import Path
import base64,json,sqlite3,sys

def read_sql(path):
 return [base64.b64decode(line).decode() for line in Path(path).read_text().splitlines()]
statements=read_sql(sys.argv[1])
items,selection,categories,receipts,page,category_page,counts,select_all,select_category=read_sql(sys.argv[2])
db=sqlite3.connect(':memory:')
for sql in [items,selection,categories,receipts]: db.execute(sql)
db.executescript('''
CREATE TABLE sending(n INTEGER PRIMARY KEY,uri TEXT NOT NULL,object TEXT UNIQUE NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,hash BLOB NOT NULL);
CREATE TABLE pending(transfer TEXT NOT NULL,object TEXT NOT NULL,dest TEXT NOT NULL,PRIMARY KEY(transfer,object));
CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
INSERT INTO pending VALUES('task','failed','synthetic-unknown');
INSERT INTO meta VALUES('transfer','task');
INSERT INTO meta VALUES('scanState','incomplete');
''')
with db:
 db.executemany('INSERT INTO items(uri,object,category,name,mime,size) VALUES(?,?,?,?,?,?)',(('synthetic-source-'+str(n),'object-'+str(n),'photos' if n%3==0 else 'files','fixture-'+str(n),'text/plain',n) for n in range(1,10018)))
 db.execute('INSERT INTO sending VALUES(?,?,?,?,?,?,?)',(1,'synthetic-source-1','object-1','fixture-1','text/plain',1,bytes(32)))
 db.execute('INSERT INTO receipts VALUES(?,?,?,?,?,?,?,?)',('task','saved','saved.txt','text/plain',1,bytes(32),'synthetic-saved','old-scope'))
 db.execute(select_category,(1,'photos'))
assertions=0
def check(value):
 global assertions
 assert value
 assertions+=1

def paged(sql,args):
 result=[];after=0
 while True:
  rows=db.execute(sql,(after,)+args).fetchall()
  if not rows: return result
  assert len(rows)<=50
  result.extend(rows);after=rows[-1][0]

before="\n".join(db.iterdump())
with db:
 db.execute('BEGIN')
 for sql in statements[:-1]: db.execute(sql)
# Actual production disk index and page queries cover every row above the former 10,000 ceiling.
rows=paged(page,())
check(len(rows)==10017 and len({r[0] for r in rows})==10017)
check(rows[0][0]==1 and rows[-1][0]==10017)
photos=paged(category_page,('photos',))
check(len(photos)==3339 and all(r[8]=='photos' for r in photos))
check(all(r[7]==1 for r in photos))
check(sum(r[7] for r in rows)==3339)
check(db.execute('SELECT selected FROM items WHERE n=?',(10017,)).fetchone()[0]==1)
check({r[0]:(r[1],r[2]) for r in db.execute(counts)}=={'files':(6678,0),'photos':(3339,3339)})
check(db.execute('SELECT uri,object,category,name,mime,size FROM items WHERE n=1').fetchone()==('synthetic-source-1','object-1','files','fixture-1','text/plain',1))
check(db.execute('SELECT n,uri,object,name,mime,size,hash FROM sending').fetchone()==(1,'synthetic-source-1','object-1','fixture-1','text/plain',1,bytes(32)))
check(db.execute('SELECT * FROM receipts').fetchone()==('task','saved','saved.txt','text/plain',1,bytes(32),'synthetic-saved','old-scope'))
check(db.execute("SELECT v FROM meta WHERE k='transfer'").fetchone()[0]=='task')
legacy=db.execute('SELECT * FROM residuals').fetchone()
check(len(legacy[0])==32 and legacy[1:]==('task','failed','synthetic-unknown','','legacy-scope-unknown'))
check(db.execute('SELECT count(*) FROM pending').fetchone()[0]==0)
check(db.execute('SELECT * FROM scan_scopes').fetchone()==('legacy','incomplete'))
with db: db.execute(select_all,(1,))
check(sum(r[2] for r in db.execute(counts))==10017)
check(db.execute('SELECT count(*) FROM items WHERE n>50 AND selected=1').fetchone()[0]==9967)
# Same task/object may receive a newly created destination in a new or the same scope.
for scope in ['new-scope','old-scope']:
 with db:
  db.execute('INSERT INTO pending VALUES(?,?,?,?)',('task','failed','new-'+scope,scope))
  db.execute(statements[-1])
  db.execute('DELETE FROM pending')
 check(db.execute('SELECT * FROM residuals WHERE token=?',(legacy[0],)).fetchone()==legacy)
 check(db.execute('SELECT directory,reason FROM residuals WHERE dest=?',('new-'+scope,)).fetchone()==(scope,'interrupted'))
 check(db.execute('SELECT count(*) FROM pending').fetchone()[0]==0)
# Clear selection/task indexes retains all residual facts and completed receipts.
with db:
 for table in ['items','sending','scan_scopes']: db.execute('DELETE FROM '+table)
check(db.execute('SELECT count(*) FROM residuals').fetchone()[0]==3)
check(db.execute('SELECT count(*) FROM receipts').fetchone()[0]==1)
# A transaction interrupted between scope/meta writes preserves the incomplete fact.
with db: db.execute("INSERT INTO scan_scopes VALUES('phone','incomplete')")
try:
 with db:
  db.execute("UPDATE scan_scopes SET state='complete' WHERE scope='phone'")
  db.execute("UPDATE meta SET v='complete' WHERE k='scanState'")
  raise RuntimeError('synthetic cancellation before commit')
except RuntimeError: pass
check(db.execute('SELECT state FROM scan_scopes WHERE scope=?',('phone',)).fetchone()[0]=='incomplete')
check(db.execute("SELECT v FROM meta WHERE k='scanState'").fetchone()[0]=='incomplete')
rollback=sqlite3.connect(':memory:');rollback.executescript(before)
try:
 with rollback:
  rollback.execute('BEGIN')
  for sql in statements[:-1]: rollback.execute(sql)
  raise RuntimeError('synthetic upgrade interruption')
except RuntimeError: pass
check('directory' not in [row[1] for row in rollback.execute('PRAGMA table_info(pending)')])
check(rollback.execute("SELECT count(*) FROM sqlite_master WHERE name='residuals'").fetchone()[0]==0)
check(rollback.execute('SELECT * FROM pending').fetchone()==('task','failed','synthetic-unknown'))
check(rollback.execute('SELECT count(*),sum(selected) FROM items').fetchone()==(10017,3339))
print(json.dumps({'kind':'production additive migration and 10017-item/50-row pagination/category/all-selection SQL executed on desktop SQLite; not Android SQLite/provider runtime evidence','assertions':assertions,'status':'passed'}))
