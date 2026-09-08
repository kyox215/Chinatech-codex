import { describe, expect, it } from "vitest";

import {
  resolveVirtualKeyboardSurface,
  type VirtualKeyboardEnvironment,
} from "./virtual-keyboard-device";

const unknownTouch: VirtualKeyboardEnvironment = {
  userAgent: "UnknownBrowser/1.0",
  platform: "",
  maxTouchPoints: 5,
  compactViewport: true,
  coarsePointer: true,
  anyCoarsePointer: true,
};

describe("resolveVirtualKeyboardSurface", () => {
  it("starts native without browser evidence", () => {
    expect(resolveVirtualKeyboardSurface()).toBe("native");
  });

  it.each([
    ["Chrome Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0", "Win32"],
    ["Edge Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/140.0.0.0", "Win32"],
    [
      "Safari Mac",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15",
      "MacIntel",
    ],
    [
      "Firefox Linux",
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Linux x86_64",
    ],
    ["Chromebook", "Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) Chrome/140.0.0.0", "Linux x86_64"],
  ])("keeps %s native at every viewport without touch evidence", (_name, userAgent, platform) => {
    for (const compactViewport of [true, false]) {
      expect(
        resolveVirtualKeyboardSurface({
          ...unknownTouch,
          userAgent,
          platform,
          compactViewport,
          maxTouchPoints: 0,
          coarsePointer: false,
          anyCoarsePointer: false,
        }),
      ).toBe("native");
    }
  });

  it.each([
    ["Windows NT 10.0", "Win32"],
    ["X11; Linux x86_64", "Linux x86_64"],
    ["X11; CrOS x86_64", "Linux x86_64"],
  ])("does not classify a touch-screen %s desktop as mobile", (userAgent, platform) => {
    expect(resolveVirtualKeyboardSurface({ ...unknownTouch, userAgent, platform })).toBe("native");
  });

  it.each([
    [
      "iPhone Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
      "iPhone",
    ],
    ["iPod", "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)", "iPod"],
    [
      "iPad",
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
      "iPad",
    ],
    [
      "Android phone Chrome",
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Linux armv8l",
    ],
    [
      "Android tablet Firefox",
      "Mozilla/5.0 (Android 15; Tablet; rv:140.0) Gecko/140.0 Firefox/140.0",
      "Linux armv8l",
    ],
  ])(
    "keeps %s virtual even at a wide viewport with a fine primary pointer",
    (_name, userAgent, platform) => {
      expect(
        resolveVirtualKeyboardSurface({
          ...unknownTouch,
          userAgent,
          platform,
          compactViewport: false,
          coarsePointer: false,
        }),
      ).toBe("virtual");
    },
  );

  it.each([
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36",
  ])("recognizes iPadOS desktop UA only with multi-touch and coarse evidence: %s", (userAgent) => {
    const ipad = { ...unknownTouch, userAgent, platform: "MacIntel", compactViewport: false };
    expect(resolveVirtualKeyboardSurface(ipad)).toBe("virtual");
    expect(resolveVirtualKeyboardSurface({ ...ipad, coarsePointer: false })).toBe("virtual");
    expect(resolveVirtualKeyboardSurface({ ...ipad, maxTouchPoints: 1 })).toBe("native");
    expect(
      resolveVirtualKeyboardSurface({ ...ipad, coarsePointer: false, anyCoarsePointer: false }),
    ).toBe("native");
    expect(resolveVirtualKeyboardSurface({ ...ipad, platform: "MacPPC" })).toBe("native");
  });

  it("requires compact viewport, touch points and primary coarse pointer on unknown devices", () => {
    expect(resolveVirtualKeyboardSurface(unknownTouch)).toBe("virtual");
    for (const missing of [
      { compactViewport: false },
      { maxTouchPoints: 0 },
      { coarsePointer: false },
    ]) {
      expect(resolveVirtualKeyboardSurface({ ...unknownTouch, ...missing })).toBe("native");
    }
  });
});
