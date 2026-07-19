import { describe, expect, it } from "vitest";

import {
  filterSettingsSectionGroups,
  getSettingsSection,
  parseSettingsView,
  SETTINGS_SECTION_GROUPS,
} from "@/features/settings/model/settings-section-registry";

describe("settings section registry", () => {
  it("keeps the approved four-group and ten-section order", () => {
    expect(SETTINGS_SECTION_GROUPS.map((group) => group.key)).toEqual([
      "personal-access",
      "store-operations",
      "business-rules",
      "output-data",
    ]);
    expect(
      SETTINGS_SECTION_GROUPS.flatMap((group) => group.sections.map((item) => item.key)),
    ).toEqual([
      "account",
      "members",
      "store",
      "suppliers",
      "kiosk",
      "rules",
      "workflow",
      "notifications",
      "ai-usage",
      "order-data",
    ]);
  });

  it("uses overview for missing, empty, and unknown section values", () => {
    expect(parseSettingsView(null)).toEqual({ kind: "overview" });
    expect(parseSettingsView("")).toEqual({ kind: "overview" });
    expect(parseSettingsView("unknown")).toEqual({ kind: "overview" });
    expect(parseSettingsView("store")).toEqual({ kind: "section", section: "store" });
  });

  it("returns stable hrefs and filters labels, descriptions, and keywords", () => {
    expect(getSettingsSection("notifications").href).toBe("/settings?section=notifications");
    expect(
      filterSettingsSectionGroups("签名").flatMap((group) =>
        group.sections.map((section) => section.key),
      ),
    ).toEqual(["kiosk", "notifications"]);
    expect(
      filterSettingsSectionGroups("Excel").flatMap((group) =>
        group.sections.map((section) => section.key),
      ),
    ).toEqual(["order-data"]);
    expect(
      filterSettingsSectionGroups("Token").flatMap((group) =>
        group.sections.map((section) => section.key),
      ),
    ).toEqual(["ai-usage"]);
  });
});
