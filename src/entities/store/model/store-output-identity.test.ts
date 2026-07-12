import { describe, expect, it } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";

const forbidden = ["ChinaTech", "Chinatech", "Viale Vittorio Veneto", "Floridia"];

describe("resolveStoreOutputIdentity", () => {
  it("resolves only the current independent store identity", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        message_signature: "Ripara Subito · Assistenza",
        print_footer: "Grazie per aver scelto Ripara Subito.",
      },
    });

    expect(identity).toMatchObject({
      canOutput: true,
      storeName: "Ripara Subito",
      storeAddress: "Via Roma 12, Siracusa",
      contactLine: "Tel: +39 0931 000000",
      messageSignature: "Ripara Subito · Assistenza",
      printFooter: "Grazie per aver scelto Ripara Subito.",
    });
    for (const value of forbidden) expect(JSON.stringify(identity)).not.toContain(value);
  });

  it("blocks output until customer-facing store identity fields are complete", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: { store_id: "store-a", store_name: "Ripara Subito" },
    });

    expect(identity.canOutput).toBe(false);
    expect(identity.storeAddress).toBe("");
    expect(identity.blockReason).toContain("门店地址");
  });

  it("quarantines the legacy ChinaTech identity fingerprint for non-default stores", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-partner", name: "Ripara Subito" },
      settings: {
        store_id: "store-partner",
        store_name: "ChinaTech",
        store_address: "Viale Vittorio Veneto, 7, Floridia (SR)",
        store_phone: "+39 0931 000000",
        message_signature: "ChinaTech - Viale Vittorio Veneto, 7, Floridia (SR)",
        print_footer: "Grazie per aver scelto ChinaTech.",
      },
    });

    expect(identity.canOutput).toBe(false);
    expect(identity.blockReason).toContain("旧店铺身份资料");
    expect(JSON.stringify(identity)).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
  });

  it("allows the configured legacy identity only for the actual default store", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "ChinaTech",
      },
      settings: {
        store_id: "00000000-0000-0000-0000-000000000001",
        store_name: "ChinaTech",
        store_address: "Viale Vittorio Veneto, 7, Floridia (SR)",
        store_phone: "+39 0931 000000",
        message_signature: "ChinaTech - Floridia",
        print_footer: "Grazie per aver scelto ChinaTech.",
      },
    });

    expect(identity.canOutput).toBe(true);
  });

  it("blocks missing, loading, failed, and cross-store identities", () => {
    expect(resolveStoreOutputIdentity({}).canOutput).toBe(false);
    expect(resolveStoreOutputIdentity({ settingsState: "loading" }).canOutput).toBe(false);
    expect(resolveStoreOutputIdentity({ settingsState: "error" }).canOutput).toBe(false);

    const mismatched = resolveStoreOutputIdentity({
      activeStore: { id: "store-b", name: "Etna Phone Lab" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
      },
    });
    expect(mismatched.canOutput).toBe(false);
    expect(JSON.stringify(mismatched)).not.toContain("Ripara Subito");
    expect(JSON.stringify(mismatched)).not.toContain("Via Roma 12");
  });
});
