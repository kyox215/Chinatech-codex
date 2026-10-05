import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { root, work, output, locales, fps, storiesFor, json, ffmpeg, probe } from "./authoring.mjs";

const requested = process.argv[2] ?? "all";
assert([...locales, "all"].includes(requested), "Use verify.mjs [zh-CN|it|en|all]");
const { getTutorials } = await import(pathToFileURL(path.join(root, "lib/tutorials.ts")));
function atoms(buffer) {
  const result = [];
  for (let offset = 0; offset + 8 <= buffer.length;) {
    let size = buffer.readUInt32BE(offset);
    const name = buffer.toString("ascii", offset + 4, offset + 8);
    if (size === 1) size = Number(buffer.readBigUInt64BE(offset + 8));
    if (size === 0) size = buffer.length - offset;
    assert(size >= 8 && offset + size <= buffer.length, `Invalid MP4 atom ${name}`);
    result.push(name); offset += size;
  }
  return result;
}
function seconds(value) { const [h, m, s] = value.split(":").map(Number); return h * 3600 + m * 60 + s; }
const report = { format: "H.264 / AAC, 1280x960, 24fps", generatedAt: new Date().toISOString(), items: [] };
for (const locale of locales.filter(value => requested === "all" || value === requested)) {
  const catalog = getTutorials(locale), directory = path.join(output, locale === "zh-CN" ? "" : locale);
  for (const story of await storiesFor(locale)) {
    const name = `${locale}-${story.id}`, video = path.join(directory, `${story.id}.mp4`);
    const measured = await json(path.join(work, `audio/${name}.json`));
    const details = await probe(video), v = details.streams.find(stream => stream.codec_type === "video"), a = details.streams.find(stream => stream.codec_type === "audio");
    assert.equal(v.codec_name, "h264"); assert.equal(v.width, 1280); assert.equal(v.height, 960);
    assert.equal(v.avg_frame_rate, `${fps}/1`); assert.equal(v.pix_fmt, "yuv420p");
    assert.equal(a.codec_name, "aac"); assert.equal(a.sample_rate, "48000");
    const duration = Number(details.format.duration);
    assert(Math.abs(duration - measured.seconds) <= 1 / fps + .003, `${name}: duration mismatch`);
    const bytes = await fs.readFile(video), atomOrder = atoms(bytes);
    assert(atomOrder.indexOf("moov") >= 0 && atomOrder.indexOf("moov") < atomOrder.indexOf("mdat"), `${name}: faststart missing`);
    const decoded = await ffmpeg(["-loglevel", "info", "-i", video, "-map", "0:v:0", "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"]);
    const meanDb = Number(decoded.stderr.match(/mean_volume: ([-\d.]+) dB/)?.[1]);
    const peakDb = Number(decoded.stderr.match(/max_volume: ([-\d.]+) dB/)?.[1]);
    assert(Number.isFinite(meanDb) && meanDb > -40 && meanDb < 0, `${name}: missing or silent narration`);
    assert(Number.isFinite(peakDb) && peakDb <= 0, `${name}: invalid audio peak`);
    const captions = await fs.readFile(path.join(directory, `${story.id}.vtt`), "utf8");
    assert(captions.startsWith("WEBVTT\n"));
    assert.equal(captions, `${captions.trimEnd()}\n`, `${name}: captions must end with one newline`);
    const cues = [...captions.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n([\s\S]*?)(?=\n\n|$)/g)];
    const expectedCues = measured.steps.flatMap(step => step.cues);
    assert.equal(cues.length, expectedCues.length);
    cues.forEach((cue, i) => {
      assert(Math.abs(seconds(cue[1]) - expectedCues[i].start) <= .001);
      assert(Math.abs(seconds(cue[2]) - expectedCues[i].start - expectedCues[i].duration) <= .001);
      assert.equal(cue[3].replace(/\s/g, ""), expectedCues[i].text.replace(/\s/g, ""));
    });
    const tutorial = catalog.find(item => item.id === story.id);
    assert(tutorial); assert.equal(tutorial.steps.length, 6);
    tutorial.steps.forEach((step, i) => assert(Math.abs(step.at - measured.steps[i].at) <= .001));
    for (const step of measured.steps) for (const cue of step.cues) {
      const wave = await probe(cue.file);
      assert(Math.abs(Number(wave.format.duration) - cue.duration) < .00003, `${name}: WAV alignment`);
    }
    const poster = await sharp(path.join(directory, `${story.id}.webp`)).metadata();
    assert.equal(poster.width, 960); assert.equal(poster.height, 720);
    const evidence = await json(path.join(work, `evidence/${name}.json`));
    assert.equal(evidence.motion.length, 6);
    const motion = [];
    // Compare only the screen region, excluding headers/subtitles. The camera
    // has stopped at 1.5s, so these frames document the mouse's visible route.
    for (const [index, step] of measured.steps.entries()) {
      const frames = [];
      for (const position of [1.8, 2.7]) {
        const file = path.join(work, `evidence/${name}-step${index + 1}-${position}.png`);
        await ffmpeg(["-ss", String(step.at + position), "-i", video, "-frames:v", "1", "-vf", "crop=1184:610:48:186", file]);
        frames.push(await sharp(file).removeAlpha().raw().toBuffer());
      }
      let changed = 0;
      for (let i = 0; i < frames[0].length; i += 3) if (Math.max(...[0, 1, 2].map(channel => Math.abs(frames[0][i + channel] - frames[1][i + channel]))) > 20) changed++;
      assert(changed > 100, `${name}/step${index + 1}: no visible pointer motion`);
      const action = evidence.motion[index];
      assert(/^http:\/\/127\.0\.0\.1:312[13](?:\/|$)/.test(action.source));
      assert.equal(action.captureLanguage, locale, `${name}: wrong screenshot language`);
      assert(action.target.width > 0 && action.target.height > 0);
      motion.push({ step: index + 1, changedPixels: changed, target: action.targetLabel, afterState: Boolean(action.after) });
    }
    const contactFrames = [];
    for (const at of [0.2, 2.25, 3.25, 4.3]) {
      const file = path.join(work, `evidence/${name}-full-${at}.png`);
      await ffmpeg(["-ss", String(at), "-i", video, "-frames:v", "1", file]);
      contactFrames.push(await sharp(file).resize(512, 384).toBuffer());
    }
    await sharp({ create: { width: 1024, height: 768, channels: 3, background: "#ffffff" } }).composite(contactFrames.map((input, i) => ({ input, left: (i % 2) * 512, top: Math.floor(i / 2) * 384 }))).png().toFile(path.join(work, `evidence/${name}-motion-sheet.png`));
    const assetBytes = await Promise.all(["mp4", "webp", "vtt"].map(async extension => {
      const file = path.join(directory, `${story.id}.${extension}`), data = extension === "mp4" ? bytes : await fs.readFile(file);
      return { path: `/${path.relative(path.join(root, "public"), file)}`, extension, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
    }));
    report.items.push({ locale, id: story.id, voice: measured.voice, rate: measured.rate, seconds: duration, bytes: bytes.length, assets: assetBytes, sha256: createHash("sha256").update(bytes).digest("hex"), decoded: true, meanDb, peakDb, faststart: true, captions: cues.length, chapters: tutorial.steps.map(step => step.at), motion });
    console.log(`Verified ${name}: ${duration}s, 6 moving steps, ${cues.length} aligned cues`);
  }
}
report.totalBytes = report.items.reduce((sum, item) => sum + item.assets.reduce((sum, asset) => sum + asset.bytes, 0), 0);
await fs.writeFile(path.join(work, `evidence/verification${requested === "all" ? "" : `-${requested}`}.json`), JSON.stringify(report, null, 2));
if (requested === "all") {
  assert.equal(report.items.length, 15);
  const manifest = { version: 1, generatedAt: report.generatedAt, format: report.format, totalBytes: report.totalBytes, episodes: report.items.map(({ motion, ...item }) => ({ ...item, verifiedMovingSteps: motion.length })) };
  await fs.writeFile(path.join(root, "scripts/tutorials/assets-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`Verified ${report.items.length} videos, ${(report.totalBytes / 1048576).toFixed(2)} MiB including posters and subtitles.`);
