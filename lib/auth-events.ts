const EVENT = "ct-auth-changed";
const CHANNEL = "ct-auth-state";
export function notifyAuthChanged() {
  window.dispatchEvent(new Event(EVENT));
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage("changed"); channel.close(); } catch { /* Storage is the fallback. */ }
  try { localStorage.setItem(CHANNEL, `${Date.now()}:${Math.random()}`); } catch { /* Foreground checks remain available. */ }
}
export function subscribeAuthChanged(refresh: () => void, local = true) {
  const stored = (event: StorageEvent) => { if (event.key === CHANNEL) refresh(); };
  let channel: BroadcastChannel | undefined;
  try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = refresh; } catch { /* Storage is the fallback. */ }
  if (local) window.addEventListener(EVENT, refresh);
  window.addEventListener("storage", stored);
  return () => { channel?.close(); window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", stored); };
}
