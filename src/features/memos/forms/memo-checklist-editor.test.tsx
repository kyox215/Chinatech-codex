import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoChecklistEditor } from "./memo-checklist-editor";

describe("MemoChecklistEditor", () => {
  it("creates one item per nonblank pasted line and never silently truncates overflow", () => {
    const onChange = vi.fn();
    const onValidationError = vi.fn();
    const view = render(
      <MemoChecklistEditor items={[]} onChange={onChange} onValidationError={onValidationError} />,
    );
    const input = screen.getByPlaceholderText("添加清单项");
    fireEvent.paste(input, {
      clipboardData: { getData: () => "Open\n\nCount till\nClose" },
    });
    expect(onChange.mock.calls[0][0].map((item: { text: string }) => item.text)).toEqual([
      "Open",
      "Count till",
      "Close",
    ]);

    view.rerender(
      <MemoChecklistEditor items={[]} onChange={onChange} onValidationError={onValidationError} />,
    );
    fireEvent.paste(screen.getByPlaceholderText("添加清单项"), {
      clipboardData: { getData: () => "A".repeat(201) },
    });
    expect(onValidationError).toHaveBeenCalledWith("每个清单项最多 200 个字符，本次内容未添加。");
    expect(screen.getByPlaceholderText("添加清单项")).toHaveValue("");
  });

  it("persists an existing clean checkbox immediately and reveals a matched completed row", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoChecklistEditor
        items={[
          { id: "a", text: "Pending", completed: false },
          { id: "b", text: "Matched stock count", completed: true },
        ]}
        immediateToggle
        search="stock"
        onChange={vi.fn()}
        onToggle={onToggle}
        onValidationError={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "切换清单项：Pending" }));
    expect(onToggle).toHaveBeenCalledWith({ id: "a", text: "Pending", completed: false }, true);
    expect(screen.getByDisplayValue("Matched stock count")).toBeVisible();
  });
});
