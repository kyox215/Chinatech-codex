import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import {
  OrderPurchasingEditor,
  purchaseDraftAmount,
  type PurchaseDraft,
} from "./order-purchasing-editor";

vi.mock("@/components/orders/money-keypad-input", () => ({
  MoneyKeypadInput: ({
    value,
    onChange,
    ariaLabel,
    disabled,
  }: {
    value: string;
    onChange: (s: string) => void;
    ariaLabel: string;
    disabled: boolean;
  }) => (
    <input
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
afterEach(cleanup);
const initial: PurchaseDraft = {
  part_name: "Screen",
  line_id: null,
  supplier_id: "supplier-1",
  unit_cost_eur: "",
  quantity: "1",
};
function setup(props: Partial<Parameters<typeof OrderPurchasingEditor>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined),
    onClose = vi.fn();
  render(
    <LocaleProvider initialLocale="en">
      <OrderPurchasingEditor
        initial={initial}
        title="Order 1"
        suppliers={[{ id: "supplier-1", name: "Supplier one" }]}
        onSave={onSave}
        onClose={onClose}
        {...props}
      />
    </LocaleProvider>,
  );
  return { onSave, onClose };
}
describe("purchase money draft", () => {
  it("keeps missing cost distinct from explicit zero and rejects rounding/exponents", () => {
    expect(purchaseDraftAmount("")).toBeNull();
    expect(purchaseDraftAmount("0")).toBe("0.00");
    expect(purchaseDraftAmount("18,29")).toBe("18.29");
    expect(purchaseDraftAmount("999999.99")).toBe("999999.99");
    expect(purchaseDraftAmount("1000000")).toBeUndefined();
    for (const value of ["1.234", "1e2", "-1", "Infinity", "NaN", "1.2.3"])
      expect(purchaseDraftAmount(value)).toBeUndefined();
  });
});
describe("OrderPurchasingEditor", () => {
  it("allows a missing-cost draft but blocks ordering until cost is entered", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save & mark ordered" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("unit cost");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(initial, false));
  });
  it("passes explicit zero and quantity without altering customer quotation", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Unit cost (€)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark ordered" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ ...initial, unit_cost_eur: "0", quantity: "2" }, true),
    );
  });
  it("keeps the draft after a failed mutation", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    setup({ onSave: save });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: "Replacement display" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Your inputs have been kept"),
    );
    expect(screen.getByLabelText("Part")).toHaveValue("Replacement display");
  });
  it("blocks stale edits and duplicate submission", async () => {
    const { onSave } = setup({ conflict: true });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
  });
  it("requires explicit discard after editing", async () => {
    const { onClose } = setup();
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: "Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(document.querySelector("[data-editor-discard]")).toBeTruthy());
  });
  it("batch supplier editing does not expose cost inputs", () => {
    setup({ batch: true });
    expect(screen.queryByLabelText("Unit cost (€)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & mark ordered" })).not.toBeInTheDocument();
    expect(screen.getByText(/keeps each unit cost/)).toBeVisible();
  });
});
