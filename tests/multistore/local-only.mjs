import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const c=JSON.parse(readFileSync('.local/backend/connection.private.json','utf8')),env=JSON.parse(readFileSync('.local/backend/env.private.json','utf8'));
for(const [value,port]of[[c.API_URL,'55421'],[c.DB_URL,'55422'],[env.APP_DATABASE_URL,'55422'],[env.SUPABASE_URL,'55421']]){const target=new URL(value);assert.equal(target.hostname,'127.0.0.1','Tests accept only the existing local isolated stack');assert.equal(target.port,port);}

export const origin=process.env.MULTISTORE_ORIGIN||'http://127.0.0.1:3117';
const testOrigin=new URL(origin);assert.ok(['127.0.0.1','localhost'].includes(testOrigin.hostname),'Integration origin must be loopback');assert.ok(['http:','https:'].includes(testOrigin.protocol));
