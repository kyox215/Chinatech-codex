import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { orders } from "@/lib/mock/fixtures";
import type { OrderDetail } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { NotifyDialog } from "./notify-dialog";

const locales = ["zh-CN", "it-IT", "en"] as const;
const exactBody = "  动态中文正文\n保留尾部空格  ";
const identity: StoreOutputIdentity = {
  storeName: "动态中文门店",
  storeAddress: "Via dinamica 1",
  contactLine: "WhatsApp +393335719865",
  messageSignature: "动态签名",
  printFooter: "动态页脚",
  publicBaseUrl: "https://example.invalid",
  canOutput: true,
  missingFields: [],
  warnings: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NotifyDialog i18n", () => {
  it("localizes chrome while preserving baseline body normalization and canonical recipient", async () => {
    const calls: Array<Record<string, unknown>> = [];

    for (const locale of locales) {
      vi.spyOn(window, "open").mockReturnValue({} as Window);
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const view = renderNotify(locale, onConfirm);

      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "orders2b2.notify.title"),
        }),
      ).toBeVisible();
      fireEvent.change(screen.getByLabelText(translateMessage(locale, "orders2b2.notify.body")), {
        target: { value: exactBody },
      });
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.notify.open") }),
      );
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(exactBody.trim())),
        "_blank",
        "noopener,noreferrer",
      );
      expect(
        await screen.findByText(translateMessage(locale, "orders2b2.notify.opened")),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.notify.confirm") }),
      );

      await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
      const input = structuredClone(onConfirm.mock.calls[0]?.[0]) as Record<string, unknown>;
      expect(input).toMatchObject({
        body: exactBody.trim(),
        recipientPhone: "+393335719865",
        templateKind: "repair_status",
      });
      expect(input.idempotencyKey).toEqual(expect.any(String));
      delete input.idempotencyKey;
      calls.push(input);
      view.unmount();
      vi.restoreAllMocks();
    }

    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toEqual(calls[0]);
  });

  it("reuses the same confirmation id after a safe failed submission", async () => {
    vi.spyOn(window, "open").mockReturnValue({} as Window);
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error("WHATSAPP_SECRET_SENTINEL"))
      .mockResolvedValueOnce(undefined);
    renderNotify("en", onConfirm);

    fireEvent.change(screen.getByLabelText(translateMessage("en", "orders2b2.notify.body")), {
      target: { value: exactBody },
    });
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("en", "orders2b2.notify.open") }),
    );
    const confirm = await screen.findByRole("button", {
      name: translateMessage("en", "orders2b2.notify.confirm"),
    });
    fireEvent.click(confirm);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      translateMessage("en", "orders2b2.error.generic", {
        operation: translateMessage("en", "orders2b2.operation.notification"),
      }),
    );
    expect(screen.queryByText("WHATSAPP_SECRET_SENTINEL")).not.toBeInTheDocument();
    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(onConfirm.mock.calls[1]?.[0]).toEqual(onConfirm.mock.calls[0]?.[0]);
  });
});

function renderNotify(
  locale: (typeof locales)[number],
  onConfirm: (input: Record<string, unknown>) => Promise<unknown>,
) {
  const order = {
    ...orders[0]!,
    status: "repairing",
    customer_name: "动态中文客户",
    customer_name_snapshot: "动态中文客户",
    customer_phone: "+393335719865",
    contact_phones: ["+393335719865"],
    device_label: "动态中文设备",
  } as unknown as OrderDetail["order"];
  const data = {
    order,
    events: [],
    messages: [],
    attachments: [],
  } satisfies OrderDetail;

  return render(
    <LocaleProvider initialLocale={locale}>
      <NotifyDialog
        open
        onOpenChange={vi.fn()}
        data={data}
        orderUrl="https://example.invalid/order/R2026001"
        storeIdentity={identity}
        canReadStoreSettings
        canUpdateStoreSettings
        busy={false}
        onConfirm={onConfirm}
      />
    </LocaleProvider>,
  );
}
