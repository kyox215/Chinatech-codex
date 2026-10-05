import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const run = promisify(execFile);
export const root = process.cwd();
export const work = path.join(root, "scripts/tutorials/.work");
export const output = path.join(root, "public/tutorials");
export const locales = ["zh-CN", "it", "en"];
export const voices = { "zh-CN": "zh-CN-XiaoxiaoNeural", it: "it-IT-ElsaNeural", en: "en-US-JennyNeural" };
export const rates = { "zh-CN": "+5%", it: "+3%", en: "+2%" };
export const fps = 24;
export const ttsPython = process.env.TUTORIAL_TTS_PYTHON ?? path.resolve(root, "../tts-env/bin/python");
const oldWork = process.env.TUTORIAL_LEGACY_WORK ?? path.resolve(root, "..");

export function hash(value) { return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24); }
export async function exists(file) { return fs.access(file).then(() => true, () => false); }
export async function json(file, fallback) { return JSON.parse(await fs.readFile(file, "utf8").catch(error => { if (fallback === undefined) throw error; return JSON.stringify(fallback); })); }
export async function setup() { for (const name of ["audio", "frames", "segments", "evidence", "captures"]) await fs.mkdir(path.join(work, name), { recursive: true }); }
export async function storiesFor(locale) { return json(path.join(root, `scripts/tutorials/storyboard${locale === "zh-CN" ? "" : `.${locale}`}.json`)); }
export async function probe(file) { return JSON.parse((await run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { maxBuffer: 8e6 })).stdout); }
export async function ffmpeg(args) { return run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 8e6 }); }
export function clauses(text, locale) {
  if (locale !== "zh-CN") return (text.match(/[^.!?]+[.!?]?/gu) ?? [text]).map(text => text.trim()).filter(Boolean);
  return (text.match(/[^。！？]+[。！？]?/gu) ?? [text]).flatMap(sentence => [...sentence].length <= 48 ? [sentence] : sentence.match(/[^，；]+[，；]?/gu) ?? [sentence]);
}
export function voiceText(text, locale) {
  let value = text.replaceAll("ChinaTech", "China Tech").replaceAll("IMEI", "I M E I");
  if (locale === "zh-CN") value = value.replaceAll("Google", "谷歌");
  return value;
}
export function time(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
export function wrap(text, width = 38) {
  const words = /[\u3400-\u9fff]/u.test(text) ? [...text] : text.split(/(?<=\s)/u);
  const measure = part => [...part].reduce((sum, char) => sum + (/[\u3400-\u9fff]/u.test(char) ? 1 : /[MW@]/u.test(char) ? .85 : .53), 0);
  const rows = []; let row = "";
  for (const word of words) { if (row && measure(row + word) > width) { rows.push(row.trim()); row = ""; } row += word; }
  if (row.trim()) rows.push(row.trim());
  return rows;
}
export const esc = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

let legacy;
async function legacyAudio() {
  if (legacy) return legacy;
  legacy = new Map();
  const data = await json(path.join(oldWork, "media.json"), {});
  for (const [id, item] of Object.entries(data)) for (const [index, step] of item.steps.entries()) {
    for (const [cueIndex, text] of clauses(step.body, "zh-CN").entries()) {
      const file = path.join(oldWork, `audio/${id}-${index + 1}-${cueIndex + 1}-${voices["zh-CN"]}.mp3`);
      if (await exists(file)) legacy.set(voiceText(text, "zh-CN"), file);
    }
  }
  return legacy;
}
export async function prepareStoryAudio(locale, story) {
  const voice = voices[locale], rate = rates[locale];
  const steps = []; let elapsed = 0;
  for (const [index, step] of story.steps.entries()) {
    const start = elapsed, cues = [];
    for (const text of clauses(step.body, locale)) {
      const spokenText = voiceText(text, locale), key = hash(`${voice}|${rate}|${spokenText}`);
      const mp3 = path.join(work, `audio/${key}.mp3`), wav = path.join(work, `audio/${key}-aligned.wav`);
      let reused = false;
      if (!await exists(mp3)) {
        const old = locale === "zh-CN" ? (await legacyAudio()).get(spokenText) : null;
        if (old) { await fs.copyFile(old, mp3); reused = true; }
        else {
          let error;
          for (let attempt = 0; attempt < 2; attempt++) {
            try { await run(ttsPython, ["-m", "edge_tts", "--voice", voice, "--rate", rate, "--text", spokenText, "--write-media", mp3], { timeout: 50_000, maxBuffer: 2e6 }); error = null; break; }
            catch (reason) { error = reason; if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1500)); }
          }
          if (error) throw error;
        }
      }
      const spoken = Number((await probe(mp3)).format.duration);
      if (!Number.isFinite(spoken) || spoken < .3) throw new Error(`Invalid narration: ${locale}/${story.id}/${index + 1}`);
      const duration = Math.ceil((spoken + .24) * fps) / fps;
      // Trim by resampled sample count; output -t may stop between audio packets.
      const samples = Math.round(duration * 48000);
      if (!await exists(wav)) await ffmpeg(["-i", mp3, "-af", `loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad=whole_len=${samples},atrim=end_sample=${samples},asetpts=N/SR/TB`, "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", wav]);
      cues.push({ text, file: wav, spoken, duration, start: elapsed, reused }); elapsed += duration;
    }
    steps.push({ ...step, at: Number(start.toFixed(6)), duration: Number((elapsed - start).toFixed(6)), cues });
    console.log(`Audio ${locale}/${story.id}: ${index + 1}/6`);
  }
  const result = { id: story.id, voice, rate, seconds: Number(elapsed.toFixed(6)), steps };
  await fs.writeFile(path.join(work, `audio/${locale}-${story.id}.json`), JSON.stringify(result, null, 2));
  return result;
}

export async function writeCatalog() {
  const data = {};
  for (const locale of locales) {
    data[locale] = [];
    for (const story of await storiesFor(locale)) {
      const measured = await json(path.join(work, `audio/${locale}-${story.id}.json`));
      const seconds = Math.ceil(measured.seconds), prefix = locale === "zh-CN" ? "/tutorials" : `/tutorials/${locale}`;
      data[locale].push({ id: story.id, number: story.number, title: story.title, description: story.description, href: story.href, actionLabel: story.actionLabel,
        duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, src: `${prefix}/${story.id}.mp4`, poster: `${prefix}/${story.id}.webp`, captions: `${prefix}/${story.id}.vtt`,
        steps: measured.steps.map(({ title, body, at }) => ({ title, body, at: Number(at.toFixed(3)) })) });
    }
  }
  const types = `export type TutorialStep = { title: string; body: string; at: number };\nexport type Tutorial = { id: string; number: string; title: string; description: string; duration: string; src: string; poster: string; captions: string; href: string; actionLabel: string; steps: readonly TutorialStep[] };\nexport type TutorialLocale = "zh-CN" | "it" | "en";\n`;
  await fs.writeFile(path.join(root, "lib/tutorials.ts"), `${types}\n// Generated from the three storyboards and measured, frame-aligned narration.\nconst catalog: Record<TutorialLocale, readonly Tutorial[]> = ${JSON.stringify(data, null, 2)};\n\nexport const tutorials: readonly Tutorial[] = catalog["zh-CN"];\nexport function getTutorials(locale: TutorialLocale): readonly Tutorial[] { return catalog[locale]; }\n`);
}
