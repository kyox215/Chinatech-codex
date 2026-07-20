import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { CustomerMessageDialog } from "@/features/customers/forms/customer-message-dialog";
import { getCustomerDetail } from "@/features/customers/testing/mock-api";
import { customers } from "@/lib/mock/state";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CustomerMessageDialog output recovery", () => {
  it("keeps customer messaging fail-closed while offering a PII-free recovery link", async () => {
    const data = await getCustomerDetail(customers[0].id);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-private", name: "Etna Phone Lab" },
      settings: { store_id: "store-private", store_name: "Etna Phone Lab" },
    });

    render(
      <CustomerMessageDialog
        open
        onOpenChange={vi.fn()}
        data={data}
        appOrigin="https://example.test"
        storeIdentity={identity}
        canReadStoreSettings
        canUpdateStoreSettings
        busy={false}
        onConfirm={vi.fn()}
      />,
    );

    const recoveryLink = screen.getByRole("link", {
      name: "前往店铺资料（在新标签页打开）",
    });
    expect(recoveryLink).toHaveAttribute("href", "/settings?section=store");
    expect(recoveryLink.getAttribute("href")).not.toMatch(
      new RegExp(`${customers[0].id}|store-private`),
    );
    expect(screen.getByRole("button", { name: /打开 WhatsApp/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "客户消息内容" })).toBeDisabled();
  });

  it("records contact only after the operator confirms the message was sent", async () => {
    const data = await getCustomerDetail(customers[0].id);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-private", name: "Etna Phone Lab" },
      settings: {
        store_id: "store-private",
        store_name: "Etna Phone Lab",
        store_address: "Via Etna 1",
        store_phone: "+39000000000",
        message_signature: "Etna Phone Lab · Assistenza",
        print_footer: "Etna Phone Lab",
      },
    });
    const onConfirm = vi.fn(async () => undefined);
    const openedWindow = { opener: window } as Window;
    vi.spyOn(window, "open").mockReturnValue(openedWindow);

    render(
      <CustomerMessageDialog
        open
        onOpenChange={vi.fn()}
        data={data}
        appOrigin="https://example.test"
        storeIdentity={identity}
        canReadStoreSettings
        canUpdateStoreSettings
        busy={false}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /打开 WhatsApp/ }));
    expect(window.open).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "我已发送，记录联系" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("explains how to retry when the browser blocks the sending window", async () => {
    const data = await getCustomerDetail(customers[0].id);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-private", name: "Etna Phone Lab" },
      settings: {
        store_id: "store-private",
        store_name: "Etna Phone Lab",
        store_address: "Via Etna 1",
        store_phone: "+39000000000",
        message_signature: "Etna Phone Lab · Assistenza",
        print_footer: "Etna Phone Lab",
      },
    });
    const onConfirm = vi.fn(async () => undefined);
    vi.spyOn(window, "open").mockReturnValue(null);

    render(
      <CustomerMessageDialog
        open
        onOpenChange={vi.fn()}
        data={data}
        appOrigin="https://example.test"
        storeIdentity={identity}
        canReadStoreSettings
        canUpdateStoreSettings
        busy={false}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /打开 WhatsApp/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("请允许浏览器弹窗");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
