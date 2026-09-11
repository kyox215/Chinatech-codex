import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import type { UpdateOrderInput } from "@/lib/repairdesk/api";
import { buildOrderPatchChanges } from "@/features/orders/model/order-edit-diff";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { OrderDetailFieldEditor, type OrderDetailField } from "./order-detail-field-editor";

afterEach(cleanup);
const initial: UpdateOrderInput = {
  expected_updated_at: "2026-09-10T10:00:00Z",
  customer_name: "",
  customer_phone: "",
  device_brand: "",
  device_model: "",
  device_notes: "Existing note",
  issue_description: "",
  accessory_notes: "",
  fault_prices: [],
  warranty_months: 6,
  warranty_text: "6个月",
};
function setup(
  field: OrderDetailField,
  props: Partial<Parameters<typeof OrderDetailFieldEditor>[0]> = {},
) {
  const onSave = vi.fn().mockResolvedValue(undefined),
    onClose = vi.fn();
  const view = render(
    <LocaleProvider initialLocale="zh-CN">
      <OrderDetailFieldEditor
        field={field}
        initial={initial}
        scopeKey="test:order"
        pending={false}
        canEditIntake
        canEditRepair
        defaultWarrantyMonths={6}
        returnFocusRef={createRef()}
        onClose={onClose}
        onSave={onSave}
        {...props}
      />
    </LocaleProvider>,
  );
  return { ...view, onSave, onClose };
}
describe("OrderDetailFieldEditor", () => {
  it("saves repair-only notes without intake permission or unrelated identity requirements", async () => {
    const { onSave } = setup("notes", { canEditIntake: false });
    fireEvent.change(screen.getByRole("textbox", { name: "设备备注" }), {
      target: { value: "Changed note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(
      buildOrderPatchChanges(onSave.mock.calls[0][0], onSave.mock.calls[0][1], {
        canEditIntake: false,
        canEditRepair: true,
      }),
    ).toEqual({ device_notes: "Changed note" });
  });
  it("keeps accessory multi-selection local until one save and changes only accessories", async () => {
    const { onSave } = setup("accessories", { canEditRepair: false });
    fireEvent.click(screen.getByRole("button", { name: "SIM卡" }));
    fireEvent.click(screen.getByRole("button", { name: "手机壳" }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const changes = buildOrderPatchChanges(onSave.mock.calls[0][0], onSave.mock.calls[0][1], {
      canEditIntake: true,
      canEditRepair: false,
    });
    expect(Object.keys(changes)).toEqual(["accessory_notes"]);
    expect(changes.accessory_notes).toContain("SIM卡");
    expect(changes.accessory_notes).toContain("手机壳");
  });
  it("requires confirmation to discard a changed field", () => {
    const { onClose } = setup("notes");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(document.querySelector("[data-editor-discard]")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("keeps failed saves and the current draft available", async () => {
    const save = vi.fn().mockRejectedValue(new Error("409 conflict"));
    setup("notes", { onSave: save });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep after error" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByRole("textbox")).toHaveValue("Keep after error");
  });
  it("makes every warranty control inert while pending", () => {
    const { container, onSave } = setup("warranty", { pending: true });
    expect(container.ownerDocument.querySelector("fieldset")).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("lets read-only users read full notes without any save control", () => {
    setup("notes", { canEditIntake: false, canEditRepair: false });
    expect(screen.getByText("Existing note")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });
});
