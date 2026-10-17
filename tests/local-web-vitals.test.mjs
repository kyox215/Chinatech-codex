import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceLoader} from './helpers/typescript-source.mjs';
const {localWebVitalsEnabled,localWebVital}=sourceLoader()('./lib/local-web-vitals');
const metric={name:'LCP',value:123.5,delta:10.5,rating:'good',navigationType:'navigate'};

test('local numeric measurement defaults off and requires an explicit loopback origin',()=>{
 for(const environment of[{}, {enabled:'true',origin:'http://localhost:3187'}, {enabled:'1'}, {enabled:'1',origin:'https://www.chinatech.in'}, {enabled:'1',origin:'http://localhost.evil.test'}, {enabled:'1',origin:'http://127.0.0.2'}, {enabled:'1',origin:'file:///localhost'}, {enabled:'1',origin:'http://localhost/?measure=1'}, {enabled:'1',origin:'http://localhost/#x'}, {enabled:'1',origin:'http://user:password@localhost'}, {enabled:'1',origin:'http://localhost:3187',vercel:'1'}])assert.equal(localWebVitalsEnabled(environment),false);
 for(const origin of['http://localhost:3187','https://127.0.0.1:3189/','http://[::1]:3187'])assert.equal(localWebVitalsEnabled({enabled:'1',origin}),true);
});
test('local observation selects only finite numeric metrics and fixed enums',()=>{
 for(const name of['TTFB','FCP','LCP','FID','CLS','INP'])assert.deepEqual(localWebVital({...metric,name}),{...metric,name});
 for(const navigationType of['navigate','reload','prerender','back-forward','back-forward-cache','restore'])assert.equal(localWebVital({...metric,navigationType}).navigationType,navigationType);
 for(const bad of[{name:'customer-phone'},{value:NaN},{value:Infinity},{value:-1},{delta:Infinity},{delta:'1'},{rating:'private note'},{navigationType:'/app/customers?phone=PRIVATE'}])assert.equal(localWebVital({...metric,...bad}),null);
});
test('local observation never reads private entry/id/attribution fields',()=>{
 const input={...metric};for(const key of['entries','id','attribution','url','phone'])Object.defineProperty(input,key,{get(){throw new Error('Must not read '+key);}});
 const output=localWebVital(input);assert.deepEqual(output,metric);assert.deepEqual(Object.keys(output),['name','value','delta','rating','navigationType']);
});
