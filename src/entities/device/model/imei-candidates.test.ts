import { describe, expect, it } from "vitest";

import { extractValidImeiCandidates } from "./imei-candidates";

describe("extractValidImeiCandidates", () => {
  it("returns only checksum-valid 15 digit IMEIs", () => {
    const candidates = extractValidImeiCandidates(
      [
        "IMEI1: 490154203237518",
        "IMEI2: 356938035643809",
        "SN: C39ZQ123N70M",
        "EID: 89043051202500726225007991441943",
        "IMEI: 123456789012345",
      ].join("\n"),
      { source: "ocr" },
    );

    expect(candidates.map(({ kind, value }) => ({ kind, value }))).toEqual([
      { kind: "imei", value: "490154203237518" },
      { kind: "imei", value: "356938035643809" },
    ]);
  });

  it.each([
    "SN: C39ZQ123N70M",
    "SN: 490154203237518",
    "MEID: 490154203237518",
    "EID: 89043051202500726225007991441943",
    "4006381333931",
  ])("rejects non-IMEI automatic candidate %s", (value) => {
    expect(extractValidImeiCandidates(value, { source: "barcode" })).toEqual([]);
  });
});
