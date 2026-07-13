"use client";

import { useEffect, useRef } from "react";

import {
  useNavigationGuard,
  type NavigationGuardResolution,
} from "@/components/navigation-guard-provider";

export interface UnsavedSettingsGuardProps {
  id?: string;
  dirty: boolean;
  isDirty?: () => boolean;
  busy: boolean;
  canSave?: boolean | (() => boolean);
  saveUnavailableReason?: string | (() => string);
  label: string;
  onSave: () => Promise<NavigationGuardResolution>;
  onDiscard: () => NavigationGuardResolution | Promise<NavigationGuardResolution>;
  onFocusFallback?: () => void;
}

export function UnsavedSettingsGuard(props: UnsavedSettingsGuardProps) {
  const { registerGuard } = useNavigationGuard();
  const id = props.id ?? "settings-store-draft";
  const latestRef = useRef(props);
  latestRef.current = props;

  useEffect(
    () =>
      registerGuard({
        id,
        label: () => latestRef.current.label,
        isDirty: () => latestRef.current.isDirty?.() ?? latestRef.current.dirty,
        isBusy: () => latestRef.current.busy,
        canSave: () =>
          typeof latestRef.current.canSave === "function"
            ? latestRef.current.canSave()
            : (latestRef.current.canSave ?? true),
        saveUnavailableReason: () =>
          typeof latestRef.current.saveUnavailableReason === "function"
            ? latestRef.current.saveUnavailableReason()
            : (latestRef.current.saveUnavailableReason ?? ""),
        save: () => latestRef.current.onSave(),
        discard: () => latestRef.current.onDiscard(),
        focusFallback: () => latestRef.current.onFocusFallback?.(),
      }),
    [id, registerGuard],
  );

  return null;
}
