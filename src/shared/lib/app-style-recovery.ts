export const repairDeskStyleReadyProperty = "--repairdesk-styles-ready";
export const repairDeskStyleReloadedAtKey = "repairdesk:style-recovery:reloaded-at";
export const repairDeskStyleReloadStateKey = "repairdesk:style-recovery:reload-state-v2";
export const repairDeskStyleReloadWindowMs = 60_000;
export const repairDeskStyleMaxAutoReloads = 1;
export const repairDeskStyleRecoveryInitialDelayMs = 200;
export const repairDeskStyleRecoveryPollDelayMs = 750;
export const repairDeskStyleRecoveryProbeTimeoutMs = 750;
export const repairDeskStyleRecoveryStyleRetryMs = 500;
export const repairDeskStyleRecoveryRuntimeGraceMs = 1_200;
export const repairDeskStyleRecoveryManualActionDelayMs = 2_500;
export const repairDeskStyleRecoveryProbePath = "/recovery-probe.txt";
export const repairDeskStyleRecoveryProbeToken = "repairdesk-recovery-v1";

export const repairDeskCriticalStyleGuard = `
#repairdesk-style-fallback {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  background: Canvas;
  color: CanvasText;
  font: 600 15px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#repairdesk-style-fallback > div {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}
#repairdesk-style-fallback span[aria-hidden="true"] {
  width: 28px;
  height: 28px;
  border: 3px solid GrayText;
  border-top-color: currentColor;
  border-radius: 999px;
  animation: repairdesk-critical-style-spin 0.8s linear infinite;
}
#repairdesk-style-status {
  max-width: min(320px, calc(100vw - 48px));
}
#repairdesk-style-retry {
  display: none;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid CanvasText;
  border-radius: 12px;
  padding: 10px 18px;
  background: CanvasText;
  color: Canvas;
  font: inherit;
  cursor: pointer;
}
#repairdesk-style-retry:focus-visible {
  outline: 3px solid Highlight;
  outline-offset: 3px;
}
#repairdesk-style-retry:disabled {
  cursor: wait;
  opacity: 0.65;
}
#repairdesk-styled-shell {
  display: none;
}
@keyframes repairdesk-critical-style-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  #repairdesk-style-fallback span[aria-hidden="true"] { animation: none; }
}
`;

export type RepairDeskStyleRecoveryDecision = "ready" | "reload" | "wait";

export type RepairDeskStyleReloadState = {
  version: 2;
  windowStartedAt: number;
  autoReloadCount: number;
  lastAutoReloadAt: number;
};

export function getRepairDeskStyleRecoveryDecision({
  stylesReady,
  reloadState,
  storageAvailable = true,
  navigationWasReloaded = false,
  now = Date.now(),
}: {
  stylesReady: boolean;
  reloadState: RepairDeskStyleReloadState | null;
  storageAvailable?: boolean;
  navigationWasReloaded?: boolean;
  now?: number;
}): RepairDeskStyleRecoveryDecision {
  if (stylesReady) return "ready";
  if (!storageAvailable) return navigationWasReloaded ? "wait" : "reload";
  if (!isRepairDeskStyleReloadStateActive(reloadState, now)) return "reload";
  return reloadState.autoReloadCount < repairDeskStyleMaxAutoReloads ? "reload" : "wait";
}

export function parseRepairDeskStyleReloadedAt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseRepairDeskStyleReloadState(
  value: string | null,
): RepairDeskStyleReloadState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RepairDeskStyleReloadState>;
    if (
      parsed.version !== 2 ||
      !Number.isFinite(parsed.windowStartedAt) ||
      !Number.isFinite(parsed.autoReloadCount) ||
      !Number.isFinite(parsed.lastAutoReloadAt) ||
      Number(parsed.windowStartedAt) < 0 ||
      !Number.isInteger(parsed.autoReloadCount) ||
      Number(parsed.autoReloadCount) < 0 ||
      Number(parsed.lastAutoReloadAt) < 0
    ) {
      return null;
    }
    return {
      version: 2,
      windowStartedAt: Number(parsed.windowStartedAt),
      autoReloadCount: Number(parsed.autoReloadCount),
      lastAutoReloadAt: Number(parsed.lastAutoReloadAt),
    };
  } catch {
    return null;
  }
}

export function isRepairDeskStyleReloadStateActive(
  state: RepairDeskStyleReloadState | null,
  now = Date.now(),
): state is RepairDeskStyleReloadState {
  return (
    state !== null &&
    now >= state.windowStartedAt &&
    now - state.windowStartedAt < repairDeskStyleReloadWindowMs
  );
}

export function getNextRepairDeskStyleReloadState({
  reloadState,
  now = Date.now(),
}: {
  reloadState: RepairDeskStyleReloadState | null;
  now?: number;
}): RepairDeskStyleReloadState {
  if (!isRepairDeskStyleReloadStateActive(reloadState, now)) {
    return {
      version: 2,
      windowStartedAt: now,
      autoReloadCount: 1,
      lastAutoReloadAt: now,
    };
  }
  return {
    ...reloadState,
    autoReloadCount: reloadState.autoReloadCount + 1,
    lastAutoReloadAt: now,
  };
}

