import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { performance as clock } from "node:perf_hooks";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { installColorAnchorABAObservation, shouldRunColorAnchorABA } from "./color-picker-observation";

type Entry = Record<string, unknown>;
export type ABASample = { time: number; scrollY: number; inline: { top: string }; targetRect: { y: number }; open: boolean; paletteConnected: boolean; experiment?: { phase: string; valid: boolean } };

/** Exact raw-value classifier. Synthetic tests establish this classifier only. */
export function summarizeColorAnchorPhase(samples: ABASample[], phase: string, start: number, end: number) {
  const window = samples.filter(frame => frame.time >= start + 2000 && frame.time < end && frame.experiment?.phase === phase);
  const triples = window.map(frame => [frame.scrollY, Number.parseFloat(frame.inline.top), frame.targetRect?.y]);
  const complete = window.length >= 8 && window.every((frame, index) => frame.open && frame.paletteConnected && frame.experiment?.valid && (index === 0 || frame.time > window[index - 1].time)) && triples.every(values => values.every(Number.isFinite));
  const distinct = [0, 1, 2].map(axis => [...new Set(triples.map(values => values[axis]))].sort((a, b) => a - b));
  const deltas = triples.slice(1).map((values, index) => values.map((value, axis) => value - triples[index][axis]));
  const changes = deltas.filter(values => values.some(value => value !== 0));
  const loop = complete && distinct.every(values => values.length === 2 && values[1] - values[0] === 1) && changes.length >= 6 && changes.every(values => Math.abs(values[0]) === 1 && values[1] === values[0] && values[2] === values[0]);
  const stable = complete && distinct.every(values => values.length === 1);
  return { phase, fixedWindow: { start: start + 2000, end }, samples: window.length, complete, distinct, changes: changes.length, kind: !complete ? "insufficient" : loop ? "loop" : stable ? "stable" : "other" };
}

export function applyColorAnchorFactor(palette: HTMLElement, phase: string, original: { value: string; priority: string }) {
  if (phase === "B") palette.style.setProperty("overflow-anchor", "none");
  else if (phase === "A1" || phase === "cleanup") {
    if (palette.style.getPropertyValue("overflow-anchor") !== original.value || palette.style.getPropertyPriority("overflow-anchor") !== original.priority) {
      if (original.value === "") palette.style.removeProperty("overflow-anchor");
      else palette.style.setProperty("overflow-anchor", original.value, original.priority);
    }
  }
  return { value: palette.style.getPropertyValue("overflow-anchor"), priority: palette.style.getPropertyPriority("overflow-anchor"), computed: getComputedStyle(palette).getPropertyValue("overflow-anchor") };
}

/** Public fixed L/R1/R2/H/R3 protocol. No actionability/private API/native input. */
export function fixedColorAnchorDriver(options: { phase: string; token: number; baseX: number; baseY: number; deadline: number; current: () => boolean; read: () => Entry; natural: () => Entry[]; log: (value: Entry) => void }) {
  const ids = new Set<number>();
  const receipt: Entry = { phase: options.phase, token: options.token, started: performance.now(), low: options.baseY - 1, high: options.baseY, left: options.baseX, records: [] };
  const records = receipt.records as Entry[];
  let done = false, timer: number | null = null, resolve!: (value: Entry) => void;
  const promise = new Promise<Entry>(complete => { resolve = complete; });
  function finish(valid: boolean, reason: string) {
    if (done) return;
    done = true; for (const id of ids) cancelAnimationFrame(id); ids.clear(); if (timer !== null) clearTimeout(timer); timer = null;
    Object.assign(receipt, { valid, reason, finished: performance.now(), rafRemaining: ids.size, timerRemaining: timer !== null }); options.log({ kind: "driver-finish", ...receipt }); resolve(receipt);
  }
  const record = (step: string, extra: Entry = {}) => { const value = { step, time: performance.now(), actual: options.read(), ...extra }; records.push(value); options.log({ kind: "driver", phase: options.phase, token: options.token, ...value }); return value; };
  const valid = () => !done && options.current() && performance.now() < options.deadline;
  const queue = (callback: () => void) => { const id = requestAnimationFrame(() => { ids.delete(id); if (!valid()) { finish(false, "DRIVER_EXPIRED_OR_IDENTITY_CHANGED"); return; } callback(); }); ids.add(id); };
  if (!valid()) finish(false, "DRIVER_EXPIRED_OR_IDENTITY_CHANGED");
  else {
    record("before-L"); window.scrollTo({ left: options.baseX, top: options.baseY - 1, behavior: "instant" });
    record("immediate-L", { command: { method: "scrollTo", left: options.baseX, top: options.baseY - 1, behavior: "instant" } });
    if (scrollX !== options.baseX || scrollY !== options.baseY - 1) finish(false, "DRIVER_L_CLAMP_OR_MISMATCH");
    else {
      timer = window.setTimeout(() => finish(false, "DRIVER_NOT_PROCESSED_IN_FIXED_WINDOW"), Math.max(0, Math.ceil(options.deadline - performance.now())));
      queue(() => { record("R1", { naturalEvents: options.natural() }); queue(() => {
        record("R2-before-H"); window.scrollTo({ left: options.baseX, top: options.baseY, behavior: "instant" });
        record("immediate-H", { command: { method: "scrollTo", left: options.baseX, top: options.baseY, behavior: "instant" } });
        if (scrollX !== options.baseX || scrollY !== options.baseY) { finish(false, "DRIVER_H_CLAMP_OR_MISMATCH"); return; }
        queue(() => { const natural = options.natural(); record("R3", { naturalEvents: natural }); finish(natural.length > 0, natural.length ? "FIXED_DRIVER_PROCESSED" : "DRIVER_NOT_PROCESSED_IN_FIXED_WINDOW"); });
      }); });
    }
  }
  return { promise, cancel: (reason: string) => finish(false, reason), state: () => ({ done, rafRemaining: ids.size, timerRemaining: timer !== null }) };
}

