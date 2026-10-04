// Authoring utility. The website builds from static media, without TTS or ffmpeg.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const root = process.cwd();
const work = path.join(root, ".local/tutorials");
const out = path.join(root, "public/tutorials");
const stories = JSON.parse(await fs.readFile("scripts/tutorials/storyboard.json", "utf8"));
const shots = JSON.parse(await fs.readFile(`${work}/captures.json`, "utf8"));
const requested = process.argv[2];
const voice = "zh-CN-XiaoxiaoNeural";
const ttsPython = path.join(root, ".local/tutorials/tts-env/bin/python");
await fs.access(ttsPython);
for (const dir of ["audio", "frames", "segments"]) await fs.mkdir(`${work}/${dir}`, { recursive: true });
await fs.mkdir(out, { recursive: true });
const measurements = JSON.parse(await fs.readFile(`${work}/media.json`, "utf8").catch(() => "{}"));
const esc = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const lines = (text, length = 29) => {
  const chars = [...text]; const result = [];
  while (chars.length) result.push(chars.splice(0, length).join(""));
  return result;
};
function time(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2,"0")}:${String(Math.floor(ms / 60000) % 60).padStart(2,"0")}:${String(Math.floor(ms / 1000) % 60).padStart(2,"0")}.${String(ms % 1000).padStart(3,"0")}`;
}
function probe(file) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
}
function clauses(text) {
  return (text.match(/[^。！？]+[。！？]?/gu) ?? [text]).flatMap(sentence => {
    if ([...sentence].length <= 48) return [sentence];
    return sentence.match(/[^，；]+[，；]?/gu) ?? [sentence];
  });
}

async function frame(story, step, index, subtitle, filename) {
  const shot = shots[step.frame];
  if (!shot) throw new Error(`Missing UI capture: ${step.frame}`);
  const portrait = shot.width / shot.height < 0.9;
  const area = portrait ? {x:96,y:176,w:480,h:628} : {x:48,y:178,w:1184,h:604};
  const picture = await sharp(shot.file).resize({width:area.w,height:area.h,fit:"inside"}).png().toBuffer({resolveWithObject:true});
  const x = area.x + (area.w-picture.info.width)/2;
  const y = area.y + (area.h-picture.info.height)/2;
  const scale = picture.info.width/shot.width;
  const h = shot.highlight;
  const highlight = h && h.y >= 0 && h.y + h.height <= shot.height ? `<rect x="${x+h.x*scale-4}" y="${y+h.y*scale-4}" width="${h.width*scale+8}" height="${h.height*scale+8}" rx="9" fill="none" stroke="#5f57ff" stroke-width="4"/>` : "";
  const subtitleLines=lines(subtitle,30);
  const progress = story.steps.map((_,i)=>`<rect x="${48+i*199}" y="818" width="185" height="5" rx="2.5" fill="${i<=index?"#5f57ff":"#e4e5ee"}"/>`).join("");
  const side = portrait ? `<text x="644" y="292" fill="#5f57ff" font-size="24" font-weight="600">第 ${index+1} 步 / ${story.steps.length}</text>${lines(step.title,11).map((line,i)=>`<text x="644" y="${350+i*60}" font-size="40" font-weight="600">${esc(line)}</text>`).join("")}<rect x="644" y="508" width="72" height="4" rx="2" fill="#5f57ff"/>${lines(step.note ?? "按画面步骤，完成这一步。",16).map((line,i)=>`<text x="644" y="${562+i*37}" font-size="24" fill="#57606a">${esc(line)}</text>`).join("")}` : "";
  const svg=`<svg width="1280" height="960" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'PingFang SC','Helvetica Neue',sans-serif;fill:#24292f}</style><rect width="1280" height="960" fill="#f6f7f9"/><rect x="0" y="0" width="1280" height="960" rx="24" fill="#f6f7f9"/><rect x="48" y="38" width="34" height="34" rx="10" fill="#5f57ff"/><text x="65" y="62" text-anchor="middle" style="fill:white" font-size="21" font-weight="600">C</text><text x="94" y="62" font-size="23" font-weight="600">ChinaTech</text><text x="258" y="62" font-size="20" fill="#57606a">使用教程 ${story.number}</text><text x="1232" y="62" text-anchor="end" font-size="18" fill="#656d76">${esc(story.title)} · 虚构资料演示</text><text x="48" y="132" font-size="37" font-weight="600">${String(index+1).padStart(2,"0")}  ${esc(step.title)}</text><rect x="${x-8}" y="${y-8}" width="${picture.info.width+16}" height="${picture.info.height+16}" rx="14" fill="white" stroke="#dfe1e6"/>${side}${progress}${subtitleLines.map((line,i)=>`<text x="640" y="${subtitleLines.length>1?876+i*45:896}" text-anchor="middle" font-size="31" font-weight="500">${esc(line)}</text>`).join("")}</svg>`;
  const overlay=Buffer.from(`<svg width="1280" height="960" xmlns="http://www.w3.org/2000/svg">${highlight}</svg>`);
  await sharp(Buffer.from(svg)).composite([{input:picture.data,left:Math.round(x),top:Math.round(y)},{input:overlay,left:0,top:0}]).png().toFile(filename);
}

