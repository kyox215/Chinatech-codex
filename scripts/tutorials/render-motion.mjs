import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { root, work, output, locales, fps, setup, storiesFor, json, exists, ffmpeg, probe, hash, time, wrap, esc, writeCatalog } from "./authoring.mjs";

await setup();
const requestedLocale = process.argv[2] ?? "all", requestedStory = process.argv[3];
if (![...locales, "all"].includes(requestedLocale)) throw new Error("Use render.mjs [zh-CN|it|en|all] [episode-id].");
const shots = await json(path.join(work, "captures.json"));
const W = 1184, H = 610, SX = 48, SY = 186;
const labels = { "zh-CN": { guide: "鼠标引导演示", demo: "虚构资料", screen: "画面位置" }, it: { guide: "Guida con il cursore", demo: "Dati dimostrativi", screen: "Sul sito" }, en: { guide: "Guided demonstration", demo: "Fictional data", screen: "On screen" } };
const svg = content => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960"><style>text{font-family:'Helvetica Neue','PingFang SC',sans-serif;fill:#24292f}</style>${content}</svg>`);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => `(${value})*(${value})*(3-2*(${value}))`;
const cursor = path.join(work, "frames/cursor.png");
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="76"><path d="M8 7 L8 55 L21 44 L32 66 L43 60 L31 39 L49 36 Z" fill="white" stroke="#5f57ff" stroke-width="4" stroke-linejoin="round"/></svg>`)).png().toFile(cursor);
await fs.mkdir(path.join(work, "frames/pulse"), { recursive: true });
for (let frame = 0; frame < 24; frame++) {
  const t = frame / 23;
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="${8 + 44 * t}" fill="#5f57ff" fill-opacity="${.12 * (1 - t)}" stroke="#5f57ff" stroke-width="5" stroke-opacity="${1 - t}"/><circle cx="64" cy="64" r="7" fill="#5f57ff" fill-opacity="${1 - t}"/></svg>`)).png().toFile(path.join(work, `frames/pulse/${String(frame).padStart(3, "0")}.png`));
}

async function screenImage(shot, file, source = shot.file, outlined = true) {
  const picture = await sharp(path.resolve(root, source)).resize({ width: W, height: H, fit: "inside" }).png().toBuffer({ resolveWithObject: true });
  const x = Math.round((W - picture.info.width) / 2), y = Math.round((H - picture.info.height) / 2), scale = picture.info.width / shot.width, r = shot.highlight;
  if (!r || r.x < -.5 || r.y < -.5 || r.x + r.width > shot.width + 1 || r.y + r.height > shot.height + 1) throw new Error(`Invalid real target: ${shot.file}`);
  const target = { x: x + (r.x + r.width / 2) * scale, y: y + (r.y + r.height / 2) * scale };
  const outline = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x + r.x * scale - 4}" y="${y + r.y * scale - 4}" width="${r.width * scale + 8}" height="${r.height * scale + 8}" rx="8" fill="none" stroke="#5f57ff" stroke-width="4"/></svg>`);
  await sharp({ create: { width: W, height: H, channels: 4, background: "#ffffff" } }).composite([{ input: picture.data, left: x, top: y }, ...(outlined ? [{ input: outline }] : [])]).png().toFile(file);
  return target;
}

