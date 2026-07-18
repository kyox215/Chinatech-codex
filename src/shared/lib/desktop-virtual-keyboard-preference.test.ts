import { describe, expect, it } from "vitest";

import {
  desktopVirtualKeyboardPreferenceKey,
  readDesktopVirtualKeyboardPreference,
  writeDesktopVirtualKeyboardPreference,
} from "./desktop-virtual-keyboard-preference";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("desktop virtual keyboard preference", () => {
  it("uses a versioned browser key per user", () => {
    expect(desktopVirtualKeyboardPreferenceKey("user-a")).toBe(
      "repairdesk:desktop-virtual-keyboard:v1:user-a",
    );
    expect(desktopVirtualKeyboardPreferenceKey("user-a")).not.toBe(
      desktopVirtualKeyboardPreferenceKey("user-b"),
    );
  });

  it("only persists an explicit enabled state and removes it when disabled", () => {
    const storage = createMemoryStorage();

    expect(readDesktopVirtualKeyboardPreference("user-a", storage)).toBe(false);
    expect(writeDesktopVirtualKeyboardPreference("user-a", true, storage)).toBe(true);
    expect(readDesktopVirtualKeyboardPreference("user-a", storage)).toBe(true);
    expect(readDesktopVirtualKeyboardPreference("user-b", storage)).toBe(false);

    expect(writeDesktopVirtualKeyboardPreference("user-a", false, storage)).toBe(true);
    expect(readDesktopVirtualKeyboardPreference("user-a", storage)).toBe(false);
  });

  it("falls back to disabled when the user or browser storage is unavailable", () => {
    expect(readDesktopVirtualKeyboardPreference(undefined, createMemoryStorage())).toBe(false);
    expect(readDesktopVirtualKeyboardPreference("user-a", undefined)).toBe(false);
    expect(writeDesktopVirtualKeyboardPreference(undefined, true, createMemoryStorage())).toBe(
      false,
    );
  });
});
