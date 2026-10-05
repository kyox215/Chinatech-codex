import { locales, setup, storiesFor, prepareStoryAudio, writeCatalog } from "./authoring.mjs";

await setup();
const requestedLocale = process.argv[2];
const selected = locales.filter(locale => !requestedLocale || requestedLocale === "all" || locale === requestedLocale);
if (!selected.length) throw new Error("Use zh-CN, it, en or all.");
const jobs = [];
for (const locale of selected) for (const story of await storiesFor(locale)) jobs.push({ locale, story });
async function worker() { for (;;) { const job = jobs.shift(); if (!job) return; await prepareStoryAudio(job.locale, job.story); } }
await Promise.all([worker(), worker()]);
try { await writeCatalog(); console.log("All measured language catalogs written."); }
catch (error) { if (error.code !== "ENOENT") throw error; console.log("Prepare all three languages before generating the catalog."); }
