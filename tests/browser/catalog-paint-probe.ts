import type { Locator, Page } from '@playwright/test';

export type PickerTier = 'brand' | 'series' | 'model';
export type PickerPaint = { token: number; start: number; firstVisible: number; frame1: number; frame2: number; ms: number; trusted: boolean; event: string };
export type PickerIntent = { tier: PickerTier; event: 'pointerdown' | 'click' | 'input'; target: string; count?: number; query?: string; pressed?: string };
export type PickerArm = PickerIntent & { token: number; source: HTMLElement; root: HTMLElement; inputId: string; kind: 'input' | 'family'; groupLabel: string; sourceLabel: string };
type NativeReceipt = { token: number; tier: PickerTier; event: string; trusted: boolean; matched: boolean; captured: boolean; at: number; rootConnected: boolean; inputMatches: boolean; sourceConnected: boolean };
export type PickerProbe = { catalogArmed: PickerArm | null; catalogSequence: number; catalogOwnerToken: number; catalogSamples: Record<PickerTier, PickerPaint[]>; catalogNativeReceipts: NativeReceipt[]; catalogPaintConditions: Record<number, Record<string, boolean>> };

/** Observe the real native event and two painted frames; never drive the UI or its clocks. */
export async function installCatalogPaintProbe(page: Page) {
  await page.evaluate(() => {
    const probe = window as unknown as PickerProbe;
    probe.catalogArmed = null; probe.catalogSequence = 0; probe.catalogOwnerToken = 0;
    probe.catalogSamples = { brand: [], series: [], model: [] };
    probe.catalogNativeReceipts = []; probe.catalogPaintConditions = {};
    const visible = (element: HTMLElement | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return false;
      for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), clip = parent.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        if (/auto|scroll|hidden|clip/.test(style.overflowY) && (rect.bottom <= clip.top || rect.top >= clip.bottom)) return false;
        if (/auto|scroll|hidden|clip/.test(style.overflowX) && (rect.right <= clip.left || rect.left >= clip.right)) return false;
        // A modal dialog is in the top layer and is not clipped by its DOM ancestors.
        if (parent instanceof HTMLDialogElement && parent.matches(':modal')) break;
      }
      const hit = document.elementFromPoint(Math.max(0, rect.left + rect.width / 2), Math.max(0, rect.top + rect.height / 2));
      return !!hit && (hit === element || element.contains(hit));
    };
    const sample = (event: Event) => {
      const start = performance.now();
      const arm = probe.catalogArmed;
      if (!arm) return;
      const input = arm.root.querySelector<HTMLInputElement>('[role="combobox"]');
      const inputMatches = !!input && input.id === arm.inputId;
      const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
      let matched = false;
      if (arm.root.isConnected && inputMatches && !input!.disabled && !input!.readOnly && target?.closest('.search-combobox') === arm.root) {
        if (arm.kind === 'input') matched = target === input || input instanceof HTMLButtonElement && input.contains(target) || arm.tier === 'model' && target === arm.root.querySelector('[role="searchbox"]');
        else {
          const button = target.closest('button');
          const groups = [...arm.root.querySelectorAll<HTMLElement>('[role="group"]')].filter(group => group.getAttribute('aria-label') === arm.groupLabel);
          matched = button instanceof HTMLButtonElement && !button.disabled && groups.length === 1 && button.closest('[role="group"]') === groups[0] && button.hasAttribute('aria-pressed') && (button.textContent ?? '').trim() === arm.sourceLabel;
        }
      }
      const captured = arm.event === event.type && event.isTrusted && matched;
      probe.catalogNativeReceipts.push({ token: arm.token, tier: arm.tier, event: event.type, trusted: event.isTrusted, matched, captured, at: start, rootConnected: arm.root.isConnected, inputMatches, sourceConnected: arm.source.isConnected });
      if (probe.catalogNativeReceipts.length > 512) probe.catalogNativeReceipts.shift();
      if (!captured) return;
      // The field owner stays fixed; a menu child may have been recreated since arming.
      probe.catalogArmed = null;
      let firstVisible: number | undefined, painting = false, done = false, poll = 0;
      const condition = () => {
        const option = [...arm.root.querySelectorAll<HTMLElement>('[role="option"]')].find(row => row.getAttribute('aria-label') === arm.target) ?? null;
        const currentInput = arm.root.querySelector<HTMLInputElement>('[role="combobox"]');
        const list = arm.root.querySelector('[role="listbox"]');
        const state = {
          rootConnected: arm.root.isConnected,
          inputMatches: currentInput?.id === arm.inputId,
          expanded: currentInput?.getAttribute('aria-expanded') === 'true',
          targetVisible: visible(option),
          notBusy: list?.getAttribute('aria-busy') === 'false',
          countMatches: arm.count === undefined || arm.root.querySelectorAll('[role="option"]').length === arm.count,
          queryMatches: arm.query === undefined || (arm.root.querySelector<HTMLInputElement>('[role="searchbox"]') ?? currentInput)?.value === arm.query,
          pressedMatches: arm.pressed === undefined || [...arm.root.querySelectorAll('button[aria-pressed="true"]')].some(button => button.textContent === arm.pressed),
        };
        probe.catalogPaintConditions[arm.token] = state;
        return Object.values(state).every(Boolean);
      };
      const queue = () => { if (!poll && !done) poll = requestAnimationFrame(() => { poll = 0; check(); }); };
      const check = () => {
        if (done) return;
        if (probe.catalogOwnerToken !== arm.token) { done = true; observer.disconnect(); cancelAnimationFrame(poll); return; }
        if (painting) return;
        if (!condition()) { queue(); return; }
        firstVisible ??= performance.now(); painting = true;
        requestAnimationFrame(() => {
          if (!condition()) { painting = false; queue(); return; }
          const frame1 = performance.now();
          requestAnimationFrame(() => {
            if (!condition()) { painting = false; queue(); return; }
            if (probe.catalogOwnerToken !== arm.token) { done = true; observer.disconnect(); cancelAnimationFrame(poll); return; }
            const frame2 = performance.now(); done = true; observer.disconnect(); cancelAnimationFrame(poll);
            probe.catalogSamples[arm.tier].push({ token: arm.token, start, firstVisible: firstVisible!, frame1, frame2, ms: frame2 - start, trusted: event.isTrusted, event: event.type });
          });
        });
      };
      const observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, attributes: true }); check();
    };
    for (const type of ['pointerdown', 'click', 'input']) document.addEventListener(type, sample, true);
  });
}

