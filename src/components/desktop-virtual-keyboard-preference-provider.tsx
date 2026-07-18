"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DesktopVirtualKeyboardPreferenceContext,
  type DesktopVirtualKeyboardPreferenceContextValue,
} from "@/components/desktop-virtual-keyboard-preference-context";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  desktopVirtualKeyboardPreferenceEvent,
  desktopVirtualKeyboardPreferenceKey,
  readDesktopVirtualKeyboardPreference,
  writeDesktopVirtualKeyboardPreference,
} from "@/shared/lib/desktop-virtual-keyboard-preference";

export function DesktopVirtualKeyboardPreferenceProvider({ children }: { children: ReactNode }) {
  const { userId } = useStoreShellContext();
  const [desktopVirtualKeyboardEnabled, setDesktopVirtualKeyboardEnabledState] = useState(false);

  useEffect(() => {
    const syncPreference = () => {
      setDesktopVirtualKeyboardEnabledState(readDesktopVirtualKeyboardPreference(userId));
    };
    syncPreference();

    if (!userId) return undefined;

    const handlePreferenceChange = () => syncPreference();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === desktopVirtualKeyboardPreferenceKey(userId)) syncPreference();
    };

    window.addEventListener(desktopVirtualKeyboardPreferenceEvent, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(desktopVirtualKeyboardPreferenceEvent, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [userId]);

  const setDesktopVirtualKeyboardEnabled = useCallback(
    (enabled: boolean) => {
      if (!writeDesktopVirtualKeyboardPreference(userId, enabled)) {
        setDesktopVirtualKeyboardEnabledState(false);
      }
    },
    [userId],
  );

  const value = useMemo<DesktopVirtualKeyboardPreferenceContextValue>(
    () => ({
      desktopVirtualKeyboardEnabled,
      preferenceReady: Boolean(userId),
      setDesktopVirtualKeyboardEnabled,
    }),
    [desktopVirtualKeyboardEnabled, setDesktopVirtualKeyboardEnabled, userId],
  );

  return (
    <DesktopVirtualKeyboardPreferenceContext.Provider value={value}>
      {children}
    </DesktopVirtualKeyboardPreferenceContext.Provider>
  );
}
