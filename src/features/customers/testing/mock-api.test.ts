import { describe, expect, it } from "vitest";

import {
  listCustomers,
  listCustomersPage,
  searchCustomerIntakeCandidates,
  searchCustomers,
} from "./mock-api";

describe("customer mock api pagination", () => {
  it("returns a bounded customer page with paging metadata", async () => {
    const all = await listCustomers();
    const page = await listCustomersPage({ page: 1, pageSize: 10 });

    expect(page.items).toHaveLength(10);
    expect(page.total).toBe(all.customers.length);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(10);
    expect(page.pageCount).toBe(Math.max(1, Math.ceil(all.customers.length / 10)));
    expect(page.tags).toEqual(all.tags);
    expect(page.stats).toEqual(all.stats);
  });

  it("paginates after search and filter are applied", async () => {
    const search = await listCustomersPage({ search: "张伟", pageSize: 10 });
    expect(search.total).toBeGreaterThan(0);
    expect(search.items.every((customer) => customer.name.includes("张伟"))).toBe(true);

    const tagged = await listCustomersPage({ tagIds: ["tag_vip"], pageSize: 10 });
    expect(tagged.total).toBeGreaterThan(0);
    expect(
      tagged.items.every((customer) => customer.tags.some((tag) => tag.id === "tag_vip")),
    ).toBe(true);
  });
});

describe("customer mock api search", () => {
  it("blocks overly broad one-character lookup", async () => {
    await expect(searchCustomers("3")).resolves.toEqual([]);
  });

  it("finds customers by name, primary phone and backup phone with a bounded limit", async () => {
    const byName = await searchCustomers("张伟", 3);
    expect(byName.length).toBeGreaterThan(0);
    expect(byName.length).toBeLessThanOrEqual(3);
    expect(byName[0]?.name).toContain("张伟");

    const all = await listCustomers();
    const withBackupPhone = all.customers.find((customer) => customer.contact_phones.length > 0);
    expect(withBackupPhone).toBeDefined();
    const backup = withBackupPhone!.contact_phones[0]!;
    const byBackup = await searchCustomers(backup, 8);
    expect(byBackup.some((customer) => customer.id === withBackupPhone!.id)).toBe(true);

    const byPrimary = await searchCustomers(withBackupPhone!.phone_raw.slice(0, 5), 8);
    expect(byPrimary.some((customer) => customer.id === withBackupPhone!.id)).toBe(true);
  });

  it("returns intake candidates with exact match and deduped history devices", async () => {
    const all = await listCustomers();
    const customer = all.customers.find((item) => item.device_count > 0);
    expect(customer).toBeDefined();

    const candidates = await searchCustomerIntakeCandidates(customer!.phone_raw, 4, 2);
    const match = candidates.find((candidate) => candidate.customer.id === customer!.id);
    expect(match).toBeDefined();
    expect(match!.exactMatch).toBe(true);
    expect(match!.historyDevices.length).toBeGreaterThan(0);
    expect(match!.historyDevices.length).toBeLessThanOrEqual(2);
    expect(match!.historyDevices.some((device) => device.source === "customer_device")).toBe(true);

    const keys = match!.historyDevices.map((device) =>
      [device.brand, device.model, device.serial_or_imei].join("|").toLowerCase(),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
