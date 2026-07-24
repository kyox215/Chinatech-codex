import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getPrintContentFit, PrintPortal } from "./print-portal";

afterEach(() => {
  cleanup();
  document.body.className = "";
  document.head
    .querySelectorAll("style#repairdesk-print-paper-page")
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
    expect(document.head.querySelector("style#repairdesk-print-paper-page")?.textContent).toContain(
      "size: A5 landscape",
    );
  });

  it("injects A4 portrait page CSS for order half-page printing", () => {
    const view = render(
      <PrintPortal paperMode="a4-portrait-half">
        <section>Half page order</section>
      </PrintPortal>,
    );

    const style = document.head.querySelector("style#repairdesk-print-paper-page");

    expect(screen.getByText("Half page order")).toBeInTheDocument();
    expect(document.body).toHaveClass("has-repair-print-a4-portrait-half");
    expect(style?.textContent).toContain("size: A4 portrait");

    view.unmount();

    expect(document.body).not.toHaveClass("has-repair-print-a4-portrait-half");
    expect(document.head.querySelector("style#repairdesk-print-paper-page")).toBeNull();
  });

  it("uses bounded whole-ticket scaling and rejects unreadable overflow", () => {
    expect(getPrintContentFit(900)).toEqual({ scale: 1, overflow: false });
    expect(getPrintContentFit(1_500)).toEqual({ scale: 0.8, overflow: false });
    expect(getPrintContentFit(2_000)).toEqual({ scale: 0.72, overflow: false });
    expect(getPrintContentFit(2_500)).toEqual({ scale: 0.72, overflow: true });
  });
});
