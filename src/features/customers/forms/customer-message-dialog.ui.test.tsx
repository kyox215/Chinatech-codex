import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { CustomerMessageDialog } from "@/features/customers/forms/customer-message-dialog";
import { getCustomerDetail } from "@/features/customers/testing/mock-api";
import { customers } from "@/lib/mock/state";

afterEach(cleanup);

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
    expect(screen.getByRole("button", { name: "确认并记录" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "客户消息内容" })).toBeDisabled();
  });
});
