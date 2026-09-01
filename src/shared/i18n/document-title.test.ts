import { describe, expect, it } from "vitest";

import { localizeKnownDocumentTitle } from "@/shared/i18n/document-title";

describe("localized document titles", () => {
  it("updates known root and static route titles", () => {
    expect(localizeKnownDocumentTitle("RepairDesk — 维修工单后台", "en")).toBe(
      "RepairDesk — Repair management",
    );
    expect(localizeKnownDocumentTitle("登录 — RepairDesk", "it-IT")).toBe("Accedi — RepairDesk");
    expect(localizeKnownDocumentTitle("确认安全邀请 — RepairDesk", "en")).toBe(
      "Confirm secure invitation — RepairDesk",
    );
    expect(localizeKnownDocumentTitle("完成员工邀请 — RepairDesk", "it-IT")).toBe(
      "Completa l’invito del dipendente — RepairDesk",
    );
  });

  it("preserves unknown and dynamic titles", () => {
    expect(localizeKnownDocumentTitle("Ordine RD-2026-001 — RepairDesk", "en")).toBe(
      "Ordine RD-2026-001 — RepairDesk",
    );
    expect(localizeKnownDocumentTitle("Stato riparazione — RepairDesk", "zh-CN")).toBe(
      "Stato riparazione — RepairDesk",
    );
  });
});
