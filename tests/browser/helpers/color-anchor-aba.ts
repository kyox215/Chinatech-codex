import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { performance as clock } from "node:perf_hooks";
import { expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type TestInfo } from "@playwright/test";
import { installColorAnchorABAObservation, shouldRunColorAnchorABA } from "./color-picker-observation";

type Entry = Record<string, unknown>;
type SampleId = "A0" | "B" | "A1";
export type ABASample = { time: number; scrollY: number; inline: { top: string }; targetRect: { y: number }; open: boolean; paletteConnected: boolean; experiment?: { phase: string; valid: boolean } };

export function summarizeColorAnchorPhase(samples: ABASample[], phase: string, start: number, end: number) {
  const selected = samples.filter(frame => frame.time >= start + 2000 && frame.time < end && frame.experiment?.phase === phase);
  const triples = selected.map(frame => [frame.scrollY, Number.parseFloat(frame.inline.top), frame.targetRect?.y]);
  const complete = selected.length >= 8 && selected.every((frame, index) => frame.open && frame.paletteConnected && frame.experiment?.valid && (index === 0 || frame.time > selected[index - 1].time)) && triples.every(values => values.every(Number.isFinite));
  const distinct = [0, 1, 2].map(axis => [...new Set(triples.map(values => values[axis]))].sort((a, b) => a - b));
  const changes = triples.slice(1).map((values, index) => values.map((value, axis) => value - triples[index][axis])).filter(values => values.some(value => value !== 0));
  const loop = complete && distinct.every(values => values.length === 2 && values[1] - values[0] === 1) && changes.length >= 6 && changes.every(values => Math.abs(values[0]) === 1 && values[1] === values[0] && values[2] === values[0]);
  return { phase, fixedWindow: { start: start + 2000, end }, samples: selected.length, complete, distinct, changes: changes.length, kind: !complete ? "insufficient" : loop ? "loop" : distinct.every(values => values.length === 1) ? "stable" : "other" };
}

export function restoreFreshColorPolicy(palette: HTMLElement, original: { value: string; priority: string }) {
  if (palette.style.getPropertyValue("overflow-anchor") !== original.value || palette.style.getPropertyPriority("overflow-anchor") !== original.priority) {
    if (original.value === "") palette.style.removeProperty("overflow-anchor");
    else palette.style.setProperty("overflow-anchor", original.value, original.priority);
  }
  return { value: palette.style.getPropertyValue("overflow-anchor"), priority: palette.style.getPropertyPriority("overflow-anchor"), computed: getComputedStyle(palette).getPropertyValue("overflow-anchor") };
}

export const freshColorToolsSource = () => `window.__siteUIColorAnchorSummarize=(${summarizeColorAnchorPhase.toString()});window.__siteUIColorAnchorRestore=(${restoreFreshColorPolicy.toString()});`;

