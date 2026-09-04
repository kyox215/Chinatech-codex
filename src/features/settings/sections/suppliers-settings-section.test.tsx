import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

import { SuppliersSettingsSection } from "@/features/settings/sections/suppliers-settings-section";
import type { Supplier } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

afterEach(cleanup);

const supplier: Supplier = {
  id: "supplier-1",
  name: "MOBILAX",
  short_name: "MOB",
  color: "#2563eb",
  contact_name: "Support",
  phone: "+39 0931 000000",
  email: "support@example.com",
  website: "https://example.com",
  notes: "Current store only",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("SuppliersSettingsSection", () => {
  it("validates the sheet draft before calling the save mutation", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSuppliers({ suppliers: [], onSave });

    fireEvent.click(screen.getByRole("button", { name: /添加供应商/ }));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "New Supplier" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "保存供应商" }));
    expect(await screen.findByText("请检查此字段")).toBeVisible();
    expect(screen.queryByText("供应商邮箱格式不正确")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "sales@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "保存供应商" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Supplier", email: "sales@example.com" }),
        undefined,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps quick contact actions in read-only mode without edit controls", () => {
    renderSuppliers({ canManage: false });

    expect(screen.getByRole("link", { name: "拨打 MOBILAX" })).toHaveAttribute(
      "href",
      "tel:+39 0931 000000",
    );
    expect(screen.getByRole("link", { name: "邮件联系 MOBILAX" })).toHaveAttribute(
      "href",
      "mailto:support@example.com",
    );
    expect(screen.getByRole("link", { name: "打开 MOBILAX 网站" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.queryByRole("button", { name: /编辑/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /归档/ })).not.toBeInTheDocument();
  });

  it("filters by contact data and confirms archive impact", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    renderSuppliers({ onArchive });
    fireEvent.change(screen.getByLabelText("搜索供应商"), { target: { value: "support@example" } });
    expect(screen.getByText("MOBILAX")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    const dialog = screen.getByRole("alertdialog", { name: "归档 MOBILAX？" });
    expect(dialog).toHaveTextContent("历史订单仍保留关联");
    expect(dialog).toHaveTextContent("当前没有恢复归档 API");
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
    await waitFor(() => expect(onArchive).toHaveBeenCalledWith("supplier-1"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("locks archive confirmation against duplicate requests and restores focus", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((nextResolve) => {
      resolve = nextResolve;
    });
    const onArchive = vi.fn().mockReturnValue(pending);
    renderSuppliers({ onArchive });

    const trigger = screen.getByRole("button", { name: "归档" });
    fireEvent.click(trigger);
    const confirm = screen.getByRole("button", { name: "确认归档" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "归档中…" })).toBeDisabled();
    await act(async () => resolve());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each([
    ["zh-CN" as const, "供应商（复数）", "编辑", "保存供应商"],
    ["it-IT" as const, "Fornitori", "Modifica", "Salva fornitore"],
    ["en" as const, "Suppliers", "Edit", "Save supplier"],
  ])(
    "localizes fixed controls in %s and preserves the exact update payload",
    async (locale, title, edit, save) => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderSuppliers({ onSave }, locale);
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: edit }));
      const name = screen.getByLabelText(
        locale === "it-IT" ? "Nome" : locale === "en" ? "Name" : "名称",
      );
      fireEvent.change(name, { target: { value: "MOBILAX Europa" } });
      fireEvent.click(screen.getByRole("button", { name: save }));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave).toHaveBeenCalledWith(
        {
          name: "MOBILAX Europa",
          short_name: "MOB",
          color: "#2563eb",
          contact_name: "Support",
          phone: "+39 0931 000000",
          email: "support@example.com",
          website: "https://example.com",
          notes: "Current store only",
        },
        "supplier-1",
      );
    },
  );

  it("takes the editor lock before awaiting and hides stale supplier PII on authority downgrade", async () => {
    let resolve!: () => void;
    const onSave = vi.fn().mockReturnValue(
      new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      }),
    );
    const view = renderSuppliers({ onSave }, "en");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "MOBILAX Europa" } });
    const save = screen.getByRole("button", { name: "Save supplier" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);

    view.rerender(suppliersTree({ canManage: false, onSave }, "en"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("MOBILAX Europa")).not.toBeInTheDocument();
    await act(async () => resolve());
  });
});

function suppliersTree(
  overrides: Partial<React.ComponentProps<typeof SuppliersSettingsSection>> = {},
  locale: AppLocale = "zh-CN",
) {
  const props: React.ComponentProps<typeof SuppliersSettingsSection> = {
    suppliers: [supplier],
    canRead: true,
    canManage: true,
    isLoading: false,
    isError: false,
    isSaving: false,
    onRetry: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onArchive: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return (
    <LocaleProvider initialLocale={locale}>
      <SuppliersSettingsSection {...props} />
    </LocaleProvider>
  );
}

function renderSuppliers(
  overrides: Partial<React.ComponentProps<typeof SuppliersSettingsSection>> = {},
  locale: AppLocale = "zh-CN",
) {
  return render(suppliersTree(overrides, locale));
}