/** Installed tools are first-party diagnostic functions, never application callbacks. */
export const colorAnchorToolsSource = () => `window.__siteUIColorAnchorSummarize=(${summarizeColorAnchorPhase.toString()});window.__siteUIColorAnchorFactor=(${applyColorAnchorFactor.toString()});window.__siteUIColorAnchorDriver=(${fixedColorAnchorDriver.toString()});`;

export async function colorAnchorABABrowserExperiment() {
  const globals = window as unknown as Record<string, unknown>;
  const summarize = globals.__siteUIColorAnchorSummarize as typeof summarizeColorAnchorPhase;
  const factor = globals.__siteUIColorAnchorFactor as typeof applyColorAnchorFactor;
  const driver = globals.__siteUIColorAnchorDriver as typeof fixedColorAnchorDriver;
  const observation = globals.__siteUIColorObservation as { frames: () => ABASample[]; state: () => Entry; finish: (reason: string) => Promise<unknown> } | undefined;
  const report: Entry = { status: "INCONCLUSIVE", p2: "OPEN", events: [], phases: [], identityStarted: performance.now(), timeOrigin: performance.timeOrigin };
  const events = report.events as Entry[], phases = report.phases as Entry[];
  const stream = globals.__siteUIColorAnchorABAStream as (packet: Entry) => Promise<unknown>;
  const pending = new Set<Promise<unknown>>(); let dropped = 0, eventSequence = 0;
  const log = (value: Entry) => {
    if (events.length >= 1024) { dropped++; if (!stopped) queueMicrotask(() => { void stop("INCONCLUSIVE", "ABA_EVENT_LIMIT"); }); return; }
    const entry = { time: performance.now(), ...value }; events.push(entry);
    if (pending.size >= 8) { dropped++; if (!stopped) queueMicrotask(() => { void stop("INCONCLUSIVE", "ABA_STREAM_BACKPRESSURE_DROP"); }); return; }
    const promise = Promise.resolve(stream({ sequence: ++eventSequence, ...entry })).catch(() => { dropped++; }).finally(() => pending.delete(promise)); pending.add(promise);
  };
  const structural = (node: Element | null) => node ? { tag: node.tagName, classes: [...node.classList].slice(0, 12) } : null;
  const regions = document.querySelectorAll('main.retail-detail section[aria-label="编辑颜色"]');
  const region = regions.length === 1 ? regions[0] : null;
  const pickers = region?.querySelectorAll(".color-picker"), picker = pickers?.length === 1 ? pickers[0] : null;
  const palettes = picker?.querySelectorAll<HTMLElement>(".color-picker__palette"), palette = palettes?.length === 1 ? palettes[0] : null;
  const details = picker?.querySelector("details"), anchor = details?.querySelector("summary");
  const radios = palette?.querySelectorAll<HTMLInputElement>('input[type="radio"][value="custom"]'), radio = radios?.length === 1 ? radios[0] : null, label = radio?.parentElement;
  const ancestors: Element[] = []; for (let parent = palette?.parentElement; parent && ancestors.length < 32; parent = parent.parentElement) ancestors.push(parent);
  const original = palette ? { value: palette.style.getPropertyValue("overflow-anchor"), priority: palette.style.getPropertyPriority("overflow-anchor"), computed: getComputedStyle(palette).getPropertyValue("overflow-anchor") } : null;
  const baseX = scrollX, baseY = scrollY;
  const rect = (node: Element | null | undefined) => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const factorState = () => palette ? { value: palette.style.getPropertyValue("overflow-anchor"), priority: palette.style.getPropertyPriority("overflow-anchor"), computed: getComputedStyle(palette).getPropertyValue("overflow-anchor") } : null;
  const read = () => ({ S: scrollY, x: scrollX, P: palette?.style.top ?? null, L: label ? label.getBoundingClientRect().y : null, target: rect(label), radio: rect(radio), anchor: rect(anchor), palette: rect(palette), open: details?.open ?? null, factor: factorState() });
  const initialViewport = JSON.stringify([innerWidth, innerHeight, devicePixelRatio, window.visualViewport?.width ?? null, window.visualViewport?.height ?? null, window.visualViewport?.scale ?? null, window.visualViewport?.offsetLeft ?? null, window.visualViewport?.offsetTop ?? null]);
  const originalActive = document.activeElement;
  const baselineOtherStyle = () => palette ? [...palette.style].filter(key => !["overflow-anchor", "top", "left", "max-height"].includes(key)).map(key => [key, palette.style.getPropertyValue(key), palette.style.getPropertyPriority(key)]) : [];
  const otherStyle = JSON.stringify(baselineOtherStyle());
  const computedAncestors = ancestors.map(node => ({ node: structural(node), overflowAnchor: getComputedStyle(node).getPropertyValue("overflow-anchor") }));
  report.preconditions = { supports: CSS.supports("overflow-anchor", "none"), original, ancestors: computedAncestors, counts: { regions: regions.length, pickers: pickers?.length ?? 0, palettes: palettes?.length ?? 0, radios: radios?.length ?? 0 }, baseX, baseY, snapshot: read(), activeElement: structural(document.activeElement), fontStatus: document.fonts?.status ?? null, viewport: initialViewport, pendingControls: document.querySelectorAll('[data-operation-recovery], [aria-busy="true"]').length };
  let phase = "precondition", token = 0, stopped = false, activeDriver: ReturnType<typeof fixedColorAnchorDriver> | null = null, phaseTimer: number | null = null, totalTimer: number | null = null, phaseStart = 0, phaseDeadline = 0, finalPhaseEnd: (() => void) | null = null;
  const cleanups: (() => void)[] = []; const natural: Entry[] = [];
  let resolve!: (value: Entry) => void; const result = new Promise<Entry>(done => { resolve = done; });
  async function stop(status: string, reason: string) {
    if (stopped) return; stopped = true; token++; activeDriver?.cancel("EXPERIMENT_STOPPED"); if (phaseTimer !== null) clearTimeout(phaseTimer); if (totalTimer !== null) clearTimeout(totalTimer); phaseTimer = null; totalTimer = null;
    const cleanupStart = performance.now(), beforeRestore = read();
    const restored = palette && original ? factor(palette, "cleanup", original) : null;
    const exact = !original || Boolean(restored && restored.value === original.value && restored.priority === original.priority && restored.computed === original.computed);
    for (const cleanup of cleanups.splice(0)) cleanup();
    log({ kind: "cleanup", status, reason, beforeRestore, restored, exact, topAfterRestore: palette?.style.top ?? null, timersRemaining: 0, listenersRemaining: cleanups.length, driver: activeDriver?.state() ?? null });
    const cleanup = observation ? await observation.finish("anchor-aba-cleanup") : null;
    await Promise.allSettled([...pending]);
    Object.assign(report, { status: exact && !dropped && performance.now() - cleanupStart <= 2000 ? status : "INCONCLUSIVE", reason: exact ? reason : "FACTOR_RESTORE_NOT_EXACT", dropped, cleanup: { start: cleanupStart, end: performance.now(), exact, rawObservation: cleanup, timersRemaining: 0, listenersRemaining: cleanups.length, pendingPackets: pending.size }, stoppedAt: performance.now() });
    resolve(report);
  }
  const invalidate = (reason: string) => { log({ kind: "invalidation", phase, token, reason, actual: read() }); void stop("INCONCLUSIVE", reason); };
  const validHost = () => Boolean(region?.isConnected && picker?.isConnected && palette?.isConnected && details?.open && anchor?.isConnected && label?.isConnected && radio?.isConnected && region.contains(palette) && radio.parentElement === label && document.activeElement === originalActive);
  const factorValid = () => {
    if (!palette || !original) return false;
    const current = factorState();
    return phase === "B" ? current?.value === "none" && current.priority === "" && current.computed === "none" : current?.value === original.value && current.priority === original.priority && current.computed === original.computed;
  };
  const current = () => !stopped && validHost() && JSON.stringify([innerWidth, innerHeight, devicePixelRatio, window.visualViewport?.width ?? null, window.visualViewport?.height ?? null, window.visualViewport?.scale ?? null, window.visualViewport?.offsetLeft ?? null, window.visualViewport?.offsetTop ?? null]) === initialViewport && JSON.stringify(baselineOtherStyle()) === otherStyle && factorValid();
  globals.__siteUIColorAnchorABA = { metadata() { const valid = current(); if (!stopped && !valid) queueMicrotask(() => invalidate("HOST_FACTOR_VIEWPORT_OR_STYLE_CHANGED")); return { phase, token, phaseStart, phaseDeadline, valid, factor: factorState(), activeElement: structural(document.activeElement) }; }, abort(reason: string) { return stop("INCONCLUSIVE", reason); } };
  log({ kind: "preconditions", ...report.preconditions as Entry });
  if (!observation?.frames || !region || !picker || !palette || !details?.open || !anchor || !radio || !label || !palette.isConnected || getComputedStyle(palette).position !== "fixed") { await stop("INCONCLUSIVE", "UNIQUE_OPEN_FIXED_HOST_NOT_PROVEN"); return result; }
  if (performance.now() - (report.identityStarted as number) > 2000) { await stop("INCONCLUSIVE", "IDENTITY_SUPPORT_BUDGET_EXCEEDED"); return result; }
  if (!CSS.supports("overflow-anchor", "none") || original?.computed !== "auto" || computedAncestors.some(value => value.overflowAnchor !== "auto")) { await stop("UNSUPPORTED_OR_NO_FACTOR_CONTRAST", "SUPPORT_COMPUTED_OR_ANCESTOR_NOT_CLEAN"); return result; }
  if ((report.preconditions as Entry).pendingControls !== 0 || document.fonts?.status === "loading" || !validHost() || baseY < 1) { await stop("INCONCLUSIVE", "INITIAL_IDENTITY_PENDING_FONT_OR_DRIVER_RANGE"); return result; }
  if (innerWidth !== 1024 || innerHeight !== 1000) { await stop("INCONCLUSIVE", "VIEWPORT_NOT_ORIGINAL_1024_1000"); return result; }
  const listen = (source: EventTarget, kind: string, callback: EventListener, capture = false) => { source.addEventListener(kind, callback, capture); cleanups.push(() => source.removeEventListener(kind, callback, capture)); };
  listen(document, "scroll", event => { if (event.target === document) { const entry = { time: performance.now(), phase, source: "document", trusted: event.isTrusted, x: scrollX, S: scrollY }; natural.push(entry); if (natural.length > 2048) { invalidate("NATURAL_EVENT_LIMIT"); return; } log({ kind: "natural-scroll", ...entry }); } }, true);
  for (const kind of ["pointerdown", "click", "keydown", "focusin", "focusout"]) listen(document, kind, event => { invalidate(`UNEXPECTED_${event.type}`); }, true);
  listen(window, "resize", () => invalidate("WINDOW_RESIZE"));
  if (window.visualViewport) listen(window.visualViewport, "resize", () => invalidate("VISUAL_VIEWPORT_CHANGE"));
  if (document.fonts) for (const kind of ["loading", "loadingdone", "loadingerror"]) listen(document.fonts, kind, () => invalidate("FONT_CHANGE"));
  const mutation = new MutationObserver(records => {
    for (const record of records) {
      log({ kind: "factor-or-ancestor-mutation", phase, token, source: structural(record.target as Element), attribute: record.attributeName, actual: read() });
      if (record.target !== palette || !current()) { invalidate("FACTOR_ANCESTOR_OR_OTHER_STYLE_MUTATION"); return; }
    }
  });
  mutation.observe(palette, { attributes: true, attributeFilter: ["style"] }); for (const ancestor of ancestors) mutation.observe(ancestor, { attributes: true, attributeFilter: ["style", "class", "open"] }); cleanups.push(() => mutation.disconnect());
  const experimentStart = performance.now(); report.experimentStart = experimentStart; report.experimentalDeadline = experimentStart + 12000;
  async function begin(index: number) {
    if (stopped) return;
    phase = ["A0", "B", "A1"][index]; token++; const ownToken = token;
    phaseStart = experimentStart + index * 4000; phaseDeadline = phaseStart + 4000;
    if (performance.now() >= phaseDeadline || !validHost()) { invalidate("PHASE_START_EXPIRED_OR_IDENTITY"); return; }
    const stage: Entry = { phase, token, scheduledStart: phaseStart, deadline: phaseDeadline, factorBefore: read(), actualStart: performance.now(), driftMs: performance.now() - phaseStart }; phases.push(stage);
    factor(palette!, phase, original!); log({ kind: "phase-factor", phase, token, scheduledStart: phaseStart, deadline: phaseDeadline, actual: read() });
    if (!current()) { invalidate("PHASE_FACTOR_NOT_EFFECTIVE"); return; }
    const driverStart = performance.now(); let receipt: Entry | null = null;
    activeDriver = driver({ phase, token, baseX, baseY, deadline: phaseDeadline, current: () => token === ownToken && current(), read, log, natural: () => natural.filter(event => (event.time as number) >= driverStart && event.trusted === true) });
    void activeDriver.promise.then(value => { receipt = value; stage.driver = value; if (!stopped && token === ownToken && value.valid !== true) invalidate(String(value.reason)); });
    const end = () => {
      phaseTimer = null; if (stopped || token !== ownToken) return;
      if (!receipt || receipt.valid !== true || !current()) { invalidate("DRIVER_MISSING_OR_STAGE_INVALID"); return; }
      const state = observation!.state();
      if (["droppedFrames", "droppedEvents", "sendFailures", "discoveryGaps"].some(key => state[key] !== 0)) { invalidate("OBSERVATION_GAP_OR_DROP"); return; }
      const summary = summarize(observation!.frames(), phase, phaseStart, phaseDeadline); stage.summary = summary; stage.actualEnd = performance.now(); stage.endDriftMs = performance.now() - phaseDeadline; log({ kind: "phase-end", phase, token, summary, actual: read() });
      if (!summary.complete) { void stop("INCONCLUSIVE", "INSUFFICIENT_FIXED_WINDOW_SAMPLES"); return; }
      if (index === 0 && summary.kind !== "loop") { void stop("BASELINE_NOT_REPRODUCED", "A0_NO_SUSTAINED_ONE_PIXEL_LOOP"); return; }
      if (index === 1 && summary.kind !== "stable") { void stop("FACTOR_DID_NOT_ELIMINATE_OBSERVED_LOOP", "B_NOT_SINGLE_VALUED"); return; }
      if (index === 2) { void stop(summary.kind === "loop" ? "palette-policy-causal-control-supported" : "NON_REVERSIBLE_OR_PATH_DEPENDENT", summary.kind === "loop" ? "MATCHED_DRIVER_A_LOOP_B_STABLE_A_LOOP" : "A1_DID_NOT_RESTORE_LOOP"); return; }
      void begin(index + 1);
    };
    if (index === 2) finalPhaseEnd = end;
    else phaseTimer = window.setTimeout(end, Math.max(0, Math.ceil(phaseDeadline - performance.now())));
  }
  totalTimer = window.setTimeout(() => { totalTimer = null; if (stopped) return; if (phase === "A1" && finalPhaseEnd) finalPhaseEnd(); else invalidate("EXPERIMENT_WINDOW_DEADLINE"); }, Math.ceil(experimentStart + 12000 - performance.now()));
  void begin(0); return result;
}

