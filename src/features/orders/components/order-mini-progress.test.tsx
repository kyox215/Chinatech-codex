import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";

import { OrderMiniProgress } from "./order-mini-progress";

afterEach(cleanup);

describe("OrderMiniProgress", () => {
  it("renders five unlabeled segments while exposing the current workflow", () => {
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
    expect(screen.queryByText("Repair")).not.toBeInTheDocument();
    expect(screen.queryByText("Finish repair")).not.toBeInTheDocument();
  });

  it("announces terminal state without adding visible labels or numbers", () => {
    render(
      <LocaleProvider initialLocale="en">
        <OrderMiniProgress workflowStatus="closed" currentLabel="Cancelled" isTerminal />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("img", { name: "Current workflow: Cancelled; order is closed" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("[data-order-mini-progress-segment]").length).toBe(5);
  });
});
