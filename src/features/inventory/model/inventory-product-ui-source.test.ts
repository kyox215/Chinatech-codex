import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = [
  "inventory-product-list-screen.tsx",
  "inventory-product-intake-screen.tsx",
  "inventory-product-detail-screen.tsx",
]
  .map((file) =>
    readFileSync(resolve(process.cwd(), "src/features/inventory/products/screens", file), "utf8"),
  )
  .join("\n");
const routerSource = readFileSync(
  resolve(process.cwd(), "src/server/api/repairdesk-router.ts"),
  "utf8",
);

describe("inventory product UI guardrails", () => {
  it("does not add connected rails, fake progress or horizontal controls", () => {
    expect(source).not.toContain("RepairOsHeaderStepper");
    expect(source).not.toContain("overflow-x-auto");
    expect(source).not.toContain("snap-x");
    expect(source).not.toContain("minWidth");
    expect(source).not.toContain("<Progress");
  });

  it("does not render buyback workspace language", () => {
    for (const forbidden of ["回收报价", "客户确认", "风险扣减", "回收付款", "证件"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps the five fixed product categories", () => {
    for (const category of ["phone", "tablet", "computer", "game_console", "other"]) {
      expect(source).toContain(category);
    }
  });

  it("keeps product and buyback realtime invalidation paths separate", () => {
    expect(routerSource).toMatch(
      /case "inventory\/products\/quick-create":[\s\S]*realtimeBroadcasts\.inventoryProductCreated/,
    );
    expect(routerSource).toMatch(
      /case "buyback\/update":[\s\S]*realtimeBroadcasts\.buybackUpdated/,
    );
    expect(routerSource).toMatch(
      /case "buyback\/attachment\/upload":[\s\S]*realtimeBroadcasts\.buybackUpdated/,
    );
  });
});