export async function runColorAnchorABA(page: Page, info: TestInfo) {
  const started = clock.now(), setupDeadline = started + 10000;
  const report: Entry = { schemaVersion: 1, diagnosticOnly: true, p2: "OPEN", status: "INCONCLUSIVE", started, budget: { total: 30000, setup: 10000, identity: 2000, phases: [4000, 4000, 4000], cleanup: 2000, reserve: 4000 }, businessHashes: [], actions: [] };
  const actions = report.actions as Entry[], businessHashes = report.businessHashes as Entry[];
  const output = info.outputPath("color-anchor-aba.json"), streamPath = info.outputPath("color-anchor-aba-stream.jsonl"); mkdirSync(dirname(output), { recursive: true });
  let streamSequence = 0; const streamEntries: Entry[] = []; const streamErrors: string[] = [], streamCostsMs: number[] = [];
  let observation: Awaited<ReturnType<typeof installColorAnchorABAObservation>> | null = null;
  async function bounded<T>(operation: string, action: (remaining: number) => Promise<T>, deadline = setupDeadline): Promise<T> {
    const remaining = Math.floor(deadline - clock.now()); if (remaining <= 0) throw new Error(`BUDGET_EXHAUSTED:${operation}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { const result = await Promise.race([action(remaining), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`BUDGET_EXHAUSTED:${operation}`)), remaining); })]); actions.push({ operation, remainingAtStart: remaining, finished: clock.now() - started }); return result; }
    finally { if (timer) clearTimeout(timer); }
  }
  const hashStore = () => bounded("hash-DEMO-retail-store", () => page.evaluate(async () => {
    if (!crypto.subtle) throw new Error("DEMO_HASH_API_UNAVAILABLE");
    const data = new TextEncoder().encode(JSON.stringify(localStorage.getItem("chinatech.m1.retail.v1")));
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(value => value.toString(16).padStart(2, "0")).join("");
  }));
  try {
    if (!shouldRunColorAnchorABA(info)) throw new Error("INDEPENDENT_ABA_GUARD_NOT_MATCHED");
    observation = await bounded("install-ABA-raw-collector", () => installColorAnchorABAObservation(page, info));
    await bounded("install-ABA-tools", () => page.addInitScript({ content: colorAnchorToolsSource() }));
    await bounded("install-ABA-stream", () => page.exposeBinding("__siteUIColorAnchorABAStream", (source, packet: Entry) => {
      const bindingStart = clock.now();
      if (source.frame !== page.mainFrame() || !packet || typeof packet !== "object" || JSON.stringify(packet).length > 512000) { streamErrors.push("ABA_STREAM_SOURCE_OR_SIZE"); return; }
      if (streamEntries.length >= 4096) { streamErrors.push("ABA_STREAM_LIMIT"); return; }
      if (packet.sequence !== streamSequence + 1) streamErrors.push("ABA_STREAM_SEQUENCE_GAP");
      streamEntries.push(packet); streamSequence++;
      try { appendFileSync(streamPath, JSON.stringify(packet) + "\n"); } catch (error) { streamErrors.push(String(error)); }
      streamCostsMs.push(clock.now() - bindingStart);
    }));
    const response = await bounded("preview-session", timeout => page.request.post("/api/preview-session", { timeout, data: { email: "demo@chinatech.local", password: "Preview2026!" } }));
    if (response.status() !== 200) throw new Error("PREVIEW_SESSION_NOT_200");
    await bounded("initial-retail-route", timeout => page.goto("/app/retail/units/demo-unit-1", { timeout }));
    for (const width of [1440, 1024]) {
      await bounded(`viewport-${width}`, () => page.setViewportSize({ width, height: 1000 }));
      const toggles = await bounded(`groups-${width}`, () => page.locator('[data-retail-group] > button[aria-expanded="false"]').all());
      for (const toggle of toggles) if (await bounded("group-visible", () => toggle.isVisible())) await bounded("group-toggle", timeout => toggle.click({ timeout }));
      await bounded(`edit-color-${width}`, timeout => page.getByRole("button", { name: "编辑颜色", exact: true }).click({ timeout }));
      const editor = page.getByRole("region", { name: "编辑颜色", exact: true });
      await bounded("editor-visible", timeout => expect(editor).toBeVisible({ timeout }));
      const before = await hashStore(); businessHashes.push({ width, stage: "before-color", sha256: before });
      await bounded(`open-palette-${width}`, timeout => editor.getByLabel("选择设备颜色", { exact: true }).click({ timeout }));
      if (width === 1024) break;
      await bounded("original-1440-label-click", timeout => editor.getByRole("radio", { name: "其他颜色", exact: true }).locator("..").click({ timeout }));
      await bounded("original-1440-fill", timeout => editor.getByRole("textbox", { name: "其他颜色", exact: true }).fill("DEMO unsaved custom color", { timeout }));
      await bounded("original-1440-cancel", timeout => editor.getByRole("button", { name: "取消", exact: true }).click({ timeout }));
      await bounded("editor-closed", timeout => expect(editor).toHaveCount(0, { timeout }));
      await bounded("original-real-reload", timeout => page.reload({ timeout }));
      const after = await hashStore(); businessHashes.push({ width, stage: "after-real-reload", sha256: after });
      if (before !== after) throw new Error("DEMO_STORE_CHANGED_AFTER_CANCEL_RELOAD");
      await bounded("retail-heading-after-reload", timeout => expect(page.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible({ timeout }));
      if (!await bounded("original-overflow-check", () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) throw new Error("ORIGINAL_HORIZONTAL_OVERFLOW");
    }
    report.setupFinished = clock.now() - started;
    report.experiment = await bounded("fixed-ABA-browser-experiment", () => page.evaluate(colorAnchorABABrowserExperiment), clock.now() + 16000);
    report.status = (report.experiment as Entry).status;
    const finalHash = await bounded("final-DEMO-hash", () => page.evaluate(async () => {
      const input = new TextEncoder().encode(JSON.stringify(localStorage.getItem("chinatech.m1.retail.v1")));
      return [...new Uint8Array(await crypto.subtle.digest("SHA-256", input))].map(value => value.toString(16).padStart(2, "0")).join("");
    }), clock.now() + 1000);
    businessHashes.push({ stage: "after-experiment", sha256: finalHash }); if (businessHashes.some(value => value.sha256 !== finalHash)) { report.status = "INCONCLUSIVE"; report.reason = "DEMO_STORE_HASH_CHANGED"; }
  } catch (error) { report.status = "INCONCLUSIVE"; report.reason = String(error); }
  finally {
    const cleanupStart = clock.now(), cleanupDeadline = cleanupStart + 2000;
    if (!page.isClosed()) {
      try { await bounded("abort-or-confirm-ABA-cleanup", () => page.evaluate(async () => { const controller = (window as unknown as Record<string, { abort?: (reason: string) => Promise<unknown> }>).__siteUIColorAnchorABA; await controller?.abort?.("NODE_FINALLY"); }), cleanupStart + 1000); }
      catch (error) { report.status = "INCONCLUSIVE"; report.abortCleanupError = String(error); }
    } else { report.status = "INCONCLUSIVE"; report.abortCleanupError = "page closed; exact restoration and cleanup could not be checked"; }
    if (observation) {
      try { const raw = await bounded("raw-collector-cleanup", () => observation!.finish(), cleanupDeadline); report.rawInputSha256 = raw.inputSha256; report.rawTransport = raw.transport; const seq = new Map<string, number>(); const gap = raw.packets.some(packet => { const previous = seq.get(packet.documentId) ?? 0; seq.set(packet.documentId, packet.sequence); return packet.sequence !== previous + 1; }); report.rawSequenceGap = gap; if (gap || raw.cleanupUnavailable || raw.transport.rejectedPackets || raw.transport.collectorErrors.length || raw.transport.lastStates && Object.values(raw.transport.lastStates).some(state => state && ["droppedFrames", "droppedEvents", "sendFailures", "discoveryGaps"].some(key => (state as Entry)[key] !== 0))) report.status = "INCONCLUSIVE"; }
      catch (error) { report.status = "INCONCLUSIVE"; report.rawCleanupError = String(error); }
    }
    report.cleanupNodeMs = clock.now() - cleanupStart; report.finishedMs = clock.now() - started; report.stream = { entries: streamSequence, errors: streamErrors, bindingCostsMs: streamCostsMs, path: streamPath }; if ((report.finishedMs as number) > 30000 || (report.cleanupNodeMs as number) > 2000 || streamErrors.length) report.status = "INCONCLUSIVE";
    report.causalLimit = "Diagnostic only; neither observed green nor B convergence is a product fix or P2 closure. Exact original native case remains required.";
    report.streamSha256 = streamEntries.length ? createHash("sha256").update(streamEntries.map(entry => JSON.stringify(entry)).join("\n") + "\n").digest("hex") : null;
    const temporary = output + ".tmp"; writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n"); renameSync(temporary, output); await info.attach("color-anchor-aba", { path: output, contentType: "application/json" });
  }
  return report;
}