/** Closed-state arming only. Clock is supplied by the existing true-toggle capture. */
export function prepareFreshColorOpen(options: { sampleId: SampleId; contextId: string }) {
  const globals = window as unknown as Record<string, unknown>;
  const observation = globals.__siteUIColorObservation as { frames: () => ABASample[]; state: () => Entry; finish: (reason: string) => Promise<unknown> } | undefined;
  const summarize = globals.__siteUIColorAnchorSummarize as typeof summarizeColorAnchorPhase;
  const restore = globals.__siteUIColorAnchorRestore as typeof restoreFreshColorPolicy;
  const send = globals.__siteUIColorAnchorABAStream as (entry: Entry) => Promise<unknown>;
  const report: Entry = { experiment: "fresh-open-v2", ...options, documentId: `color-document-${performance.timeOrigin}`, timeOrigin: performance.timeOrigin, status: "INCONCLUSIVE", p2: "OPEN", events: [] };
  const events = report.events as Entry[], pending = new Set<Promise<unknown>>(), cleanups: (() => void)[] = [];
  let sequence = 0, dropped = 0, stopped = false, firstOpen: number | null = null, deadline: number | null = null, timer: number | null = null, ready = false, openMutationSeen = false;
  let resolve!: (value: Entry) => void; const result = new Promise<Entry>(done => { resolve = done; });
  const structure = (node: EventTarget | null) => node instanceof Element ? { tag: node.tagName, classes: [...node.classList].slice(0, 12) } : node === document ? { tag: "DOCUMENT" } : null;
  const regions = document.querySelectorAll('main.retail-detail section[aria-label="编辑颜色"]'), region = regions.length === 1 ? regions[0] : null;
  const pickers = region?.querySelectorAll(".color-picker"), picker = pickers?.length === 1 ? pickers[0] : null;
  const palettes = picker?.querySelectorAll<HTMLElement>(".color-picker__palette"), palette = palettes?.length === 1 ? palettes[0] : null;
  const details = picker?.querySelector("details"), anchor = details?.querySelector("summary"), radios = palette?.querySelectorAll<HTMLInputElement>('input[type="radio"][value="custom"]'), radio = radios?.length === 1 ? radios[0] : null, label = radio?.parentElement;
  const ancestors: Element[] = []; for (let node = palette?.parentElement; node && ancestors.length < 32; node = node.parentElement) ancestors.push(node);
  const policy = () => palette ? { value: palette.style.getPropertyValue("overflow-anchor"), priority: palette.style.getPropertyPriority("overflow-anchor"), computed: getComputedStyle(palette).getPropertyValue("overflow-anchor") } : null;
  const original = policy();
  const viewport = () => [innerWidth, innerHeight, devicePixelRatio, window.visualViewport?.width ?? null, window.visualViewport?.height ?? null, window.visualViewport?.scale ?? null, window.visualViewport?.offsetLeft ?? null, window.visualViewport?.offsetTop ?? null];
  const initialViewport = JSON.stringify(viewport());
  const otherStyle = () => palette ? [...palette.style].filter(key => !["overflow-anchor", "top", "left", "width", "max-height"].includes(key)).map(key => [key, palette.style.getPropertyValue(key), palette.style.getPropertyPriority(key)]) : [];
  const initialOtherStyle = JSON.stringify(otherStyle());
  const fonts = [label, radio, anchor, palette].map(node => { if (!node) return null; const style = getComputedStyle(node); return { node: structure(node), family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight, textAdjust: style.getPropertyValue("text-size-adjust"), webkitTextAdjust: style.getPropertyValue("-webkit-text-size-adjust") }; });
  const originalAncestors = ancestors.map(node => ({ node: structure(node), overflowAnchor: getComputedStyle(node).getPropertyValue("overflow-anchor") }));
  const signature = { viewport: viewport(), scroll: { x: scrollX, y: scrollY }, fonts, fontStatus: document.fonts?.status ?? null, position: palette ? { computedPosition: getComputedStyle(palette).position, width: palette.style.width, left: palette.style.left, top: palette.style.top, maxHeight: palette.style.maxHeight } : null, original, ancestors: originalAncestors };
  report.signature = signature; report.preconditions = { supports: CSS.supports("overflow-anchor", "none"), original, counts: { regions: regions.length, pickers: pickers?.length ?? 0, palettes: palettes?.length ?? 0, radios: radios?.length ?? 0 }, closed: details?.open === false, activeElement: structure(document.activeElement), S: scrollY, x: scrollX, pendingControls: document.querySelectorAll('[data-operation-recovery], [aria-busy="true"]').length };
  const log = (kind: string, extra: Entry = {}) => {
    const value = { sequence: ++sequence, experiment: "fresh-open-v2", ...options, time: performance.now(), kind, S: scrollY, x: scrollX, open: details?.open ?? null, factor: policy(), ...extra };
    if (events.length >= 1024 || pending.size >= 8) { dropped++; if (!stopped) queueMicrotask(() => { void finish("INCONCLUSIVE", "EVENT_OR_STREAM_LIMIT"); }); return; }
    events.push(value); const task = Promise.resolve(send(value)).catch(() => { dropped++; }).finally(() => pending.delete(task)); pending.add(task);
  };
  const validHost = () => Boolean(region?.isConnected && picker?.isConnected && palette?.isConnected && radio?.isConnected && label?.isConnected && anchor?.isConnected && region.contains(palette) && radio.parentElement === label);
  const validPolicy = () => { const current = policy(); return options.sampleId === "B" ? current?.value === "none" && current.priority === "" && current.computed === "none" : current?.value === original?.value && current?.priority === original?.priority && current?.computed === "auto"; };
  const valid = () => validHost() && validPolicy() && JSON.stringify(viewport()) === initialViewport && JSON.stringify(otherStyle()) === initialOtherStyle && (firstOpen === null || details?.open === true);
  async function finish(status: string, reason: string) {
    if (stopped) return; stopped = true; ready = false; const cleanupStart = performance.now(); if (timer !== null) clearTimeout(timer); timer = null;
    for (const cleanup of cleanups.splice(0)) cleanup();
    const summary = firstOpen !== null && deadline !== null && observation?.frames ? summarize(observation.frames(), options.sampleId, firstOpen, deadline) : null;
    const restored = palette && original ? restore(palette, original) : null;
    const exact = Boolean(original && restored && restored.value === original.value && restored.priority === original.priority && restored.computed === original.computed);
    log("cleanup", { reason, restored, exact, topAfter: palette?.style.top ?? null, listenersRemaining: cleanups.length, timerRemaining: false });
    const rawCleanup = observation ? await observation.finish("fresh-open-v2-cleanup") : null; await Promise.allSettled([...pending]);
    const state = observation?.state(); const gaps = state ? ["droppedFrames", "droppedEvents", "sendFailures", "discoveryGaps"].some(key => state[key] !== 0) : true;
    Object.assign(report, { status: exact && !gaps && !dropped && performance.now() - cleanupStart <= 2000 ? status : "INCONCLUSIVE", reason, firstOpen, deadline, windowStoppedAt: cleanupStart, windowStopDriftMs: deadline === null ? null : cleanupStart - deadline, actualEnd: performance.now(), summary, dropped, cleanup: { exact, restored, rawCleanup, durationMs: performance.now() - cleanupStart, listenersRemaining: cleanups.length, timerRemaining: false, pendingPackets: pending.size } }); resolve(report);
  }
  const abort = (reason: string) => { if (stopped) return; log("invalidation", { reason }); return finish("INCONCLUSIVE", reason); };
  globals.__siteUIColorAnchorABA = {
    metadata() { const current = valid(); if (!stopped && !current) queueMicrotask(() => { void abort("HOST_POLICY_VIEWPORT_OR_STYLE_CHANGED"); }); return { experiment: "fresh-open-v2", ...options, phase: options.sampleId, valid: current && !stopped, firstOpen, deadline, factor: policy() }; },
    onToggle(open: boolean, time: number) {
      if (stopped) return; log("true-toggle-capture", { capturedTime: time });
      if (!open || firstOpen !== null || !valid()) { void abort("UNEXPECTED_TOGGLE_OR_IDENTITY"); return; }
      firstOpen = time; deadline = time + 4000;
      timer = window.setTimeout(() => { timer = null; void finish("SAMPLE_OBSERVED", "FIXED_FIRST_OPEN_WINDOW_COMPLETE"); }, Math.max(0, Math.ceil(deadline - performance.now())));
    }, wait: () => result, abort, snapshot: () => ({ ready, firstOpen, deadline, timeOrigin: performance.timeOrigin, signature, stopped }),
  };
  log("closed-preconditions", { signature, preconditions: report.preconditions });
  if (!observation?.frames || !validHost() || !details || details.open || !original || original.value !== "" || original.priority !== "" || original.computed !== "auto" || !CSS.supports("overflow-anchor", "none") || originalAncestors.some(value => value.overflowAnchor !== "auto")) { void finish("INCONCLUSIVE", "UNSUPPORTED_OR_UNIQUE_CLOSED_POLICY_NOT_PROVEN"); return { ready: false, signature }; }
  if (document.fonts?.status !== "loaded" || innerWidth !== 1024 || innerHeight !== 1000 || (report.preconditions as Entry).pendingControls !== 0) { void finish("INCONCLUSIVE", "FONT_VIEWPORT_OR_PENDING_PRECONDITION"); return { ready: false, signature }; }
  const listen = (source: EventTarget, kind: string, callback: EventListener, capture = false) => { source.addEventListener(kind, callback, capture); cleanups.push(() => source.removeEventListener(kind, callback, capture)); };
  for (const kind of ["pointerdown", "click", "keydown", "focusin", "focusout"]) listen(document, kind, event => {
    log(event.type, { source: structure(event.target), activeElement: structure(document.activeElement) });
    if (firstOpen !== null || event.type === "keydown" || (["pointerdown", "click"].includes(event.type) && !(event.target instanceof Node && anchor?.contains(event.target)))) void abort("UNEXPECTED_INPUT_OR_FOCUS");
  }, true);
  listen(window, "resize", () => { void abort("RESIZE"); }); if (window.visualViewport) listen(window.visualViewport, "resize", () => { void abort("VISUAL_VIEWPORT_CHANGE"); });
  if (document.fonts) for (const kind of ["loading", "loadingdone", "loadingerror"]) listen(document.fonts, kind, () => { void abort("FONT_CHANGE"); });
  const mutation = new MutationObserver(records => { for (const record of records) {
    log("mutation", { source: structure(record.target), attribute: record.attributeName });
    const expectedOpen = record.target === details && record.attributeName === "open" && details.open && !openMutationSeen;
    if (expectedOpen) openMutationSeen = true;
    if (!expectedOpen && (record.target !== palette || !valid())) { void abort("HOST_FACTOR_OR_ANCESTOR_MUTATION"); return; }
  } });
  mutation.observe(palette!, { attributes: true, attributeFilter: ["style"], attributeOldValue: true }); for (const ancestor of ancestors) mutation.observe(ancestor, { attributes: true, attributeFilter: ["class", "style", "open"] }); cleanups.push(() => mutation.disconnect());
  if (options.sampleId === "B") palette!.style.setProperty("overflow-anchor", "none");
  log("policy-before-original-click"); if (!valid()) { void abort("POLICY_NOT_EFFECTIVE_BEFORE_OPEN"); return { ready: false, signature }; }
  ready = true; return { ready, signature };
}

