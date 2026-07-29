import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoEditorOverlay } from "./memo-editor-overlay";

describe("MemoEditorOverlay", () => {
  it("gives the compact sheet a constrained scrolling layout", () => {
    render(
      <MemoEditorOverlay
        compact
        open
        title="新建备忘"
        description="快速写下，详情稍后补充"
        onOpenChange={vi.fn()}
      >
        <form className="min-h-0 flex-1 overflow-y-auto">表单</form>
      </MemoEditorOverlay>,
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "flex",
      "flex-col",
      "w-full",
      "min-w-0",
      "max-w-full",
      "overflow-x-hidden",
      "overflow-hidden",
      "bg-[var(--memo-quick-entry-surface)]",
      "rounded-t-[1.25rem]",
    );
    expect(screen.getByText("快速写下，详情稍后补充")).toBeVisible();
  });

  it("keeps the desktop dialog compact and viewport safe", () => {
    render(
      <MemoEditorOverlay
        compact={false}
        open
        title="新建备忘"
        description="快速写下，详情稍后补充"
        onOpenChange={vi.fn()}
      >
        <form>表单</form>
      </MemoEditorOverlay>,
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "w-[min(576px,calc(100vw-24px))]",
      "overflow-hidden",
      "bg-[var(--memo-quick-entry-surface)]",
      "rounded-[1rem]",
      "p-4",
    );
  });
});
