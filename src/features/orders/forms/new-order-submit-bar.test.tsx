import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewOrderSubmitBar } from "./new-order-submit-bar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NewOrderSubmitBar", () => {
  it("publishes its measured height so mobile content can scroll above it", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 390,
      height: 64,
      top: 780,
      right: 390,
      bottom: 844,
      left: 0,
      x: 0,
      y: 780,
      toJSON: () => undefined,
    });

    const { container } = render(
      <form data-new-order-form="true">
        <NewOrderSubmitBar valid pending={false} custodyStatus={null} />
      </form>,
    );

    const form = container.querySelector<HTMLElement>('[data-new-order-form="true"]');
    expect(form?.style.getPropertyValue("--new-order-submit-offset")).toBe("64px");
    expect(screen.getByRole("button", { name: "创建工单" })).toHaveClass("h-11", "min-h-11");
  });

  it("keeps incomplete status alongside one reachable create action", () => {
    render(
      <form data-new-order-form="true">
        <NewOrderSubmitBar
          valid={false}
          pending={false}
          custodyStatus={null}
          statusMessage="请补全必填字段"
          validationSummaryId="missing-fields"
        />
      </form>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("请补全必填字段");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const create = screen.getByRole("button", { name: "创建工单" });
    expect(create).toBeEnabled();
    expect(create).toHaveAttribute("aria-describedby", "missing-fields");
    expect(create).toHaveAttribute("type", "submit");
  });
});
