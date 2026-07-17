import { describe, expect, it } from "vitest";

import {
  findRepairServiceCatalogItemByName,
  getRepairServiceCatalogItem,
  repairServiceCatalogGroups,
  repairServiceCatalogItems,
  resolveRepairServiceCatalogItem,
} from "./repair-service-catalog";

describe("repair service catalog", () => {
  it("keeps every catalog key and display name unique", () => {
    expect(new Set(repairServiceCatalogItems.map((item) => item.catalogKey)).size).toBe(
      repairServiceCatalogItems.length,
    );
    expect(new Set(repairServiceCatalogItems.map((item) => item.name)).size).toBe(
      repairServiceCatalogItems.length,
    );
  });

  it("provides one main item plus every detail option for each group", () => {
    for (const group of repairServiceCatalogGroups) {
      const items = repairServiceCatalogItems.filter((item) => item.groupKey === group.key);
      expect(items).toHaveLength(group.options.length + 1);
      expect(items[0]).toMatchObject({
        catalogKey: `${group.key}:main`,
        name: group.label,
        isMain: true,
      });
    }
  });

  it("rejects a spoofed catalog key/name pair and falls back to the real name", () => {
    expect(getRepairServiceCatalogItem("display:main")?.name).toBe("屏幕");
    expect(findRepairServiceCatalogItemByName("电池 - 健康度低")?.catalogKey).toBe(
      "battery:health",
    );
    expect(
      resolveRepairServiceCatalogItem({ catalogKey: "display:main", name: "电池 - 健康度低" })
        ?.catalogKey,
    ).toBe("battery:health");
  });
});
