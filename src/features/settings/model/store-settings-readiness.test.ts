import { describe, expect, it } from "vitest";

import {
  buildStoreMessagePreview,
  buildStorePrintPreview,
  getStoreSettingsReadiness,
  type StoreSettingsReadinessInput,
} from "./store-settings-readiness";

const completeSettings: StoreSettingsReadinessInput = {
  store_name: "ChinaTech",
  store_address: "Viale Vittorio Veneto 7",
  store_phone: "+39 0931",
  store_whatsapp: "+39 333",
  store_email: "info@example.test",
  default_inventory_warranty_months: 12,
  print_footer: "Grazie per aver scelto ChinaTech.",
  message_signature: "ChinaTech - Floridia",
};

describe("store settings readiness", () => {
  it("marks a complete store profile as ready", () => {
    expect(getStoreSettingsReadiness(completeSettings)).toMatchObject({
      completedCount: 6,
      totalCount: 6,
      score: 100,
      tone: "ready",
      missingLabels: [],
    });
  });

  it("accepts either WhatsApp or phone as the customer contact", () => {
    const readiness = getStoreSettingsReadiness({
      ...completeSettings,
      store_whatsapp: "",
    });

    expect(readiness.items.find((item) => item.key === "contact")?.completed).toBe(true);
  });

  it("reports missing fields that affect customer messages and print output", () => {
    const readiness = getStoreSettingsReadiness({
      ...completeSettings,
      store_address: "",
      store_phone: "",
      store_whatsapp: "",
      message_signature: "",
    });

    expect(readiness.tone).toBe("danger");
    expect(readiness.missingLabels).toEqual(["客户联系方式", "门店地址", "消息签名"]);
  });

  it("builds message and print previews with explicit missing placeholders", () => {
    const settings = {
      ...completeSettings,
      store_whatsapp: "",
      store_phone: "",
      print_footer: "",
    };

    expect(buildStoreMessagePreview(settings)).toContain("Contatto: 未填写 WhatsApp / 电话");
    expect(buildStorePrintPreview(settings)).toContain("未填写打印页脚");
  });
});
