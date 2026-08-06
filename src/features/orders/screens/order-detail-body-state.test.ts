import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  registerOrderDetailBodyOwner,
  resetOrderDetailBodyOwnersForTests,
  updateOrderDetailBodyOwner,
} from "./order-detail-body-state";

function bodyMarkers() {
  return {
    active: document.body.dataset.orderDetailActive,
    mobile: document.body.dataset.mobileWorkspaceActive,
    mode: document.body.dataset.orderDetailRenderMode,
    modeOwner: document.body.dataset.orderDetailRenderModeOwner,
  };
}

describe("order detail body owner registry", () => {
  beforeEach(() => {
    resetOrderDetailBodyOwnersForTests();
    document.body.dataset.orderDetailActive = "outer-active";
    document.body.dataset.mobileWorkspaceActive = "outer-mobile";
    document.body.dataset.orderDetailRenderMode = "outer-mode";
    document.body.dataset.orderDetailRenderModeOwner = "outer-owner";
  });

  afterEach(() => {
    resetOrderDetailBodyOwnersForTests();
    delete document.body.dataset.orderDetailActive;
    delete document.body.dataset.mobileWorkspaceActive;
    delete document.body.dataset.orderDetailRenderMode;
    delete document.body.dataset.orderDetailRenderModeOwner;
  });

  it("falls back to the newest remaining page owner without losing active/mobile state", () => {
    const compact = registerOrderDetailBodyOwner({
      ownerId: "compact",
      surface: "page",
      renderMode: "compact",
    });
    const desktop = registerOrderDetailBodyOwner({
      ownerId: "desktop",
      surface: "page",
      renderMode: "desktop",
    });

    expect(bodyMarkers()).toEqual({
      active: "true",
      mobile: "true",
      mode: "desktop",
      modeOwner: "desktop",
    });

    desktop();
    expect(bodyMarkers()).toEqual({
      active: "true",
      mobile: "true",
      mode: "compact",
      modeOwner: "compact",
    });

    compact();
    expect(bodyMarkers()).toEqual({
      active: "outer-active",
      mobile: "outer-mobile",
      mode: "outer-mode",
      modeOwner: "outer-owner",
    });
  });

  it("keeps dialog ownership while a page owner is removed", () => {
    const page = registerOrderDetailBodyOwner({
      ownerId: "page",
      surface: "page",
      renderMode: "desktop",
    });
    const dialog = registerOrderDetailBodyOwner({
      ownerId: "dialog",
      surface: "dialog",
      renderMode: "desktop",
    });

    page();
    expect(bodyMarkers()).toEqual({
      active: "true",
      mobile: "true",
      mode: undefined,
      modeOwner: undefined,
    });

    dialog();
    expect(bodyMarkers()).toEqual({
      active: "outer-active",
      mobile: "outer-mobile",
      mode: "outer-mode",
      modeOwner: "outer-owner",
    });
  });

  it("updates the live owner and ignores stale cleanup for a replaced id", () => {
    const firstCleanup = registerOrderDetailBodyOwner({
      ownerId: "same-id",
      surface: "page",
      renderMode: "compact",
    });
    const replacementCleanup = registerOrderDetailBodyOwner({
      ownerId: "same-id",
      surface: "page",
      renderMode: "desktop",
    });

    updateOrderDetailBodyOwner("same-id", { renderMode: "compact" });
    expect(document.body.dataset.orderDetailRenderMode).toBe("compact");

    firstCleanup();
    expect(document.body.dataset.orderDetailActive).toBe("true");
    expect(document.body.dataset.orderDetailRenderMode).toBe("compact");

    replacementCleanup();
    expect(bodyMarkers()).toEqual({
      active: "outer-active",
      mobile: "outer-mobile",
      mode: "outer-mode",
      modeOwner: "outer-owner",
    });
  });
});
