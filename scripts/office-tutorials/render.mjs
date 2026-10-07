import fs from 'node:fs/promises';
import path from 'node:path';
import {root,work,output,locales,stories,read,save,setup,sharp,ffmpeg,probe,hash,esc,wrap,time,fps,catalog} from './author.mjs';
await setup();
const capture=await read(path.join(work,'captures.json'));
const palette={bg:'#f6f7f9',ink:'#24292f',muted:'#656d76',purple:'#5f57ff'};
const labels={
 'zh-CN':{demo:'网页演示 · 终端示意',step:'步骤',terminal:'Windows 管理员终端 · 操作示意',paste:'粘贴完整命令（示意）',short:'命令已缩略；完整内容须从网页复制',pending:'尚未执行 · 视频不安装、激活或卸载软件',check:'先保存文档、核对终端和授权，再决定是否执行',admin:'以管理员身份打开',copy:'从网页复制完整命令',review:'粘贴后核对，不在视频中执行'},
 it:{demo:'Sito dimostrativo · terminale illustrativo',step:'Passo',terminal:'Terminale Windows amministratore · illustrazione',paste:'Incolla tutto il comando (illustrazione)',short:'Comando abbreviato: copia tutto dal sito',pending:'Non eseguito · il video non installa, attiva o rimuove Office',check:'Salva e verifica terminale e licenza prima di decidere',admin:'Apri come amministratore',copy:'Copia tutto dal sito',review:'Incolla e verifica: il video non esegue'},
 en:{demo:'Website demonstration · terminal illustration',step:'Step',terminal:'Windows administrator terminal · illustration',paste:'Paste the full command (illustration)',short:'Command shortened: copy its full content from the website',pending:'Not executed · this video does not install, activate or remove Office',check:'Save documents and verify the terminal and license first',admin:'Open as administrator',copy:'Copy the full website command',review:'Paste and check: this video does not execute'}
};
const svg=(w,h,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:'Helvetica Neue','PingFang SC',sans-serif;fill:${palette.ink}}</style>${body}</svg>`);
const rows=(text,x,y,size,width,extra='')=>wrap(text,width).map((s,i)=>`<text x="${x}" y="${y+i*size*1.3}" font-size="${size}" ${extra}>${esc(s)}</text>`).join('');
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cursor=path.join(work,'frames/cursor.png');await sharp(svg(64,76,'<path d="M8 7 L8 55 L21 44 L32 66 L43 60 L31 39 L49 36 Z" fill="white" stroke="#5f57ff" stroke-width="4" stroke-linejoin="round"/>')).png().toFile(cursor);
await fs.mkdir(path.join(work,'frames/pulse'),{recursive:true});for(let i=0;i<24;i++)await sharp(svg(128,128,`<circle cx="64" cy="64" r="${8+44*i/23}" fill="none" stroke="#5f57ff" stroke-width="5" opacity="${1-i/23}"/>`)).png().toFile(path.join(work,'frames/pulse',String(i).padStart(3,'0')+'.png'));
async function terminal(locale,id){
 const l=labels[locale],file=path.join(work,'captures',`${locale}-${id}-5.png`);
 const text=`<rect width="1440" height="860" fill="#f6f7f9"/>${rows(l.terminal,65,68,31,68,'font-weight="650"')}
 <rect x="55" y="110" width="390" height="600" rx="20" fill="#eeedff"/>${[l.admin,l.copy,l.review].map((s,i)=>`<circle cx="94" cy="${180+i*165}" r="21" fill="#5f57ff"/><text x="94" y="${188+i*165}" text-anchor="middle" font-size="22" style="fill:white">${i+1}</text>${rows(s,65,235+i*165,24,25)}`).join('')}
 <rect x="475" y="110" width="910" height="600" rx="18" fill="#202331"/><rect x="475" y="110" width="910" height="67" rx="18" fill="#33364a"/><text x="510" y="151" font-size="25" style="fill:white">PowerShell · ${esc({"zh-CN":"管理员",it:"Amministratore",en:"Administrator"}[locale])}</text><circle cx="1348" cy="145" r="9" fill="#ef6471"/>
 <text x="510" y="223" font-size="23" style="fill:#c0c2cf">PS C:\\Windows\\System32&gt;</text><text x="510" y="280" font-size="23" style="fill:#c0c2cf">powershell.exe -NoProfile -ExecutionPolicy Bypass</text><text x="510" y="321" font-size="23" style="fill:#c0c2cf">-Command { ... }</text>${rows(l.short,510,385,23,60,'style="fill:#c0c2cf"')}
 <rect x="505" y="510" width="850" height="62" rx="12" fill="#5f57ff"/>${rows(l.paste,930,550,24,53,'text-anchor="middle" style="fill:white" font-weight="650"')}
 ${rows(l.pending,510,640,23,62,'style="fill:#ffd89e"')}${rows(l.check,720,775,24,78,'text-anchor="middle"')}`;
 await sharp(svg(1440,860,text)).png().toFile(file);
 return{file:path.relative(root,file),width:1440,height:860,highlight:{x:505,y:510,width:850,height:62},documentLanguage:locale,source:'local authored terminal illustration; no command execution',targetLabel:l.paste,illustration:true};
}
async function fitted(shot,file,W,H,outlined=true,source=shot.file){
 const r=shot.highlight,cropHeight=Math.min(shot.height,Math.round(shot.width*H/W)),cropTop=clamp(Math.round(r.y+r.height/2-cropHeight/2),0,shot.height-cropHeight);
 const pic=await sharp(path.resolve(root,source)).extract({left:0,top:cropTop,width:shot.width,height:cropHeight}).resize(W,H).png().toBuffer({resolveWithObject:true});const x=0,y=0,scale=pic.info.width/shot.width,vertical=pic.info.height/cropHeight;
 if(r.x<0||r.y<0||r.x+r.width>shot.width+1||r.y+r.height>shot.height+1)throw Error('Invalid target');
 const outline=svg(W,H,`<rect x="${r.x*scale-5}" y="${(r.y-cropTop)*vertical-5}" width="${r.width*scale+10}" height="${r.height*vertical+10}" rx="12" fill="none" stroke="#5f57ff" stroke-width="5"/>`);
 await sharp({create:{width:W,height:H,channels:4,background:'white'}}).composite([{input:pic.data,left:x,top:y},...(outlined?[{input:outline}]:[])]).png().toFile(file);
 return{x:(r.x+r.width/2)*scale,y:(r.y+r.height/2-cropTop)*vertical,crop:{x:0,y:cropTop,width:shot.width,height:cropHeight}};
}
async function segment(locale,story,step,index,promo=false){
 const w=promo?1080:1920,h=promo?1920:1080,W=promo?936:1776,H=promo?580:700,SX=72,SY=promo?565:185;
 let shot=index===4&&!promo?await terminal(locale,story.id):capture[`${locale}.${promo?['install','reinstall','install','install','uninstall','install'][index]:story.id}.${promo?[1,1,4,1,2,1][index]:index+1}`];
 if(!shot||shot.documentLanguage!==locale)throw Error('Missing localized screenshot');
 const prefix=path.join(work,'frames',`${locale}-${story.id}-${index+1}`),screen=prefix+'-screen.png',plate=prefix+'-plate.png';
 let target;
 if(promo){
  const r=shot.highlight,meta=await sharp(path.resolve(root,shot.file)).metadata(),cw=Math.min(meta.width,Math.max(650,r.width+120)),ch=Math.min(meta.height,400),cx=clamp(Math.round(r.x+r.width/2-cw/2),0,meta.width-cw),cy=clamp(Math.round(r.y+r.height/2-ch/2),0,meta.height-ch);
  await sharp(path.resolve(root,shot.file)).extract({left:cx,top:cy,width:cw,height:ch}).resize(W,H,{fit:'contain',background:'white'}).png().toFile(screen);const scale=Math.min(W/cw,H/ch);target={x:(W-cw*scale)/2+(r.x+r.width/2-cx)*scale,y:(H-ch*scale)/2+(r.y+r.height/2-cy)*scale};
 }else target=await fitted(shot,screen,W,H);
 const progress=Array.from({length:6},(_,i)=>`<rect x="${72+i*(w-144)/6}" y="${promo?1206:910}" width="${(w-144)/6-12}" height="6" rx="3" fill="${i<=index?'#5f57ff':'#e0e2e7'}"/>`).join('');
 let body=`<rect width="${w}" height="${h}" fill="#f6f7f9"/><rect x="72" y="40" width="50" height="50" rx="15" fill="#5f57ff"/><text x="97" y="76" text-anchor="middle" font-size="31" style="fill:white">C</text><text x="140" y="77" font-size="32" font-weight="650">ChinaTech</text>`;
 if(promo){body+=`${rows('Office 工具箱',72,245,83,15,'font-weight="700"')}${rows(step.title,72,387,51,20,'font-weight="650" style="fill:#5f57ff"')}<rect x="62" y="555" width="956" height="600" rx="24" fill="white" stroke="#e0e2e7"/>${progress}<text x="540" y="1285" text-anchor="middle" font-size="29">无需登录 · 命令参考 · 鼠标教程</text><text x="540" y="1815" text-anchor="middle" font-size="26" style="fill:#656d76">www.chinatech.in/toolbox/office</text><text x="540" y="1870" text-anchor="middle" font-size="24" style="fill:#656d76">软件操作需由你核对后手动执行</text>`;}
 else body+=`<text x="1848" y="76" text-anchor="end" font-size="24" style="fill:#656d76">${esc(labels[locale].demo)}</text>${rows(story.title,72,130,36,93,'font-weight="650"')}<text x="72" y="171" font-size="24" style="fill:#5f57ff">${index+1} / 6 · ${esc(step.title)}</text><rect x="62" y="175" width="1796" height="720" rx="18" fill="white" stroke="#e0e2e7"/>${progress}`;
 await sharp(svg(w,h,body)).png().toFile(plate);
 const cues=[];for(const [i,cue] of step.cues.entries()){
  const file=prefix+`-cue-${i}.png`,lines=wrap(cue.text,promo?21:44);if(lines.length>3)throw Error('Subtitle needs shorter clauses');
  await sharp(svg(w,h,lines.map((line,j)=>`<text x="${w/2}" y="${(promo?1450:970)-Math.max(0,lines.length-2)*20+j*(promo?58:50)}" text-anchor="middle" font-size="${promo?42:40}" font-weight="500">${esc(line)}</text>`).join(''))).png().toFile(file);cues.push(file);
 }
 const args=['-loop','1','-framerate',String(fps),'-i',plate,'-loop','1','-framerate',String(fps),'-i',screen,'-loop','1','-framerate',String(fps),'-i',cursor,'-framerate',String(fps),'-i',path.join(work,'frames/pulse/%03d.png')];
 for(const cue of cues)args.push('-loop','1','-framerate',String(fps),'-i',cue);
 const zoom=promo?1:1.28,ex=SX+target.x,ey=SY+target.y,startX=clamp(ex+260,SX+55,SX+W-55),startY=clamp(ey+130,SY+60,SY+H-60);
 const filters=[`[1:v]scale=${W*2}:${H*2},zoompan=z='1+${zoom-1}*min(on/36,1)':x='max(0,min(iw-iw/zoom,${target.x*2}-iw/(2*zoom)))':y='max(0,min(ih-ih/zoom,${target.y*2}-ih/(2*zoom)))':d=1:s=${W}x${H}:fps=${fps}[view]`,`[0:v][view]overlay=${SX}:${SY}:shortest=1[base]`];let current='base';
 if(shot.after&&!promo){const after=prefix+'-after.png';await fitted(shot,after,W,H,false,shot.after);const n=4+cues.length;args.push('-loop','1','-framerate',String(fps),'-i',after);filters.push(`[${current}][${n}:v]overlay=${SX}:${SY}:enable='gte(t,3.4)'[after]`);current='after';}
 if(promo&&index===5){const qr=path.join(work,'wechat/二维码.png'),n=4+cues.length;args.push('-loop','1','-framerate',String(fps),'-i',qr);filters.push(`[${n}:v]scale=480:480[qr]`,`[${current}][qr]overlay=300:615[qrview]`);current='qrview';}
 const p='clip((t-.8)/1.8,0,1)',smooth=`(${p})*(${p})*(3-2*(${p}))`;
 const cropX=clamp(target.x-W/(2*zoom),0,W-W/zoom),cropY=clamp(target.y-H/(2*zoom),0,H-H/zoom);
 const endX=promo&&index===5?540:SX+(target.x-cropX)*zoom,endY=promo&&index===5?855:SY+(target.y-cropY)*zoom;
 filters.push(`[${current}][2:v]overlay=x='${startX-8}+${endX-startX}*${smooth}':y='${startY-8}+${endY-startY}*${smooth}':enable='between(t,.8,3.4)'[mouse]`,`[3:v]setpts=PTS+2.6/TB[pulse]`,`[mouse][pulse]overlay=${endX-64}:${endY-64}:eof_action=pass:enable='between(t,2.6,3.4)'[clicked]`);current='clicked';
 for(const [i,cue] of step.cues.entries()){const next='sub'+i,at=cue.start-step.at,end=at+cue.duration+(promo&&index===5&&i===step.cues.length-1?3:0);filters.push(`[${current}][${4+i}:v]overlay=0:0:enable='between(t,${at},${end})'[${next}]`);current=next;}
 filters.push(`[${current}]format=yuv420p[out]`);
 const duration=step.duration+(promo&&index===5?3:0),file=path.join(work,'segments',`${locale}-${story.id}-${index+1}.mp4`),fingerprint=hash(JSON.stringify({step,shot,filters,duration,screen:hash(await fs.readFile(screen)),after:shot.after&&!promo?hash(await fs.readFile(prefix+'-after.png')):null,plate:hash(await fs.readFile(plate)),cues:await Promise.all(cues.map(async f=>hash(await fs.readFile(f)))),cursor:hash(await fs.readFile(cursor)),encoder:'x264/crf22/24fps/1500k',version:2}));
 let cached=false;try{cached=(await fs.readFile(file+'.hash','utf8'))===fingerprint;}catch{}
 if(!cached){await ffmpeg([...args,'-filter_complex_threads','1','-filter_complex',filters.join(';'),'-map','[out]','-an','-t',duration.toFixed(6),'-c:v','libx264','-threads','2','-preset','fast','-crf','22','-maxrate','1500k','-bufsize','3000k','-r',String(fps),file]);await fs.writeFile(file+'.hash',fingerprint);}
 console.log(`Video ${locale}/${story.id} ${index+1}/6`);return{file,duration,target:shot.highlight,sourceCrop:target.crop??null,illustration:!!shot.illustration,source:shot.source,mouse:{start:{x:startX,y:startY},end:{x:endX,y:endY},clickAt:2.6}};
}
const selected=process.argv[2];if(selected&&selected!=='promotion')throw Error('Only promotion or all episodes can be rendered.');
const allJobs=[...locales.flatMap(locale=>stories[locale].map(story=>({locale,story}))),{locale:'zh-CN',story:stories.promo,promo:true}],jobs=selected?allJobs.filter(j=>j.promo):allJobs;
const reports=selected?(await read(path.join(work,'evidence/render.json'))).filter(r=>!r.promo):[];
for(const job of jobs){const {locale,story,promo}=job,audio=await read(path.join(work,'audio',`${locale}-${story.id}.json`));if(audio.steps.some((s,i)=>s.body!==story.steps[i][1]))throw Error('Narration source changed');const motions=[];
 for(const [i,step] of audio.steps.entries())motions.push(await segment(locale,story,step,i,promo));
 const quote=file=>`file '${file.replaceAll("'","'\\''")}'`,list=path.join(work,'segments',`${locale}-${story.id}-list.txt`);await fs.writeFile(list,motions.map(m=>quote(m.file)).join('\n'));
 const sound=path.join(work,'segments',`${locale}-${story.id}-audio.txt`);await fs.writeFile(sound,audio.steps.flatMap(s=>s.cues.map(c=>quote(c.file))).join('\n'));
 const seconds=audio.seconds+(promo?3:0),folder=promo?path.join(work,'wechat'):path.join(output,locale);await fs.mkdir(folder,{recursive:true});const video=path.join(folder,promo?'01-Office工具箱推广.mp4':story.id+'.mp4');
 const pending=path.join(work,'evidence',`${locale}-${story.id}-pending.mp4`);await ffmpeg(['-f','concat','-safe','0','-i',list,'-f','concat','-safe','0','-i',sound,'-map','0:v:0','-map','1:a:0','-vf',`setpts=N/(${fps}*TB)`,'-fps_mode','cfr','-r',String(fps),'-c:v','libx264','-threads','2','-preset','fast','-crf','22','-maxrate','1500k','-bufsize','3000k','-af',promo?'apad=pad_dur=3':'anull','-c:a','aac','-b:a','96k','-ar','48000','-t',seconds.toFixed(6),'-movflags','+faststart',pending]);
 const details=await probe(pending);if(Math.abs(Number(details.format.duration)-seconds)>.1)throw Error('Duration drift');await fs.rename(pending,video);
 const frame=path.join(work,'evidence',`${locale}-${story.id}-poster.png`);await ffmpeg(['-ss',promo?String(seconds-2):'2.2','-i',video,'-frames:v','1',frame]);
 const poster=path.join(folder,promo?'01-Office工具箱推广封面.jpg':story.id+'.webp');if(promo)await sharp(frame).jpeg({quality:92}).toFile(poster);else await sharp(frame).resize(960,540).webp({quality:87}).toFile(poster);
 let vtt='WEBVTT\n\n';for(const [si,step] of audio.steps.entries())for(const [ci,cue] of step.cues.entries())vtt+=`${time(cue.start)} --> ${time(cue.start+cue.duration+(promo&&si===5&&ci===step.cues.length-1?3:0))}\n${wrap(cue.text,promo?21:59).join('\n')}\n\n`;
 const captions=path.join(folder,promo?'01-Office工具箱推广.vtt':story.id+'.vtt');await fs.writeFile(captions,vtt.trimEnd()+'\n');
 reports.push({locale,id:story.id,promo:!!promo,seconds,voice:audio.voice,motion:motions.map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>key!=='file'))),assets:await Promise.all([video,poster,captions].map(async file=>{const data=await fs.readFile(file);return{path:path.relative(root,file),bytes:data.length,sha256:(await import('node:crypto')).createHash('sha256').update(data).digest('hex')};}))});await save(path.join(work,'evidence/render.json'),reports);
}
await catalog();await save(path.join(root,'scripts/office-tutorials/assets-manifest.json'),{version:1,generatedAt:new Date().toISOString(),format:'H.264 / AAC, 24fps, website1920x1080/promo1080x1920',episodes:reports.filter(r=>!r.promo)});
