import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { OrderListPresentationSwitch } from "./order-list-presentation-switch";

afterEach(cleanup);
describe("OrderListPresentationSwitch", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "exposes three controlled presentation choices in %s",
    (locale) => {
      const onChange = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <OrderListPresentationSwitch value="cards" onChange={onChange} compact />
        </LocaleProvider>,
      );
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
      expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(buttons[2]);
      expect(onChange).toHaveBeenCalledWith("board");
      expect(buttons[2]).toHaveAttribute("aria-pressed", "false");
    },
  );
  it("blocks presentation changes during a list transition", () => {
    const onChange = vi.fn();
    render(<OrderListPresentationSwitch value="list" onChange={onChange} disabled />);
    screen.getAllByRole("button").forEach((button) => {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
