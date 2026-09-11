import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";
import type { NewOrderPrefill } from "@/features/orders/model/new-order-intent";

import { NewOrderDialog } from "./new-order-dialog";

vi.mock("@/components/navigation-guard-provider", () => ({
  useNavigationGuard: () => ({
    runGuardedTransition: ({ run }: { run: () => void }) => {
      run();
      return Promise.resolve({ status: "executed" });
    },
  }),
}));

vi.mock("@/features/orders/screens/new-order-screen", async () => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    NewOrderScreen: ({
      onCancel,
      onCreated,
    }: {
      onCancel: () => void;
      onCreated: (id: string) => void;
    }) => {
      const [draft, setDraft] = useState("");
      const [quote, setQuote] = useState("");
      const [deposit, setDeposit] = useState("");
      const [note, setNote] = useState("");
      return (
        <div data-testid="new-order-screen-stub">
          <input
            aria-label="synthetic draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <input
            aria-label="synthetic quote"
            value={quote}
            onChange={(event) => setQuote(event.target.value)}
          />
          <input
            aria-label="synthetic deposit"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
          />
          <input
            aria-label="synthetic note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button type="button" onClick={onCancel}>
            stub cancel
          </button>
          <button type="button" onClick={() => onCreated("order-1")}>
            stub created
          </button>
        </div>
      );
    },
  };
});

function renderDialog(locale: AppLocale, onOpenChange = vi.fn(), onCreated = vi.fn()) {
  render(
    <LocaleProvider initialLocale={locale}>
      <NewOrderDialog open sessionKey={1} onOpenChange={onOpenChange} onCreated={onCreated} />
    </LocaleProvider>,
  );
  return { onOpenChange, onCreated };
}

