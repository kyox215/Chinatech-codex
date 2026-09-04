import { describe, expect, it } from "vitest";

import { translateMessage } from "@/shared/i18n/messages";
import type { InventoryProductFormValidationCode } from "./inventory-product-form";

import {
  formatInventoryProductDate,
  formatInventoryProductMoney,
  getInventoryQuickEntryErrorMessage,
  getInventorySafeErrorMessage,
  localizeInventoryAvailability,
  localizeInventoryColor,
  localizeInventoryDetailNextAction,
  localizeInventoryFreshness,
  localizeInventoryIdentifierKind,
  localizeInventoryIdentifierSource,
  localizeInventoryInspection,
  localizeInventoryProductCategory,
  localizeInventoryProductStatus,
  localizeInventoryValidation,
} from "./inventory-product-i18n";

const locales = ["zh-CN", "it-IT", "en"] as const;
const t =
  (locale: (typeof locales)[number]) =>
  (key: Parameters<typeof translateMessage>[1], values?: Parameters<typeof translateMessage>[2]) =>
    translateMessage(locale, key, values);

describe("inventory product i18n", () => {
  it.each(locales)("localizes every stable Quick Entry validation code in %s", (locale) => {
    const codes: InventoryProductFormValidationCode[] = [
      "brand_required",
      "model_required",
      "notes_too_long",
      "battery_invalid",
      "imei2_requires_imei1",
      "imei1_required",
      "gtin_invalid",
      "imei_invalid",
      "serial_invalid",
      "eid_invalid",
      "identifier_duplicate",
      "primary_identifier_required",
      "eid_primary_forbidden",
      "list_price_invalid",
      "cost_amount_invalid",
      "warranty_invalid",
      "color_required",
      "color_not_approved",
    ];

    for (const code of codes) {
      expect(localizeInventoryValidation(code, "RAW", t(locale))).not.toBe("RAW");
    }
  });

  it.each([
    ["zh-CN", "手机", "在库", "序列号", "扫描录入", "正常"],
    ["it-IT", "Telefono", "Disponibile", "Numero di serie", "Scansione", "Normale"],
    ["en", "Phone", "In stock", "Serial number", "Scanned", "Normal"],
  ] as const)(
    "localizes stable product facts in %s",
    (locale, category, status, kind, source, check) => {
      expect(localizeInventoryProductCategory("phone", "RAW", t(locale))).toBe(category);
      expect(localizeInventoryProductStatus("in_stock", "RAW", t(locale))).toBe(status);
      expect(localizeInventoryIdentifierKind("serial", "RAW", t(locale))).toBe(kind);
      expect(localizeInventoryIdentifierSource("scan", "RAW", t(locale))).toBe(source);
      expect(localizeInventoryInspection("normal", "RAW", t(locale))).toBe(check);
      expect(localizeInventoryValidation("invalid_imei", "RAW", t(locale))).not.toBe("RAW");
      expect(localizeInventoryAvailability("service-unavailable", t(locale))).not.toBe("");
      expect(localizeInventoryFreshness("privacy-redacted", t(locale))).not.toBe("");
    },
  );

  it.each(locales)("preserves unknown and custom values byte-for-byte in %s", (locale) => {
    const custom = "  自定义-CUSTOM-Δ  ";
    expect(localizeInventoryProductCategory("future-category", custom, t(locale))).toBe(custom);
    expect(localizeInventoryProductStatus("future-status", custom, t(locale))).toBe(custom);
    expect(localizeInventoryIdentifierKind("future-kind", custom, t(locale))).toBe(custom);
    expect(localizeInventoryIdentifierSource("future-source", custom, t(locale))).toBe(custom);
    expect(localizeInventoryInspection("future-check", custom, t(locale))).toBe(custom);
    expect(localizeInventoryValidation("future-validation", custom, t(locale))).toBe(custom);
  });

  it.each([
    ["zh-CN", "黑色"],
    ["it-IT", "Nero"],
    ["en", "Black"],
  ] as const)("separates a stable color label from its canonical value in %s", (locale, label) => {
    const input = { stableId: "black", value: "NERO-CANONICO-原值", label: "RAW" };
    expect(localizeInventoryColor(input, t(locale))).toEqual({ value: input.value, label });
    expect(input).toEqual({ stableId: "black", value: "NERO-CANONICO-原值", label: "RAW" });

    const custom = { stableId: "custom-neon", value: "  Neon-客户值  ", label: "  展示原值  " };
    expect(localizeInventoryColor(custom, t(locale))).toEqual({
      value: "  Neon-客户值  ",
      label: "  展示原值  ",
    });
  });

  it.each(locales)("localizes only stable next-action ids in %s", (locale) => {
    const known = {
      kind: "action" as const,
      id: "reserve-product" as const,
      label: "源文案可变化",
      href: "/inventory/item-动态/reserve",
      command: "reservation.create" as const,
    };
    expect(localizeInventoryDetailNextAction(known, t(locale))).not.toBe(known.label);
    expect(known.href).toBe("/inventory/item-动态/reserve");

    const custom = { ...known, id: "custom-action" as never, label: "  自定义动作  " };
    expect(localizeInventoryDetailNextAction(custom, t(locale))).toBe("  自定义动作  ");
  });

  it("formats the same instants in Europe/Rome using the active locale and handles invalid values", () => {
    const winter = "2026-01-15T12:00:00.000Z";
    const summer = "2026-07-15T12:00:00.000Z";
    expect(formatInventoryProductDate(winter, "en", t("en"))).toContain("1:00 PM");
    expect(formatInventoryProductDate(summer, "en", t("en"))).toContain("2:00 PM");
    expect(formatInventoryProductDate(winter, "it-IT", t("it-IT"))).not.toBe(
      formatInventoryProductDate(winter, "en", t("en")),
    );
    expect(formatInventoryProductDate("invalid", "en", t("en"))).toBe("Date unavailable");
    expect(formatInventoryProductDate(null, "it-IT", t("it-IT"))).toBe("Data non disponibile");
    expect(formatInventoryProductMoney(1234.5, "it-IT", t("it-IT"))).toContain("€");
    expect(formatInventoryProductMoney(Number.NaN, "en", t("en"))).toBe("Amount unavailable");
  });

  it.each(locales)("uses structured safe errors and excludes raw diagnostics in %s", (locale) => {
    const sentinel = "SECRET-SENTINEL-客户号";
    const message = getInventorySafeErrorMessage(
      { status: 403, code: "FORBIDDEN", message: sentinel, stack: sentinel },
      t(locale),
    );
    expect(message).not.toContain(sentinel);
    expect(message).toBe(translateMessage(locale, "inventory2b4.error.authorization"));
    expect(getInventorySafeErrorMessage({ status: 409, message: sentinel }, t(locale))).toBe(
      translateMessage(locale, "inventory2b4.error.conflict"),
    );
  });

  it.each(locales)(
    "maps Quick Entry failure categories without exposing diagnostics in %s",
    (locale) => {
      const sentinel = "SECRET-SENTINEL-客户号";
      const cases = [
        [{ name: "AbortError", message: sentinel }, "inventory2b4.error.connectivity"],
        [{ status: 503, message: sentinel }, "inventory2b4.error.server"],
        [{ status: 409, message: sentinel }, "inventory2b4.error.conflict"],
        [{ status: 403, code: "FORBIDDEN", message: sentinel }, "inventory2b4.error.authorization"],
        [
          { status: 422, code: "VALIDATION_FAILED", message: sentinel },
          "inventory2b4.error.validation",
        ],
      ] as const;

      for (const [error, key] of cases) {
        const message = getInventoryQuickEntryErrorMessage(error, "create", t(locale));
        expect(message).toBe(translateMessage(locale, key));
        expect(message).not.toContain(sentinel);
      }

      expect(getInventoryQuickEntryErrorMessage(new Error(sentinel), "create", t(locale))).toBe(
        translateMessage(locale, "inventory2b4.quick.screen.createFailed"),
      );
      expect(getInventoryQuickEntryErrorMessage(new Error(sentinel), "update", t(locale))).toBe(
        translateMessage(locale, "inventory2b4.quick.edit.updateFailed"),
      );
    },
  );
});
