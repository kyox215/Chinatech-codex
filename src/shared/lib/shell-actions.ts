import type { RepairDeskShellAction } from "@/shared/config/navigation";

interface ShellActionRunnerOptions {
  pathname: string;
  push: (href: string) => void;
  close?: () => void;
  openCommand?: () => void;
  openScanner?: () => void;
  openCamera?: () => void;
}

export function runRepairDeskShellAction(
  action: RepairDeskShellAction,
  { pathname, push, close, openCommand, openScanner, openCamera }: ShellActionRunnerOptions,
) {
  close?.();

  if (action.kind === "command") {
    openCommand?.();
    return;
  }

  if (action.kind === "scanner") {
    openScanner?.();
    return;
  }

  if (action.kind === "camera") {
    openCamera?.();
    return;
  }

  if (action.eventName && action.eventPathname === pathname && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(action.eventName));
    return;
  }

  if (action.href) {
    push(action.href);
  }
}
