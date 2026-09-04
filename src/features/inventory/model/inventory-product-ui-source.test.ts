import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceFiles = [
  "inventory-product-list-screen.tsx",
  "inventory-product-intake-screen.tsx",
  "inventory-product-edit-screen.tsx",
  "inventory-product-detail-screen.tsx",
  "../components/inventory-product-queue-components.tsx",
];
const screenSource = Object.fromEntries(
  sourceFiles.map((file) => [
    file,
    readFileSync(resolve(process.cwd(), "src/features/inventory/products/screens", file), "utf8"),
  ]),
);
const source = Object.values(screenSource).join("\n");
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

  it("keeps Intake and Edit on the shared page/body composition", () => {
    for (const file of [
      "inventory-product-intake-screen.tsx",
      "inventory-product-edit-screen.tsx",
    ]) {
      expect(screenSource[file]).toContain("InventoryProductPageFrame");
      expect(screenSource[file]).toContain("InventoryProductFormWorkspace");
    }
  });

  it("keeps the list canary's single accessible heading and mobile search target", () => {
    const listSource = screenSource["inventory-product-list-screen.tsx"];
    expect(listSource).toContain('<h1 className="sr-only">{t("inventory2b4.list.title")}</h1>');
    expect(listSource).toContain('placeholder={t("inventory2b4.list.search")}');
    expect(listSource).toContain('className="h-11 pl-9"');
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
