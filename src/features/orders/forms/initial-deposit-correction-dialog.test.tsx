import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InitialDepositCorrectionDialog } from "./initial-deposit-correction-dialog";

vi.mock("@/components/orders/money-keypad-input", () => ({
  MoneyKeypadInput: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("InitialDepositCorrectionDialog", () => {
  it("explains correction semantics and requires a changed amount plus reason", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <InitialDepositCorrectionDialog
        open
        onOpenChange={vi.fn()}
        quotation={100}
        currentDeposit={20}
        pending={false}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/不代表新增收款/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "确认更正" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("正确的定金金额"), { target: { value: "25.50" } });
    fireEvent.change(screen.getByLabelText("更正原因"), {
      target: { value: "建单时现金金额录入错误" },
    });
    expect(screen.getByText("€74.50")).toBeInTheDocument();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(25.5, "建单时现金金额录入错误", expect.any(String)),
    );
  });

  it("keeps the dialog usable when the mutation rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("stale"));
    render(
      <InitialDepositCorrectionDialog
        open
        onOpenChange={vi.fn()}
        quotation={100}
        currentDeposit={20}
        pending={false}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText("正确的定金金额"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("更正原因"), { target: { value: "重新核对现金定金" } });
    fireEvent.click(screen.getByRole("button", { name: "确认更正" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
