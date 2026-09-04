import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

describe("OrderTransitionReasonSelector i18n", () => {
  it.each([
    ["it-IT", "Annullato dal cliente"],
    ["en", "Customer cancelled"],
  ] as const)("localizes fixed copy in %s while emitting the canonical reason", (locale, label) => {
    const onChange = vi.fn();
    const { container } = render(
      <LocaleProvider initialLocale={locale}>
        <OrderTransitionReasonSelector target="cancelled" value="" onChange={onChange} />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

    expect(onChange).toHaveBeenCalledWith("客户主动取消本次维修。");
    expect(container.textContent).not.toMatch(/[一-龥]/);
  });
});
