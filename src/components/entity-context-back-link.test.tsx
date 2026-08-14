import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityContextBackLink } from "./entity-context-back-link";

describe("EntityContextBackLink", () => {
  it("is an icon-only deterministic link with a destination label and focus contract", () => {
    render(
      <EntityContextBackLink
        context={{ href: "/inventory", label: "返回商品库存", kind: "inventory" }}
      />,
    );

    const link = screen.getByRole("link", { name: "返回商品库存" });
    expect(link).toHaveAttribute("href", "/inventory");
    expect(link).toHaveAttribute("data-entity-context-back", "inventory");
    expect(link).toHaveClass("size-11", "focus-visible:ring-2");
    expect(link).not.toHaveTextContent("商品");
  });
});
