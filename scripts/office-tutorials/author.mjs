import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {run,hash,esc,wrap,time,voices,rates,fps,probe,ffmpeg,clauses,voiceText as sharedVoiceText} from '../tutorials/authoring.mjs';
export {run,hash,esc,wrap,time,voices,rates,fps,probe,ffmpeg,sharp};
export const root=process.cwd(), work=path.join(root,'.local/office-videos'), output=path.join(root,'public/tutorials/office');
export const locales=['zh-CN','it','en'], ids=['install','activate','uninstall','reinstall'];
export const stories=JSON.parse(await fs.readFile(path.join(root,'scripts/office-tutorials/storyboards.json'),'utf8'));
function voiceText(text,locale){return sharedVoiceText(text,locale).replaceAll('403',{'zh-CN':'四零三',it:'quattrocentotre',en:'four zero three'}[locale]);}
export const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
export const save=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');};
export async function setup(){for(const d of ['audio','captures','frames','segments','evidence','wechat'])await fs.mkdir(path.join(work,d),{recursive:true});}
export async function catalog(){
 const result={};
 for(const locale of locales){result[locale]=[];for(const [index,story] of stories[locale].entries()){
  let audio;try{audio=await read(path.join(work,'audio',`${locale}-${story.id}.json`));}catch{}
  const seconds=audio?.seconds??60;
  result[locale].push({id:story.id,number:String(index+1).padStart(2,'0'),title:story.title,description:story.description,duration:`${Math.floor(seconds/60)}:${String(Math.ceil(seconds%60)).padStart(2,'0')}`,src:`/tutorials/office/${locale}/${story.id}.mp4`,poster:`/tutorials/office/${locale}/${story.id}.webp`,captions:`/tutorials/office/${locale}/${story.id}.vtt`,href:`#command-${story.id}`,actionLabel:{'zh-CN':'查看对应命令',it:'Vedi il comando',en:'View the command'}[locale],steps:story.steps.map(([title,body],i)=>({title,body,at:audio?.steps[i].at??i*10}))});
 }}
 await fs.writeFile(path.join(root,'lib/office-tutorials.ts'),`import type { Tutorial, TutorialLocale } from "./tutorials";\n\n// Generated from explicitly localized public storyboards and measured narration.\nconst catalog: Record<TutorialLocale, readonly Tutorial[]> = ${JSON.stringify(result,null,2)};\n\nexport function getOfficeTutorials(locale: TutorialLocale): readonly Tutorial[] { return catalog[locale]; }\n`);
 return result;
}
export async function prepareAudio(){
 await setup();
 const python=process.env.OFFICE_TTS_PYTHON;if(!python)throw Error('Set OFFICE_TTS_PYTHON to the project authoring environment.');
 const jobs=[...locales.flatMap(locale=>stories[locale].map(story=>({locale,story}))),{locale:'zh-CN',story:stories.promo}];
 let cursor=0;
 await Promise.all(Array.from({length:2},async()=>{while(cursor<jobs.length){const {locale,story}=jobs[cursor++];let elapsed=0;const steps=[];
  for(const [index,[title,body]] of story.steps.entries()){
   const at=elapsed,cues=[];
   for(const text of clauses(body,locale)){
    const spokenText=voiceText(text,locale),key=hash(`${voices[locale]}|${rates[locale]}|${spokenText}`),mp3=path.join(work,'audio',key+'.mp3'),wav=path.join(work,'audio',key+'.wav');
    try{await fs.access(mp3);}catch{let done=false;for(let attempt=0;attempt<2&&!done;attempt++){try{await run(python,['-m','edge_tts','--voice',voices[locale],'--rate',rates[locale],'--text',spokenText,'--write-media',mp3],{timeout:50000,maxBuffer:2e6});done=true;}catch(error){if(attempt)throw error;}}}
    const spoken=Number((await probe(mp3)).format.duration);if(!(spoken>.25))throw Error('Missing narration');
    const duration=Math.ceil((spoken+.24)*fps)/fps,samples=Math.round(duration*48000);
    try{await fs.access(wav);}catch{await ffmpeg(['-i',mp3,'-af',`loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad=whole_len=${samples},atrim=end_sample=${samples},asetpts=N/SR/TB`,'-c:a','pcm_s16le','-ar','48000','-ac','1',wav]);}
    cues.push({text,file:wav,spoken,duration,start:elapsed});elapsed+=duration;
   }
   steps.push({title,body,at:Number(at.toFixed(6)),duration:Number((elapsed-at).toFixed(6)),cues});console.log(`Audio ${locale}/${story.id} ${index+1}/6`);
  }
  await save(path.join(work,'audio',`${locale}-${story.id}.json`),{locale,id:story.id,voice:voices[locale],rate:rates[locale],seconds:Number(elapsed.toFixed(6)),steps});
 }}));
 await catalog();
}
if(process.argv[1]===path.join(root,'scripts/office-tutorials/author.mjs')){if(process.argv[2]==='audio')await prepareAudio();else await catalog();}
