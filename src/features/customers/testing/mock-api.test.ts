import { describe, expect, it } from "vitest";

import { listCustomers, listCustomersPage } from "./mock-api";

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
