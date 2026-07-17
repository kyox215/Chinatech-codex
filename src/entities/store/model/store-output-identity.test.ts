import { describe, expect, it } from "vitest";

import {
  buildStoreCustomerOutputUrl,
  resolveStoreOutputIdentity,
} from "@/entities/store/model/store-output-identity";

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
        public_base_url: "https://ripara.example.test/app/",
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
      publicBaseUrl: "https://ripara.example.test/app",
      missingFields: [],
    });
    expect(identity.blockCode).toBeUndefined();
    expect(identity.recoveryTarget).toBeUndefined();
    for (const value of forbidden) expect(JSON.stringify(identity)).not.toContain(value);
    expect(buildStoreCustomerOutputUrl(identity, "/orders/order-a")).toBe(
      "https://ripara.example.test/app/orders/order-a",
    );
  });

  it("rejects customer output paths that could escape the configured store URL", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        public_base_url: "https://ripara.example.test/app",
        message_signature: "Ripara Subito · Assistenza",
        print_footer: "Grazie per aver scelto Ripara Subito.",
      },
    });

    expect(buildStoreCustomerOutputUrl(identity, "https://evil.example/orders/order-a")).toBe("");
    expect(buildStoreCustomerOutputUrl(identity, "//evil.example/orders/order-a")).toBe("");
    expect(buildStoreCustomerOutputUrl(identity, "../admin")).toBe("");
    expect(buildStoreCustomerOutputUrl(identity, "%2e%2e/admin")).toBe("");
    expect(buildStoreCustomerOutputUrl(identity, "orders/%2E%2E/admin")).toBe("");
    expect(buildStoreCustomerOutputUrl(identity, "orders/order-a")).toBe(
      "https://ripara.example.test/app/orders/order-a",
    );
  });

  it("omits customer links when public base URL is missing or invalid", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        public_base_url: "http://unsafe.example.test",
        message_signature: "Ripara Subito · Assistenza",
        print_footer: "Grazie per aver scelto Ripara Subito.",
      },
    });

    expect(identity.canOutput).toBe(true);
    expect(identity.publicBaseUrl).toBe("");
    expect(identity.warnings).toContain("客户门户域名无效，客户消息将不会包含外部链接");
    expect(buildStoreCustomerOutputUrl(identity, "/orders/order-a")).toBe("");
  });

  it("blocks output until customer-facing store identity fields are complete", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: { store_id: "store-a", store_name: "Ripara Subito" },
    });

    expect(identity.canOutput).toBe(false);
    expect(identity.storeAddress).toBe("");
    expect(identity.blockReason).toContain("门店地址");
    expect(identity).toMatchObject({
      blockCode: "missing_required_fields",
      missingFields: ["store_address", "contact", "message_signature", "print_footer"],
      recoveryTarget: "store",
    });
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
    expect(identity).toMatchObject({
      blockCode: "legacy_identity",
      missingFields: [],
      recoveryTarget: "store",
    });
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

  it("publishes stable recovery metadata for missing, loading, and failed identities", () => {
    expect(resolveStoreOutputIdentity({})).toMatchObject({
      canOutput: false,
      blockCode: "missing_store_name",
      missingFields: ["store_name"],
      recoveryTarget: "store",
    });
    expect(resolveStoreOutputIdentity({ settingsState: "loading" })).toMatchObject({
      canOutput: false,
      blockCode: "settings_loading",
      missingFields: [],
      recoveryTarget: "wait",
    });
    expect(resolveStoreOutputIdentity({ settingsState: "error" })).toMatchObject({
      canOutput: false,
      blockCode: "settings_load_failed",
      missingFields: [],
      recoveryTarget: "retry_settings",
    });
  });

  it("blocks cross-store identities without offering a settings destination", () => {
    const mismatched = resolveStoreOutputIdentity({
      activeStore: { id: "store-b", name: "Etna Phone Lab" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
      },
    });
    expect(mismatched).toMatchObject({
      canOutput: false,
      blockCode: "store_context_mismatch",
      missingFields: [],
      recoveryTarget: "reload_store_context",
    });
    expect(JSON.stringify(mismatched)).not.toContain("Ripara Subito");
    expect(JSON.stringify(mismatched)).not.toContain("Via Roma 12");
  });

  it("fails closed when settings are not bound to the active store", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: {
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        message_signature: "Ripara Subito · Assistenza",
        print_footer: "Grazie per aver scelto Ripara Subito.",
      },
    });

    expect(identity).toMatchObject({
      canOutput: false,
      blockCode: "store_context_mismatch",
      missingFields: [],
      recoveryTarget: "reload_store_context",
    });
    expect(identity.storeName).toBe("");
    expect(JSON.stringify(identity)).not.toContain("Ripara Subito");
  });

  it("routes notification-only gaps to notification settings", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
      },
    });

    expect(identity).toMatchObject({
      blockCode: "missing_required_fields",
      missingFields: ["message_signature", "print_footer"],
      recoveryTarget: "notifications",
    });
  });

  it("routes a legacy notification-only fingerprint to notification settings", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-partner", name: "Ripara Subito" },
      settings: {
        store_id: "store-partner",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        message_signature: "ChinaTech - Floridia",
        print_footer: "Grazie per il tuo acquisto.",
      },
    });

    expect(identity).toMatchObject({
      blockCode: "legacy_identity",
      recoveryTarget: "notifications",
    });
    expect(JSON.stringify(identity)).not.toMatch(/ChinaTech|Floridia/i);
  });

  it("blocks legacy public customer URLs for non-default stores", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-partner", name: "Ripara Subito" },
      settings: {
        store_id: "store-partner",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
        public_base_url: "https://chinatech.in",
        message_signature: "Ripara Subito · Assistenza",
        print_footer: "Grazie per aver scelto Ripara Subito.",
      },
    });

    expect(identity).toMatchObject({
      canOutput: false,
      blockCode: "legacy_identity",
      recoveryTarget: "store",
    });
    expect(buildStoreCustomerOutputUrl(identity, "/orders/order-a")).toBe("");
    expect(JSON.stringify(identity)).not.toMatch(/chinatech\.in|ChinaTech/i);
  });
});
