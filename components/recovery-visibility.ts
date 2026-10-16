/** Presentation only: a scrollable, rendered host owns its original recovery UI. */
export function recoveryHostEligible(host: HTMLElement) {
  if (!host.isConnected) return false;
  for (let node: HTMLElement | null = host; node; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true" || node.hasAttribute("inert")) return false;
    if (node.tagName === "SUMMARY" || (node.tagName === "DETAILS" && !node.hasAttribute("open"))) return false;
  }
  if (!host.getClientRects().length) return false;
  const visibility = host.ownerDocument.defaultView?.getComputedStyle(host).visibility;
  return visibility !== undefined && visibility !== "hidden" && visibility !== "collapse";
}

/** One observer set per provider; events inspect registered hosts, never business content. */
export function createRecoveryVisibilityRegistry(publish: (counts: Record<string, number>) => void) {
  const entries = new Map<symbol, { id: string; host: HTMLElement }>();
  const hosts = new Map<HTMLElement, number>();
  let counts: Record<string, number> = {};
  let view: Window | null = null;
  let observer: MutationObserver | null = null;
  let sizes: ResizeObserver | null = null;
  let frame: number | null = null;
  let generation = 0;
  let notify: (() => void) | null = null;

  function scan() {
    const next: Record<string, number> = {};
    for (const { id, host } of entries.values()) {
      if (recoveryHostEligible(host)) next[id] = (next[id] ?? 0) + 1;
    }
    const keys = Object.keys(next);
    if (keys.length === Object.keys(counts).length && keys.every(id => next[id] === counts[id])) return;
    counts = next;
    publish(next);
  }
  function schedule() {
    if (frame !== null || !view || !entries.size) return;
    const own = generation;
    frame = view.requestAnimationFrame(() => { if (own !== generation) return; frame = null; if (entries.size) scan(); });
  }
  function stop() {
    generation++;
    if (frame !== null) view?.cancelAnimationFrame(frame);
    frame = null;
    observer?.disconnect(); observer = null;
    sizes?.disconnect(); sizes = null;
    if (notify) view?.removeEventListener("resize", notify);
    notify = null; view = null;
  }
  function start(host: HTMLElement) {
    view = host.ownerDocument.defaultView;
    if (!view) return;
    const own = generation;
    notify = () => { if (own === generation) schedule(); };
    observer = new MutationObserver(notify);
    observer.observe(host.ownerDocument.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "inert", "class", "style", "open", "data-open"] });
    if (typeof ResizeObserver !== "undefined") sizes = new ResizeObserver(notify);
    view.addEventListener("resize", notify);
  }
  function register(id: string, host: HTMLElement) {
    const token = Symbol(id);
    entries.set(token, { id, host });
    if (!view) start(host);
    const count = hosts.get(host) ?? 0;
    hosts.set(host, count + 1);
    if (!count) sizes?.observe(host);
    scan();
    return () => {
      if (!entries.delete(token)) return;
      const remaining = (hosts.get(host) ?? 1) - 1;
      if (remaining) hosts.set(host, remaining);
      else { hosts.delete(host); sizes?.unobserve(host); }
      if (!entries.size) stop();
      scan();
    };
  }
  function dispose() {
    entries.clear(); hosts.clear(); stop(); scan();
  }
  return { register, dispose };
}
