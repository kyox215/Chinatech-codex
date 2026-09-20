import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toaster } from "./sonner";

const sonnerMocks = vi.hoisted(() => ({ props: vi.fn() }));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    sonnerMocks.props(props);
    return <div data-testid="sonner" />;
  },
}));

describe("Toaster defaults", () => {
  it("keeps one short, dismissible toast inside the mobile top safe area", () => {
    render(<Toaster />);

    expect(sonnerMocks.props).toHaveBeenCalledWith(
      expect.objectContaining({
        position: "top-center",
        duration: 2_500,
        visibleToasts: 1,
        closeButton: true,
        offset: { top: 16 },
        mobileOffset: {
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: 12,
          right: 12,
        },
      }),
    );
  });
});
