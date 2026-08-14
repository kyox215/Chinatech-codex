import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";

import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";

import { InventoryReservationFormBody } from "./inventory-reservation-form-body";

const summary: InventoryLifecycleListSummary = {
  item_id: "story-item",
  stock_unit_id: "story-unit",
  sku: "SYNTH-RESERVE",
  business_status: "in_stock",
  unit_version: 2,
  allowed_actions: ["reservation.create"],
};

describe("InventoryReservationFormBody", () => {
  it("renders the adapter-owned controlled reservation body and submits locally", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <InventoryReservationFormBody
        summary={summary}
        customerSearch=""
        onCustomerSearchChange={vi.fn()}
        customer={{
          id: "story-customer",
          name: "合成客户",
          phone_e164: "+390000000000",
          phone_raw: "0000000000",
          contact_phones: [],
          consent_marketing: false,
          consent_sms: false,
        }}
        onCustomerClear={vi.fn()}
        customerResults={[]}
        onCustomerSelect={vi.fn()}
        price="899"
        onPriceChange={vi.fn()}
        deposit="100"
        onDepositChange={vi.fn()}
        method="cash"
        onMethodChange={vi.fn()}
        paymentNote=""
        onPaymentNoteChange={vi.fn()}
        expiresAt="2026-08-20T12:00"
        onExpiresAtChange={vi.fn()}
        expectedPickupAt="2026-08-15T12:00"
        onExpectedPickupAtChange={vi.fn()}
        noDepositReason=""
        onNoDepositReasonChange={vi.fn()}
        noDeposit={false}
        canSubmit
        conflict={null}
        operationError={null}
        operationVerification="idle"
        operationAcknowledged={false}
        onAcknowledgeOperation={vi.fn()}
        onVerifyOperation={vi.fn()}
        onSubmit={onSubmit}
        pending={false}
      />,
    );

    expect(screen.getByLabelText("成交价 *")).toHaveValue("899");
    fireEvent.click(screen.getByRole("button", { name: "确认预订" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('[data-inventory-lifecycle-body="reservation"]'),
    ).toBeInTheDocument();
  });
});
