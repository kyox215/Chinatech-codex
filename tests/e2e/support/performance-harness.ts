import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Page, TestInfo } from "@playwright/test";

/**
 * Controlled dev synthetic evidence only. These measurements are not
 * production RUM and must not be used as production timing budgets.
 */
export const PERFORMANCE_HARNESS_METADATA = {
  source: "controlled-dev-synthetic",
  productionRUM: false,
  productionTiming: false,
  piiPolicy: "controlled-synthetic-fixture-no-production-pii",
} as const;

export type DomPerformanceMetrics = {
  nodeCount: number;
  maxDepth: number;
  maxChildren: number;
  scrollWidth: number;
  innerWidth: number;
  renderer: {
    active: number;
    inactive: number;
    compact: number;
    desktop: number;
    pending: number;
  };
  ordersList: {
    total: number;
    mobile: number;
    desktop: number;
    subtreeNodeCount: {
      mobile: number;
      desktop: number;
    };
  };
  resources: {
    count: number;
    decodedBodySize: number;
    entries: Array<{
      path: string;
      duration: number;
      decodedBodySize: number;
      transferSize: number;
    }>;
  };
  longTasks: {
    observerSupported: boolean;
    count: number;
    totalDuration: number;
    maxDuration: number;
  };
  navigationDuration: number | null;
};

type LongTaskRecord = { duration: number };

declare global {
  interface Window {
    __repairdeskPerformanceLongTasks?: LongTaskRecord[];
    __repairdeskPerformanceLongTaskObserverSupported?: boolean;
  }
}

export async function installPerformanceObservers(page: Page) {
  await page.addInitScript(() => {
    const target = window as Window;
    target.__repairdeskPerformanceLongTasks = [];
    target.__repairdeskPerformanceLongTaskObserverSupported =
      typeof PerformanceObserver !== "undefined";
    if (typeof PerformanceObserver === "undefined") return;

    try {
      const observer = new PerformanceObserver((list) => {
        const records = target.__repairdeskPerformanceLongTasks ?? [];
        for (const entry of list.getEntries()) {
          records.push({ duration: entry.duration });
        }
        target.__repairdeskPerformanceLongTasks = records;
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      target.__repairdeskPerformanceLongTaskObserverSupported = false;
    }
  });
}

export async function collectDomPerformanceMetrics(page: Page): Promise<DomPerformanceMetrics> {
  return page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("*"));
    let maxDepth = 0;
    let maxChildren = 0;
    for (const element of elements) {
      maxChildren = Math.max(maxChildren, element.children.length);
      let depth = 0;
      let parent = element.parentElement;
      while (parent) {
        depth += 1;
        parent = parent.parentElement;
      }
      maxDepth = Math.max(maxDepth, depth);
    }

    const rendererEntries = Array.from(
      document.querySelectorAll<HTMLElement>("[data-order-detail-renderer]"),
    );
    const countRenderer = (mode: string) =>
      rendererEntries.filter((entry) => entry.dataset.orderDetailRenderer === mode).length;
    const compact = countRenderer("compact");
    const desktop = countRenderer("desktop");
    const pending = countRenderer("pending");
    const ordersListEntries = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-order-mobile-list="true"], [data-order-desktop-list="true"]',
      ),
    );
    const ordersListMobile = ordersListEntries.filter(
      (entry) => entry.dataset.orderMobileList === "true",
    ).length;
    const ordersListDesktop = ordersListEntries.filter(
      (entry) => entry.dataset.orderDesktopList === "true",
    ).length;
    const countSubtreeNodes = (entry: HTMLElement | undefined) =>
      entry ? entry.querySelectorAll("*").length + 1 : 0;
    const ordersListMobileEntry = ordersListEntries.find(
      (entry) => entry.dataset.orderMobileList === "true",
    );
    const ordersListDesktopEntry = ordersListEntries.find(
      (entry) => entry.dataset.orderDesktopList === "true",
    );
    const resources = performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      let path = resource.name;
      try {
        path = new URL(resource.name, window.location.href).pathname;
      } catch {
        // Keep the resource name only when URL parsing is unavailable.
      }
      return {
        path,
        duration: Math.round(resource.duration * 100) / 100,
        decodedBodySize: resource.decodedBodySize ?? 0,
        transferSize: resource.transferSize ?? 0,
      };
    });
    const longTasks = window.__repairdeskPerformanceLongTasks ?? [];
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    return {
      nodeCount: elements.length,
      maxDepth,
      maxChildren,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      innerWidth: window.innerWidth,
      renderer: {
        active: compact + desktop,
        inactive: pending,
        compact,
        desktop,
        pending,
      },
      ordersList: {
        total: ordersListEntries.length,
        mobile: ordersListMobile,
        desktop: ordersListDesktop,
        subtreeNodeCount: {
          mobile: countSubtreeNodes(ordersListMobileEntry),
          desktop: countSubtreeNodes(ordersListDesktopEntry),
        },
      },
      resources: {
        count: resources.length,
        decodedBodySize: resources.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
        entries: resources,
      },
      longTasks: {
        observerSupported: window.__repairdeskPerformanceLongTaskObserverSupported === true,
        count: longTasks.length,
        totalDuration: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
        maxDuration: longTasks.reduce((max, entry) => Math.max(max, entry.duration), 0),
      },
      navigationDuration: navigation?.duration ?? null,
    } satisfies DomPerformanceMetrics;
  });
}

export async function writePerformanceArtifact(
  testInfo: TestInfo,
  fileName: string,
  value: unknown,
) {
  const outputPath = testInfo.outputPath(fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function takeSyntheticScreenshot(page: Page, testInfo: TestInfo, fileName: string) {
  const outputPath = testInfo.outputPath(fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await page.screenshot({
    path: outputPath,
    fullPage: false,
  });
  return outputPath;
}
