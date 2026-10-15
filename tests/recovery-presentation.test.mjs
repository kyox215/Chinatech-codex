import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Pure memory DOM contract: no browser, page, filesystem assets, network or business data.
const code = ts.transpileModule(readFileSync(new URL("../components/recovery-visibility.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness() {
  const frames = new Map(), cancelled = [], mutations = [], sizes = [], listeners = new Set(), publications = [];
  let sequence = 0, measurements = 0;
  class MutationObserver {
    constructor(callback) { this.callback = callback; mutations.push(this); }
    observe(root, options) { this.root = root; this.options = options; this.connected = true; }
    disconnect() { this.connected = false; }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.hosts = new Set(); sizes.push(this); }
    observe(host) { this.hosts.add(host); }
    unobserve(host) { this.hosts.delete(host); }
    disconnect() { this.hosts.clear(); }
  }
  const view = {
    getComputedStyle: host => ({ visibility: host.visibility }),
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => { cancelled.push(id); frames.delete(id); },
    addEventListener: (type, callback) => { assert.equal(type, "resize"); listeners.add(callback); },
    removeEventListener: (type, callback) => { assert.equal(type, "resize"); listeners.delete(callback); },
  };
  const document = { defaultView: view, documentElement: {} };
  const sandbox = createContext({ exports: {}, MutationObserver, ResizeObserver });
  runInContext(code, sandbox);
  const { createRecoveryVisibilityRegistry, recoveryHostEligible } = sandbox.exports;
  const registry = createRecoveryVisibilityRegistry(value => publications.push(JSON.parse(JSON.stringify(value))));
  function node(tagName = "DIV", parentElement = null, attributes = {}) {
    const attrs = new Map(Object.entries(attributes));
    return {
      tagName, parentElement, ownerDocument: document, isConnected: true, visibility: "visible", boxes: 1, attrs,
      hasAttribute: name => attrs.has(name), getAttribute: name => attrs.get(name) ?? null,
      getClientRects() { measurements++; return Array(this.boxes).fill({}); },
      // Reading content or viewport positions would violate the presentation contract.
      get textContent() { throw new Error("business text read"); },
      get innerHTML() { throw new Error("business HTML read"); },
      getBoundingClientRect() { throw new Error("viewport read"); },
      querySelectorAll() { throw new Error("business DOM scan"); },
    };
  }
  function flush() { const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(); }
  function changes(count = 1) { for (let i = 0; i < count; i++) for (const observer of mutations) if (observer.connected) observer.callback([]); }
  function resize() { for (const callback of listeners) callback(); for (const observer of sizes) if (observer.hosts.size) observer.callback([]); }
  return { registry, eligible: recoveryHostEligible, node, frames, cancelled, mutations, sizes, listeners, publications, flush, changes, resize, measurements: () => measurements };
}

test("hidden tabs, breakpoint boxes, attributes and nested details release only presentation", () => {
  const h = harness(), outer = h.node("DETAILS", null, { open: "" }), inner = h.node("DETAILS", outer, { open: "" }), tab = h.node("DIV", inner), host = h.node("SECTION", tab);
  const remove = h.registry.register("original-request", host);
  assert.deepEqual(h.publications.at(-1), { "original-request": 1 });
  for (const mutate of [
    () => { tab.attrs.set("hidden", ""); return () => tab.attrs.delete("hidden"); },
    () => { outer.attrs.delete("open"); return () => outer.attrs.set("open", ""); },
    () => { inner.attrs.delete("open"); return () => inner.attrs.set("open", ""); },
    () => { tab.attrs.set("aria-hidden", "true"); return () => tab.attrs.delete("aria-hidden"); },
    () => { tab.attrs.set("inert", ""); return () => tab.attrs.delete("inert"); },
    () => { host.boxes = 0; return () => { host.boxes = 1; }; },
    () => { host.visibility = "collapse"; return () => { host.visibility = "visible"; }; },
    () => { host.visibility = "hidden"; return () => { host.visibility = "visible"; }; },
    () => { host.isConnected = false; return () => { host.isConnected = true; }; },
  ]) {
    const restore = mutate(); h.changes(3); h.resize(); assert.equal(h.frames.size, 1); h.flush();
    assert.deepEqual(h.publications.at(-1), {});
    restore(); h.changes(); h.flush(); assert.deepEqual(h.publications.at(-1), { "original-request": 1 });
  }
  remove(); assert.deepEqual(h.publications.at(-1), {});
});

test("opening only outer details never claims a still closed inner host; summary and unmeasurable fallback stay global", () => {
  const h = harness(), outer = h.node("DETAILS"), inner = h.node("DETAILS", outer), host = h.node("SECTION", inner);
  h.registry.register("unknown", host); assert.equal(h.publications.length, 0);
  outer.attrs.set("open", ""); h.changes(); h.flush(); assert.equal(h.publications.length, 0);
  inner.attrs.set("open", ""); h.changes(); h.flush(); assert.deepEqual(h.publications.at(-1), { unknown: 1 });
  const summary = h.node("SUMMARY", outer), summaryHost = h.node("SECTION", summary);
  assert.equal(h.eligible(summaryHost), false);
  host.ownerDocument = { defaultView: null }; assert.equal(h.eligible(host), false);
  h.registry.dispose();
});

test("same-ID distinct tokens, host replacement and old cleanup preserve the current local owner", () => {
  const h = harness(), first = h.node("SECTION"), second = h.node("SECTION");
  const a = h.registry.register("id", first), b = h.registry.register("id", second);
  assert.deepEqual(h.publications.at(-1), { id: 2 });
  a(); a(); assert.deepEqual(h.publications.at(-1), { id: 1 });
  const other = h.registry.register("next-id", first);
  assert.deepEqual(h.publications.at(-1), { id: 1, "next-id": 1 });
  b(); assert.deepEqual(h.publications.at(-1), { "next-id": 1 });
  other(); assert.deepEqual(h.publications.at(-1), {});
  assert.equal(h.listeners.size, 0); assert.equal(h.frames.size, 0);
  assert.ok(h.mutations.every(row => !row.connected)); assert.ok(h.sizes.every(row => row.hosts.size === 0));
});

test("bursts coalesce once, unchanged counts do not publish, and static hosts do not poll or transfer when offscreen", () => {
  const h = harness(), a = h.node("SECTION"), b = h.node("SECTION");
  h.registry.register("same", a); h.registry.register("same", b);
  const publications = h.publications.length, before = h.measurements();
  h.changes(30); h.resize(); h.resize(); assert.equal(h.frames.size, 1);
  h.flush(); assert.equal(h.measurements() - before, 2); assert.equal(h.publications.length, publications);
  assert.equal(h.frames.size, 0); h.flush(); assert.equal(h.measurements() - before, 2);
  // No viewport query exists; rendered hosts remain eligible at any scroll position.
  assert.equal(h.eligible(a), true);
  assert.deepEqual(Array.from(h.mutations[0].options.attributeFilter), ["hidden", "aria-hidden", "inert", "class", "style", "open", "data-open"]);
  h.registry.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0);
});

test("StrictMode-like teardown, queued old RAF and stale observer cannot touch a new registration", () => {
  const h = harness(), host = h.node("SECTION");
  const oldRemove = h.registry.register("old", host);
  h.changes(); const oldFrame = [...h.frames.values()][0], oldObserver = h.mutations[0].callback;
  h.registry.dispose(); assert.equal(h.cancelled.length, 1); assert.equal(h.frames.size, 0);
  const remove = h.registry.register("new", host), count = h.publications.length;
  oldRemove(); oldFrame(); oldObserver([]);
  assert.equal(h.publications.length, count); assert.equal(h.frames.size, 0);
  assert.deepEqual(h.publications.at(-1), { new: 1 });
  h.changes(); assert.equal(h.frames.size, 1); remove();
  assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0);
  assert.ok(h.mutations.every(row => !row.connected)); assert.ok(h.sizes.every(row => row.hosts.size === 0));
});
