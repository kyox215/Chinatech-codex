import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";

import { OrderMiniProgress } from "./order-mini-progress";

afterEach(cleanup);

describe("OrderMiniProgress", () => {
  it("renders five segments with visible current and next labels", () => {
    render(
      <LocaleProvider initialLocale="en">
        <OrderMiniProgress
          workflowStatus="repair"
          currentLabel="Repair"
          nextAction="Finish repair"
        />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("img", { name: "Current workflow: Repair; next step: Finish repair" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("[data-order-mini-progress-segment]").length).toBe(5);
    expect(screen.getByText("Repair")).toBeVisible();
    expect(screen.getByText("→ Finish repair")).toBeVisible();
  });

  it("shows the terminal label without implying every repair stage was completed", () => {
    render(
      <LocaleProvider initialLocale="en">
        <OrderMiniProgress workflowStatus="closed" currentLabel="Cancelled" isTerminal />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("img", { name: "Current workflow: Cancelled; order is closed" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("[data-order-mini-progress-segment]").length).toBe(5);
    expect(screen.getByText("Cancelled")).toBeVisible();
    for (const segment of document.querySelectorAll("[data-order-mini-progress-segment]"))
      expect(segment).toHaveClass("bg-border");
    expect(document.querySelector("[data-order-progress-next]")).toBeNull();
  });
});
