import { describe, expect, it } from "vitest";

import {
  normalizePhoneBook,
  normalizePhoneRaw,
  primaryPhoneRaw,
  samePhoneRaw,
  uniqueContactPhones,
} from "./phone";

describe("phone helpers", () => {
  it("keeps only digits for phone identity checks", () => {
    expect(normalizePhoneRaw("+39 333-015 223")).toBe("39333015223");
  });

  it("compares normalized phone numbers", () => {
    expect(samePhoneRaw("+39 333-015 223", "39 333 015 223")).toBe(true);
    expect(samePhoneRaw("+39 333-015 223", "+39 333 015 224")).toBe(false);
  });

  it("uses the first separated phone as the primary identity", () => {
    expect(primaryPhoneRaw("+39 333 015 223 / +39 344 122 7014")).toBe("39333015223");
  });

  it("splits backup phones and removes duplicates", () => {
    expect(
      normalizePhoneBook("+39 333 015 223 / +39 344 122 7014", [
        "+39 333 015 223",
        "+39 345 000 7788",
      ]),
    ).toEqual({
      primary: "+39 333 015 223",
      primaryRaw: "39333015223",
      contacts: ["+39 344 122 7014", "+39 345 000 7788"],
    });
  });

  it("filters primary numbers out of backup phone lists", () => {
    expect(
      uniqueContactPhones("+39 320 100 2005", [
        "3201002005",
        "+39 329 900 0005",
        "+39 329 900 0005 / +39 320 100 2005",
      ]),
    ).toEqual(["+39 329 900 0005"]);
  });
});
