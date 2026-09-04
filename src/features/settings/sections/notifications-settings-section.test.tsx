import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { NotificationsSettingsSection } from "@/features/settings/sections/notifications-settings-section";
import type { ActorStoreMembership, StoreSettings } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

afterEach(cleanup);

const store: ActorStoreMembership = {
  id: "store-a",
  membershipId: "membership-a",
  name: "Repair Lab",
  slug: "repair-lab",
  role: "owner",
  status: "active",
};

const completeSettings: StoreSettings = {
  id: "settings-a",
  store_id: "store-a",
  store_name: "Repair Lab",
  store_address: "Via Roma 12, Siracusa",
  store_phone: "+39 000 000000",
  store_whatsapp: "",
  store_email: "repair@example.test",
  default_order_warranty_text: "6个月",
  default_order_warranty_months: 6,
  default_inventory_warranty_months: 12,
  print_footer: "Grazie per aver scelto Repair Lab.",
  message_signature: "Repair Lab · Assistenza",
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
};

describe("NotificationsSettingsSection", () => {
  it("edits only notification fields and links to the real template workspace", () => {
    const onDraftChange = vi.fn();
    renderNotifications({ onDraftChange });

    fireEvent.change(screen.getByLabelText("客户消息签名"), {
      target: { value: "Pending signature" },
    });
    fireEvent.change(screen.getByLabelText("打印页脚"), {
      target: { value: "Pending footer" },
    });

    expect(onDraftChange).toHaveBeenNthCalledWith(1, {
      message_signature: "Pending signature",
    });
    expect(onDraftChange).toHaveBeenNthCalledWith(2, { print_footer: "Pending footer" });
    expect(screen.getByRole("link", { name: /打开消息模板/ })).toHaveAttribute("href", "/messages");
    expect(screen.queryByRole("button", { name: /测试|发送/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预览客户消息" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "预览打印资料" })).toHaveClass("min-h-11");
  });

  it("uses semantic read-only values and removes the template link without read capability", () => {
    const { container } = renderNotifications({
      canUpdateSettings: false,
      canReadMessageTemplates: false,
    });
    const details = container.querySelector("dl");

    expect(details).not.toBeNull();
    expect(within(details as HTMLElement).getByText("客户消息签名").tagName).toBe("DT");
    expect(within(details as HTMLElement).getByText("Repair Lab · Assistenza").tagName).toBe("DD");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /打开消息模板/ })).not.toBeInTheDocument();
    expect(screen.getByText("当前账号无模板读取权限")).toBeVisible();
  });

  it("keeps saved output blocked while showing the current-section draft projection", () => {
    const saved = { ...completeSettings, store_address: "" };
    renderNotifications({ saved, draftSettings: completeSettings, isDraftDirty: true });

    expect(screen.getByText("客户输出当前保持关闭")).toBeVisible();
    expect(screen.getByText(/当前客户输出仍然阻断；保存这份草稿后预计解除阻断/)).toBeVisible();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("未保存草稿 · 客户消息")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "预览客户消息" }));
    const previewDialog = screen.getByRole("dialog", { name: "未保存草稿 · 客户消息" });
    expect(previewDialog).toBeVisible();
    expect(previewDialog).toHaveTextContent("Gentile Mario Rossi");
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByRole("link", { name: "补充店铺资料" })).toHaveAttribute(
      "href",
      "/settings?section=store",
    );
    expect(screen.queryByText("当前已就绪")).not.toBeInTheDocument();
  });

  it.each([
    ["zh-CN", "预览客户消息", "预览打印资料"],
    ["it-IT", "Anteprima messaggio cliente", "Anteprima dati di stampa"],
    ["en", "Preview customer message", "Preview print output"],
  ] as const)(
    "keeps canonical customer output byte-identical in %s",
    (locale, messageAction, printAction) => {
      const messagePreview =
        "Gentile Mario Rossi,\nIl dispositivo iPhone 15 è pronto.\nRepair Lab · Assistenza";
      const printPreview = "Repair Lab\nVia Roma 12, Siracusa\nGrazie per aver scelto Repair Lab.";
      renderNotifications({ locale, messagePreview, printPreview });

      expect(screen.getByDisplayValue(completeSettings.message_signature)).toHaveValue(
        completeSettings.message_signature,
      );
      expect(screen.getByDisplayValue(completeSettings.print_footer)).toHaveValue(
        completeSettings.print_footer,
      );
      expect(screen.getByRole("link")).toHaveAttribute("href", "/messages");
      fireEvent.click(screen.getByRole("button", { name: messageAction }));
      expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(messagePreview);
      fireEvent.click(screen.getByRole("button", { name: /关闭|Chiudi|Close/ }));
      fireEvent.click(screen.getByRole("button", { name: printAction }));
      expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(printPreview);
    },
  );
});

function renderNotifications({
  saved = completeSettings,
  draftSettings = completeSettings,
  isDraftDirty = false,
  canUpdateSettings = true,
  canReadMessageTemplates = true,
  onDraftChange = vi.fn(),
  locale = "zh-CN",
  messagePreview = "Gentile Mario Rossi,\nexample preview",
  printPreview = "Repair Lab\nexample footer",
}: {
  saved?: StoreSettings;
  draftSettings?: StoreSettings;
  isDraftDirty?: boolean;
  canUpdateSettings?: boolean;
  canReadMessageTemplates?: boolean;
  onDraftChange?: (patch: { message_signature?: string; print_footer?: string }) => void;
  locale?: AppLocale;
  messagePreview?: string;
  printPreview?: string;
} = {}) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <NotificationsSettingsSection
        draft={{
          message_signature: draftSettings.message_signature,
          print_footer: draftSettings.print_footer,
        }}
        savedOutputIdentity={resolveStoreOutputIdentity({ activeStore: store, settings: saved })}
        draftOutputIdentity={resolveStoreOutputIdentity({
          activeStore: store,
          settings: draftSettings,
        })}
        isDraftDirty={isDraftDirty}
        canUpdateSettings={canUpdateSettings}
        canReadMessageTemplates={canReadMessageTemplates}
        fieldErrors={{}}
        messagePreview={messagePreview}
        printPreview={printPreview}
        onDraftChange={onDraftChange}
      />
    </LocaleProvider>,
  );
}
