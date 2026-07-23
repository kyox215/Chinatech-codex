export const repairDeskPreloadTargets = [
  "orders",
  "workflow",
  "settings",
  "customers",
  "inventory",
] as const;

export type RepairDeskPreloadTarget = (typeof repairDeskPreloadTargets)[number];

const ownedTargetsByWorkspaceHome: Record<string, readonly RepairDeskPreloadTarget[]> = {
  "/orders": ["orders", "workflow", "settings", "customers", "inventory"],
  "/customers": ["customers"],
  "/inventory": ["inventory"],
  "/settings": ["settings"],
};

const targetPriorityByWorkspace: Record<string, readonly RepairDeskPreloadTarget[]> = {
  orders: ["orders", "customers", "workflow", "settings", "inventory"],
  customers: ["customers", "orders", "workflow", "settings", "inventory"],
  inventory: ["orders", "customers", "inventory", "settings", "workflow"],
  settings: [],
};

export function isRepairDeskPreloadEnabled(
  value = process.env.NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED,
) {
  return value !== "0";
}

export function getRepairDeskPreloadTargets(pathname: string, constrainedNetwork = false) {
  const workspace = pathname.split("/").filter(Boolean)[0] ?? "orders";
  const targets = targetPriorityByWorkspace[workspace] ?? targetPriorityByWorkspace.orders;
  return constrainedNetwork ? targets.slice(0, 2) : [...targets];
}

export function isRepairDeskPreloadTargetOwnedByWorkspaceHome(
  pathname: string,
  target: RepairDeskPreloadTarget,
) {
  const normalizedPathname = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  return ownedTargetsByWorkspaceHome[normalizedPathname]?.includes(target) ?? false;
}

export async function runRepairDeskPreloadQueue(
  tasks: readonly (() => Promise<unknown>)[],
  maxConcurrency = 2,
) {
  const workerCount = Math.max(1, Math.min(maxConcurrency, tasks.length));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < tasks.length) {
        const task = tasks[nextIndex];
        nextIndex += 1;
        try {
          await task();
        } catch {
          // Preloading is best-effort; later tasks should still warm their caches.
        }
      }
    }),
  );
}
