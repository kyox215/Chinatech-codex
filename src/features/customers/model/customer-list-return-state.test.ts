import { afterEach, describe, expect, it } from "vitest";
import {
  clearCustomerListReturnState,
  readCustomerListReturnState,
  saveCustomerListReturnState,
} from "./customer-list-return-state";

const scope = { storeId: "store-a", userId: "user-a", authorityFingerprint: "authority-a" };
const state = {
  ...scope,
  customerId: "customer-a",
  href: "/customers?q=SYNTHETIC&group=active&page=2",
  scrollY: 320,
};
afterEach(clearCustomerListReturnState);

describe("same-tab customer list return checkpoint", () => {
  it("preserves view context only until the list consumes and clears it", () => {
    saveCustomerListReturnState(state, 1000);
    expect(readCustomerListReturnState(scope, "customer-a", 1001)).toMatchObject(state);
    clearCustomerListReturnState();
    expect(readCustomerListReturnState(scope, "customer-a", 1002)).toBeNull();
  });
  it.each([
    { ...scope, storeId: "store-b" },
    { ...scope, userId: "user-b" },
    { ...scope, userId: "" },
    { ...scope, authorityFingerprint: "authority-b" },
  ])("discards stale identity/authority scope %j", (nextScope) => {
    saveCustomerListReturnState(state, 1000);
    expect(readCustomerListReturnState(nextScope, "customer-a", 1001)).toBeNull();
    expect(readCustomerListReturnState(scope, "customer-a", 1002)).toBeNull();
  });
  it("does not expose another entity's return context", () => {
    saveCustomerListReturnState(state, 1000);
    expect(readCustomerListReturnState(scope, "customer-b", 1001)).toBeNull();
  });
  it.each([999, 601001])("expires invalid or older than ten minute checkpoints at %i", (now) => {
    saveCustomerListReturnState(state, 1000);
    expect(readCustomerListReturnState(scope, "customer-a", now)).toBeNull();
  });
  it.each(["https://example.com", "//example.com", "/customers/customer-a", "/orders"])(
    "rejects non-list destination %s",
    (href) => {
      saveCustomerListReturnState({ ...state, href }, 1000);
      expect(readCustomerListReturnState(scope, undefined, 1001)).toBeNull();
    },
  );
});
