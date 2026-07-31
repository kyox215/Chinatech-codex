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
      const repairOptionCount = "repairOptions" in group ? group.repairOptions.length : 0;
      expect(items).toHaveLength(group.options.length + repairOptionCount + 1);
      expect(items[0]).toMatchObject({
        catalogKey: `${group.key}:main`,
        name: group.label,
        isMain: true,
      });
    }
  });

  it("adds repair variants without removing the historical inspection catalog", () => {
    expect(getRepairServiceCatalogItem("display:incell")?.name).toBe("屏幕 - Incell");
    expect(getRepairServiceCatalogItem("battery:high-capacity")?.name).toBe("电池 - 扩容版");
    expect(getRepairServiceCatalogItem("charging:assembled")?.name).toBe("尾插 - 组装");
    expect(getRepairServiceCatalogItem("display:no-display")?.name).toBe("屏幕 - 黑屏无显示");
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
