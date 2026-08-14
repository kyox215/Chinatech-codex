import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { InventoryConsequenceDialog } from "./inventory-consequence-dialog";

function DialogHarness({
  pending = false,
  initiallyOpen = false,
}: {
  pending?: boolean;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const onConfirm = vi.fn(() => setOpen(false));
  return (
    <div>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        打开确认
      </button>
      <InventoryConsequenceDialog
        open={open}
        title="放弃未保存的修改？"
        description="当前草稿还没有写入库存。"
        consequences={["已保存内容不会受影响。", "你可以继续编辑。"]}
        confirmLabel="确认离开"
        cancelLabel="继续编辑"
        tone="warning"
        pending={pending}
        onConfirm={onConfirm}
        onOpenChange={setOpen}
        returnFocusRef={triggerRef}
      />
    </div>
  );
}

describe("InventoryConsequenceDialog", () => {
  it("focuses the safe cancel action and restores the trigger after Escape", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "打开确认" });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps both actions at the mobile target size and confirms once", async () => {
    const user = userEvent.setup();
    render(<DialogHarness initiallyOpen />);
    const cancel = screen.getByRole("button", { name: "继续编辑" });
    const confirm = screen.getByRole("button", { name: "确认离开" });
    expect(cancel).toHaveClass("min-h-11");
    expect(confirm).toHaveClass("min-h-11");
    await user.click(confirm);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("blocks close while pending and exposes busy status", () => {
    render(<DialogHarness initiallyOpen pending />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "继续编辑" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "处理中…" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
