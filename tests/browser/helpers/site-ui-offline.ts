import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import ts from "typescript";
import type { Page } from "@playwright/test";
import type { RetailUnit } from "../../../lib/retail";

export type OfflineSnapshot = {
  recovery: { pending?: { command: Record<string, unknown> } | null; busy: boolean };
  units: RetailUnit[]; draft: unknown; closes: number; clears: number; subscribers: number;
  calls: { action: string; requestId: string; payload: Record<string, unknown>; command: unknown }[];
};
type Stats = { rafScheduled: number; rafFired: number; activeFrames: number; observers: number; resizeObservers: number; visibilityBatches: number };
declare global {
  interface Window {
    adapter: {
      [key: string]: unknown;
      snapshot: () => OfflineSnapshot;
      unit: RetailUnit;
      completed: number;
      deferredClear: boolean;
      cleanup: () => Promise<void>;
      finishCleanup: () => void;
      watch: () => boolean;
      restoreDraft: (value: unknown) => void;
      delayedControl?: (value: unknown) => void;
      createRegistry: typeof import("../../../components/recovery-visibility").createRecoveryVisibilityRegistry;
    };
    offlineStats: () => Stats;
  }
}

// Only provider, platform and private-control seams are synthetic. React, the editor,
// receipt/presentation/global-notice/input/feedback components and retail validation are real.
const adapterSource = "import React, { createContext, useSyncExternalStore } from \"react\";\n\n// In-memory backend/provider seam. No production adapter, storage or HTTP is loaded.\nconst recoveryListeners = new Set<() => void>();\nconst retailListeners = new Set<() => void>();\nlet recovery: any = { pending: null, busy: false, message: \"\" };\nlet units: any[] = [];\nlet draft: any;\nlet releaseDispatch: ((saved: boolean) => void) | undefined;\nlet releaseRecovery: (() => void) | undefined;\nlet releaseClear: (() => void) | undefined;\nlet recovering = false;\nconst api: any = {\n  calls: [], drafts: [], closes: 0, clears: 0, deferredClear: false,\n  setRecovery(next: any) { recovery = next; recoveryListeners.forEach(fn => fn()); },\n  setUnits(next: any[]) { units = next; retailListeners.forEach(fn => fn()); },\n  resolveDispatch(saved = false) { releaseDispatch?.(saved); },\n  resolveRecovery() { releaseRecovery?.(); },\n  resolveClear() { releaseClear?.(); },\n  snapshot() { return { recovery, units, draft, calls: api.calls, drafts: api.drafts, closes: api.closes, clears: api.clears, subscribers: recoveryListeners.size }; },\n  reset() { recovery = { pending: null, busy: false, message: \"\" }; api.calls = []; api.drafts = []; api.closes = 0; api.clears = 0; api.deferredClear = false; },\n};\n(window as any).adapter = api;\nexport const backendRecovery = () => recovery;\nexport const subscribeRecovery = (fn: () => void) => { recoveryListeners.add(fn); return () => recoveryListeners.delete(fn); };\nexport const backendWriting = () => false;\nexport const loadRecovery = async () => { api.calls.push({ action: \"read\" }); };\nexport const recoverOperation = async (action: string, requestId: string) => {\n  // Mirror client.ts recoverOperation's synchronous `writing` guard at this seam.\n  if (recovering) return;\n  recovering = true;\n  api.calls.push({ action, requestId, command: structuredClone(recovery.pending?.command) });\n  api.setRecovery({ ...recovery, busy: true });\n  await new Promise<void>(resolve => { releaseRecovery = resolve; });\n  api.setRecovery({ ...recovery, busy: false });\n  recovering = false;\n};\nexport const useLanguage = () => ({ t: (text: string, vars: any = {}) => Object.entries(vars).reduce((s, [key, value]) => s.replaceAll(`{${key}}`, String(value)), text), systemText: (text: string) => text, locale: \"zh-CN\" });\nexport const useOnline = () => true;\nexport const BackendSnapshotContext = createContext(null);\nexport const Toast = ({ message }: any) => <p role=\"status\">{message}</p>;\nexport const createBackendBootstrap = () => { throw new Error(\"Full BackendProvider is outside this offline seam\"); };\nexport const startRealtimeUpdates = () => { throw new Error(\"Realtime must not start\"); };\nexport const useStaff = () => ({ can: () => true });\nexport function useRetail() {\n  const current = useSyncExternalStore((fn) => { retailListeners.add(fn); return () => retailListeners.delete(fn); }, () => units, () => units);\n  return { units: current, ready: true, error: \"\", feedback: null, dispatch: async (payload: any, options: any) => {\n    api.calls.push({ action: \"save\", payload: structuredClone(payload), ...options });\n    return new Promise<boolean>(resolve => { releaseDispatch = resolve; });\n  } };\n}\nexport function useDeviceDraft(key: string, value: any, restore: (saved: any) => void) {\n  draft = structuredClone(value);\n  api.restoreDraft = restore;\n  api.drafts.push(structuredClone(value));\n  return { key, clear: async () => { api.clears++; if (api.deferredClear) await new Promise<void>(resolve => { releaseClear = resolve; }); }, recover: () => restore(api.recoverValue), discard: async () => { api.calls.push({ action: \"discard\" }); } };\n}\nexport const DeviceDraftNotice = () => <span data-draft-notice />;\n// A delayed private-control callback is a seam, rather than a reimplementation of the editor.\nexport function ColorPicker({ value, onChange }: any) {\n  api.delayedControl = onChange;\n  return <input aria-label=\"颜色\" value={value} onChange={e => onChange(e.target.value)} />;\n}\nexport const IdentifierField = ColorPicker;\nexport const SingleChoice = ColorPicker;\nexport const RetailDateControl = ColorPicker;\nexport const RetailMoneyControl = ColorPicker;\nexport const RetailNumberControl = ColorPicker;\nexport const RetailWarrantyControl = ColorPicker;\nexport const RetailCatalogControl = ColorPicker;\nexport const RetailDisksControl = ColorPicker;\nexport const RetailRamControl = ColorPicker;\nexport const RetailStorageControl = ColorPicker;\n";
const entrySource = "import React, { StrictMode, useState } from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport { RecoveryPresentationProvider, OperationRecoveryControls, useOperationReceipt } from \"@/components/use-operation-receipt\";\nimport { BackendSyncNotice } from \"@/components/backend-provider\";\nimport { ContentProgress, OperationFeedbackProvider } from \"@/components/operation-feedback\";\nimport { RetailFieldEditor } from \"@/components/retail/retail-field-editor\";\nimport { retailUnits } from \"@/lib/retail-fixtures\";\nimport { createRecoveryVisibilityRegistry } from \"@/components/recovery-visibility\";\n\nconst api = (window as any).adapter;\nlet root: ReturnType<typeof createRoot>;\nfunction ReceiptProbe({ id }: { id: string }) {\n  const receipt = useOperationReceipt();\n  api.watch = () => receipt.watch(id, async isCurrent => { await api.cleanup(); if (isCurrent()) api.completed++; });\n  return <output data-receipt data-waiting={receipt.waiting} data-executing={receipt.executing} data-id={receipt.requestId} />;\n}\nfunction RecoveryCase() {\n  const [id, setId] = useState(\"request-original\");\n  const [host, setHost] = useState(true);\n  const [identity, setIdentity] = useState(1);\n  api.switchId = setId; api.switchHost = setHost; api.switchIdentity = setIdentity;\n  return <RecoveryPresentationProvider key={identity}>\n    <div id=\"global\"><BackendSyncNotice /></div>\n    <div id=\"tab\" role=\"tabpanel\"><details id=\"outer\" open><summary>Outer</summary><details id=\"inner\" open><summary>Inner</summary>\n      <div id=\"desktop\" className=\"desktop\">{host && <OperationRecoveryControls key={`desktop-${host}`} requestId={id} />}</div>\n    </details></details></div>\n    <div id=\"mobile\" className=\"mobile\"><details id=\"mobileDetails\" open><summary>Overview</summary><OperationRecoveryControls requestId={null} /></details></div>\n    <ReceiptProbe key={identity} id={id} />\n  </RecoveryPresentationProvider>;\n}\nfunction EditorCase({ field }: { field: any }) {\n  return <RecoveryPresentationProvider><div id=\"global\"><BackendSyncNotice /></div><RetailFieldEditor unit={retailUnits[0]} field={field} onClose={() => { api.closes++; }} /></RecoveryPresentationProvider>;\n}\napi.unit = retailUnits[0];\napi.createRegistry = createRecoveryVisibilityRegistry;\napi.mount = (kind = \"recovery\", field = \"location\", strict = false) => {\n  root?.unmount();\n  document.getElementById(\"root\")!.replaceChildren();\n  root = createRoot(document.getElementById(\"root\")!);\n  api.setUnits([structuredClone(retailUnits[0])]);\n  const tree = <OperationFeedbackProvider><ContentProgress />{kind === \"recovery\" ? <RecoveryCase /> : <EditorCase field={field} />}</OperationFeedbackProvider>;\n  root.render(strict ? <StrictMode>{tree}</StrictMode> : tree);\n};\napi.unmount = () => root?.unmount();\napi.ready = true;\n";

