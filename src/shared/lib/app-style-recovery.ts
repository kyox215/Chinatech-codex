export const repairDeskStyleReadyProperty = "--repairdesk-styles-ready";
export const repairDeskStyleReloadedAtKey = "repairdesk:style-recovery:reloaded-at";
export const repairDeskStyleReloadCooldownMs = 30_000;

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

export function getRepairDeskStyleRecoveryDecision({
  stylesReady,
  lastReloadedAt,
  now = Date.now(),
}: {
  stylesReady: boolean;
  lastReloadedAt: number | null;
  now?: number;
}): RepairDeskStyleRecoveryDecision {
  if (stylesReady) return "ready";
  if (lastReloadedAt === null || now - lastReloadedAt >= repairDeskStyleReloadCooldownMs) {
    return "reload";
  }
  return "wait";
}

export function parseRepairDeskStyleReloadedAt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
