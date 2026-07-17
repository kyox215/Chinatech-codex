import { describe, expect, it } from "vitest";

import {
  appleDeviceModelSuggestions,
  customerLabelForNewOrder,
  customerNameForNewOrder,
  customerNameValueForCreateOrder,
  deviceModelSuggestionsForBrand,
  initialNewOrderForm,
  isAppleDeviceModelSuggestion,
} from "./new-order-form";

describe("new order customer name helpers", () => {
  it("requires the operator to confirm who holds the device", () => {
    expect(initialNewOrderForm.deviceCustodyStatus).toBeNull();
    expect(initialNewOrderForm.issueCaptureMode).toBe("reported");
  });

  it("treats generated phone-only customer names as blank", () => {
    const customer = {
      name: "客户 3335719865",
      phone_e164: "+39 333 571 9865",
      phone_raw: "3335719865",
    };

    expect(customerNameForNewOrder(customer)).toBe("");
    expect(customerLabelForNewOrder(customer)).toBe("+39 333 571 9865");
  });

  it("keeps real customer names and mismatched customer labels", () => {
    expect(
      customerNameForNewOrder({
        name: "Mario Rossi",
        phone_e164: "+39 333 571 9865",
        phone_raw: "3335719865",
      }),
    ).toBe("Mario Rossi");

    expect(
      customerNameForNewOrder({
        name: "客户 1234",
        phone_e164: "+39 333 571 9865",
        phone_raw: "3335719865",
      }),
    ).toBe("客户 1234");
  });

  it("omits generated names from create-order payloads", () => {
    expect(
      customerNameValueForCreateOrder({
        ...initialNewOrderForm,
        customerName: "客户 3335719865",
        customerPhone: "+39 333 571 9865",
      }),
    ).toBeUndefined();

    expect(
      customerNameValueForCreateOrder({
        ...initialNewOrderForm,
        customerName: "张伟",
        customerPhone: "+39 333 571 9865",
      }),
    ).toBe("张伟");
  });
});

describe("new order device model suggestions", () => {
  it("offers current and legacy iPhone models for Apple devices", () => {
    const suggestions = deviceModelSuggestionsForBrand("Apple");

    expect(suggestions).toBe(appleDeviceModelSuggestions);
    expect(suggestions).toContain("iPhone 17e");
    expect(suggestions).toContain("iPhone Air");
    expect(suggestions).toContain("iPhone 17 Pro Max");
    expect(suggestions).toContain("iPhone 8");
    expect(suggestions).toContain("iPhone (1st generation)");
  });

  it("also shows Apple model options before a brand is selected", () => {
    expect(deviceModelSuggestionsForBrand("")).toContain("iPhone 15");
    expect(deviceModelSuggestionsForBrand("苹果")).toContain("iPhone 15");
  });

  it("does not show Apple model options for other brands", () => {
    expect(deviceModelSuggestionsForBrand("Samsung")).toEqual([]);
  });

  it("recognizes selected iPhone suggestions case-insensitively", () => {
    expect(isAppleDeviceModelSuggestion("iphone 17 pro max")).toBe(true);
    expect(isAppleDeviceModelSuggestion("Galaxy S24")).toBe(false);
  });
});