describe("NewOrderDialog i18n", () => {
  it("keeps a visible guarded close action while the localized screen is loading", () => {
    const { onOpenChange } = renderDialog("en");

    expect(screen.getByText(translateMessage("en", "orders2b1.new.dialogLoading"))).toHaveAttribute(
      "role",
      "status",
    );
    fireEvent.click(screen.getByRole("button", { name: translateMessage("en", "common.close") }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("returns focus to the current list entry when rotation replaced the original opener", async () => {
    function Harness({ compact }: { compact: boolean }) {
      const [open, setOpen] = useState(false);
      return (
        <LocaleProvider initialLocale="zh-CN">
          <button
            key={compact ? "compact" : "desktop"}
            data-order-list-new-button={compact ? undefined : "true"}
            aria-label={compact ? "新建工单" : undefined}
            onClick={() => setOpen(true)}
          >
            新建工单
          </button>
          <NewOrderDialog open={open} sessionKey={1} onOpenChange={setOpen} onCreated={vi.fn()} />
        </LocaleProvider>
      );
    }
    const view = render(<Harness compact={false} />);
    const originalOpener = screen.getByRole("button", { name: "新建工单" });
    originalOpener.focus();
    fireEvent.click(originalOpener);
    await screen.findByRole("button", { name: "stub cancel" });
    view.rerender(<Harness compact />);
    const currentOpener = document.querySelector<HTMLButtonElement>(
      'button[aria-label="新建工单"]',
    )!;
    const rects = vi
      .spyOn(currentOpener, "getClientRects")
      .mockReturnValue([new DOMRect(0, 0, 44, 44)] as unknown as DOMRectList);
    expect(originalOpener.isConnected).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "stub cancel" }));
    await waitFor(() => expect(currentOpener).toHaveFocus());
    rects.mockRestore();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "provides localized accessible dialog metadata and preserves callbacks in %s",
    async (locale) => {
      const { onOpenChange, onCreated } = renderDialog(locale);
      const dialog = screen.getByRole("dialog", {
        name: translateMessage(locale, "orders2b1.new.title"),
      });

      expect(dialog).toHaveAccessibleDescription(
        translateMessage(locale, "orders2b1.new.dialogDescription"),
      );

      fireEvent.click(await screen.findByRole("button", { name: "stub cancel" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);

      fireEvent.click(screen.getByRole("button", { name: "stub created" }));
      expect(onCreated).toHaveBeenCalledWith("order-1");
    },
  );
  it("keeps the mounted editor and typed draft across same-session parent and prefill rerenders", async () => {
    const result = render(
      <LocaleProvider initialLocale="zh-CN">
        <NewOrderDialog
          open
          sessionKey={1}
          prefill={{ key: "synthetic" }}
          onOpenChange={vi.fn()}
          onCreated={vi.fn()}
        />
      </LocaleProvider>,
    );
    const input = await screen.findByRole("textbox", { name: "synthetic draft" });
    fireEvent.change(input, { target: { value: "Retained synthetic draft" } });
    for (let i = 0; i < 4; i++) {
      result.rerender(
        <LocaleProvider initialLocale="zh-CN">
          <NewOrderDialog
            open
            sessionKey={1}
            prefill={{ key: "synthetic" }}
            onOpenChange={vi.fn()}
            onCreated={vi.fn()}
          />
        </LocaleProvider>,
      );
      expect(screen.getByRole("textbox", { name: "synthetic draft" })).toBe(input);
      expect(input).toHaveValue("Retained synthetic draft");
    }
  });

  it.each([
    {
      key: "session-2:customer-1:device-1:identifier-1",
      customerId: "customer-1",
      deviceId: "device-1",
      identifier: "identifier-1",
    },
    {
      key: "session-1:customer-2:device-1:identifier-1",
      customerId: "customer-2",
      deviceId: "device-1",
      identifier: "identifier-1",
    },
    {
      key: "session-1:customer-1:device-2:identifier-1",
      customerId: "customer-1",
      deviceId: "device-2",
      identifier: "identifier-1",
    },
    {
      key: "session-1:customer-1:device-1:identifier-2",
      customerId: "customer-1",
      deviceId: "device-1",
      identifier: "identifier-2",
    },
  ] satisfies NewOrderPrefill[])(
    "starts exactly one fresh editor for a different semantic intake $key",
    async (prefill) => {
      const renderSession = (sessionKey: number, currentPrefill: NewOrderPrefill) => (
        <LocaleProvider initialLocale="zh-CN">
          <NewOrderDialog
            open
            sessionKey={sessionKey}
            prefill={currentPrefill}
            onOpenChange={vi.fn()}
            onCreated={vi.fn()}
          />
        </LocaleProvider>
      );
      const result = render(
        renderSession(1, {
          key: "session-1:customer-1:device-1:identifier-1",
          customerId: "customer-1",
          deviceId: "device-1",
          identifier: "identifier-1",
        }),
      );
      await screen.findByRole("textbox", { name: "synthetic draft" });
      const previousInputs = screen.getAllByRole("textbox");
      previousInputs.forEach((input, index) =>
        fireEvent.change(input, { target: { value: `Previous form ${index}` } }),
      );
      result.rerender(renderSession(2, prefill));
      const freshInputs = screen.getAllByRole("textbox");
      freshInputs.forEach((input, index) => {
        expect(input).not.toBe(previousInputs[index]);
        expect(input).toHaveValue("");
        fireEvent.change(input, { target: { value: `Fresh form ${index}` } });
      });
      for (let replay = 0; replay < 3; replay++) {
        result.rerender(renderSession(2, { ...prefill }));
        screen.getAllByRole("textbox").forEach((input, index) => {
          expect(input).toBe(freshInputs[index]);
          expect(input).toHaveValue(`Fresh form ${index}`);
        });
      }
    },
  );

  it("starts a fresh editor after closing and reopening the same session key", async () => {
    const props = { sessionKey: 1, onOpenChange: vi.fn(), onCreated: vi.fn() };
    const result = render(
      <LocaleProvider initialLocale="zh-CN">
        <NewOrderDialog {...props} open />
      </LocaleProvider>,
    );
    const input = await screen.findByRole("textbox", { name: "synthetic draft" });
    fireEvent.change(input, { target: { value: "Previous synthetic session" } });
    result.rerender(
      <LocaleProvider initialLocale="zh-CN">
        <NewOrderDialog {...props} open={false} />
      </LocaleProvider>,
    );
    expect(input).not.toBeInTheDocument();
    result.rerender(
      <LocaleProvider initialLocale="zh-CN">
        <NewOrderDialog {...props} open />
      </LocaleProvider>,
    );
    const reopened = await screen.findByRole("textbox", { name: "synthetic draft" });
    expect(reopened).not.toBe(input);
    expect(reopened).toHaveValue("");
  });
});
