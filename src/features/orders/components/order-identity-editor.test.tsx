import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { UpdateOrderInput } from "@/lib/repairdesk/api";
import { OrderIdentityEditor } from "./order-identity-editor";

vi.mock("@/features/orders/forms/customer-intake-lookup", () => ({
  CustomerIdentityReview: () => null,
}));
afterEach(cleanup);
const initial: UpdateOrderInput = {
  expected_updated_at: "2026-09-17T08:00:00.000Z",
  expected_customer_updated_at: "2026-09-17T07:00:00.000Z",
  customer_name: "",
  customer_phone: "",
  contact_phones: [],
  device_brand: "Samsung",
  device_model: "Galaxy A54",
  issue_description: "",
  fault_prices: [],
};
function setup(overrides: Partial<Parameters<typeof OrderIdentityEditor>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined),
    onClose = vi.fn();
  const props = {
    group: "customer" as const,
    scopeKey: "store:order",
    initial,
    pending: false,
    canEdit: true,
    canEditRepair: true,
    onSave,
    onClose,
    ...overrides,
  };
  const view = render(
    <LocaleProvider initialLocale="en">
      <OrderIdentityEditor {...props} />
    </LocaleProvider>,
  );
  return { ...view, onSave, onClose, props };
}
describe("OrderIdentityEditor current customer contacts", () => {
  it("lets an anonymous customer add only the primary phone and freezes both versions", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), {
      target: { value: "+393330000901" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]).toEqual([
      initial,
      { ...initial, customer_phone: "+393330000901", contact_phones: [] },
    ]);
  });
  it("adds multiple backup rows and explicitly clears all backups without changing the primary", async () => {
    const existing = {
      ...initial,
      customer_phone: "+393330000901",
      contact_phones: ["+393330000902"],
    };
    const { onSave } = setup({ initial: existing });
    fireEvent.click(screen.getByRole("button", { name: "Add alternative phone" }));
    expect(screen.getAllByRole("textbox", { name: /Alternative phone/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Delete.* 2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Delete.* 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][1]).toMatchObject({
      customer_phone: existing.customer_phone,
      contact_phones: [],
    });
  });
  it("retains failed phone edits and dirty cancellation asks to continue or discard", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("synthetic failure"));
    const { onClose } = setup({ onSave });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), {
      target: { value: "+393330000903" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("+393330000903");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(document.querySelector("[data-editor-discard]")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("detects a customer-only remote revision and preserves the local draft", () => {
    const { rerender, props, onSave } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), {
      target: { value: "+393330000904" },
    });
    rerender(
      <LocaleProvider initialLocale="en">
        <OrderIdentityEditor
          {...props}
          initial={{ ...initial, expected_customer_updated_at: "2026-09-17T08:01:00.000Z" }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("+393330000904");
    expect(onSave).not.toHaveBeenCalled();
  });
});