const repairDeskStyleRecoveryBootstrapConfig = JSON.stringify({
  readyProperty: repairDeskStyleReadyProperty,
  legacyReloadedAtKey: repairDeskStyleReloadedAtKey,
  reloadStateKey: repairDeskStyleReloadStateKey,
  reloadWindowMs: repairDeskStyleReloadWindowMs,
  maxAutoReloads: repairDeskStyleMaxAutoReloads,
  initialDelayMs: repairDeskStyleRecoveryInitialDelayMs,
  pollDelayMs: repairDeskStyleRecoveryPollDelayMs,
  probeTimeoutMs: repairDeskStyleRecoveryProbeTimeoutMs,
  styleRetryMs: repairDeskStyleRecoveryStyleRetryMs,
  runtimeGraceMs: repairDeskStyleRecoveryRuntimeGraceMs,
  manualActionDelayMs: repairDeskStyleRecoveryManualActionDelayMs,
  probePath: repairDeskStyleRecoveryProbePath,
  probeToken: repairDeskStyleRecoveryProbeToken,
});

export const repairDeskStyleRecoveryBootstrap = `
(() => {
  const existing = window.__repairDeskStyleRecovery;
  if (existing && typeof existing.wake === "function") {
    existing.wake();
    return;
  }

  const config = ${repairDeskStyleRecoveryBootstrapConfig};
  const root = document.documentElement;
  const status = document.getElementById("repairdesk-style-status");
  const retry = document.getElementById("repairdesk-style-retry");
  let runtimeReady = window.__repairDeskRuntimeReady === true;
  let timer;
  let manualTimer;
  let runtimeGraceTimer;
  let probeController;
  let probeInFlight = false;
  let reloadScheduled = false;
  let manualReloadScheduled = false;
  let runtimeGraceExpired = false;

  const stylesReady = () =>
    window.getComputedStyle(root).getPropertyValue(config.readyProperty).trim() === "1";
  const applicationReady = () => stylesReady() && runtimeReady;

  const setPhase = (phase, message) => {
    root.setAttribute("data-style-recovery", phase);
    if (status && message) status.textContent = message;
  };

  const setRetryVisible = (visible) => {
    if (!retry) return;
    retry.style.display = visible ? "inline-flex" : "none";
  };

  const clearStoredRecovery = () => {
    try {
      window.sessionStorage.removeItem(config.reloadStateKey);
      window.sessionStorage.removeItem(config.legacyReloadedAtKey);
    } catch {}
  };

  const markReady = () => {
    if (!applicationReady()) return false;
    if (timer !== undefined) window.clearTimeout(timer);
    if (manualTimer !== undefined) window.clearTimeout(manualTimer);
    if (runtimeGraceTimer !== undefined) window.clearTimeout(runtimeGraceTimer);
    if (probeController) probeController.abort();
    setRetryVisible(false);
    root.removeAttribute("data-style-recovery");
    clearStoredRecovery();
    return true;
  };

  const navigationWasReloaded = () => {
    try {
      const entry = performance.getEntriesByType("navigation")[0];
      if (entry && entry.type === "reload") return true;
      return Boolean(performance.navigation && performance.navigation.type === 1);
    } catch {
      return false;
    }
  };

  const readReloadState = () => {
    try {
      const raw = window.sessionStorage.getItem(config.reloadStateKey);
      if (!raw) return { available: true, state: null };
      const parsed = JSON.parse(raw);
      const valid =
        parsed &&
        parsed.version === 2 &&
        Number.isFinite(parsed.windowStartedAt) &&
        Number.isInteger(parsed.autoReloadCount) &&
        parsed.autoReloadCount >= 0 &&
        Number.isFinite(parsed.lastAutoReloadAt);
      return { available: true, state: valid ? parsed : null };
    } catch {
      return { available: false, state: null };
    }
  };

  const stateIsActive = (state, now) =>
    Boolean(
      state &&
        now >= state.windowStartedAt &&
        now - state.windowStartedAt < config.reloadWindowMs,
    );

  const canAutoReload = () => {
    const now = Date.now();
    const stored = readReloadState();
    if (!stored.available) return !navigationWasReloaded();
    if (!stateIsActive(stored.state, now)) return true;
    return stored.state.autoReloadCount < config.maxAutoReloads;
  };

  const recordAutoReload = () => {
    const now = Date.now();
    const stored = readReloadState();
    if (!stored.available) return !navigationWasReloaded();
    const nextState = stateIsActive(stored.state, now)
      ? {
          ...stored.state,
          autoReloadCount: stored.state.autoReloadCount + 1,
          lastAutoReloadAt: now,
        }
      : { version: 2, windowStartedAt: now, autoReloadCount: 1, lastAutoReloadAt: now };
    try {
      window.sessionStorage.setItem(config.reloadStateKey, JSON.stringify(nextState));
      return true;
    } catch {
      return !navigationWasReloaded();
    }
  };

  const showManualRecovery = (message) => {
    setPhase("manual", message || "RepairDesk 未完成启动，请立即重试。");
    setRetryVisible(true);
  };

  const probeReachability = async () => {
    probeController = new AbortController();
    const timeout = window.setTimeout(() => probeController.abort(), config.probeTimeoutMs);
    try {
      const url = new URL(config.probePath, window.location.href);
      url.searchParams.set("repairdesk_recovery", String(Date.now()));
      const response = await window.fetch(url, {
        cache: "no-store",
        credentials: "same-origin",
        signal: probeController.signal,
      });
      if (!response.ok) return false;
      return (await response.text()).trim() === config.probeToken;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
      probeController = undefined;
    }
  };

  const retryStyles = async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));
    if (links.length === 0) return false;
    setPhase("retrying-styles", "网络已恢复，正在进入 RepairDesk…");
    const nonce = String(Date.now());
    await Promise.race([
      Promise.allSettled(
        links.map(
          (link) =>
            new Promise((resolve) => {
              const settle = () => resolve(undefined);
              link.addEventListener("load", settle, { once: true });
              link.addEventListener("error", settle, { once: true });
              const url = new URL(link.href, window.location.href);
              url.searchParams.set("repairdesk_style_retry", nonce);
              link.href = url.toString();
            }),
        ),
      ),
      new Promise((resolve) => window.setTimeout(resolve, config.styleRetryMs)),
    ]);
    return stylesReady();
  };

  const scheduleReload = () => {
    if (reloadScheduled) return;
    if (!canAutoReload() || !recordAutoReload()) {
      showManualRecovery("连接已恢复，RepairDesk 未完成启动，请立即重试。");
      return;
    }
    reloadScheduled = true;
    setPhase("reloading", "网络已恢复，正在重新进入 RepairDesk…");
    window.setTimeout(() => {
      if (applicationReady()) {
        reloadScheduled = false;
        markReady();
        return;
      }
      window.location.reload();
    }, 60);
  };

  const schedule = (delay = config.pollDelayMs) => {
    if (applicationReady()) {
      markReady();
      return;
    }
    if (stylesReady() && !runtimeGraceExpired) return;
    if (document.visibilityState === "hidden" || reloadScheduled || manualReloadScheduled) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(attemptRecovery, delay);
  };

  async function attemptRecovery() {
    if (probeInFlight || reloadScheduled || manualReloadScheduled) return;
    if (applicationReady()) {
      markReady();
      return;
    }
    if (stylesReady() && !runtimeGraceExpired) return;
    if (document.visibilityState === "hidden") return;
    probeInFlight = true;
    setPhase("probing", navigator.onLine === false ? "网络已断开，RepairDesk 正在自动重试…" : "正在恢复 RepairDesk…");
    try {
      const reachable = await probeReachability();
      if (applicationReady()) {
        markReady();
        return;
      }
      if (!reachable) {
        setPhase("waiting", "网络暂不可用，RepairDesk 正在自动重试…");
        return;
      }
      if (!runtimeReady && !runtimeGraceExpired) {
        setPhase("awaiting-runtime", "网络已恢复，正在启动 RepairDesk…");
        return;
      }
      if (runtimeReady && (await retryStyles())) {
        markReady();
        return;
      }
      scheduleReload();
    } finally {
      probeInFlight = false;
      if (!applicationReady() && !reloadScheduled && !manualReloadScheduled) schedule();
    }
  }

  const wake = () => schedule(0);
  const markRuntimeReady = () => {
    runtimeReady = true;
    window.__repairDeskRuntimeReady = true;
    wake();
  };

  window.__repairDeskStyleRecovery = { markRuntimeReady, wake };

  retry?.addEventListener("click", () => {
    if (manualReloadScheduled) return;
    manualReloadScheduled = true;
    retry.disabled = true;
    setPhase("manual-reloading", "正在重新加载 RepairDesk…");
    window.setTimeout(() => window.location.reload(), 60);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      wake();
    } else {
      if (timer !== undefined) window.clearTimeout(timer);
      if (probeController) probeController.abort();
    }
  });
  document.addEventListener("resume", wake);
  window.addEventListener("online", wake);
  window.addEventListener("pageshow", wake);
  window.addEventListener("focus", wake);
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (target && target.tagName === "LINK" && target.rel === "stylesheet") wake();
    },
    true,
  );

  runtimeGraceTimer = window.setTimeout(() => {
    runtimeGraceExpired = true;
    if (!applicationReady()) {
      setPhase(runtimeReady ? "probing" : "awaiting-runtime", "正在恢复 RepairDesk…");
      wake();
    }
  }, config.runtimeGraceMs);

  if (applicationReady()) {
    markReady();
  } else {
    manualTimer = window.setTimeout(
      () => showManualRecovery("仍在恢复中，你也可以立即重试。"),
      config.manualActionDelayMs,
    );
    if (!stylesReady()) {
      schedule(config.initialDelayMs);
    }
  }
})();
`;
