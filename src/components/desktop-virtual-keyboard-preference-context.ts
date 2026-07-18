"use client";

import { createContext, useContext } from "react";

export interface DesktopVirtualKeyboardPreferenceContextValue {
  desktopVirtualKeyboardEnabled: boolean;
  preferenceReady: boolean;
  setDesktopVirtualKeyboardEnabled: (enabled: boolean) => void;
}

const unavailablePreference: DesktopVirtualKeyboardPreferenceContextValue = {
  desktopVirtualKeyboardEnabled: false,
  preferenceReady: false,
  setDesktopVirtualKeyboardEnabled: () => undefined,
};

export const DesktopVirtualKeyboardPreferenceContext =
  createContext<DesktopVirtualKeyboardPreferenceContextValue>(unavailablePreference);

export function useDesktopVirtualKeyboardPreference() {
  return useContext(DesktopVirtualKeyboardPreferenceContext);
}
