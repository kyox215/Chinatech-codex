"use client";

import { useEffect } from "react";

type RepairDeskStyleRecoveryController = {
  markRuntimeReady: () => void;
};

export function AppStyleRecovery() {
  useEffect(() => {
    const recoveryWindow = window as typeof window & {
      __repairDeskRuntimeReady?: boolean;
      __repairDeskStyleRecovery?: RepairDeskStyleRecoveryController;
    };
    recoveryWindow.__repairDeskRuntimeReady = true;
    recoveryWindow.__repairDeskStyleRecovery?.markRuntimeReady();
  }, []);

  return null;
}
