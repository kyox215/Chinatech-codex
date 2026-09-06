import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrderSupplierPicker } from "./order-supplier-picker";
import userEvent from "@testing-library/user-event";
import {
  createAuthorityFingerprint,
  resolveStoreShellContext,
} from "@/features/stores/model/store-shell-context";
import { storesKeys } from "@/features/stores/api/query-keys";
import type { ShellBootstrap } from "@/features/stores/model/shell-bootstrap";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { Supplier } from "@/lib/repairdesk/types";

const authority = vi.hoisted(() => ({ role: "owner", storeId: "store-test", ready: true }));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => ({
    status: authority.ready ? "ready" : "degraded",
    isLoading: false,
    isRefreshing: false,
    isDegraded: !authority.ready,
    activeStore: { id: authority.storeId, role: authority.role, membershipId: "membership-test" },
    userId: "owner-test",
    permissions: { canManageSuppliers: true },
    authorityFingerprint: createAuthorityFingerprint({
      userId: "owner-test",
      activeStore: {
        id: authority.storeId,
        name: "Synthetic Store",
        slug: "synthetic",
        status: "active",
        role: authority.role as "owner",
        membershipId: "membership-test",
      },
      permissions: { canManageSuppliers: true } as never,
    }),
  }),
}));
beforeEach(() => {
  authority.role = "owner";
  authority.storeId = "store-test";
  authority.ready = true;
});
afterEach(cleanup);
it("waits for supplier mutation success and retains the choice surface after failure", async () => {
  const supplier = { id: "s1", name: "Synthetic Supplier", color: "var(--primary)" } as Supplier;
  const onChange = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LocaleProvider initialLocale="en">
        <OrderSupplierPicker suppliers={[supplier]} mode="sheet" onChange={onChange} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button", { name: /Synthetic Supplier/ }));
  await screen.findByRole("alert");
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Synthetic Supplier/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onChange).toHaveBeenNthCalledWith(2, "s1");
});

it("offers owner management in a new tab, refreshes only on return, and cancels stale identity sessions", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  vi.spyOn(client, "refetchQueries").mockImplementation(async () => {
    client.setQueryData(storesKeys.bootstrap, freshBootstrap());
  });
  const supplier = {
    id: "s1",
    name: "Synthetic Supplier",
    short_name: "Synthetic Supplier",
    color: "var(--primary)",
  } as Supplier;
  const view = () => (
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale="en">
        <OrderSupplierPicker suppliers={[supplier]} mode="sheet" onChange={() => undefined} />
      </LocaleProvider>
    </QueryClientProvider>
  );
  const rendered = render(view());
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button", { name: "Synthetic Supplier" })).toBeVisible();
  const link = screen.getByRole("link", { name: "Edit suppliers (new tab)" });
  expect(link).toHaveAttribute("href", "/settings?section=suppliers");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  fireEvent.focus(window);
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(link);
  fireEvent.focus(window);
  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["repairdesk-options", "store", "store-test"],
      exact: true,
    }),
  );
  expect(invalidate).toHaveBeenCalledTimes(1);
  fireEvent.focus(window);
  expect(invalidate).toHaveBeenCalledTimes(1);
  fireEvent.click(link);
  authority.storeId = "store-new";
  rendered.rerender(view());
  fireEvent.focus(window);
  expect(invalidate).toHaveBeenCalledTimes(1);
  authority.role = "technician";
  rendered.rerender(view());
  expect(screen.queryByRole("link", { name: "Edit suppliers (new tab)" })).toBeNull();
  authority.role = "owner";
  authority.ready = false;
  rendered.rerender(view());
  expect(screen.queryByRole("link", { name: "Edit suppliers (new tab)" })).toBeNull();
});

function freshBootstrap(storeId = "store-test"): ShellBootstrap {
  const activeStore = {
    id: storeId,
    name: "Synthetic Store",
    slug: "synthetic",
    status: "active",
    role: "owner",
    membershipId: "membership-test",
  };
  return {
    onboarding: { userId: "owner-test", activeStore, stores: [activeStore] },
    storeContext: { activeStore, stores: [activeStore], permissions: { canManageSuppliers: true } },
  } as ShellBootstrap;
}

for (const result of ["changed-store", "failed", "paused"] as const) {
  it(`does not refresh old-store options when the cached shell is A but return authority is ${result}`, async () => {
    const client = new QueryClient();
    client.setQueryData(storesKeys.bootstrap, freshBootstrap());
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let finish: (() => void) | undefined;
    const refresh = vi.spyOn(client, "refetchQueries").mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      if (result === "failed") throw new Error("offline");
      if (result === "paused") {
        client
          .getQueryCache()
          .find({ queryKey: storesKeys.bootstrap, exact: true })
          ?.setState({ fetchStatus: "paused" });
        return;
      }
      client.setQueryData(storesKeys.bootstrap, freshBootstrap("store-B"));
    });
    render(
      <QueryClientProvider client={client}>
        <LocaleProvider initialLocale="en">
          <OrderSupplierPicker suppliers={[]} mode="sheet" onChange={() => undefined} />
        </LocaleProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("link", { name: "Edit suppliers (new tab)" }));
    fireEvent.focus(window);
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(
      { queryKey: storesKeys.bootstrap, exact: true },
      { throwOnError: true },
    );
    expect(invalidate).not.toHaveBeenCalled();
    finish?.();
    await waitFor(() => expect(refresh.mock.settledResults[0]?.type).not.toBe("incomplete"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(authority.storeId).toBe("store-test");
    if (result === "paused")
      expect(client.getQueryState(storesKeys.bootstrap)?.fetchStatus).toBe("paused");
    if (result === "changed-store")
      expect(
        resolveStoreShellContext({
          onboardingStatus: client.getQueryData<ShellBootstrap>(storesKeys.bootstrap)!.onboarding,
          storeContext: client.getQueryData<ShellBootstrap>(storesKeys.bootstrap)!.storeContext,
        }).activeStore?.id,
      ).toBe("store-B");
  });
}

it("includes supplier management in the desktop menu keyboard navigation", async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LocaleProvider initialLocale="en">
        <OrderSupplierPicker suppliers={[]} onChange={() => undefined} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  screen.getByRole("button").focus();
  await user.keyboard("{Enter}");
  const manage = await screen.findByRole("menuitem", { name: "Edit suppliers (new tab)" });
  await user.keyboard("{Home}");
  await waitFor(() => expect(manage).toHaveFocus());
  await user.keyboard("{Enter}");
  expect(screen.getByRole("menu")).toBeVisible();
});
