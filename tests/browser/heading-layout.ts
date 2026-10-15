import type {Page, Locator} from '@playwright/test';

/** Measure the neutral layout, without a previous click hovering the next page's action. */
export async function measureHeadingLayout(page: Page, action: Locator) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  return action.evaluate(async node => {
    const menu = document.querySelector('.module-heading .page-menu-button');
    if (!menu) throw new Error('Heading menu is required for the layout measurement');
    const related = new Set<Element>();
    for (const root of [node, menu]) for (let current: Element | null = root; current; current = current.parentElement) related.add(current);
    const finite = () => [...new Set([...related].flatMap(element => element.getAnimations()))]
      .filter(animation => animation.playState === 'running' && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all(finite().map(animation => animation.finished.catch(() => undefined))),
        new Promise<never>((_, reject) => {timeout = setTimeout(() => reject(new Error('Heading transition did not settle within 2 seconds')), 2000);}),
      ]);
    } finally {clearTimeout(timeout);}
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {x: box.x, y: box.y, width: box.width, height: box.height};
    };
    // Both boxes and diagnostics come from the same frame; infinite activity is left running.
    return {a: rect(node), m: rect(menu), runningFinite: finite().length, actionTransform: getComputedStyle(node).transform, menuTransform: getComputedStyle(menu).transform};
  });
}
