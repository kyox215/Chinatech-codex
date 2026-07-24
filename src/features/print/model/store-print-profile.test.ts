import { describe, expect, it } from "vitest";

import { buildStorePrintProfile } from "./store-print-profile";

describe("buildStorePrintProfile", () => {
  it("builds a printable profile from active store settings", () => {
    const profile = buildStorePrintProfile(
      {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        store_whatsapp: "+39 333 1111111",
        store_email: "info@ripara.test",
        print_footer: "Grazie per la fiducia.",
        message_signature: "Ripara Subito · Assistenza",
      },
      { id: "store-a", name: "Ripara Subito" },
    );

    expect(profile).toMatchObject({
      storeName: "Ripara Subito",
      storeAddress: "Via Roma 12, Siracusa",
      storeContactLine: "Tel: +39 0931 000000 · WhatsApp: +39 333 1111111 · info@ripara.test",
      storeSummaryLine:
        "Via Roma 12, Siracusa · Tel: +39 0931 000000 · WhatsApp: +39 333 1111111 · info@ripara.test",
      printFooter: "Grazie per la fiducia.",
      canOutput: true,
    });
  });

  it("uses a neutral printable fallback instead of borrowing another tenant identity", () => {
    const profile = buildStorePrintProfile({
      store_name: "   ",
      store_address: "",
      store_phone: "",
      store_whatsapp: "",
      store_email: "",
      print_footer: "",
    });

    expect(profile.canOutput).toBe(true);
    expect(profile.storeName).toBe("RepairDesk");
    expect(profile.storeSummaryLine).toBe("");
    expect(profile.printFooter).toBe("Documento generato da RepairDesk.");
    expect(JSON.stringify(profile)).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
  });

  it("keeps printing available when the explicit print footer is missing", () => {
    const profile = buildStorePrintProfile({
      store_name: "Centro Tech Floridia",
      store_address: "Via Roma 12, Siracusa",
      store_phone: "+39 0931 000000",
      message_signature: "Centro Tech Floridia",
      print_footer: "",
    });

    expect(profile.canOutput).toBe(true);
    expect(profile.printFooter).toBe("Documento generato da RepairDesk.");
  });

  it("omits mismatched tenant settings while keeping the document printable", () => {
    const profile = buildStorePrintProfile(
      {
        store_id: "store-b",
        store_name: "Other Tenant",
        store_address: "Private address",
        store_phone: "+39 000",
      },
      { id: "store-a", name: "Current Store" },
    );

    expect(profile).toMatchObject({
      canOutput: true,
      storeName: "Current Store",
      storeAddress: "",
      storeContactLine: "",
    });
    expect(profile.warnings).toHaveLength(1);
    expect(JSON.stringify(profile)).not.toContain("Other Tenant");
    expect(JSON.stringify(profile)).not.toContain("Private address");
  });

  it("omits settings when the active store identity is unavailable", () => {
    const profile = buildStorePrintProfile({
      store_id: "store-b",
      store_name: "Unverified Store",
      store_address: "Private address",
    });

    expect(profile).toMatchObject({
      canOutput: true,
      storeName: "RepairDesk",
      storeAddress: "",
    });
    expect(profile.warnings).toHaveLength(1);
    expect(JSON.stringify(profile)).not.toContain("Unverified Store");
    expect(JSON.stringify(profile)).not.toContain("Private address");
  });
});
