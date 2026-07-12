import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { ApprovalRequestDialog } from "@/features/orders/forms/approval-request-dialog";
import { NotifyDialog } from "@/features/orders/forms/notify-dialog";
import { getOrder } from "@/features/orders/testing/mock-api";
import { orders } from "@/lib/mock/state";

afterEach(cleanup);

describe("order customer-output recovery dialogs", () => {
  it("keeps WhatsApp disabled and exposes only the safe store-settings destination", async () => {
    const data = await getOrder(orders[0].id);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-private", name: "Etna Phone Lab" },
      settings: { store_id: "store-private", store_name: "Etna Phone Lab" },
    });

    render(
      <NotifyDialog
        open
        onOpenChange={vi.fn()}
        data={data}
        orderUrl="https://example.test/orders/private-order"
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
    expect(recoveryLink).toHaveAttribute("target", "_blank");
    expect(recoveryLink.getAttribute("href")).not.toMatch(/store-private|private-order/);
    expect(screen.getByRole("button", { name: "确认并打开 WhatsApp" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "通知内容" })).toBeDisabled();
  });

  it("routes an approval message with notification-only gaps to notification settings", async () => {
    const data = await getOrder(orders[0].id);
    const identity = resolveStoreOutputIdentity({
      activeStore: { id: "store-a", name: "Etna Phone Lab" },
      settings: {
        store_id: "store-a",
        store_name: "Etna Phone Lab",
        store_address: "Via Roma 12, Siracusa",
        store_phone: "+39 0931 000000",
      },
    });

    render(
      <ApprovalRequestDialog
        open
        onOpenChange={vi.fn()}
        data={data}
        orderUrl="https://example.test/orders/order-a"
        storeIdentity={identity}
        canReadStoreSettings
        canUpdateStoreSettings={false}
        busy={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "查看通知与打印（在新标签页打开）" })).toHaveAttribute(
      "href",
      "/settings?section=notifications",
    );
    expect(screen.getByRole("button", { name: "确认并打开 WhatsApp" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "审批消息内容" })).toBeDisabled();
  });
});
