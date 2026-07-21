import { describe, expect, it } from "vitest";

import {
  getCustomerDetail,
  listCustomers,
  listCustomersPage,
  searchCustomerIntakeCandidates,
  searchCustomers,
} from "./mock-api";
import { createOrder, transitionOrder } from "@/features/orders/testing/mock-api";

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

  it("filters customer pages by repair business state", async () => {
    const active = await listCustomersPage({ work: "active", pageSize: 20 });
    expect(active.total).toBeGreaterThan(0);
    expect(active.items.every((customer) => customer.active_order_count > 0)).toBe(true);

    const unpaid = await listCustomersPage({ work: "unpaid", pageSize: 20 });
    expect(unpaid.total).toBeGreaterThan(0);
    expect(unpaid.items.every((customer) => (customer.unpaid_amount ?? 0) > 0)).toBe(true);

    const withDevices = await listCustomersPage({ work: "with_devices", pageSize: 20 });
    expect(withDevices.total).toBeGreaterThan(0);
    expect(withDevices.items.every((customer) => customer.device_count > 0)).toBe(true);

    const repeat = await listCustomersPage({ work: "repeat", pageSize: 20 });
    expect(repeat.total).toBeGreaterThan(0);
    expect(repeat.items.every((customer) => (customer.valid_order_count ?? 0) > 1)).toBe(true);
  });

  it("searches customer pages by device model snapshots", async () => {
    const all = await listCustomersPage({ pageSize: 20 });
    const customerWithDevice = all.items.find((customer) => customer.latest_device_label);
    expect(customerWithDevice).toBeDefined();

    const modelToken = customerWithDevice!.latest_device_label!.split(" ").at(-1)!;
    const search = await listCustomersPage({ search: modelToken, pageSize: 20 });
    expect(search.total).toBeGreaterThan(0);
    expect(search.items.some((customer) => customer.id === customerWithDevice!.id)).toBe(true);
  });

  it("keeps cancelled orders in customer history while excluding them from €70 totals", async () => {
    const phone = "+393339997070";
    const create = (suffix: string) =>
      createOrder({
        customer_name: "取消金额回归",
        customer_phone: phone,
        device_brand: "Samsung",
        device_model: `A31 ${suffix}`,
        device_imei: `CANCEL-70-${suffix}`,
        order_type: "quick_repair",
        status: "new",
        issue_description: `取消金额回归 ${suffix}`,
        fault_prices: [{ name: "测试服务", price: 70 }],
        deposit_amount: 0,
      });
    const first = await create("A");
    const second = await create("B");
    await transitionOrder(second.id, "cancelled", { reason: "取消第二张测试单" });

    const [customer] = await searchCustomers(phone, 1);
    const detail = await getCustomerDetail(customer!.id);

    expect(detail.orders.map((order) => order.id).sort()).toEqual([first.id, second.id].sort());
    expect(detail.stats).toMatchObject({
      order_count: 2,
      valid_order_count: 1,
      lifetime_quoted_amount: 70,
      outstanding_amount: 70,
      unpaid_amount: 70,
    });
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

    const candidates = await searchCustomerIntakeCandidates({
      q: customer!.phone_raw,
      limit: 4,
      deviceLimit: 2,
    });
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

  it("uses phone as a hard filter while name only ranks same-phone customers", async () => {
    const all = await listCustomers();
    const phoneCustomer = all.customers[0]!;
    const differentPhoneSameName = all.customers.find(
      (customer) =>
        customer.id !== phoneCustomer.id && customer.phone_raw !== phoneCustomer.phone_raw,
    )!;

    const candidates = await searchCustomerIntakeCandidates({
      phone: phoneCustomer.phone_raw,
      name: differentPhoneSameName.name,
      phoneMatchMode: "exact",
      limit: 8,
      deviceLimit: 2,
    });

    expect(candidates.some((candidate) => candidate.customer.id === phoneCustomer.id)).toBe(true);
    expect(
      candidates.every(
        (candidate) =>
          candidate.customer.phone_raw === phoneCustomer.phone_raw ||
          candidate.customer.contact_phones.some(
            (phone) => phone.replace(/\D/g, "") === phoneCustomer.phone_raw,
          ),
      ),
    ).toBe(true);
    expect(
      candidates.some((candidate) => candidate.customer.id === differentPhoneSameName.id),
    ).toBe(false);
  });
});
