import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PrintPortal } from "./print-portal";

afterEach(() => {
  cleanup();
  document.body.className = "";
  document.head
    .querySelectorAll("style#repairdesk-print-a4-portrait-half-page")
    .forEach((node) => node.remove());
});

describe("PrintPortal", () => {
  it("mounts printable content in the document body", () => {
    render(
      <PrintPortal>
        <section>Printable order</section>
      </PrintPortal>,
    );

    expect(screen.getByText("Printable order")).toBeInTheDocument();
    expect(document.body).toHaveClass("has-repair-print");
    expect(document.body).toHaveClass("has-repair-print-a5-landscape");
  });

  it("injects A4 portrait page CSS for order half-page printing", () => {
    const view = render(
      <PrintPortal paperMode="a4-portrait-half">
        <section>Half page order</section>
      </PrintPortal>,
    );

    const style = document.head.querySelector("style#repairdesk-print-a4-portrait-half-page");

    expect(screen.getByText("Half page order")).toBeInTheDocument();
    expect(document.body).toHaveClass("has-repair-print-a4-portrait-half");
    expect(style?.textContent).toContain("size: A4 portrait");

    view.unmount();

    expect(document.body).not.toHaveClass("has-repair-print-a4-portrait-half");
    expect(document.head.querySelector("style#repairdesk-print-a4-portrait-half-page")).toBeNull();
  });
});
