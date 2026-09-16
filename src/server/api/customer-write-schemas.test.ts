import { describe, expect, it } from "vitest";
import { rolePermissions } from "@/server/permissions";
import {
  customerCreateBodySchema,
  customerUpdateBodySchema,
  customerDeviceUpsertBodySchema,
  customerDeviceDeleteBodySchema,
  customerTagsUpdateBodySchema,
} from "./repairdesk-schemas";
const version = "2026-09-15T23:00:00.000001Z";
describe("customer write version schemas", () => {
  it("keeps create inputs independent of update versions", () => {
    expect(
      customerCreateBodySchema.safeParse({ input: { name: "A", phone_e164: "+3900000001" } })
        .success,
    ).toBe(true);
    expect(
      customerDeviceUpsertBodySchema.safeParse({
        customerId: "a",
        input: { brand: "Test", model: "A" },
      }).success,
    ).toBe(true);
  });
  it.each([undefined, "", "bad"])(
    "rejects missing or invalid customer versions: %s",
    (expected_updated_at) => {
      expect(
        customerUpdateBodySchema.safeParse({
          id: "a",
          input: { name: "A", phone_e164: "+3900000001", expected_updated_at },
        }).success,
      ).toBe(false);
    },
  );
  it("requires a version whenever a device id is present, including deletion", () => {
    expect(
      customerDeviceUpsertBodySchema.safeParse({
        customerId: "a",
        input: { id: "d", brand: "Test", model: "A" },
      }).success,
    ).toBe(false);
    expect(
      customerDeviceUpsertBodySchema.safeParse({
        customerId: "a",
        input: { id: "d", brand: "Test", model: "A", expected_updated_at: version },
      }).success,
    ).toBe(true);
    expect(
      customerDeviceDeleteBodySchema.safeParse({ customerId: "a", deviceId: "d" }).success,
    ).toBe(false);
    expect(
      customerDeviceDeleteBodySchema.parse({
        customerId: "a",
        deviceId: "d",
        expected_updated_at: version,
      }).expected_updated_at,
    ).toBe(version);
  });
  it("retains microsecond precision and requires a customer version for tags", () => {
    const input = { customerId: "a", tagIds: [], expected_customer_updated_at: version };
    expect(customerTagsUpdateBodySchema.parse(input)).toEqual(input);
    expect(customerTagsUpdateBodySchema.safeParse({ customerId: "a", tagIds: [] }).success).toBe(
      false,
    );
    expect(
      customerTagsUpdateBodySchema.safeParse({ ...input, tagIds: Array(65).fill("a") }).success,
    ).toBe(false);
  });
});

describe("customer foreground revision permission inclusion", () => {
  it.each(["owner", "manager", "sales"] as const)(
    "%s may read both customer and order lists",
    (role) => {
      expect(rolePermissions[role]["customer:list"]).toBe("allow");
      expect(rolePermissions[role]["order:list"]).toBe("allow");
    },
  );
});
