import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { OrderListViewMode } from "./order-list-view-mode";

afterEach(cleanup);

describe("OrderListViewMode disclosure", () => {
  it("changes the real data scope and restores focus to the current scope trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OrderListViewMode disclosure value="active" canBrowseArchive onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /订单显示范围/ });
    await user.click(trigger);
    const choices = screen.getByRole("group", { name: "订单显示范围" });
    expect(within(choices).getAllByRole("button")).toHaveLength(3);
    await user.click(within(choices).getByRole("button", { name: "已归档" }));
    expect(onChange).toHaveBeenCalledWith("archive");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not expose archive or all-record browsing without its permission", async () => {
    render(
      <OrderListViewMode disclosure value="active" canBrowseArchive={false} onChange={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /订单显示范围/ }));
    expect(
      within(screen.getByRole("group", { name: "订单显示范围" })).getAllByRole("button"),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "已归档" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全部" })).not.toBeInTheDocument();
  });

  it.each([
    ["it-IT", "Intervallo ordini"],
    ["en", "Order display range"],
  ] as const)("keeps scope options localized in %s", async (locale, label) => {
    render(
      <LocaleProvider initialLocale={locale}>
        <OrderListViewMode disclosure value="all" canBrowseArchive onChange={vi.fn()} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
    expect(screen.getByRole("dialog", { name: label })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: label })).getAllByRole("button")).toHaveLength(
      3,
    );
    expect(screen.getByRole("dialog")).not.toHaveTextContent("选择要查看");
  });
});