async function renderStep(locale, story, step, index) {
  const shot = shots[`${locale}.${step.frame}`];
  if (!shot || !/^http:\/\/127\.0\.0\.1:312[13]/.test(shot.source)) throw new Error(`Local capture required: ${locale}.${step.frame}`);
  if (locale !== "zh-CN" && (shot.documentLanguage !== locale || shot.after && shot.afterLanguage !== locale)) throw new Error(`Matching live interface language required: ${locale}.${step.frame}`);
  const prefix = path.join(work, `frames/${locale}-${story.id}-${index + 1}`), screen = `${prefix}-screen.png`, plate = `${prefix}-plate.png`;
  const target = await screenImage(shot, screen), zoom = shot.width > 1000 ? 1.5 : 1.18;
  const crop = { x: clamp(target.x - W / (2 * zoom), 0, W - W / zoom), y: clamp(target.y - H / (2 * zoom), 0, H - H / zoom) };
  const end = { x: SX + (target.x - crop.x) * zoom, y: SY + (target.y - crop.y) * zoom };
  const start = { x: clamp(end.x + (end.x > 640 ? -270 : 270), SX + 50, SX + W - 55), y: clamp(end.y + (end.y > 490 ? -140 : 140), SY + 65, SY + H - 65) };
  const progress = story.steps.map((_, i) => `<rect x="${48 + i * 199}" y="806" width="185" height="4" rx="2" fill="${i <= index ? "#5f57ff" : "#e2e3e8"}"/>`).join("");
  const targetText = (shot.targetLabel && (shot.interactive || shot.targetLabel.length <= 70) ? shot.targetLabel : step.title).replace(/(?:PO-)?LOCAL-[A-Z0-9-]+\s*/gu, "").trim();
  const labelRows = wrap(`${labels[locale].screen}: ${targetText}`, 61);
  const label = `${labelRows[0]}${labelRows.length > 1 ? "…" : ""}`;
  await sharp(svg(`<rect width="1280" height="960" fill="#f6f7f9"/><rect x="48" y="34" width="35" height="35" rx="10" fill="#5f57ff"/><text x="65" y="59" text-anchor="middle" style="fill:white" font-size="22" font-weight="700">C</text><text x="96" y="60" font-size="24" font-weight="650">ChinaTech</text><text x="254" y="59" font-size="19" fill="#57606a">${esc(labels[locale].guide)} · ${story.number}</text><text x="1232" y="59" text-anchor="end" font-size="18" fill="#656d76">${esc(labels[locale].demo)} · ${locale === "zh-CN" ? "中文" : locale.toUpperCase()}</text><text x="48" y="117" font-size="34" font-weight="650">${esc(story.title)}</text><text x="48" y="159" font-size="25" fill="#5f57ff">${String(index + 1).padStart(2, "0")} / 06 · ${esc(step.title)}</text><rect x="40" y="178" width="1200" height="626" rx="13" fill="white" stroke="#e2e3e8"/>${progress}<text x="640" y="836" text-anchor="middle" font-size="17" fill="#57606a">${esc(label)}</text>`)).png().toFile(plate);
  const trail = `${prefix}-trail.png`;
  await sharp(svg(`<path d="M ${start.x} ${start.y} Q ${(start.x + end.x) / 2} ${(start.y + end.y) / 2 - 95} ${end.x} ${end.y}" fill="none" stroke="#5f57ff" stroke-width="3" stroke-opacity=".45" stroke-dasharray="7 8"/>`)).png().toFile(trail);
  const cueFiles = [];
  for (const [cueIndex, cue] of step.cues.entries()) {
    const rows = wrap(cue.text, 36);
    if (rows.length > 3) throw new Error(`Subtitle needs shorter clauses: ${locale}/${story.id}/${index + 1}/${cueIndex + 1}`);
    const file = `${prefix}-cue-${cueIndex}.png`;
    await sharp(svg(rows.map((line, i) => `<text x="640" y="${rows.length === 3 ? 867 + i * 35 : rows.length === 2 ? 883 + i * 39 : 900}" text-anchor="middle" font-size="29" font-weight="500">${esc(line)}</text>`).join(""))).png().toFile(file);
    cueFiles.push(file);
  }
  const args = ["-loop", "1", "-framerate", String(fps), "-i", plate, "-loop", "1", "-framerate", String(fps), "-i", screen, "-loop", "1", "-framerate", String(fps), "-i", cursor, "-framerate", String(fps), "-i", path.join(work, "frames/pulse/%03d.png"), "-loop", "1", "-framerate", String(fps), "-i", trail];
  for (const file of cueFiles) args.push("-loop", "1", "-framerate", String(fps), "-i", file);
  const position = "clip((on/24-0.25)/1.25,0,1)", zoomExpression = `1+${zoom - 1}*${smooth(position)}`;
  const camera = `scale=${W * 2}:${H * 2},zoompan=z='${zoomExpression}':x='max(0,min(iw-iw/zoom,${target.x * 2}-iw/(2*zoom)))':y='max(0,min(ih-ih/zoom,${target.y * 2}-ih/(2*zoom)))':d=1:s=${W}x${H}:fps=${fps}`;
  const filters = [`[1:v]${camera}[view]`, `[0:v][view]overlay=${SX}:${SY}:shortest=1[base]`]; let current = "base";
  if (shot.after) {
    const after = `${prefix}-after.png`; await screenImage(shot, after, shot.after, false);
    const input = 5 + cueFiles.length; args.push("-loop", "1", "-framerate", String(fps), "-i", after);
    const reveal = `${zoom}-${zoom - 1}*${smooth("clip((on/24-3.45)/.75,0,1)")}`;
    filters.push(`[${input}:v]scale=${W * 2}:${H * 2},zoompan=z='${reveal}':x='max(0,min(iw-iw/zoom,${target.x * 2}-iw/(2*zoom)))':y='max(0,min(ih-ih/zoom,${target.y * 2}-ih/(2*zoom)))':d=1:s=${W}x${H}:fps=${fps}[after]`, `[${current}][after]overlay=${SX}:${SY}:enable='gte(t,3.45)'[changed]`); current = "changed";
  }
  filters.push(`[${current}][4:v]overlay=0:0:enable='between(t,1.55,3.15)'[trail]`);
  const p = "clip((t-1.55)/1.6,0,1)", eased = smooth(p);
  filters.push(`[trail][2:v]overlay=x='${start.x - 8}+${end.x - start.x}*${eased}':y='${start.y - 8}+${end.y - start.y}*${eased}-45*sin(PI*${p})':enable='gte(t,1.55)${shot.after ? "*lt(t,4.2)" : ""}'[cursor]`, "[3:v]setpts=PTS+3.15/TB[pulse]", `[cursor][pulse]overlay=${end.x - 64}:${end.y - 64}:eof_action=pass:enable='between(t,3.15,4.15)'[pulseview]`); current = "pulseview";
  for (const [cueIndex, cue] of step.cues.entries()) {
    const next = `cue${cueIndex}`, begin = cue.start - step.at, finish = begin + cue.duration;
    filters.push(`[${current}][${5 + cueIndex}:v]overlay=0:0:enable='gte(t,${begin})*lt(t,${finish})'[${next}]`); current = next;
  }
  filters.push(`[${current}]format=yuv420p[out]`);
  const segment = path.join(work, `segments/${locale}-${story.id}-${index + 1}.mp4`), marker = `${segment}.hash`;
  const captureHash = hash(await fs.readFile(path.resolve(root, shot.file)));
  const afterHash = shot.after ? hash(await fs.readFile(path.resolve(root, shot.after))) : null;
  const plateHash = hash(await fs.readFile(plate));
  const fingerprint = hash(JSON.stringify({ story, step, shot, captureHash, afterHash, plateHash, filters, version: 4 }));
  if (!await exists(segment) || (await fs.readFile(marker, "utf8").catch(() => "")) !== fingerprint) {
    await ffmpeg([...args, "-filter_complex_threads", "1", "-filter_complex", filters.join(";"), "-map", "[out]", "-an", "-t", step.duration.toFixed(6), "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "22", "-r", String(fps), segment]); await fs.writeFile(marker, fingerprint);
  }
  return { segment, shot: shot.file, after: shot.after ?? null, captureLanguage: shot.documentLanguage ?? "zh-CN", target: shot.highlight, targetLabel: shot.targetLabel, zoom, mouse: { start, end, clickAt: shot.interactive ? 3.15 : null, focusAt: 3.15 }, source: shot.source, duration: step.duration };
}

for (const locale of locales.filter(locale => requestedLocale === "all" || requestedLocale === locale)) {
  const directory = path.join(output, locale === "zh-CN" ? "" : locale); await fs.mkdir(directory, { recursive: true });
  for (const story of await storiesFor(locale)) {
    if (requestedStory && story.id !== requestedStory) continue;
    const audio = await json(path.join(work, `audio/${locale}-${story.id}.json`));
    if (audio.steps.some((step, i) => step.body !== story.steps[i].body || step.title !== story.steps[i].title)) throw new Error(`Prepare changed audio first: ${locale}/${story.id}`);
    const motion = [];
    for (const [index, step] of audio.steps.entries()) { motion.push(await renderStep(locale, story, step, index)); console.log(`Rendered ${locale}/${story.id}: ${index + 1}/6`); }
    const list = path.join(work, `segments/${locale}-${story.id}-video.txt`), audioList = path.join(work, `segments/${locale}-${story.id}-audio.txt`), quote = file => `file '${file.replaceAll("'", "'\\''")}'`;
    await fs.writeFile(list, motion.map(item => quote(item.segment)).join("\n"));
    await fs.writeFile(audioList, audio.steps.flatMap(step => step.cues.map(cue => quote(cue.file))).join("\n"));
    const video = path.join(directory, `${story.id}.mp4`);
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-f", "concat", "-safe", "0", "-i", audioList, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-shortest", "-movflags", "+faststart", video]);
    let vtt = "WEBVTT\n\n";
    for (const step of audio.steps) for (const cue of step.cues) vtt += `${time(cue.start)} --> ${time(cue.start + cue.duration)}\n${wrap(cue.text, 34).join("\n")}\n\n`;
    await fs.writeFile(path.join(directory, `${story.id}.vtt`), `${vtt.trimEnd()}\n`);
    const poster = path.join(work, `evidence/${locale}-${story.id}-poster.png`);
    await ffmpeg(["-ss", "2.2", "-i", video, "-frames:v", "1", poster]); await sharp(poster).resize(960, 720).webp({ quality: 87 }).toFile(path.join(directory, `${story.id}.webp`));
    const details = await probe(video);
    const report = { locale, id: story.id, voice: audio.voice, seconds: Number(details.format.duration), expectedSeconds: audio.seconds, bytes: Number(details.format.size), streams: details.streams.map(({ codec_name, codec_type, width, height, sample_rate, avg_frame_rate }) => ({ codec_name, codec_type, width, height, sample_rate, avg_frame_rate })), motion };
    await fs.writeFile(path.join(work, `evidence/${locale}-${story.id}.json`), JSON.stringify(report, null, 2)); console.log(`Done ${locale}/${story.id}: ${report.seconds}s, ${(report.bytes / 1048576).toFixed(2)} MiB`);
  }
}
await writeCatalog();
