import { describe, expect, it } from "vitest";

import type { Customer, CustomerIntakeCandidate } from "@/lib/repairdesk/types";

import {
  compareCustomerIntakeMatches,
  customerIntakePolicyBlocksSubmit,
  getCustomerIntakeNameMatchKind,
  getCustomerIntakeNewCustomerPolicy,
  getCustomerIntakePhoneMatchKind,
  normalizeCustomerIntakeSearch,
} from "./customer-intake-search";

describe("customer intake search policy", () => {
  it("normalizes structured input without collapsing it into legacy q", () => {
    expect(
      normalizeCustomerIntakeSearch({
        phone: " +39 333 571 9865 ",
        name: "  Alèssio  ",
        phoneMatchMode: "exact",
        limit: 99,
        deviceLimit: 0,
      }),
    ).toMatchObject({
      kind: "structured",
      phoneRaw: "393335719865",
      normalizedName: "alessio",
      phoneMatchMode: "exact",
      limit: 12,
      deviceLimit: 1,
    });
  });

  it("keeps same-phone candidates and excludes different phones before name ranking", () => {
    const customer = makeCustomer("same", "Marco", "3335719865", ["+39 320 111 2233"]);
    expect(getCustomerIntakePhoneMatchKind(customer, "3335719865", "progressive")).toBe(
      "exact_primary",
    );
    expect(getCustomerIntakePhoneMatchKind(customer, "393201112233", "exact")).toBe(
      "exact_alternate",
    );
    expect(getCustomerIntakePhoneMatchKind(customer, "9999999999", "progressive")).toBeNull();
    expect(getCustomerIntakeNameMatchKind(customer.name, "alessio")).toBe("none");
  });

  it("sorts phone relevance before name relevance", () => {
    const exactDifferent = makeCandidate("a", "Marco", "3335719865", "exact_primary", "none");
    const partialSameName = makeCandidate("b", "Alessio", "3335710000", "prefix_primary", "exact");
    expect(
      [partialSameName, exactDifferent].sort(compareCustomerIntakeMatches)[0]?.customer.id,
    ).toBe("a");
  });

  it("derives allowed, shared-phone confirmation and exact-duplicate policies", () => {
    const exactDifferent = makeCandidate("a", "Marco", "3335719865", "exact_primary", "none");
    const exactSame = makeCandidate("b", "Alessio", "3335719865", "exact_primary", "exact");

    expect(getCustomerIntakeNewCustomerPolicy([], "3335719865", "Alessio")).toBe("allowed");
    expect(getCustomerIntakeNewCustomerPolicy([exactDifferent], "3335719865", "Alessio")).toBe(
      "requires_shared_phone_confirmation",
    );
    expect(getCustomerIntakeNewCustomerPolicy([exactDifferent], "3335719865", "")).toBe(
      "blocked_missing_name",
    );
    expect(
      getCustomerIntakeNewCustomerPolicy([exactDifferent, exactSame], "3335719865", "Alessio"),
    ).toBe("blocked_exact_duplicate");
    expect(customerIntakePolicyBlocksSubmit("blocked_exact_duplicate")).toBe(true);
    expect(customerIntakePolicyBlocksSubmit("blocked_missing_name")).toBe(true);
    expect(customerIntakePolicyBlocksSubmit("requires_shared_phone_confirmation")).toBe(false);
  });
});

function makeCustomer(id: string, name: string, phoneRaw: string, contactPhones: string[] = []) {
  return {
    id,
    name,
    phone_e164: phoneRaw,
    phone_raw: phoneRaw,
    contact_phones: contactPhones,
    consent_marketing: false,
    consent_sms: true,
  } satisfies Customer;
}

function makeCandidate(
  id: string,
  name: string,
  phoneRaw: string,
  phoneMatchKind: CustomerIntakeCandidate["phoneMatchKind"],
  nameMatchKind: CustomerIntakeCandidate["nameMatchKind"],
) {
  return {
    customer: makeCustomer(id, name, phoneRaw),
    exactMatch: phoneMatchKind?.startsWith("exact") ?? false,
    phoneMatchKind,
    nameMatchKind,
    historyDevices: [],
  } satisfies CustomerIntakeCandidate;
}