export const armCatalogPaintProbe = (source: Locator, value: PickerIntent) => source.evaluate((element, value) => {
  const root = element.closest<HTMLElement>('.search-combobox');
  const input = root?.querySelector<HTMLInputElement>('[role="combobox"]');
  if (!(element instanceof HTMLElement) || !root || !input?.id) throw new Error('Sampler requires the independent catalog field owner');
  const group = element.closest<HTMLElement>('[role="group"]');
  const family = value.tier === 'series';
  if (family ? element.tagName !== 'BUTTON' || !element.hasAttribute('aria-pressed') || !group?.getAttribute('aria-label') || !root.contains(group) : element !== input && !(value.tier === 'model' && element.getAttribute('role') === 'searchbox')) throw new Error('Sampler source does not match its tier');
  const probe = window as unknown as PickerProbe;
  const token = ++probe.catalogSequence; probe.catalogOwnerToken = token;
  probe.catalogArmed = { ...value, token, source: element, root, inputId: input.id, kind: family ? 'family' : 'input', groupLabel: group?.getAttribute('aria-label') ?? '', sourceLabel: (element.textContent ?? '').trim() };
}, value);

export const catalogPaintDiagnostics = (page: Page) => page.evaluate(() => {
  const probe = window as unknown as PickerProbe, arm = probe.catalogArmed;
  return { armed: arm ? { token: arm.token, tier: arm.tier, event: arm.event, inputId: arm.inputId, rootConnected: arm.root.isConnected, inputMatches: arm.root.querySelector<HTMLInputElement>('[role="combobox"]')?.id === arm.inputId, sourceConnected: arm.source.isConnected } : null, native: probe.catalogNativeReceipts, paintConditions: probe.catalogPaintConditions, counts: Object.fromEntries(Object.entries(probe.catalogSamples).map(([tier, values]) => [tier, values.length])) };
});
