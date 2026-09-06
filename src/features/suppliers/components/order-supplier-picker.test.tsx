import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrderSupplierPicker } from "./order-supplier-picker";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { Supplier } from "@/lib/repairdesk/types";

afterEach(cleanup);
it("waits for supplier mutation success and retains the choice surface after failure", async () => {
  const supplier = { id: "s1", name: "Synthetic Supplier", color: "var(--primary)" } as Supplier;
  const onChange = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
  render(
    <LocaleProvider initialLocale="en">
      <OrderSupplierPicker suppliers={[supplier]} mode="sheet" onChange={onChange} />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button", { name: /Synthetic Supplier/ }));
  await screen.findByRole("alert");
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Synthetic Supplier/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onChange).toHaveBeenNthCalledWith(2, "s1");
});
