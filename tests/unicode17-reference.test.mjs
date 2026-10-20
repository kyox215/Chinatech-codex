import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';import{unicode17Reference}from'../scripts/lib/unicode17-reference.mjs';
const data=JSON.parse(readFileSync('scripts/unicode/unicode17-data.json')),reference=unicode17Reference(data),decode=value=>String.fromCodePoint(...value.trim().split(/\s+/).filter(Boolean).map(hex=>parseInt(hex,16)));
test('Unicode17 canonical reordering/composition matches all official normalization columns and Node24 built-in NFKC',()=>{
 let lines=0,checks=0;for(const raw of gunzipSync(readFileSync('tests/data/unicode17-normalization.txt.gz')).toString('utf8').split(/\r?\n/)){const line=raw.split('#')[0].trim();if(!line||line.startsWith('@'))continue;const columns=line.split(';').slice(0,5).map(decode),expected=columns[3];for(const value of columns){assert.equal(reference.nfkc(value),expected,'official normalization line '+lines);assert.equal(reference.nfkc(value),value.normalize('NFKC'));checks++;}lines++;}assert(lines>20000);assert.equal(checks,lines*5);
});
test('Unicode17 all scalar lower/upper and FinalSigma honor new Cased and Case_Ignorable with Hangul, blocked and reordered marks',()=>{
 for(const[point]of data.rows){const value=String.fromCodePoint(point);assert.equal(reference.lower(value),value.toLocaleLowerCase('en-US'));assert.equal(reference.upper(value),value.toUpperCase());}
 const cases=['A\u030A','\u1100\u1161\u11A8','q\u0315\u0897','\u0345Σ','AΣ\u0345','AΣ\u0345A','\u{16EA0}Σ','AΣ\u{1E6E3}A','a\u0301\u0323','a\u0301\u030A','\u1100\u1161\u11A8\u0301','\u00C5\u0301'];
 for(const value of cases){assert.equal(reference.nfkc(value),value.normalize('NFKC'));assert.equal(reference.lower(value),value.toLocaleLowerCase('en-US'));assert.equal(reference.upper(value),value.toUpperCase());}
 for(const[point,,,,,cased,ignorable]of data.rows)if(cased||ignorable){const char=String.fromCodePoint(point);for(const value of[char+'Σ','AΣ'+char+'A','A'+char+'Σ'+char])assert.equal(reference.lower(value),value.toLocaleLowerCase('en-US'));}
});
