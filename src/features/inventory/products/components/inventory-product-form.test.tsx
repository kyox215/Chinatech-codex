import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  InventoryProductFormDetails,
  type InventoryProductFormDetailsProps,
} from "./inventory-product-form";
import { createInventoryProductFormDraft } from "../model/inventory-product-form";

function renderDetails(overrides: Partial<InventoryProductFormDetailsProps> = {}) {
  const props: InventoryProductFormDetailsProps = {
    draft: createInventoryProductFormDraft("phone"),
    identifierSection: null,
    onConditionChange: vi.fn(),
    onGtinChange: vi.fn(),
    onSpecificationChange: vi.fn(),
    onListPriceChange: vi.fn(),
    onCostChange: vi.fn(),
    onLocationChange: vi.fn(),
    onWarrantyChange: vi.fn(),
    onNotesChange: vi.fn(),
    ...overrides,
  };
  return render(<InventoryProductFormDetails {...props} />);
}

describe("InventoryProductFormDetails", () => {
  it("keeps invalid field feedback linked and uses the accessible danger token", () => {
    renderDetails({ conditionInvalid: true });
    fireEvent.click(screen.getByRole("button", { name: /更多信息/ }));

    const field = screen.getByLabelText("成色");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-describedby", "product-condition-error");
    expect(screen.getByText("请检查此字段")).toHaveClass("text-status-danger-foreground");
  });
});
