"use client";

import { UnsavedNavigationGuard } from "@/components/unsaved-navigation-guard";
import type { NavigationGuardResolution } from "@/components/navigation-guard-provider";

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
  const id = props.id ?? "settings-store-draft";
  return <UnsavedNavigationGuard {...props} id={id} />;
}
