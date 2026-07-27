import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoEditorOverlay } from "./memo-editor-overlay";

describe("MemoEditorOverlay", () => {
  it("gives the compact sheet a constrained scrolling layout", () => {
    render(
      <MemoEditorOverlay compact open title="新建备忘" onOpenChange={vi.fn()}>
        <form className="min-h-0 flex-1 overflow-y-auto">表单</form>
      </MemoEditorOverlay>,
    );

    expect(screen.getByRole("dialog")).toHaveClass("flex", "flex-col", "overflow-hidden");
    expect(screen.getByText("记录本店铺事项，或安排一项待办工作。")).toBeVisible();
  });
});
