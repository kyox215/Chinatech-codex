import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerStatusScreen } from "./customer-status-screen";

const apiMocks = vi.hoisted(() => ({
  resolveCustomerStatus: vi.fn(),
  resolveCustomerStatusForStaff: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/features/customer-status/api/customer-status-client", () => apiMocks);
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
const publicStatus = {
  store: { name: "Chinatech", phone: "+39 000" },
  order: {
    public_no: "R2027001",
    device: "Apple iPhone",
    stage: "repair" as const,
    stage_label: "Riparazione in corso",
    progress_percent: 72,
    last_updated_at: "2026-07-20T12:00:00.000Z",
    next_action: "Attendi il completamento della riparazione.",
  },
};

describe("CustomerStatusScreen identity routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", `/r#${token}`);
    apiMocks.resolveCustomerStatus.mockResolvedValue(publicStatus);
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("keeps anonymous scans on the public progress page without a staff login branch", async () => {
    apiMocks.resolveCustomerStatusForStaff.mockRejectedValue(
      Object.assign(new Error(), { status: 401 }),
    );
    render(<CustomerStatusScreen />);

    expect(await screen.findByText("Riparazione in corso")).toBeVisible();
    expect(apiMocks.resolveCustomerStatus).toHaveBeenCalledWith(
      token,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiMocks.resolveCustomerStatusForStaff).toHaveBeenCalledWith(
      token,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("button", { name: /accesso personale/i })).not.toBeInTheDocument();
  });

  it("automatically opens internal detail for an authenticated authorized scan", async () => {
    apiMocks.resolveCustomerStatusForStaff.mockResolvedValue("/orders/order-1?from=orders");
    render(<CustomerStatusScreen />);

    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/orders/order-1?from=orders"),
    );
    expect(window.location.hash).toBe("");
  });

  it("silently falls back to the public view for cross-store or unauthorized staff", async () => {
    apiMocks.resolveCustomerStatusForStaff.mockRejectedValue(
      Object.assign(new Error(), { status: 404 }),
    );
    render(<CustomerStatusScreen />);

    expect(await screen.findByText("Riparazione in corso")).toBeVisible();
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/accesso interno/i)).not.toBeInTheDocument();
  });

  it("never lets an older staff resolution navigate after a newer scan", async () => {
    const nextToken = `v2.1.${"N".repeat(22)}.2.${"T".repeat(43)}`;
    let resolveFirst: (path: string) => void = () => undefined;
    let resolveSecond: (path: string) => void = () => undefined;
    apiMocks.resolveCustomerStatusForStaff.mockImplementation(
      (candidate: string) =>
        new Promise<string>((resolve) => {
          if (candidate === token) resolveFirst = resolve;
          if (candidate === nextToken) resolveSecond = resolve;
        }),
    );
    render(<CustomerStatusScreen />);

    await waitFor(() => expect(apiMocks.resolveCustomerStatusForStaff).toHaveBeenCalledTimes(1));
    act(() => {
      window.history.replaceState(null, "", `/r#${nextToken}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(apiMocks.resolveCustomerStatusForStaff).toHaveBeenCalledTimes(2));

    await act(async () => resolveFirst("/orders/order-old?from=orders"));
    expect(routerMocks.replace).not.toHaveBeenCalled();

    await act(async () => resolveSecond("/orders/order-new?from=orders"));
    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/orders/order-new?from=orders"),
    );
  });

  it("distinguishes a temporary internal failure from an unavailable QR", async () => {
    apiMocks.resolveCustomerStatusForStaff.mockRejectedValue(
      Object.assign(new Error("temporary"), { status: 503 }),
    );
    render(<CustomerStatusScreen />);

    expect(await screen.findByText("Riparazione in corso")).toBeVisible();
    expect(await screen.findByText(/Impossibile aprire l'ordine interno/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeVisible();
  });
});
