import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { ScanSearchSheet } from "./scan-search-button";

const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  runGuardedTransition: vi.fn(({ run }: { run: () => void }) => {
    run();
    return { status: "executed" as const };
  }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigationMocks.push }) }));
vi.mock("@/components/navigation-guard-provider", () => ({
  useNavigationGuard: () => ({ runGuardedTransition: navigationMocks.runGuardedTransition }),
}));
vi.mock("@/features/capture/components/barcode-scanner-sheet", () => ({
  BarcodeScannerSheet: (props: {
    renderActions?: (
      payload: CapturePayload,
      helpers: { close: () => void; rescan: () => void },
    ) => React.ReactNode;
  }) => (
    <div>
      {props.renderActions?.(
        {
          kind: "customer_status_link",
          raw: "",
          value: "",
          label: "维修工单二维码",
          targetHref: `/r#${token}`,
          sensitive: true,
        },
        { close: vi.fn(), rescan: vi.fn() },
      )}
    </div>
  ),
}));

describe("ScanSearchSheet customer status routing", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("routes only through /r and never invokes ordinary order search", () => {
    const onSearch = vi.fn();
    const navigateDocument = vi.fn();
    render(
      <ScanSearchSheet
        open
        onOpenChange={vi.fn()}
        scope="orders"
        onSearch={onSearch}
        navigateDocument={navigateDocument}
      />,
    );

    expect(document.body.textContent).not.toContain(token);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "查看此订单" }));

    expect(navigateDocument).toHaveBeenCalledWith(`/r#${token}`);
    expect(navigationMocks.push).not.toHaveBeenCalled();
    expect(onSearch).not.toHaveBeenCalled();
  });
});
