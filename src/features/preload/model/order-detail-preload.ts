export const ORDER_DETAIL_PRELOAD_LIMIT = 2;
export const ORDER_DETAIL_PRELOAD_CONCURRENCY = 1;
export const ORDER_DETAIL_PRELOAD_QUEUE_LIMIT = 2;
export const ORDER_DETAIL_PRELOAD_GC_TIME = 2 * 60_000;
export const ORDER_DETAIL_HOVER_DELAY_MS = 100;

export type RepairDeskPreloadNetworkState = {
  online: boolean;
  effectiveType?: string;
  saveData?: boolean;
};

export function getOrderDetailAutomaticPreloadLimit({
  online,
  effectiveType,
  saveData,
}: RepairDeskPreloadNetworkState) {
  if (!online || saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
    return 0;
  }
  return effectiveType === "3g" ? 1 : ORDER_DETAIL_PRELOAD_LIMIT;
}

type ScheduledPreload = {
  key: string;
  run: () => Promise<unknown>;
  priority: "background" | "intent";
};

export class BoundedPreloadScheduler {
  private readonly queue: ScheduledPreload[] = [];
  private readonly activeKeys = new Set<string>();
  private readonly queuedKeys = new Set<string>();
  private activeCount = 0;
  private disposed = false;

  constructor(
    private readonly maxConcurrency = ORDER_DETAIL_PRELOAD_CONCURRENCY,
    private readonly maxQueueSize = ORDER_DETAIL_PRELOAD_QUEUE_LIMIT,
  ) {}

  schedule(key: string, run: () => Promise<unknown>, priority: "background" | "intent") {
    if (this.disposed || this.activeKeys.has(key) || this.queuedKeys.has(key)) return false;
    const task = { key, run, priority };
    if (priority === "intent") {
      this.removeQueuedIntentTasks();
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }
    this.queuedKeys.add(key);
    this.trimQueue();
    if (!this.queuedKeys.has(key)) return false;
    this.drain();
    return true;
  }

  cancel(key: string) {
    const index = this.queue.findIndex((task) => task.key === key);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    this.queuedKeys.delete(key);
    return true;
  }

  clear() {
    this.queue.splice(0);
    this.queuedKeys.clear();
  }

  dispose() {
    this.disposed = true;
    this.clear();
  }

  snapshot() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      activeKeys: [...this.activeKeys],
      queuedKeys: this.queue.map((task) => task.key),
    };
  }

  private drain() {
    if (this.disposed) return;
    const concurrency = Math.max(1, this.maxConcurrency);
    while (this.activeCount < concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) return;
      this.queuedKeys.delete(task.key);
      this.activeKeys.add(task.key);
      this.activeCount += 1;
      void Promise.resolve()
        .then(task.run)
        .catch(() => undefined)
        .finally(() => {
          this.activeCount -= 1;
          this.activeKeys.delete(task.key);
          this.drain();
        });
    }
  }

  private removeQueuedIntentTasks() {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const task = this.queue[index];
      if (task.priority !== "intent") continue;
      this.queue.splice(index, 1);
      this.queuedKeys.delete(task.key);
    }
  }

  private trimQueue() {
    const queueLimit = Math.max(1, this.maxQueueSize);
    while (this.queue.length > queueLimit) {
      const dropped = this.queue.pop();
      if (dropped) this.queuedKeys.delete(dropped.key);
    }
  }
}
