import { describe, expect, it, vi } from "vitest";

import {
  initializeSignatureBitmap,
  SIGNATURE_BACKGROUND_COLOR,
  SIGNATURE_INK_COLOR,
} from "@/shared/ui/signature-pad";

describe("signature bitmap evidence", () => {
  it("uses a theme-independent dark ink on an opaque white bitmap", () => {
    const context = {
      fillStyle: "transparent",
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
    };

    initializeSignatureBitmap(context, 780, 352);

    expect(SIGNATURE_BACKGROUND_COLOR).toBe("#ffffff");
    expect(SIGNATURE_INK_COLOR).toBe("#111827");
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 780, 352);
    expect(context.fillStyle).toBe(SIGNATURE_BACKGROUND_COLOR);
  });
});
