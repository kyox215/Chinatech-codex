import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const attachmentId = "00000000-0000-4000-8000-000000000901";
const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  readInventoryProductThumbnail: vi.fn(),
}));

vi.mock("@/server/auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth-context")>()),
  getRequestActor: mocks.getRequestActor,
}));
vi.mock("@/features/inventory/server/inventory.service", () => ({
  readInventoryProductThumbnail: mocks.readInventoryProductThumbnail,
}));

import { UnauthorizedError } from "@/server/auth-context";

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRequestActor.mockResolvedValue({
    id: "owner-1",
    storeId: "store-1",
    role: "owner",
  });
  mocks.readInventoryProductThumbnail.mockResolvedValue({
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    contentType: "image/jpeg",
  });
});

describe("inventory product thumbnail route", () => {
  it("streams a private same-origin image without exposing storage metadata", async () => {
    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect(mocks.readInventoryProductThumbnail).toHaveBeenCalledWith(
      attachmentId,
      expect.objectContaining({ storeId: "store-1" }),
    );
    expect(JSON.stringify([...response.headers])).not.toContain("repairdesk-inventory-attachments");
    expect(JSON.stringify([...response.headers])).not.toContain("/object/sign/");
  });

  it("rejects cross-site embedding before authentication", async () => {
    const response = await GET(request("cross-site"), context());

    expect(response.status).toBe(403);
    expect(mocks.getRequestActor).not.toHaveBeenCalled();
    expect(mocks.readInventoryProductThumbnail).not.toHaveBeenCalled();
  });

  it("returns an empty no-store response when authentication expires", async () => {
    mocks.getRequestActor.mockRejectedValue(new UnauthorizedError());

    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.text()).toBe("");
  });

  it("maps safe repository failures without returning their message", async () => {
    mocks.readInventoryProductThumbnail.mockRejectedValue(
      Object.assign(new Error("private storage detail"), { status: 404 }),
    );

    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });
});

function request(fetchSite = "same-origin") {
  return new NextRequest(
    `https://www.chinatech.in/api/repairdesk/inventory/product-thumbnails/${attachmentId}`,
    { headers: { "sec-fetch-site": fetchSite, "sec-fetch-dest": "image" } },
  );
}

function context() {
  return { params: Promise.resolve({ attachmentId }) };
}
