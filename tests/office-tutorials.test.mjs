import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getOfficeTutorials} from '../lib/office-tutorials.ts';
const locales=['zh-CN','it','en'],ids=['install','activate','uninstall','reinstall'];
const stories=JSON.parse(readFileSync(new URL('../scripts/office-tutorials/storyboards.json',import.meta.url),'utf8'));
test('Office catalogs use all three localized storyboards, preserve action IDs and measured chapters',()=>{
 for(const locale of locales){const list=getOfficeTutorials(locale);assert.deepEqual(list.map(t=>t.id),ids);
  for(const [i,t] of list.entries()){assert.equal(t.title,stories[locale][i].title);assert.equal(t.description,stories[locale][i].description);assert.equal(t.href,`#command-${ids[i]}`);assert.equal(t.src,`/tutorials/office/${locale}/${ids[i]}.mp4`);assert.equal(t.steps.length,6);assert.equal(t.steps[0].at,0);
   for(const [j,s] of t.steps.entries()){assert.equal(s.title,stories[locale][i].steps[j][0]);assert.equal(s.body,stories[locale][i].steps[j][1]);if(j)assert.ok(s.at>t.steps[j-1].at);if(locale!=='zh-CN')assert.equal(/[\u3400-\u9fff]/u.test(s.title+s.body),false);}
  }
 }
});
test('Every Office media asset exists and matches its frozen manifest and localized captions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../scripts/office-tutorials/assets-manifest.json',import.meta.url),'utf8'));assert.equal(manifest.episodes.length,12);
 for(const episode of manifest.episodes){assert.ok(episode.seconds>=60&&episode.seconds<=90);assert.equal(episode.motion.length,6);const t=getOfficeTutorials(episode.locale).find(t=>t.id===episode.id);assert.ok(t);
  for(const asset of episode.assets){const file=new URL('../'+asset.path,import.meta.url);assert.ok(existsSync(file));const raw=readFileSync(file);assert.equal(raw.length,asset.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256);if(asset.path.endsWith('.mp4'))assert.ok(raw.length<20*1024*1024);}
  const captions=readFileSync(new URL('../public'+t.captions,import.meta.url),'utf8');assert.match(captions,/^WEBVTT/);for(const s of t.steps)assert.ok(captions.split(/\n\n/gu).filter(block=>block.includes('-->')).map(block=>block.split('\n').slice(1).join('')).join('').replace(/\s/gu,'').includes(s.body.replace(/\s/gu,'')));assert.equal(episode.motion[4].illustration,true);assert.match(episode.motion[4].source,/no command execution/);
 }
});
