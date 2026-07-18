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

  it("blocks output instead of borrowing another tenant identity", () => {
    const profile = buildStorePrintProfile({
      store_name: "   ",
      store_address: "",
      store_phone: "",
      store_whatsapp: "",
      store_email: "",
      print_footer: "",
    });

    expect(profile.canOutput).toBe(false);
    expect(profile.storeName).toBe("");
    expect(profile.storeSummaryLine).toBe("");
    expect(profile.printFooter).toBe("");
    expect(JSON.stringify(profile)).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
  });

  it("blocks printing when the explicit print footer is missing", () => {
    const profile = buildStorePrintProfile({
      store_name: "Centro Tech Floridia",
      store_address: "Via Roma 12, Siracusa",
      store_phone: "+39 0931 000000",
      message_signature: "Centro Tech Floridia",
      print_footer: "",
    });

    expect(profile.canOutput).toBe(false);
    expect(profile.blockReason).toContain("打印页脚");
  });
});