async function storeHash(page: Page) {
  return page.evaluate(async () => { const input = new TextEncoder().encode(JSON.stringify(localStorage.getItem("chinatech.m1.retail.v1"))); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", input))].map(value => value.toString(16).padStart(2, "0")).join(""); });
}

export async function runColorAnchorABA(browser: Browser, info: TestInfo) {
  const outerStart = clock.now(), samples: Entry[] = [];
  const report: Entry = { experiment: "fresh-open-v2", diagnosticOnly: true, p2: "OPEN", ciSha: process.env.GITHUB_SHA ?? null, status: "INCONCLUSIVE", samples, notExecuted: ["A0", "B", "A1"], budget: { sample: 18000, setup: 10000, policyAndOriginalOpen: 2000, firstOpenWindow: 4000, cleanup: 2000, outer: 60000 } };
  if (!shouldRunColorAnchorABA(info)) throw new Error("FRESH_OPEN_GUARD_NOT_MATCHED");
  const output = info.outputPath("color-anchor-aba.json"); mkdirSync(dirname(output), { recursive: true });
  let expectedSignature: string | null = null, expectedStoreHash: string | null = null;
  for (const sampleId of ["A0", "B", "A1"] as const) {
    const start = clock.now(), setupDeadline = start + 10000, sample: Entry = { experiment: "fresh-open-v2", sampleId, contextId: `fresh-${sampleId}`, status: "INCONCLUSIVE", actions: [], storeHashes: [], stream: [] }; samples.push(sample); report.notExecuted = (["A0", "B", "A1"] as const).slice(samples.length);
    let context: BrowserContext | null = null, page: Page | null = null, observer: Awaited<ReturnType<typeof installColorAnchorABAObservation>> | null = null, cleanupDeadline = start + 18000;
    let lateContext = false; const streamPath = info.outputPath(`color-anchor-aba-${sampleId}-stream.jsonl`); const streamCosts: number[] = [];
    async function bounded<T>(name: string, action: (remaining: number) => Promise<T>, deadline = setupDeadline): Promise<T> {
      const remaining = Math.floor(Math.min(deadline, outerStart + 60000) - clock.now()); if (remaining <= 0) throw new Error(`BUDGET:${name}`); let timer: ReturnType<typeof setTimeout> | undefined;
      try { const value = await Promise.race([action(remaining), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`BUDGET:${name}`)), remaining); })]); (sample.actions as Entry[]).push({ name, remaining, finishedMs: clock.now() - start }); return value; }
      finally { if (timer) clearTimeout(timer); }
    }
    try {
      const use = info.project.use; const options: BrowserContextOptions = { baseURL: use.baseURL, viewport: use.viewport, userAgent: use.userAgent, deviceScaleFactor: use.deviceScaleFactor, isMobile: use.isMobile, hasTouch: use.hasTouch, locale: use.locale, colorScheme: use.colorScheme, reducedMotion: use.reducedMotion, forcedColors: use.forcedColors, timezoneId: use.timezoneId };
      const creation = browser.newContext(options); void creation.then(value => { if (lateContext) void value.close().catch(() => { sample.lateContextCleanupUnconfirmed = true; }); }, () => undefined); context = await bounded("fresh-context", () => creation); page = await bounded("fresh-page", () => context!.newPage());
      observer = await bounded("raw-collector", () => installColorAnchorABAObservation(page!, info, sampleId)); await bounded("tools", () => page!.addInitScript({ content: freshColorToolsSource() }));
      await bounded("sample-stream", () => page!.exposeBinding("__siteUIColorAnchorABAStream", (source, packet: Entry) => {
        const before = clock.now(); const stream = sample.stream as Entry[];
        if (source.frame !== page!.mainFrame() || stream.length >= 1024 || JSON.stringify(packet).length > 512000) { sample.streamGap = true; return; }
        if (packet.sequence !== stream.length + 1) sample.streamGap = true; stream.push(packet); try { appendFileSync(streamPath, JSON.stringify(packet) + "\n"); } catch (error) { sample.streamError = String(error); } streamCosts.push(clock.now() - before);
      }));
      const session = await bounded("preview-session", timeout => context!.request.post("/api/preview-session", { timeout, data: { email: "demo@chinatech.local", password: "Preview2026!" } })); if (session.status() !== 200) throw new Error("PREVIEW_SESSION_NOT_200");
      await bounded("retail-route", timeout => page!.goto("/app/retail/units/demo-unit-1", { timeout }));
      for (const width of [1440, 1024]) {
        await bounded(`viewport-${width}`, () => page!.setViewportSize({ width, height: 1000 }));
        const toggles = await bounded("original-group-targets", () => page!.locator('[data-retail-group] > button[aria-expanded="false"]').all());
        for (const toggle of toggles) if (await bounded("group-visible", () => toggle.isVisible())) await bounded("original-group-click", timeout => toggle.click({ timeout }));
        await bounded("original-editor-click", timeout => page!.getByRole("button", { name: "编辑颜色", exact: true }).click({ timeout })); const editor = page!.getByRole("region", { name: "编辑颜色", exact: true }); await bounded("editor-visible", timeout => expect(editor).toBeVisible({ timeout }));
        const before = await bounded("DEMO-store-hash", () => storeHash(page!)); (sample.storeHashes as string[]).push(before); if (expectedStoreHash === null) expectedStoreHash = before; if (before !== expectedStoreHash) throw new Error("FRESH_INITIAL_DEMO_HASH_MISMATCH");
        if (width === 1024) break;
        await bounded("original1440-open", timeout => editor.getByLabel("选择设备颜色", { exact: true }).click({ timeout })); await bounded("original1440-custom-label", timeout => editor.getByRole("radio", { name: "其他颜色", exact: true }).locator("..").click({ timeout }));
        await bounded("original1440-fill", timeout => editor.getByRole("textbox", { name: "其他颜色", exact: true }).fill("DEMO unsaved custom color", { timeout })); await bounded("original1440-cancel", timeout => editor.getByRole("button", { name: "取消", exact: true }).click({ timeout }));
        await bounded("editor-closed", timeout => expect(editor).toHaveCount(0, { timeout })); await bounded("real-reload", timeout => page!.reload({ timeout })); const after = await bounded("DEMO-reload-hash", () => storeHash(page!)); (sample.storeHashes as string[]).push(after); if (after !== before) throw new Error("DEMO_CANCEL_RELOAD_HASH_CHANGED");
        await bounded("original-heading", timeout => expect(page!.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible({ timeout })); if (!await bounded("original-overflow", () => page!.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) throw new Error("ORIGINAL_OVERFLOW");
      }
      sample.setupMs = clock.now() - start; const policyDeadline = clock.now() + 2000;
      const prepared = await bounded("closed-policy-arm", () => page!.evaluate(prepareFreshColorOpen, { sampleId, contextId: `fresh-${sampleId}` }), policyDeadline); sample.prepared = prepared;
      if (!prepared.ready) { sample.observation = await bounded("precondition-stop-report", () => page!.evaluate(() => (window as unknown as Record<string, { wait: () => Promise<Entry> }>).__siteUIColorAnchorABA.wait()), policyDeadline); throw new Error("CLOSED_POLICY_PRECONDITION_FAILED"); } const signature = JSON.stringify(prepared.signature); if (expectedSignature === null) expectedSignature = signature; if (signature !== expectedSignature) throw new Error("FRESH_FONT_STYLE_VIEWPORT_STATE_MISMATCH");
      await bounded("original1024-summary-click-only", timeout => page!.getByRole("region", { name: "编辑颜色", exact: true }).getByLabel("选择设备颜色", { exact: true }).click({ timeout }), policyDeadline);
      const opened = await bounded("first-toggle-receipt", () => page!.evaluate(() => (window as unknown as Record<string, { snapshot: () => { firstOpen: number | null; deadline: number | null; timeOrigin: number } }>).__siteUIColorAnchorABA.snapshot()), policyDeadline);
      if (opened.firstOpen === null || opened.deadline === null) throw new Error("FIRST_TRUE_TOGGLE_NOT_CAPTURED");
      cleanupDeadline = Math.min(start + 18000, clock.now() + Math.max(0, opened.timeOrigin + opened.deadline + 2000 - Date.now()));
      sample.observation = await bounded("fixed-first-open-window", () => page!.evaluate(() => (window as unknown as Record<string, { wait: () => Promise<Entry> }>).__siteUIColorAnchorABA.wait()), cleanupDeadline);
      const finalHash = await bounded("DEMO-final-hash", () => storeHash(page!), cleanupDeadline); (sample.storeHashes as string[]).push(finalHash); if (finalHash !== expectedStoreHash) throw new Error("DEMO_STORE_CHANGED");
      sample.status = (sample.observation as Entry).status;
    } catch (error) { lateContext = true; sample.status = "INCONCLUSIVE"; sample.reason = String(error); }
    finally {
      cleanupDeadline = Math.min(cleanupDeadline, clock.now() + 2000, start + 18000);
      if (page && !page.isClosed()) { try { await bounded("abort-confirm-cleanup", () => page!.evaluate(async () => { await (window as unknown as Record<string, { abort?: (reason: string) => Promise<unknown> }>).__siteUIColorAnchorABA?.abort?.("NODE_FINALIZATION"); }), cleanupDeadline); } catch (error) { sample.cleanupError = String(error); sample.status = "INCONCLUSIVE"; } }
      if (observer) { try { const raw = await bounded("raw-finalization", () => observer!.finish(), cleanupDeadline); sample.inputSha256 = raw.inputSha256; sample.rawTransport = raw.transport; sample.rawCleanup = raw.browserCleanup; const sequence = new Map<string, number>(); sample.rawGap = raw.packets.some(packet => { const previous = sequence.get(packet.documentId) ?? 0; sequence.set(packet.documentId, packet.sequence); return packet.sequence !== previous + 1; }); if (sample.rawGap || raw.cleanupUnavailable || raw.collectionGaps.length || raw.transport.rejectedPackets || raw.transport.collectorErrors.length || Object.values(raw.transport.lastStates).some(state => state && ["droppedFrames", "droppedEvents", "sendFailures", "discoveryGaps"].some(key => (state as Entry)[key] !== 0))) sample.status = "INCONCLUSIVE"; } catch (error) { sample.rawError = String(error); sample.status = "INCONCLUSIVE"; } }
      if (context) { try { await bounded("close-fresh-context", () => context!.close(), cleanupDeadline); sample.contextClosed = true; } catch (error) { sample.contextClosed = false; sample.closeError = String(error); sample.status = "INCONCLUSIVE"; } }
      sample.totalMs = clock.now() - start; sample.streamCostsMs = streamCosts; if ((sample.totalMs as number) > 18000 || sample.streamGap || sample.streamError) sample.status = "INCONCLUSIVE";
      const sampleOutput = info.outputPath(`color-anchor-aba-${sampleId}.json`); const temporary = sampleOutput + ".tmp"; writeFileSync(temporary, JSON.stringify(sample, null, 2) + "\n"); renameSync(temporary, sampleOutput); await info.attach(`color-anchor-aba-${sampleId}`, { path: sampleOutput, contentType: "application/json" });
    }
    const observation = sample.observation as { summary?: { complete: boolean; kind: string } } | undefined;
    if (sample.status !== "SAMPLE_OBSERVED" || !sample.contextClosed || !observation?.summary?.complete) { report.status = "INCONCLUSIVE"; break; }
    if (observation.summary.kind !== (sampleId === "B" ? "stable" : "loop")) { report.status = sampleId === "A0" ? "BASELINE_NOT_REPRODUCED" : sampleId === "B" ? "FACTOR_DID_NOT_ELIMINATE_OBSERVED_LOOP" : "FRESH_ORIGINAL_POLICY_NOT_REPRODUCED"; break; }
    if (sampleId === "A1") report.status = "palette-policy-at-open-causal-control-supported";
  }
  report.executedSamples = samples.length; report.totalMs = clock.now() - outerStart; if ((report.totalMs as number) > 60000) report.status = "INCONCLUSIVE";
  report.notExecuted = (["A0", "B", "A1"] as const).slice(samples.length).map(sampleId => ({ sampleId, status: "NOT_EXECUTED_CONTRACT_STOP" }));
  report.limit = "Fresh A1 is an independent original-policy reproduction, not same-host state reversibility. No product/P2/release GO; original native30s gate remains required.";
  const temporary = output + ".tmp"; writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n"); renameSync(temporary, output); await info.attach("color-anchor-aba", { path: output, contentType: "application/json" }); return report;
}
