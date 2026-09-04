import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { CustomerDeviceDialog } from "@/features/customers/forms/customer-device-dialog";
import { CustomerEditDialog } from "@/features/customers/forms/customer-edit-dialog";
import { CustomerFollowupDialog } from "@/features/customers/forms/customer-followup-dialog";
import {
  CustomerMessageDialog,
  buildCustomerMessage,
} from "@/features/customers/forms/customer-message-dialog";
import { CustomerTagsDialog } from "@/features/customers/forms/customer-tags-dialog";
import { getCustomerDetail as getMockCustomerDetail } from "@/features/customers/testing/mock-api";
import { customers } from "@/lib/mock/state";
import type { CustomerDetail } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

let data: CustomerDetail;
const identity = resolveStoreOutputIdentity({
  activeStore: { id: "store-dynamic", name: "动态门店 Ω" },
  settings: {
    store_id: "store-dynamic",
    store_name: "动态门店 Ω",
    store_address: "动态地址 Ω",
    store_phone: "+390100000000",
    message_signature: "动态签名 Ω",
    print_footer: "动态页脚 Ω",
  },
});

beforeAll(async () => {
  const base = await getMockCustomerDetail(customers[0].id);
  data = {
    ...base,
    customer: {
      ...base.customer,
      name: "动态客户 Ω",
      phone_e164: "+393330001122",
      notes: "动态客户备注 Ω",
    },
    tags: [...base.tags, { id: "tag-dynamic", name: "动态标签 Ω", color: "#123456" }],
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function localized(locale: "zh-CN" | "it-IT" | "en", children: React.ReactNode) {
  return render(<LocaleProvider initialLocale={locale}>{children}</LocaleProvider>);
}

function FollowupFocusHarness({ validOpener }: { validOpener: boolean }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const disconnectedRef = useRef<HTMLElement | null>(document.createElement("button"));
  return (
    <LocaleProvider initialLocale="it-IT">
      <button ref={openerRef} onClick={() => setOpen(true)}>
        Open follow-up
      </button>
      <CustomerFollowupDialog
        open={open}
        onOpenChange={setOpen}
        busy={false}
        orders={data.orders}
        returnFocusRef={validOpener ? openerRef : disconnectedRef}
        onSave={vi.fn()}
      />
    </LocaleProvider>
  );
}

function DeviceFocusHarness({ validOpener }: { validOpener: boolean }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const disconnectedRef = useRef<HTMLElement | null>(document.createElement("button"));
  return (
    <LocaleProvider initialLocale="en">
      <button ref={openerRef} onClick={() => setOpen(true)}>
        Open device editor
      </button>
      <CustomerDeviceDialog
        open={open}
        onOpenChange={setOpen}
        device={data.devices[0]}
        busy={false}
        returnFocusRef={validOpener ? openerRef : disconnectedRef}
        onSave={vi.fn()}
      />
    </LocaleProvider>
  );
}

describe("customer detail dialog runtime i18n", () => {
  it("restores device dialog focus exactly once to its connected visible opener", async () => {
    render(<DeviceFocusHarness validOpener />);
    const opener = screen.getByRole("button", { name: "Open device editor" });
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const focus = vi.spyOn(opener as HTMLButtonElement, "focus");

    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(opener).toHaveFocus();
  });

  it("does not override Radix focus behavior for a disconnected device opener", async () => {
    render(<DeviceFocusHarness validOpener={false} />);
    const opener = screen.getByRole("button", { name: "Open device editor" });
    const focus = vi.spyOn(opener as HTMLButtonElement, "focus");

    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(focus).not.toHaveBeenCalledWith({ preventScroll: true });
  });

  it("restores focus exactly to a connected visible follow-up opener", async () => {
    render(<FollowupFocusHarness validOpener />);
    const opener = screen.getByRole("button", { name: "Open follow-up" });
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const focus = vi.spyOn(opener as HTMLButtonElement, "focus");

    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(opener).toHaveFocus();
  });

  it("leaves Radix default close focus behavior intact for an invalid opener", async () => {
    render(<FollowupFocusHarness validOpener={false} />);
    const opener = screen.getByRole("button", { name: "Open follow-up" });
    const focus = vi.spyOn(opener as HTMLButtonElement, "focus");

    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(focus).not.toHaveBeenCalledWith({ preventScroll: true });
  });

  it("keeps edit, device, and follow-up drafts open and canonical after rejected saves", async () => {
    const captured: unknown[] = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const editSave = vi.fn((input) => {
        captured.push(["edit", input]);
        return Promise.reject(new Error("RAW-EDIT-SENTINEL"));
      });
      let view = localized(
        locale,
        <CustomerEditDialog
          open
          onOpenChange={vi.fn()}
          data={data}
          busy={false}
          onSave={editSave}
        />,
      );
      expect(screen.getByDisplayValue("动态客户 Ω")).toHaveClass("text-base");
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "customers.detail.close") }),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.form.save") }),
      );
      await waitFor(() => expect(editSave).toHaveBeenCalledOnce());
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(screen.getByDisplayValue("动态客户 Ω")).toBeVisible();
      view.unmount();

      const deviceSave = vi.fn((input) => {
        captured.push(["device", input]);
        return Promise.reject(new Error("RAW-DEVICE-SENTINEL"));
      });
      view = localized(
        locale,
        <CustomerDeviceDialog open onOpenChange={vi.fn()} busy={false} onSave={deviceSave} />,
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "customers.form.brand"), { exact: false }),
        {
          target: { value: "华为 Dynamic Ω" },
        },
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "customers.form.model"), { exact: false }),
        {
          target: { value: "Mate 自定义 Ω" },
        },
      );
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.form.saveDevice") }),
      );
      await waitFor(() => expect(deviceSave).toHaveBeenCalledOnce());
      expect(screen.getByRole("dialog")).toBeVisible();
      view.unmount();

      const followupSave = vi.fn((input) => {
        captured.push(["followup", { ...input, due_at: "<timestamp>" }]);
        return Promise.reject(new Error("RAW-FOLLOWUP-SENTINEL"));
      });
      view = localized(
        locale,
        <CustomerFollowupDialog
          open
          onOpenChange={vi.fn()}
          busy={false}
          orders={data.orders}
          onSave={followupSave}
        />,
      );
      expect(screen.getByDisplayValue("维修后联系客户")).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "customers.form.createFollowup"),
        }),
      );
      await waitFor(() => expect(followupSave).toHaveBeenCalledOnce());
      expect(followupSave.mock.calls[0][0].title).toBe("维修后联系客户");
      expect(screen.getByRole("dialog")).toBeVisible();
      view.unmount();
    }

    const byLocale = [captured.slice(0, 3), captured.slice(3, 6), captured.slice(6, 9)];
    expect(byLocale[1]).toEqual(byLocale[0]);
    expect(byLocale[2]).toEqual(byLocale[0]);
  });

  it("preserves server tags and selected IDs while localizing only missing stable defaults", async () => {
    const captured: string[][] = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const onSave = vi.fn((ids: string[]) => {
        captured.push(ids);
        return Promise.reject(new Error("RAW-TAGS-SENTINEL"));
      });
      const view = localized(
        locale,
        <CustomerTagsDialog open onOpenChange={vi.fn()} data={data} busy={false} onSave={onSave} />,
      );
      expect(screen.getByText("动态标签 Ω")).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "customers.form.tagBusiness")),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.form.saveTags") }),
      );
      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      expect(screen.getByRole("dialog")).toBeVisible();
      view.unmount();
    }
    expect(captured[1]).toEqual(captured[0]);
    expect(captured[2]).toEqual(captured[0]);
    expect(captured[0]).toEqual(data.tags.map((tag) => tag.id));
  });

  it("keeps message body, recipient, and trim behavior locale-invariant after rejection", async () => {
    const captured: unknown[] = [];
    const expectedBody = buildCustomerMessage(data, "https://example.invalid", identity);
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const onConfirm = vi.fn((input) => {
        captured.push(input);
        return Promise.reject(new Error("RAW-MESSAGE-SENTINEL"));
      });
      const openedWindow = { opener: window } as Window;
      vi.spyOn(window, "open").mockReturnValue(openedWindow);
      const view = localized(
        locale,
        <CustomerMessageDialog
          open
          onOpenChange={vi.fn()}
          data={data}
          appOrigin="https://example.invalid"
          storeIdentity={identity}
          canReadStoreSettings
          canUpdateStoreSettings
          busy={false}
          onConfirm={onConfirm}
        />,
      );
      const body = screen.getByRole("textbox", {
        name: translateMessage(locale, "customers.message.bodyLabel"),
      });
      expect(body).toHaveValue(expectedBody);
      fireEvent.change(body, { target: { value: `  ${expectedBody}  ` } });
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(`${translateMessage(locale, "customers.message.open")} WhatsApp`),
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.message.confirm") }),
      );
      await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(body).toHaveValue(`  ${expectedBody}  `);
      view.unmount();
      vi.restoreAllMocks();
    }
    expect(captured[1]).toEqual(captured[0]);
    expect(captured[2]).toEqual(captured[0]);
    expect(captured[0]).toEqual({
      channel: "whatsapp",
      body: expectedBody,
      recipient_phone: "+393330001122",
    });
  });
});
