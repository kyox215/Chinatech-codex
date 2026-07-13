import { describe, expect, it, vi } from "vitest";

import {
  areKioskReturnDraftsEqual,
  hasKioskReturnDrafts,
  kioskReturnDraftKey,
  readKioskReturnDrafts,
  writeKioskReturnDrafts,
} from "./kiosk-return-draft";

describe("kiosk return reason drafts", () => {
  it("keys drafts by session and submission version", () => {
    expect(kioskReturnDraftKey({ id: "session-a", submission_version: 3 })).toBe("session-a:3");
  });

  it("writes only explicit bounded drafts and removes empty state", () => {
    const storage = {
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    writeKioskReturnDrafts(storage, "store-a", {
      "session-a:3": "请重新确认电话",
      "bad key": "drop",
      "session-b:1": "",
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      "repairdesk:settings:kiosk-return-drafts:store-a",
      JSON.stringify({ "session-a:3": "请重新确认电话" }),
    );
    writeKioskReturnDrafts(storage, "store-a", {});
    expect(storage.removeItem).toHaveBeenCalledWith(
      "repairdesk:settings:kiosk-return-drafts:store-a",
    );
  });

  it("recovers a valid saved draft without trusting malformed storage", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ "session-a:2": "保留原因", "invalid key": "drop" })),
    };
    expect(readKioskReturnDrafts(storage, "store-a")).toEqual({
      "session-a:2": "保留原因",
    });
    expect(hasKioskReturnDrafts({ "session-a:2": "  " })).toBe(false);
  });

  it("compares normalized drafts without depending on property order", () => {
    expect(
      areKioskReturnDraftsEqual(
        { "session-b:1": "B", "session-a:2": "A" },
        { "session-a:2": "A", "session-b:1": "B" },
      ),
    ).toBe(true);
    expect(areKioskReturnDraftsEqual({ "session-a:2": "A" }, { "session-a:2": "changed" })).toBe(
      false,
    );
  });
});
