export const desktopVirtualKeyboardPreferenceEvent =
  "repairdesk:desktop-virtual-keyboard-preference-change";

const desktopVirtualKeyboardPreferenceKeyPrefix = "repairdesk:desktop-virtual-keyboard:v1";

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function desktopVirtualKeyboardPreferenceKey(userId: string) {
  return `${desktopVirtualKeyboardPreferenceKeyPrefix}:${userId}`;
}

export function readDesktopVirtualKeyboardPreference(
  userId: string | undefined,
  storage: BrowserStorage | undefined = getBrowserLocalStorage(),
) {
  if (!userId || !storage) return false;

  try {
    return storage.getItem(desktopVirtualKeyboardPreferenceKey(userId)) === "enabled";
  } catch {
    return false;
  }
}

export function writeDesktopVirtualKeyboardPreference(
  userId: string | undefined,
  enabled: boolean,
  storage: BrowserStorage | undefined = getBrowserLocalStorage(),
) {
  if (!userId || !storage) return false;

  try {
    const key = desktopVirtualKeyboardPreferenceKey(userId);
    if (enabled) storage.setItem(key, "enabled");
    else storage.removeItem(key);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(desktopVirtualKeyboardPreferenceEvent, {
          detail: { userId, enabled },
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}

function getBrowserLocalStorage(): BrowserStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