export function buildSiteUIOfflineBundle(source = process.cwd(), baseline = false) {
  const native = createRequire(resolve(source, "package.json"));
const seams = new Set(["lib/backend/client", "lib/backend/bootstrap", "lib/backend/realtime-client", "components/language-provider", "components/page-recovery", "components/backend-snapshot", "components/toast", "components/staff/use-staff", "components/use-device-draft", "components/retail/retail-provider", "components/color-picker", "components/identifier-field", "components/single-choice", "components/retail/retail-input-controls", "components/retail/retail-warranty-control", "components/retail/retail-spec-controls"]);
const modules: string[] = [], ids = new Map<string, number>();
function pathFor(request: string, parent: string): string {
  const rel = request.startsWith("@/") ? request.slice(2) : request.startsWith(".") ? resolve(dirname(parent), request).slice(source.length + 1) : null;
  if (rel && seams.has(rel)) return "virtual:adapter.tsx";
  if (request === "lucide-react") return "virtual:icons";
  if (request.endsWith(".css")) return "virtual:css";
  const file = request.startsWith("@/") ? resolve(source, request.slice(2)) : request.startsWith(".") ? resolve(dirname(parent), request) : native.resolve(request);
  if (existsSync(file) && extname(file)) return file;
  for (const ending of [".tsx", ".ts", ".js", "/index.js"]) if (existsSync(file + ending)) return file + ending;
  throw new Error(`Cannot resolve ${request} from ${parent}`);
}
function add(file: string): number {
  if (ids.has(file)) return ids.get(file)!;
  const id = modules.length; ids.set(file, id); modules.push("");
  let code: string;
  if (file === "virtual:icons") code = 'module.exports = new Proxy({}, {get:(_t,name)=>props=>require("react").createElement("svg",{...props,"data-icon":String(name)})});';
  else if (file === "virtual:css") code = 'module.exports = {__esModule:true,default:new Proxy({}, {get:(_t,name)=>String(name)})};';
  else {
    let raw = file === "virtual:adapter.tsx" ? adapterSource : file === "virtual:entry.tsx" ? entrySource : readFileSync(file, "utf8");
    if (baseline && file.startsWith(source + "/components/")) {
      const { execFileSync } = native("node:child_process");
      try { raw = execFileSync("git", ["show", `HEAD:${file.slice(source.length + 1)}`], { cwd: source, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* newly added helper is absent in the old hook */ }
    }
    code = /\.tsx?$/.test(file) ? ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText : raw;
    code = code.replaceAll("process.env.NODE_ENV", '"development"');
  }
  code = code.replace(/require\(["']([^"']+)["']\)/g, (_match, name) => `__require(${add(pathFor(name, file))})`);
  modules[id] = `function(module,exports,__require){${code}\n}`;
  return id;
}
const entry = add("virtual:entry.tsx");

  return `(()=>{const modules=[${modules.join(",\n")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}__require(${entry});})();`;
}

export async function mountSiteUIOffline(page: Page, bundle = buildSiteUIOfflineBundle()) {
  const requests: string[] = [], errors: string[] = [], consoleErrors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>.mobile{display:none}@media(max-width:767px){.desktop{display:none}.mobile{display:block}}.hide{display:none}.progress{height:2px}.sync-recovery{padding:6px}button,input,textarea{min-height:44px;font-size:16px}</style><div id="root"></div>');
  // about:blank is deliberately not a secure context. The deterministic UUID shim
  // supplies the browser API only; original nonce ownership is asserted by tests.
  await page.addScriptTag({ content: "(()=>{\n    window.fetch = () => { throw new Error(\"No network in offline acceptance\"); };\n    let nonce = 0;\n    if (!crypto.randomUUID) Object.defineProperty(crypto, \"randomUUID\", { value: () => `00000000-0000-4000-8000-${String(++nonce).padStart(12, \"0\")}` });\n    const stats = { rafScheduled: 0, rafFired: 0, activeFrames: new Set(), observers: new Set(), resizeObservers: new Set(), visibilityBatches: 0 };\n    const raf = requestAnimationFrame.bind(window), cancel = cancelAnimationFrame.bind(window);\n    window.requestAnimationFrame = fn => { stats.rafScheduled++; const id = raf(time => { stats.activeFrames.delete(id); stats.rafFired++; fn(time); }); stats.activeFrames.add(id); return id; };\n    window.cancelAnimationFrame = id => { stats.activeFrames.delete(id); cancel(id); };\n    const MO = MutationObserver, RO = ResizeObserver;\n    window.MutationObserver = class extends MO { constructor(fn) { super((list, observer) => { if (this.recovery) stats.visibilityBatches++; fn(list, observer); }); } observe(target, opts) { this.recovery = opts?.attributeFilter?.includes(\"data-open\"); if (this.recovery || opts?.attributeFilter?.includes(\"aria-busy\")) stats.observers.add(this); return super.observe(target, opts); } disconnect() { stats.observers.delete(this); super.disconnect(); } };\n    window.ResizeObserver = class extends RO { observe(...args) { stats.resizeObservers.add(this); return super.observe(...args); } disconnect() { stats.resizeObservers.delete(this); super.disconnect(); } };\n    window.offlineStats = () => ({ rafScheduled: stats.rafScheduled, rafFired: stats.rafFired, activeFrames: stats.activeFrames.size, observers: stats.observers.size, resizeObservers: stats.resizeObservers.size, visibilityBatches: stats.visibilityBatches });\n})();" });
  await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => Boolean(window.adapter?.ready));
  return { requests, errors, consoleErrors };
}

export async function offlineCall<T = void>(page: Page, name: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(({ name, args }) => (window.adapter[name] as (...args: unknown[]) => T)(...args), { name, args });
}