for (const story of stories) {
  if(requested && requested!==story.id) continue;
  let elapsed=0; const chapters=[]; const segments=[]; let vtt="WEBVTT\n\n";
  for (const [index,step] of story.steps.entries()) {
    chapters.push({title:step.title,body:step.body,at:Number(elapsed.toFixed(3))});
    for(const [cueIndex,cue] of clauses(step.body).entries()) {
      const stem=`${story.id}-${index+1}-${cueIndex+1}`;
      const audio=`${work}/audio/${stem}-${voice}.mp3`, png=`${work}/frames/${stem}.png`, segment=`${work}/segments/${stem}.mp4`;
      const voiceText=cue.replaceAll("ChinaTech","China Tech").replaceAll("IMEI","I M E I").replaceAll("Google","谷歌");
      execFileSync(ttsPython,["-m","edge_tts","--voice",voice,"--rate","+5%","--text",voiceText,"--write-media",audio], { timeout: 45000 });
      const spoken=Number(probe(audio).format.duration);
      if(!Number.isFinite(spoken)||spoken<0.3)throw new Error(`Voice synthesis did not produce audio: ${stem}`);
      const duration=Math.ceil((spoken+0.30)*15)/15;
      await frame(story,step,index,cue,png);
      if(index===0 && cueIndex===0) await sharp(png).resize(960,720).webp({quality:85}).toFile(`${out}/${story.id}.webp`);
      execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-loop","1","-framerate","15","-i",png,"-i",audio,"-t",duration.toFixed(6),"-vf","format=yuv420p","-af","loudnorm=I=-16:TP=-1.5:LRA=11,apad","-c:v","libx264","-preset","fast","-tune","stillimage","-crf","24","-r","15","-c:a","aac","-ar","48000","-b:a","80k",segment]);
      segments.push(segment);
      vtt+=`${time(elapsed)} --> ${time(elapsed+duration)}\n${lines(cue,29).join("\n")}\n\n`;
      elapsed+=duration;
    }
    console.log(`${story.id}: step ${index+1}/${story.steps.length}`);
  }
  const concat=`${work}/segments/${story.id}.txt`;
  await fs.writeFile(concat,segments.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join("\n"));
  const video=`${out}/${story.id}.mp4`;
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",concat,"-c","copy","-movflags","+faststart",video]);
  await fs.writeFile(`${out}/${story.id}.vtt`,vtt.trimEnd()+"\n");
  const media=probe(video);
  measurements[story.id]={seconds:Number(media.format.duration),bytes:Number(media.format.size),voice,steps:chapters,streams:media.streams.map(({codec_type,codec_name,width,height,sample_rate})=>({codec_type,codec_name,width,height,sample_rate}))};
  await fs.writeFile(`${work}/media.json`,JSON.stringify(measurements,null,2));
  console.log(`${story.id}: ${(Number(media.format.size)/1024/1024).toFixed(2)} MB, ${media.format.duration}s`);
}
// Preserve declarations, regenerate only the static public tutorial catalog.
if (stories.some(story => !measurements[story.id])) {
  console.log("Episode rendered. The catalog is updated after every episode is available.");
  process.exit(0);
}
const types=(await fs.readFile("lib/tutorials.ts","utf8")).split("// Generated")[0];
const data=stories.map(story=>{
  const measured=measurements[story.id];
  if(!measured)throw new Error(`Finish rendering all episodes before publishing: ${story.id}`);
  const seconds=Math.ceil(measured.seconds);
  return {...story,duration:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`,src:`/tutorials/${story.id}.mp4`,poster:`/tutorials/${story.id}.webp`,captions:`/tutorials/${story.id}.vtt`,steps:measured.steps};
});
await fs.writeFile("lib/tutorials.ts",types+"// Generated from scripts/tutorials/storyboard.json with measured narration timing.\nexport const tutorials: readonly Tutorial[] = "+JSON.stringify(data,null,2)+";\n");
