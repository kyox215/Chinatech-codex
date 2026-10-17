// Real isolated Supabase/Auth/Storage/BFF test. Intentionally retains only its
// synthetic fixtures for browser review; never accepts remote databases.
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import postgres from 'postgres';
const c=JSON.parse(readFileSync('.local/backend/connection.private.json','utf8'));
for(const [value,port] of [[c.API_URL,'55421'],[c.DB_URL,'55422']]){const url=new URL(value);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,port);}
mkdirSync('.company-tmp/multistore-pilot-20261017',{recursive:true});
// Repeated local runs retain fixtures. Reserve fixture capacity only in this
// loopback stack, restore the exact operator setting even on failure, and test
// the actual final-slot boundary independently in limits.mjs.
const admin=postgres(c.DB_URL,{max:1});
const [control]=await admin`select max_stores from chinatech_v2_private.pilot_control where singleton`;
const [stores]=await admin`select count(*)::int as count from chinatech_v2.stores`;
try{
 await admin`update chinatech_v2_private.pilot_control set max_stores=${Math.max(control.max_stores,stores.count+4)} where singleton`;
await import('./multistore/admission.mjs');
await import('./multistore/storage.mjs');
await import('./multistore/retail.mjs');
await import('./multistore/security.mjs');
await import('./multistore/limits.mjs');
await import('./multistore/legacy.mjs');
await import('./multistore/upload-race.mjs');
await import('./multistore/rate.mjs');
await import('./multistore/admission-security.mjs');
console.log('PASS isolated multi-store admission, private original storage, quotas and security');

}finally{await admin`update chinatech_v2_private.pilot_control set max_stores=${control.max_stores} where singleton`;await admin.end();}
