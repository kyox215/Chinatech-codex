import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orders } from "@/lib/mock/fixtures";
import { OrderFaultDescriptionEditor } from "./order-fault-description-editor";
vi.mock("@/hooks/use-mobile", () => ({ useViewportMode: () => "desktop" }));
const order = {
  ...orders[0]!,
  issue_description: "Original fault",
  diagnosis_result: "Original diagnosis",
  updated_at: "2026-09-05T10:00:00Z",
};
const props = {
  open: true,
  order,
  canEditIntake: true,
  canEditRepair: true,
  pending: false,
  onOpenChange: vi.fn(),
  onSave: vi.fn(),
  onReload: vi.fn(),
  getErrorMessage: () => "Save failed",
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  props.onSave.mockResolvedValue(undefined);
});
const fields = () => screen.getAllByRole("textbox");
describe("fault editor draft and conditional-write contract", () => {
  it("clears diagnosis explicitly and sends the opening baseline", async () => {
    const user = userEvent.setup();
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.clear(fields()[1]!);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(props.onSave).toHaveBeenCalledWith({
      changes: { diagnosis_result: "" },
      expectedUpdatedAt: order.updated_at,
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
  it("retains dirty text on remote refresh and requires an explicit reload", async () => {
    const user = userEvent.setup();
    const result = render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    const fresh = { ...order, issue_description: "Remote", updated_at: "2026-09-05T11:00:00Z" };
    result.rerender(<OrderFaultDescriptionEditor {...props} order={fresh} />);
    expect(fields()[0]).toHaveValue("Original fault draft");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    props.onReload.mockResolvedValue(fresh);
    await user.click(screen.getByRole("button", { name: "载入最新版本" }));
    await user.click(screen.getByRole("button", { name: "放弃草稿并载入" }));
    await waitFor(() => expect(fields()[0]).toHaveValue("Remote"));
  });
  it("keeps failed drafts and excludes readonly intake from payload", async () => {
    const user = userEvent.setup();
    props.onSave.mockRejectedValue(new Error("offline"));
    render(<OrderFaultDescriptionEditor {...props} canEditIntake={false} />);
    expect(fields()[0]).toHaveAttribute("readonly");
    await user.clear(fields()[1]!);
    await user.type(fields()[1]!, "New diagnosis");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(props.onSave).toHaveBeenCalledWith({
      changes: { diagnosis_result: "New diagnosis" },
      expectedUpdatedAt: order.updated_at,
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(fields()[1]).toHaveValue("New diagnosis");
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it("guards pending Escape/X and duplicate submissions", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    props.onSave.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await user.keyboard("{Escape}");
    const closeX = screen
      .getAllByRole("button", { name: "取消" })
      .find((button) => button.querySelector("svg.lucide-x"));
    expect(closeX).toBeDefined();
    await user.click(closeX!);
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(fields()[0]).toBeDisabled();
    resolve();
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
  });
  it("asks before dirty cancel and preserves draft when declined", async () => {
    const user = userEvent.setup();
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(fields()[0]).toHaveValue("Original fault draft");
  });
  it("refreshes a pristine draft and disables unchanged save", () => {
    const result = render(<OrderFaultDescriptionEditor {...props} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    result.rerender(
      <OrderFaultDescriptionEditor
        {...props}
        order={{ ...order, issue_description: "New", updated_at: "new" }}
      />,
    );
    expect(fields()[0]).toHaveValue("New");
  });
  it("saves only intake changes with repair readonly and rejects blank faults", async () => {
    const user = userEvent.setup();
    render(<OrderFaultDescriptionEditor {...props} canEditRepair={false} />);
    expect(fields()[1]).toHaveAttribute("readonly");
    await user.clear(fields()[0]!);
    await user.type(fields()[0]!, "   ");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeVisible();
    await user.clear(fields()[0]!);
    await user.type(fields()[0]!, "  Fixed fault  ");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(props.onSave).toHaveBeenCalledWith({
      changes: { issue_description: "Fixed fault" },
      expectedUpdatedAt: order.updated_at,
    });
  });
  it("cannot submit with neither field permission", () => {
    render(<OrderFaultDescriptionEditor {...props} canEditIntake={false} canEditRepair={false} />);
    fields().forEach((field) => expect(field).toHaveAttribute("readonly"));
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(props.onSave).not.toHaveBeenCalled();
  });
  it("keeps a retryable draft for HTTP 500 even when its message matches the legacy conflict", async () => {
    const user = userEvent.setup();
    props.onSave.mockRejectedValue(
      Object.assign(new Error("工单已被更新，请刷新后再试"), { status: 500 }),
    );
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.queryByRole("button", { name: "载入最新版本" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    expect(fields()[0]).toHaveValue("Original fault draft");
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it.each([
    { status: 409 },
    Object.assign(new Error("工单已被更新，请刷新后再试"), { status: 400 }),
  ])("keeps server conflict %j and draft after confirmed reload failure", async (cause) => {
    const user = userEvent.setup();
    props.onSave.mockRejectedValue(cause);
    props.onReload.mockRejectedValue(new Error("offline"));
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeDisabled());
    await user.click(screen.getByRole("button", { name: "载入最新版本" }));
    await user.click(screen.getByRole("button", { name: "放弃草稿并载入" }));
    await waitFor(() => expect(props.onReload).toHaveBeenCalledOnce());
    expect(fields()[0]).toHaveValue("Original fault draft");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
});

describe("editor presentation states and inline confirmation", () => {
  it("shows whitespace-only state, independent descriptions and no normalized submit", async () => {
    const user = userEvent.setup();
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, "   ");
    expect(screen.getByText("只有空白变化，无需保存")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(fields()[0]!.getAttribute("aria-describedby")).not.toBe(
      fields()[1]!.getAttribute("aria-describedby"),
    );
  });
  it("returns from confirmation with Escape/X and discards only once on explicit action", async () => {
    const user = userEvent.setup();
    render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    await user.keyboard("{Escape}");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(fields()[0]).toHaveValue("Original fault draft");
    await user.keyboard("{Escape}");
    await user.click(
      screen
        .getAllByRole("button", { name: "取消" })
        .find((button) => button.querySelector("svg.lucide-x"))!,
    );
    expect(fields()[0]).toHaveValue("Original fault draft");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "放弃修改" }));
    expect(props.onOpenChange).toHaveBeenCalledTimes(1);
  });
  it("preserves the draft and conflict after a failed confirmed reload", async () => {
    const user = userEvent.setup();
    const result = render(<OrderFaultDescriptionEditor {...props} />);
    await user.type(fields()[0]!, " draft");
    result.rerender(
      <OrderFaultDescriptionEditor {...props} order={{ ...order, updated_at: "remote" }} />,
    );
    props.onReload.mockRejectedValue(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "载入最新版本" }));
    await user.click(screen.getByRole("button", { name: "放弃草稿并载入" }));
    await waitFor(() => expect(fields()[0]).toHaveValue("Original fault draft"));
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "载入最新版本" })).toBeVisible();
    expect(screen.getByText("载入失败，当前修改仍保留。请重试。")).toBeVisible();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
});
