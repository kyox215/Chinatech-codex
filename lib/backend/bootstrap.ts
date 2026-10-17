import type { BackendSnapshot } from "./contracts";
import { backendIdentityKey } from "./read-plan";

type Client = {
  generation: () => number;
  read: () => BackendSnapshot | null;
  subscribe: (listener: () => void) => () => void;
  configure: (snapshot: BackendSnapshot) => void;
  reconcile: (snapshot: BackendSnapshot) => void;
  release: (generation: number) => number | null;
  canAdoptRelease: (baseline: number) => boolean;
};

/** One component tree owns this bootstrap. It never writes server module state. */
export function createBackendBootstrap(initial: BackendSnapshot, client: Client) {
  const baseline = client.generation();
  const scope = { store: initial.storeId, member: initial.staff.currentId };
  let owned: number | null = null;
  let released: number | null = null;
  let invalid = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const matches = (snapshot: BackendSnapshot) => snapshot.storeId === scope.store && snapshot.staff.currentId === scope.member && (!initial.read || !snapshot.read || backendIdentityKey(initial.read.scope) === backendIdentityKey(snapshot.read.scope));
  const read = () => {
    if (invalid) return null;
    const generation = client.generation();
    if (owned === null) return released === null && generation === baseline ? initial : null;
    if (generation !== owned) return null;
    const current = client.read();
    return current && matches(current) ? current : null;
  };
  return {
    read,
    isActive: () => owned !== null && client.generation() === owned && !invalid,
    readFor(next: BackendSnapshot) {
      const current = read();
      if (!current || !matches(next)) return null;
      const before = current.staff.members.find(row => row.id === scope.member)?.revision ?? 0;
      const after = next.staff.members.find(row => row.id === scope.member)?.revision ?? 0;
      if (after < before || next.revision < current.revision) return current;
      // New server props may revoke access before passive reconciliation runs.
      return after > before || next.revision > current.revision ? next : current;
    },
    server: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const stop = client.subscribe(listener);
      return () => { listeners.delete(listener); stop(); };
    },
    activate(next: BackendSnapshot) {
      const generation = client.generation();
      const firstHandoff = owned === null && released === null && client.canAdoptRelease(baseline);
      if (invalid || !matches(next) || (owned === null ? generation !== (released ?? baseline) && !firstHandoff : generation !== owned)) {
        invalid = true; notify(); return false;
      }
      if (owned === generation) client.reconcile(next);
      else client.configure(next);
      owned = client.generation(); released = null; notify();
      return true;
    },
    dispose() {
      // Strict Mode can replay our own cleanup. An unrelated invalidation cannot.
      if (owned !== null && client.generation() === owned) {
        released = client.release(owned);
      } else { invalid = true; }
      owned = null; notify();
    },
  };
}
