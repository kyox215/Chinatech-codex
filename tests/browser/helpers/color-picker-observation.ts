import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { arch, release } from "node:os";
import type { Page, TestInfo } from "@playwright/test";

export const colorObservationTitle = "routed retail editor cancels without persisting and restores after reload at four widths";
export const colorAnchorABATitle = "diagnostic palette overflow-anchor A0 B A1 with fixed RAF scroll driver";
const bindingName = "__siteUIColorObservationStream";
const controllerName = "__siteUIColorObservation";
type Entry = Record<string, unknown>;
type Packet = { documentId: string; sequence: number; frames: Entry[]; events: Entry[]; computed: Entry[]; state: Entry };
type ObservationContext = Pick<TestInfo, "title" | "project" | "outputPath" | "attach" | "status">;

export function shouldObserveColorPicker(info: Pick<TestInfo, "title" | "project">, flag = process.env.SITE_UI_COLOR_OBSERVATION) {
  return flag === "1" && info.title === colorObservationTitle && info.project.name === "webkit-touch";
}

export function shouldRunColorAnchorABA(info: Pick<TestInfo, "title" | "project">, flag = process.env.SITE_UI_COLOR_ANCHOR_ABA) {
  return flag === "1" && info.title === colorAnchorABATitle && info.project.name === "webkit-touch";
}

