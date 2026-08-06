import type { ViewportMode } from "@/hooks/use-mobile";

export type OrderDetailBodyOwner = {
  ownerId: string;
  surface: "page" | "dialog";
  renderMode: ViewportMode;
};

type RegisteredOwner = OrderDetailBodyOwner & {
  sequence: number;
  token: symbol;
};

type BodySnapshot = {
  orderDetailActive?: string;
  mobileWorkspaceActive?: string;
  orderDetailRenderMode?: string;
  orderDetailRenderModeOwner?: string;
};

const owners = new Map<string, RegisteredOwner>();
let nextSequence = 0;
let bodySnapshot: BodySnapshot | null = null;

function getBody() {
  return typeof document === "undefined" ? null : document.body;
}

function readBodySnapshot(body: HTMLElement): BodySnapshot {
  return {
    orderDetailActive: body.dataset.orderDetailActive,
    mobileWorkspaceActive: body.dataset.mobileWorkspaceActive,
    orderDetailRenderMode: body.dataset.orderDetailRenderMode,
    orderDetailRenderModeOwner: body.dataset.orderDetailRenderModeOwner,
  };
}

function restoreBodySnapshot(body: HTMLElement) {
  if (!bodySnapshot) return;
  if (bodySnapshot.orderDetailActive === undefined) {
    delete body.dataset.orderDetailActive;
  } else {
    body.dataset.orderDetailActive = bodySnapshot.orderDetailActive;
  }
  if (bodySnapshot.mobileWorkspaceActive === undefined) {
    delete body.dataset.mobileWorkspaceActive;
  } else {
    body.dataset.mobileWorkspaceActive = bodySnapshot.mobileWorkspaceActive;
  }
  if (bodySnapshot.orderDetailRenderMode === undefined) {
    delete body.dataset.orderDetailRenderMode;
  } else {
    body.dataset.orderDetailRenderMode = bodySnapshot.orderDetailRenderMode;
  }
  if (bodySnapshot.orderDetailRenderModeOwner === undefined) {
    delete body.dataset.orderDetailRenderModeOwner;
  } else {
    body.dataset.orderDetailRenderModeOwner = bodySnapshot.orderDetailRenderModeOwner;
  }
}

function recomputeBodyState() {
  const body = getBody();
  if (!body) return;

  if (owners.size === 0) {
    restoreBodySnapshot(body);
    bodySnapshot = null;
    return;
  }

  body.dataset.orderDetailActive = "true";
  const entries = [...owners.values()];
  const mobileWorkspaceActive = entries.some(
    (entry) => entry.surface === "dialog" || entry.renderMode !== "desktop",
  );
  if (mobileWorkspaceActive) {
    body.dataset.mobileWorkspaceActive = "true";
  } else {
    delete body.dataset.mobileWorkspaceActive;
  }

  const latestPageOwner = entries
    .filter((entry) => entry.surface === "page")
    .sort((a, b) => b.sequence - a.sequence)[0];
  if (latestPageOwner) {
    body.dataset.orderDetailRenderMode = latestPageOwner.renderMode;
    body.dataset.orderDetailRenderModeOwner = latestPageOwner.ownerId;
  } else {
    delete body.dataset.orderDetailRenderMode;
    delete body.dataset.orderDetailRenderModeOwner;
  }
}

export function registerOrderDetailBodyOwner(owner: OrderDetailBodyOwner) {
  const body = getBody();
  if (owners.size === 0 && body) bodySnapshot = readBodySnapshot(body);

  const registered: RegisteredOwner = {
    ...owner,
    sequence: nextSequence++,
    token: Symbol(owner.ownerId),
  };
  owners.set(owner.ownerId, registered);
  recomputeBodyState();

  return () => {
    const current = owners.get(owner.ownerId);
    if (!current || current.token !== registered.token) return;
    owners.delete(owner.ownerId);
    recomputeBodyState();
  };
}

export function updateOrderDetailBodyOwner(
  ownerId: string,
  update: Partial<Pick<OrderDetailBodyOwner, "surface" | "renderMode">>,
) {
  const current = owners.get(ownerId);
  if (!current) return;
  owners.set(ownerId, { ...current, ...update });
  recomputeBodyState();
}

/** Test-only reset that also restores any pre-existing body markers. */
export function resetOrderDetailBodyOwnersForTests() {
  owners.clear();
  nextSequence = 0;
  const body = getBody();
  if (body) restoreBodySnapshot(body);
  bodySnapshot = null;
}
