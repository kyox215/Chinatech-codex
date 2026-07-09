import { describe, expect, it } from "vitest";

import { buildStorePrintProfile } from "./store-print-profile";

describe("buildStorePrintProfile", () => {
  it("builds a printable profile from active store settings", () => {
    const profile = buildStorePrintProfile({
      store_name: "Ripara Subito",
      store_address: "Via Roma 12, Siracusa",
      store_phone: "+39 0931 000000",
      store_whatsapp: "+39 333 1111111",
      store_email: "info@ripara.test",
      print_footer: "Grazie per la fiducia.",
    });

    expect(profile).toMatchObject({
      storeName: "Ripara Subito",
      storeAddress: "Via Roma 12, Siracusa",
      storeContactLine: "Tel: +39 0931 000000 · WhatsApp: +39 333 1111111 · info@ripara.test",
      storeSummaryLine:
        "Via Roma 12, Siracusa · Tel: +39 0931 000000 · WhatsApp: +39 333 1111111 · info@ripara.test",
      printFooter: "Grazie per la fiducia.",
    });
  });

  it("falls back safely when settings are missing or blank", () => {
    const profile = buildStorePrintProfile({
      store_name: "   ",
      store_address: "",
      store_phone: "",
      store_whatsapp: "",
      store_email: "",
      print_footer: "",
    });

    expect(profile.storeName).toBe("ChinaTech");
    expect(profile.storeSummaryLine).toBe("Viale Vittorio Veneto, 7, Floridia (SR)");
    expect(profile.printFooter).toBe("Grazie per aver scelto ChinaTech.");
  });

  it("uses the custom store name in the generated fallback footer", () => {
    const profile = buildStorePrintProfile({
      store_name: "Centro Tech Floridia",
      print_footer: "",
    });

    expect(profile.printFooter).toBe("Grazie per aver scelto Centro Tech Floridia.");
  });
});