/** Self-contained addInitScript. It reads only known structural nodes and numbers. */
export function colorPickerObservationInit(options: { binding: string; controller: string; maxFrames: number; maxDurationMs: number; batchFrames: number; experiment?: boolean }) {
  if (window !== window.top) return;
  const globals = window as unknown as Record<string, unknown>;
  if (globals[options.controller]) return;
  const send = globals[options.binding] as (packet: Packet) => Promise<unknown>;
  const documentId = `color-document-${performance.timeOrigin}`;
  const state = { frameCount: 0, eventCount: 0, discoveryGaps: 0, droppedFrames: 0, droppedEvents: 0, sendFailures: 0, deferredFlushes: 0, sequence: 0, pendingPackets: 0, maxPendingPackets: 0, active: false, disposed: false, rafPending: false, timerPending: false, observerConnected: false, sessions: 0, stopReason: "not-opened", finalComputedTaken: false };
  let frames: Entry[] = [], events: Entry[] = [], computed: Entry[] = [];
  let picker: Element | null = null, editor: Element | null = null, details: HTMLDetailsElement | null = null;
  let palette: HTMLElement | null = null, anchor: HTMLElement | null = null, radio: HTMLInputElement | null = null, target: HTMLElement | null = null;
  let ancestors: Element[] = [], raf: number | null = null, timer: number | null = null;
  let openedAt = 0, previousTimestamp: number | null = null, previousGeometry = "", changeComputedTaken = false;
  const pending = new Set<Promise<unknown>>();
  const history: Entry[] = [];
  const cleanups: (() => void)[] = [];
  const structure = (node: EventTarget | null): Entry | null => {
    if (node === document) return { slot: "document" };
    if (node === window) return { slot: "window" };
    if (window.visualViewport && node === window.visualViewport) return { slot: "visualViewport" };
    if (!(node instanceof Element)) return null;
    const slot = node === palette ? "palette" : node === target ? "target-label" : node === radio ? "hidden-radio" : node === anchor ? "summary" : node === details ? "details" : node === editor ? "editor" : node === document.documentElement ? "html" : node === document.body ? "body" : null;
    return { slot, tag: node.tagName, classes: [...node.classList].slice(0, 12), ancestorIndex: ancestors.indexOf(node) };
  };
  const rect = (node: Element | null) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left };
  };
  const inline = () => palette ? { width: palette.style.width, left: palette.style.left, top: palette.style.top, maxHeight: palette.style.maxHeight, overflowAnchor: palette.style.getPropertyValue("overflow-anchor"), overflowAnchorPriority: palette.style.getPropertyPriority("overflow-anchor") } : null;
  function flush() {
    if (!frames.length && !events.length && !computed.length) return;
    if (state.pendingPackets >= 4) { state.deferredFlushes++; return; }
    const packet: Packet = { documentId, sequence: ++state.sequence, frames, events, computed, state: { ...state, sentAt: performance.now() } };
    frames = []; events = []; computed = [];
    state.pendingPackets++; state.maxPendingPackets = Math.max(state.maxPendingPackets, state.pendingPackets);
    const task = Promise.resolve(send(packet)).catch(() => { state.sendFailures++; }).finally(() => { state.pendingPackets--; pending.delete(task); });
    pending.add(task);
  }
  function event(kind: string, node: EventTarget | null, extra: Entry = {}) {
    if (state.disposed) return;
    if (state.eventCount >= 4096 || events.length >= 128) { state.droppedEvents++; return; }
    state.eventCount++;
    events.push({ kind, time: performance.now(), source: structure(node), open: details?.open ?? null, scrollX, scrollY, ...extra });
    if (events.length >= 32) flush();
  }
  function sparse(reason: string) {
    const started = performance.now();
    const properties = ["display", "position", "transform", "filter", "backdrop-filter", "perspective", "contain", "container-type", "content-visibility", "will-change", "overflow", "overflow-x", "overflow-y", "overflow-anchor", "zoom", "writing-mode"];
    const css = (node: Element, pseudo?: string) => {
      try { const style = getComputedStyle(node, pseudo); return Object.fromEntries(properties.map(key => [key, style.getPropertyValue(key)])); }
      catch { return null; }
    };
    const radioStyle = radio ? getComputedStyle(radio) : null;
    const typography = [target, radio, anchor, palette].filter((node): node is HTMLElement => Boolean(node)).map(node => { const style = getComputedStyle(node); return { node: structure(node), fontSize: style.fontSize, lineHeight: style.lineHeight, textSizeAdjust: style.getPropertyValue("text-size-adjust"), webkitTextSizeAdjust: style.getPropertyValue("-webkit-text-size-adjust") }; });
    computed.push({ reason, time: started, open: details?.open ?? null, paletteOffsetParent: structure(palette?.offsetParent ?? null), ancestors: ancestors.map(node => ({ node: structure(node), css: css(node), scrollTop: node.scrollTop, scrollLeft: node.scrollLeft, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight })), detailsContent: details ? css(details, "::details-content") : null, radio: radioStyle ? { minHeight: radioStyle.minHeight, width: radioStyle.width, height: radioStyle.height, position: radioStyle.position, rect: rect(radio), offsetParent: structure(radio?.offsetParent ?? null) } : null, typography, paletteWidths: palette ? { clientWidth: palette.clientWidth, offsetWidth: palette.offsetWidth } : null, costMs: performance.now() - started });
  }
  const mutations = (records: MutationRecord[]) => {
    for (const record of records) event("mutation", record.target, { attribute: record.attributeName, oldValue: record.oldValue, current: record.target === palette ? inline() : details?.open ?? null });
  };
  const observer = new MutationObserver(mutations);
  function stop(reason: string, takeFinal = false) {
    if (takeFinal && details && !state.finalComputedTaken) { sparse(reason); state.finalComputedTaken = true; }
    if (raf !== null) cancelAnimationFrame(raf);
    if (timer !== null) clearTimeout(timer);
    raf = null; timer = null; mutations(observer.takeRecords()); observer.disconnect();
    state.active = false; state.rafPending = false; state.timerPending = false; state.observerConnected = false; state.stopReason = reason;
    event("sampler-stop", details, { reason }); flush();
  }
  function sample(timestamp: number) {
    raf = null; state.rafPending = false;
    if (!state.active) return;
    if (!palette?.isConnected || !target?.isConnected || !details?.isConnected) { stop("detached", true); return; }
    if (!details.open) { stop("closed", true); return; }
    if (state.frameCount >= options.maxFrames || performance.now() - openedAt >= options.maxDurationMs) { stop("budget", true); return; }
    const started = performance.now(), viewport = window.visualViewport;
    const frame: Entry = { time: started, rafTimestamp: timestamp, rafIntervalMs: previousTimestamp === null ? null : timestamp - previousTimestamp, documentId, session: state.sessions, targetRect: rect(target), radioRect: rect(radio), anchorRect: rect(anchor), paletteRect: rect(palette), inline: inline(), open: details.open, paletteConnected: palette.isConnected, paletteOffsetParent: structure(palette.offsetParent), paletteScroll: { top: palette.scrollTop, left: palette.scrollLeft, clientHeight: palette.clientHeight, scrollHeight: palette.scrollHeight, clientWidth: palette.clientWidth, scrollWidth: palette.scrollWidth }, ancestorsScroll: ancestors.map(node => ({ node: structure(node), top: node.scrollTop, left: node.scrollLeft })), scrollX, scrollY, scrollingElementTop: document.scrollingElement?.scrollTop ?? null, innerWidth, innerHeight, documentSize: { clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }, devicePixelRatio, visualViewport: viewport ? { offsetLeft: viewport.offsetLeft, offsetTop: viewport.offsetTop, pageLeft: viewport.pageLeft, pageTop: viewport.pageTop, width: viewport.width, height: viewport.height, scale: viewport.scale } : null };
    if (options.experiment) frame.experiment = (globals.__siteUIColorAnchorABA as { metadata?: () => Entry } | undefined)?.metadata?.() ?? null;
    const geometry = JSON.stringify([frame.targetRect, frame.anchorRect, frame.paletteRect, frame.inline, frame.scrollX, frame.scrollY, frame.visualViewport]);
    const left = Number.parseFloat(palette.style.left), top = Number.parseFloat(palette.style.top), paletteRect = frame.paletteRect as ReturnType<typeof rect>;
    const coordinateMismatch = Boolean(paletteRect && Number.isFinite(left) && Number.isFinite(top) && (paletteRect.left !== left || paletteRect.top !== top));
    if (!changeComputedTaken && ((previousGeometry && geometry !== previousGeometry) || coordinateMismatch)) { sparse("first-change-or-coordinate-mismatch"); changeComputedTaken = true; }
    frame.costMs = performance.now() - started;
    frame.computedSampleIncluded = changeComputedTaken && computed.length > 0;
    if (options.experiment && history.length < options.maxFrames) history.push(frame);
    state.frameCount++;
    if (frames.length < 32) frames.push(frame); else state.droppedFrames++;
    previousGeometry = geometry; previousTimestamp = timestamp;
    if (frames.length >= options.batchFrames) flush();
    raf = requestAnimationFrame(sample); state.rafPending = true;
  }
  function locate(node: Element) {
    const next = node.closest(".color-picker");
    if (!next || !next.closest("main.retail-detail")) return false;
    if (picker !== next) {
      stop("host-replaced"); picker = next; editor = next.closest("section[aria-label]");
      details = next.querySelector("details"); palette = next.querySelector<HTMLElement>(".color-picker__palette"); anchor = details?.querySelector("summary") ?? null;
      radio = palette?.querySelector<HTMLInputElement>('input[type="radio"][value="custom"]') ?? null; target = radio?.parentElement ?? null;
      ancestors = []; for (let parent = palette?.parentElement; parent && ancestors.length < 32; parent = parent.parentElement) ancestors.push(parent);
    }
    const complete = Boolean(details && palette && anchor && radio && target);
    if (!complete) { state.discoveryGaps++; event("host-discovery-gap", next, { found: { details: Boolean(details), palette: Boolean(palette), anchor: Boolean(anchor), radio: Boolean(radio), target: Boolean(target) } }); flush(); }
    return complete;
  }
  function start() {
    if (state.active || state.disposed || !details?.open || !palette || state.frameCount >= options.maxFrames) return;
    state.active = true; state.sessions++; state.stopReason = "running"; openedAt = performance.now(); previousTimestamp = null; previousGeometry = ""; changeComputedTaken = false; state.finalComputedTaken = false;
    observer.observe(palette, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
    observer.observe(details, { attributes: true, attributeFilter: ["open"], attributeOldValue: true }); state.observerConnected = true;
    sparse("first-open"); event("sampler-start", details, { maxFrames: options.maxFrames, maxDurationMs: options.maxDurationMs }); flush();
    raf = requestAnimationFrame(sample); state.rafPending = true;
    timer = window.setTimeout(() => stop("duration", true), options.maxDurationMs);
    state.timerPending = true;
  }
  function listen(source: EventTarget, kind: string, callback: EventListener, capture = false) { source.addEventListener(kind, callback, capture); cleanups.push(() => source.removeEventListener(kind, callback, capture)); }
  const interaction: EventListener = e => {
    if (!(e.target instanceof Element)) return;
    const summary = e.target.closest(".color-picker summary");
    if (summary && locate(summary)) event(`summary-${e.type}`, anchor);
    else if (target?.contains(e.target)) { event(`target-${e.type}`, e.target, { labelEvent: true }); if (e.type === "pointerdown" || e.type === "click") stop(`target-${e.type}`, true); }
  };
  for (const kind of ["pointerdown", "click"]) listen(document, kind, interaction, true);
  listen(document, "toggle", e => {
    if (!(e.target instanceof Element) || !e.target.matches(".color-picker details") || !locate(e.target)) return;
    event("toggle", details); if (details?.open) start(); else stop("closed", true);
  }, true);
  for (const kind of ["focusin", "focusout"]) listen(document, kind, e => { if (picker && e.target instanceof Node && picker.contains(e.target)) event(kind, e.target); }, true);
  listen(document, "scroll", e => { if (picker && (e.target === document || e.target === palette || ancestors.includes(e.target as Element))) event("scroll", e.target); }, true);
  listen(window, "resize", e => { if (picker) event("resize", e.target); });
  if (window.visualViewport) for (const kind of ["scroll", "resize"]) listen(window.visualViewport, kind, e => { if (picker) event(`visualViewport-${kind}`, e.target); });
  if (document.fonts) for (const kind of ["loading", "loadingdone", "loadingerror"]) listen(document.fonts, kind, () => event(`fonts-${kind}`, null, { status: document.fonts.status }));
  function dispose(reason: string) { if (state.disposed) return; stop(reason, true); for (const cleanup of cleanups.splice(0)) cleanup(); event("disposed", null, { listenersRemaining: cleanups.length }); state.disposed = true; flush(); }
  listen(window, "pagehide", () => dispose("pagehide"));
  globals[options.controller] = { async finish(reason: string) { dispose(reason); await Promise.allSettled([...pending]); flush(); await Promise.allSettled([...pending]); return { ...state, remainingFrames: frames.length, remainingEvents: events.length, listenersRemaining: cleanups.length }; }, state: () => ({ ...state, listenersRemaining: cleanups.length }), frames: options.experiment ? () => history : undefined };
  event("document-start", null, { timeOrigin: performance.timeOrigin, userAgent: navigator.userAgent, fontStatus: document.fonts?.status ?? null }); flush();
}

