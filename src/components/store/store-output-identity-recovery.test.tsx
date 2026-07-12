import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoreOutputIdentityRecovery } from "@/components/store/store-output-identity-recovery";
import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";

afterEach(cleanup);

describe("StoreOutputIdentityRecovery", () => {
  it("renders nothing when customer output is ready", () => {
    const identity = readyIdentity();
    const { container } = render(
      <StoreOutputIdentityRecovery identity={identity} canReadSettings canUpdateSettings />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("announces loading without a misleading action", () => {
    render(
      <StoreOutputIdentityRecovery
        identity={resolveStoreOutputIdentity({ settingsState: "loading" })}
        canReadSettings
        canUpdateSettings
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在读取当前店铺资料");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("retries a failed settings read without linking to Settings", async () => {
    const user = userEvent.setup();
    const onRetrySettings = vi.fn().mockResolvedValue(undefined);
    render(
      <StoreOutputIdentityRecovery
        identity={resolveStoreOutputIdentity({ settingsState: "error" })}
        canReadSettings
        canUpdateSettings
        onRetrySettings={onRetrySettings}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新读取店铺资料" }));
    await waitFor(() => expect(onRetrySettings).toHaveBeenCalledTimes(1));
  });

  it("reloads a mismatched store context without exposing a settings URL", async () => {
    const user = userEvent.setup();
    const onReloadStoreContext = vi.fn().mockResolvedValue(undefined);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-b", name: "Etna Phone Lab" },
      settings: { store_id: "store-a", store_name: "Ripara Subito" },
    });
    render(
      <StoreOutputIdentityRecovery
        identity={identity}
        canReadSettings
        canUpdateSettings
        onReloadStoreContext={onReloadStoreContext}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载当前店铺" }));
    await waitFor(() => expect(onReloadStoreContext).toHaveBeenCalledTimes(1));
  });

  it("opens editable store recovery in a separate tab and keeps a mobile touch target", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: { store_id: "store-a", store_name: "Ripara Subito" },
    });
    render(
      <StoreOutputIdentityRecovery
        identity={identity}
        canReadSettings
        canUpdateSettings
        openSettingsInNewTab
      />,
    );

    const link = screen.getByRole("link", { name: "前往店铺资料（在新标签页打开）" });
    expect(link).toHaveAttribute("href", "/settings?section=store");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveClass("min-h-11", "w-full");
    expect(link.getAttribute("href")).not.toMatch(/store-a|Ripara/);
  });

  it("rechecks settings after the user returns from the recovery destination", async () => {
    const user = userEvent.setup();
    const onRetrySettings = vi.fn().mockResolvedValue(undefined);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: { store_id: "store-a", store_name: "Ripara Subito" },
    });
    render(
      <StoreOutputIdentityRecovery
        identity={identity}
        canReadSettings
        canUpdateSettings
        onRetrySettings={onRetrySettings}
        openSettingsInNewTab
      />,
    );

    await user.click(screen.getByRole("button", { name: "重新检查资料" }));
    await waitFor(() => expect(onRetrySettings).toHaveBeenCalledTimes(1));
  });

  it("routes notification-only gaps to the notification section", () => {
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Ripara Subito" },
      settings: {
        store_id: "store-a",
        store_name: "Ripara Subito",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
      },
    });
    render(
      <StoreOutputIdentityRecovery identity={identity} canReadSettings canUpdateSettings={false} />,
    );

    expect(screen.getByRole("link", { name: "查看通知与打印" })).toHaveAttribute(
      "href",
      "/settings?section=notifications",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("当前账号只能查看设置");
  });

  it("does not expose private Settings when permission is unavailable", () => {
    const identity = resolveStoreOutputIdentity({});
    render(
      <StoreOutputIdentityRecovery
        identity={identity}
        canReadSettings={false}
        canUpdateSettings={false}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("当前账号无法打开店铺设置");
  });
});

function readyIdentity() {
  return resolveStoreOutputIdentity({
    activeStore: { id: "store-a", name: "Ripara Subito" },
    settings: {
      store_id: "store-a",
      store_name: "Ripara Subito",
      store_address: "Via Roma 12, Siracusa",
      store_phone: "+39 0931 000000",
      message_signature: "Ripara Subito · Assistenza",
      print_footer: "Grazie per aver scelto Ripara Subito.",
    },
  });
}
