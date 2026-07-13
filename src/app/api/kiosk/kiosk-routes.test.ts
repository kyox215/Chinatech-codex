import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  kioskDeviceUnauthorizedError,
  KIOSK_INTERNAL_ERROR_RESPONSE,
  KIOSK_PUBLIC_ERROR_CODES,
} from "@/features/kiosk/model/kiosk-public-error";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const mocks = vi.hoisted(() => ({
  getKioskPublicSession: vi.fn(),
  pairKioskDevice: vi.fn(),
  queueRepairDeskRealtimeBroadcast: vi.fn(),
  submitKioskPublicSession: vi.fn(),
}));

vi.mock("@/server/api/kiosk-public-source", () => ({
  kioskPublicSource: vi.fn(async () => ({
    getKioskPublicSession: mocks.getKioskPublicSession,
    pairKioskDevice: mocks.pairKioskDevice,
    submitKioskPublicSession: mocks.submitKioskPublicSession,
  })),
}));

vi.mock("@/features/realtime/server/realtime-broadcast", () => ({
  queueRepairDeskRealtimeBroadcast: mocks.queueRepairDeskRealtimeBroadcast,
}));

import { POST as pairKiosk } from "./pair/route";
import { GET as getKioskSession } from "./session/route";
import { POST as submitKioskSession } from "./session/submit/route";

describe("public kiosk routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a stable unauthorized code when a device token is revoked", async () => {
    mocks.getKioskPublicSession.mockRejectedValueOnce(kioskDeviceUnauthorizedError());

    const response = await getKioskSession(
      new NextRequest("http://localhost/api/kiosk/session", {
        headers: { "x-kiosk-token": "revoked-token" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "iPad 未绑定或已撤销",
      code: KIOSK_PUBLIC_ERROR_CODES.deviceUnauthorized,
    });
  });

  it("projects a safe pairing response and queues only scoped realtime metadata", async () => {
    mocks.pairKioskDevice.mockResolvedValueOnce({
      token: "secret-device-token",
      device: {
        id: "device-1",
        store_id: storeId,
        label: "Front iPad",
        status: "active",
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
      },
    });

    const response = await pairKiosk(
      new NextRequest("http://localhost/api/kiosk/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "12345678" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        token: "secret-device-token",
        device: { label: "Front iPad", status: "active" },
      },
    });
    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenCalledWith({
      storeId,
      domain: "settings",
      mutation: "updated",
      queryGroups: ["kiosk.devices"],
    });
  });

  it("requires confirmation and never exposes internal session identifiers", async () => {
    const unconfirmed = await submitKioskSession(
      new NextRequest("http://localhost/api/kiosk/session/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiosk-token": "device-token",
        },
        body: JSON.stringify({ customer_name: "Cliente", confirmation_checked: false }),
      }),
    );
    expect(unconfirmed.status).toBe(400);
    expect(mocks.submitKioskPublicSession).not.toHaveBeenCalled();

    mocks.submitKioskPublicSession.mockResolvedValueOnce({
      ok: true,
      session_id: "internal-session-id",
      store_id: storeId,
    });
    const confirmed = await submitKioskSession(
      new NextRequest("http://localhost/api/kiosk/session/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiosk-token": "device-token",
        },
        body: JSON.stringify({ customer_name: "Cliente", confirmation_checked: true }),
      }),
    );

    await expect(confirmed.json()).resolves.toEqual({ data: { ok: true } });
    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenCalledWith({
      storeId,
      domain: "settings",
      mutation: "updated",
      queryGroups: ["kiosk.sessions"],
    });
  });

  it("never returns raw internal errors from anonymous routes", async () => {
    const internalMessage = "relation customer_kiosk_sessions does not exist";
    mocks.getKioskPublicSession.mockRejectedValueOnce(new Error(internalMessage));
    mocks.pairKioskDevice.mockRejectedValueOnce(new Error(internalMessage));
    mocks.submitKioskPublicSession.mockRejectedValueOnce(new Error(internalMessage));

    const responses = await Promise.all([
      getKioskSession(
        new NextRequest("http://localhost/api/kiosk/session", {
          headers: { "x-kiosk-token": "device-token" },
        }),
      ),
      pairKiosk(
        new NextRequest("http://localhost/api/kiosk/pair", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: "12345678" }),
        }),
      ),
      submitKioskSession(
        new NextRequest("http://localhost/api/kiosk/session/submit", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kiosk-token": "device-token",
          },
          body: JSON.stringify({ confirmation_checked: true }),
        }),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({
        error: KIOSK_INTERNAL_ERROR_RESPONSE.message,
        code: KIOSK_INTERNAL_ERROR_RESPONSE.code,
      });
      expect(JSON.stringify(body)).not.toContain(internalMessage);
    }
  });
});