async function installColorObservation(page: Page, info: ObservationContext, experiment = false) {
  const output = info.outputPath("color-layout-observation.json");
  const streamPath = info.outputPath("color-layout-observation-stream.jsonl");
  mkdirSync(dirname(output), { recursive: true });
  const packets: Packet[] = [], collectorErrors: string[] = [], receivedDocuments = new Set<string>();
  const bindingCostsMs: number[] = [];
  let acceptedFrames = 0, rejectedPackets = 0;
  const inputs = ["tests/browser/site-ui-recheck.spec.ts", "tests/browser/helpers/color-picker-observation.ts", "components/color-picker.tsx", "components/single-choice.tsx", "components/retail/retail-field-editor.tsx", "components/retail/retail-field-editor.module.css", "app/globals.css"];
  if (experiment) inputs.push("tests/browser/color-anchor-aba.spec.ts", "tests/browser/helpers/color-anchor-aba.ts");
  const inputSha256 = Object.fromEntries(inputs.map(file => [file, createHash("sha256").update(readFileSync(resolve(process.cwd(), file))).digest("hex")]));
  await page.exposeBinding(bindingName, (source, raw: unknown) => {
    const started = performance.now();
    if (source.frame !== page.mainFrame() || !raw || typeof raw !== "object") { rejectedPackets++; return; }
    const packet = raw as Packet;
    if (typeof packet.documentId !== "string" || packet.documentId.length > 100 || !Number.isInteger(packet.sequence) || !Array.isArray(packet.frames) || packet.frames.length > 32 || !Array.isArray(packet.events) || packet.events.length > 128 || !Array.isArray(packet.computed) || packet.computed.length > 3 || packets.length >= 1024 || acceptedFrames + packet.frames.length > 16384 || (!receivedDocuments.has(packet.documentId) && receivedDocuments.size >= 8)) { rejectedPackets++; return; }
    const line = JSON.stringify(packet);
    if (line.length > 512000) { rejectedPackets++; return; }
    receivedDocuments.add(packet.documentId); acceptedFrames += packet.frames.length; packets.push(packet);
    try { appendFileSync(streamPath, line + "\n"); } catch (error) { collectorErrors.push(String(error)); }
    bindingCostsMs.push(performance.now() - started);
  });
  await page.addInitScript(colorPickerObservationInit, { binding: bindingName, controller: controllerName, maxFrames: 2048, maxDurationMs: 30000, batchFrames: 8, experiment });
  return {
    async finish() {
      let browserCleanup: unknown = null, cleanupUnavailable: string | null = null;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        if (page.isClosed()) cleanupUnavailable = "page already closed; prior streamed packets retained";
        else browserCleanup = await Promise.race([
          page.evaluate(async name => { const controller = (window as unknown as Record<string, { finish: (reason: string) => Promise<unknown> }>)[name]; return controller ? controller.finish("afterEach") : null; }, controllerName),
          new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("observation cleanup exceeded 1000ms")), 1000); }),
        ]);
      } catch (error) { cleanupUnavailable = String(error); }
      finally { if (timeout) clearTimeout(timeout); }
      const report = { schemaVersion: 1, diagnosticOnly: true, title: info.title, project: info.project.name, status: info.status, environment: { platform: process.platform, arch: arch(), osRelease: release(), node: process.version, browserVersion: page.context().browser()?.version() ?? null, ciSha: process.env.GITHUB_SHA ?? null, device: Object.fromEntries(["browserName", "viewport", "userAgent", "isMobile", "hasTouch", "deviceScaleFactor", "locale"].map(key => [key, (info.project.use as Record<string, unknown>)[key] ?? null])) }, inputSha256, collectionGaps: acceptedFrames ? [] : ["no geometry frames received; not evidence of stability or a normal picker"], limits: { maxFramesPerDocument: 2048, maxDurationMsPerOpen: 30000, batchFrames: 8, maxInFlightPackets: 4, maxDocuments: 8, maxPackets: 1024, maxTotalFrames: 16384 }, transport: { packets: packets.length, acceptedFrames, rejectedPackets, bindingCostsMs, collectorErrors, streamPath, lastStates: Object.fromEntries([...receivedDocuments].map(id => [id, packets.filter(packet => packet.documentId === id).at(-1)?.state ?? null])) }, browserCleanup, cleanupUnavailable, observationPerturbation: "RAF reads, sparse computed-style reads and binding/stream I/O can perturb layout/timing; a green observed run is not a product fix. Last in-flight or not-yet-batched samples may be absent if the page closes; missing final computed/cleanup is explicit.", packets };
      const temporary = output + ".tmp"; writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n"); renameSync(temporary, output);
      await info.attach("color-layout-observation", { path: output, contentType: "application/json" });
      return report;
    },
  };
}

export async function installColorPickerObservation(page: Page, info: ObservationContext) {
  return installColorObservation(page, info);
}

export async function installColorAnchorABAObservation(page: Page, info: ObservationContext) {
  if (!shouldRunColorAnchorABA(info)) throw new Error("Color anchor ABA observation guard did not match");
  return installColorObservation(page, info, true);
}
