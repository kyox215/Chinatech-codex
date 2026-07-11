import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoreShellContextSnapshot } from "@/features/stores/model/store-shell-context";

import { StoreShellUnavailableState } from "./store-shell-unavailable-state";

afterEach(cleanup);

describe("StoreShellUnavailableState", () => {
  it.each([
    ["platform_admin", "/platform", "进入平台管理"],
    ["onboarding_required", "/onboarding", "前往店铺开通"],
  ] as const)("provides a recovery action for %s", (status, href, label) => {
    render(<StoreShellUnavailableState shell={makeShell(status)} />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("retries the store shell in place after a read error", () => {
    const onRetry = vi.fn();
    render(<StoreShellUnavailableState shell={makeShell("error")} onRetry={onRetry} />);

    screen.getByRole("button", { name: "重新读取" }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

function makeShell(status: StoreShellContextSnapshot["status"]): StoreShellContextSnapshot {
  return {
    stores: [],
    isPlatformAdmin: status === "platform_admin",
    isLoading: false,
    isRefreshing: false,
    isError: status === "error",
    isDegraded: false,
    canSwitchStore: false,
    status,
    statusLabel: "店铺状态",
    statusDescription: "当前没有可用店铺。",
  };
}
