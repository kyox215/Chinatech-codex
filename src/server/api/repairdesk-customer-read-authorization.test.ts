import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  listCustomers: vi.fn(async () => []),
  listCustomersPage: vi.fn(async () => ({ items: [], total: 0 })),
  getCustomerDetail: vi.fn(async () => ({ id: "customer_1" })),
  searchCustomers: vi.fn(async () => []),
  searchCustomerIntakeCandidates: vi.fn(async () => []),
  getCustomerDevices: vi.fn(async () => []),
}));

vi.mock("@/server/auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth-context")>()),
  getRequestActor: mocks.getRequestActor,
}));

vi.mock("@/server/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/supabase")>()),
  hasSupabaseConfig: () => true,
}));

vi.mock("@/shared/lib/e2e-auth-bypass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/e2e-auth-bypass")>()),
  isRepairDeskE2eAuthBypassEnabled: () => false,
}));

vi.mock("@/features/customers/server/customer.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/customers/server/customer.service")>()),
  listCustomers: mocks.listCustomers,
  listCustomersPage: mocks.listCustomersPage,
  getCustomerDetail: mocks.getCustomerDetail,
  searchCustomers: mocks.searchCustomers,
  searchCustomerIntakeCandidates: mocks.searchCustomerIntakeCandidates,
  getCustomerDevices: mocks.getCustomerDevices,
}));

import { handleRepairDeskPost } from "./repairdesk-router";

const cases = [
  ["customers/list", {}, mocks.listCustomers],
  ["customers/list-page", {}, mocks.listCustomersPage],
  ["customer/get", { id: "customer_1" }, mocks.getCustomerDetail],
  ["customers/search", {}, mocks.searchCustomers],
  ["customers/intake-search", {}, mocks.searchCustomerIntakeCandidates],
  ["customers/devices", { customerId: "customer_1" }, mocks.getCustomerDevices],
] as const;

describe("customer read route authorization wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 before any customer reader runs for scoped roles without object scope", async () => {
    for (const role of ["technician", "viewer"] as const) {
      mocks.getRequestActor.mockResolvedValue(actor(role));

      for (const [path, body, reader] of cases) {
        const before = reader.mock.calls.length;
        const response = await handleRepairDeskPost(path, body);
        expect(response.status, `${role} ${path}`).toBe(403);
        expect(response.headers.get("cache-control"), `${role} ${path}`).toBe(
          "private, no-store, max-age=0",
        );
        expect(reader.mock.calls.length, `${role} ${path}`).toBe(before);
      }
    }
  });

  it("preserves successful dispatch for owner, manager, and sales", async () => {
    for (const role of ["owner", "manager", "sales"] as const) {
      mocks.getRequestActor.mockResolvedValue(actor(role));

      for (const [path, body, reader] of cases) {
        const before = reader.mock.calls.length;
        const response = await handleRepairDeskPost(path, body);
        expect(response.status, `${role} ${path}`).toBe(200);
        expect(response.headers.get("cache-control"), `${role} ${path}`).toBe(
          "private, no-store, max-age=0",
        );
        expect(reader.mock.calls.length, `${role} ${path}`).toBe(before + 1);
        await expect(response.json()).resolves.toHaveProperty("data");
      }
    }
  });
});

function actor(role: StoreRole): AuditActor {
  return {
    id: `staff_${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store_1",
  };
}
