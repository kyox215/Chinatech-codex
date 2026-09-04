import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import type { InventoryListItem } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const mocks = vi.hoisted(() => ({
  searchParams: "",
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  shell: {} as Record<string, unknown>,
  list: vi.fn(),
  history: vi.fn(),
  create: vi.fn(),
  revise: vi.fn(),
  respond: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  scanValue: "",
  scanClickValue: "SCAN-DYNAMIC-001",
  viewport: "desktop" as "compact" | "desktop" | "pending",
  setLocale: undefined as undefined | ((locale: "zh-CN" | "it-IT" | "en") => void),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/buyback",
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => mocks.shell,
}));
vi.mock("@/hooks/use-mobile", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/use-mobile")>("@/hooks/use-mobile")),
  useViewportMode: () => mocks.viewport,
}));
vi.mock("@/features/capture", () => ({
  consumeScanSearchIntent: () => mocks.scanValue,
  subscribeScanSearchIntent: () => () => undefined,
  ScanSearchButton: ({
    onSearch,
    className,
  }: {
    onSearch: (value: string) => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={() => onSearch(mocks.scanClickValue)}>
      scan
    </button>
  ),
}));
vi.mock("@/components/imei-scanner-field", async () => {
  const { useLocale: useActualLocale } = await vi.importActual<
    typeof import("@/shared/i18n/locale-provider")
  >("@/shared/i18n/locale-provider");
  return {
    ImeiScannerField: ({
      value,
      onChange,
      placeholder,
      inputAriaLabel,
      identifierLabel,
      showScanner = true,
      showPaste = true,
    }: {
      value: string;
      onChange: (value: string) => void;
      placeholder: string;
      inputAriaLabel?: string;
      identifierLabel?: string;
      showScanner?: boolean;
      showPaste?: boolean;
    }) => {
      const { t } = useActualLocale();
      const identifier = identifierLabel ?? "IMEI";
      return (
        <div>
          <input
            aria-label={inputAriaLabel}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
          {showScanner ? (
            <button
              type="button"
              aria-label={t("inventory2b4.scanner.cameraAction", { identifier })}
            >
              scanner
            </button>
          ) : null}
          {showPaste ? (
            <button
              type="button"
              aria-label={t("inventory2b4.scanner.pasteAction", { identifier })}
            >
              paste
            </button>
          ) : null}
        </div>
      );
    },
  };
});
vi.mock("@/features/buyback/api/buyback-api", () => ({
  listBuybackRecords: (...args: unknown[]) => mocks.list(...args),
  readTransparentBuybackHistory: (...args: unknown[]) => mocks.history(...args),
  createTransparentBuybackQuote: (...args: unknown[]) => mocks.create(...args),
  reviseTransparentBuybackQuote: (...args: unknown[]) => mocks.revise(...args),
  recordTransparentBuybackResponse: (...args: unknown[]) => mocks.respond(...args),
}));

import { BuybackScreen } from "./transparent-buyback-screen";

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/buyback");
  mocks.searchParams = "";
  mocks.scanValue = "";
  mocks.scanClickValue = "SCAN-DYNAMIC-001";
  mocks.viewport = "desktop";
  mocks.setLocale = undefined;
  mocks.shell = shellState();
  mocks.list.mockResolvedValue([buybackItem()]);
  mocks.history.mockResolvedValue(historyResult());
  mocks.create.mockResolvedValue(commandResult("created"));
  mocks.revise.mockResolvedValue(commandResult("revised"));
  mocks.respond.mockResolvedValue(commandResult("response_recorded"));
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Transparent Buyback screen i18n", () => {
  it("keeps the server and client-first root deterministic while the store authority restores", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    const tree = () => (
      <QueryClientProvider client={client}>
        <LocaleProvider initialLocale="en">
          <SidebarProvider>
            <BuybackScreen />
          </SidebarProvider>
        </LocaleProvider>
      </QueryClientProvider>
    );
    mocks.shell = shellState({ status: "loading", activeStore: undefined });
    const serverHtml = renderToString(tree());
    expect(serverHtml).toContain(`aria-label="${translateMessage("en", "buyback2b5.loading")}"`);
    expect(mocks.list).not.toHaveBeenCalled();

    const host = document.createElement("div");
    host.innerHTML = serverHtml;
    document.body.append(host);
    mocks.shell = shellState();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, tree());
    });

    expect(await within(host).findByText("华为 Mate 客制 Ω")).toBeVisible();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    await act(async () => root?.unmount());
    host.remove();
  });

  it.each([
    ["zh-CN", "回收管理", "筛选回收记录"],
    ["it-IT", "Ritiro usato", "Filtra pratiche di ritiro"],
    ["en", "Buyback", "Filter buyback records"],
  ] as const)(
    "localizes list chrome in %s and preserves dynamic facts",
    async (locale, title, filter) => {
      const { container } = renderBuyback(locale);
      expect((await screen.findAllByRole("heading", { name: title, level: 1 }))[0]).toBeVisible();
      expect(screen.getAllByLabelText(filter).length).toBeGreaterThan(0);
      await screen.findByText("华为 Mate 客制 Ω");
      for (const value of ["BB-动态-001", "华为 Mate 客制 Ω", "朱红 客制", "future-outcome"]) {
        expect(container.textContent).toContain(value);
      }
      if (locale !== "zh-CN") {
        const fixedCopy = (container.textContent ?? "")
          .replaceAll("BB-动态-001", "")
          .replaceAll("华为 Mate 客制 Ω", "")
          .replaceAll("朱红 客制", "");
        expect(fixedCopy).not.toMatch(/[\p{Script=Han}]/u);
      }
      expect(container.textContent).not.toContain("PROVIDER-SECRET-SENTINEL");
      expect(mocks.list).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps workspace and detail sheets viewport-bounded with an independent scroll body", async () => {
    const assertBoundedSheet = (kind: "workspace" | "detail") => {
      const scrollBody = document.querySelector<HTMLElement>(
        `[data-buyback-scroll-body="${kind}"]`,
      );
      const footer = document.querySelector<HTMLElement>(`[data-buyback-fixed-footer="${kind}"]`);
      const sheet = scrollBody?.closest<HTMLElement>("[role=dialog]");
      expect(sheet).toHaveClass(
        "top-1",
        "bottom-1",
        "h-auto",
        "max-h-none",
        "min-h-0",
        "overflow-hidden",
        "md:top-auto",
        "md:h-[min(90svh,780px)]",
        "md:max-h-[min(90svh,780px)]",
      );
      expect(sheet).toHaveStyle("--tw-enter-translate-y: 0px");
      expect(scrollBody).toHaveClass(
        "min-h-0",
        "flex-1",
        "basis-0",
        "overflow-y-auto",
        "overscroll-contain",
      );
      expect(footer).toHaveClass("shrink-0");
      expect(scrollBody?.nextElementSibling).toBe(footer);
    };

    const user = userEvent.setup();
    const workspaceView = renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    assertBoundedSheet("workspace");
    workspaceView.unmount();

    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getByRole("button", { name: /BB-动态-001/ }));
    await screen.findByRole("dialog");
    assertBoundedSheet("detail");
  });

  it("keeps compact critical actions at a 44px touch target with stable accessible names", async () => {
    const user = userEvent.setup();
    mocks.viewport = "compact";
    renderBuyback("it-IT");
    await screen.findByText("华为 Mate 客制 Ω");
    const create = screen.getByRole("button", { name: "Nuova offerta trasparente" });
    expect(create).toHaveClass("size-11");
    expect(
      screen
        .getAllByRole("button", { name: "scan" })
        .filter((item) => item.classList.contains("size-11")),
    ).toHaveLength(1);
    expect(
      screen
        .getAllByRole("combobox", { name: "Filtra pratiche di ritiro" })
        .filter((item) => item.classList.contains("size-11")),
    ).toHaveLength(1);

    await user.click(create);
    const workspace = await screen.findByRole("dialog", { name: "Nuova offerta trasparente" });
    expect(within(workspace).getByRole("button", { name: "Annulla" })).toHaveClass("min-h-11");
    expect(
      within(workspace).getByRole("button", { name: "Salva offerta trasparente" }),
    ).toHaveClass("min-h-11");
  });

  it.each([
    ["compact", "escape"],
    ["compact", "cancel"],
    ["desktop", "escape"],
    ["desktop", "cancel"],
  ] as const)("returns focus to the %s create opener after %s", async (viewport, closeMethod) => {
    const user = userEvent.setup();
    mocks.viewport = viewport;
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    const opener = screen.getByRole("button", { name: "New transparent quote" });
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const focus = vi.spyOn(opener, "focus");

    await user.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "New transparent quote" });
    if (closeMethod === "escape") await user.keyboard("{Escape}");
    else await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    expect(opener).toHaveFocus();
  });

  it("returns focus to the empty-state create opener", async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([]);
    renderBuyback("en");
    await screen.findByText("No transparent quotes yet");
    const opener = screen.getByRole("button", { name: "New quote" });
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const focus = vi.spyOn(opener, "focus");

    await user.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "New transparent quote" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    expect(opener).toHaveFocus();
  });

  it("returns focus from detail Escape and revise cancel to the quote card", async () => {
    const user = userEvent.setup();
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    const card = screen.getByRole("button", { name: /BB-动态-001/ });
    vi.spyOn(card, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const focus = vi.spyOn(card, "focus");

    await user.click(card);
    let detail = await screen.findByRole("dialog", { name: "华为 Mate 客制 Ω" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(detail).not.toBeInTheDocument());
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    expect(card).toHaveFocus();

    focus.mockClear();
    await user.click(card);
    detail = await screen.findByRole("dialog", { name: "华为 Mate 客制 Ω" });
    await user.click(within(detail).getByRole("button", { name: "Revise quote" }));
    const workspace = await screen.findByRole("dialog", { name: "Revise quote" });
    expect(focus).not.toHaveBeenCalledWith({ preventScroll: true });
    await user.click(within(workspace).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(workspace).not.toBeInTheDocument());
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    expect(card).toHaveFocus();
  });

  it("does not restore focus to an opener from a replaced authority", async () => {
    const user = userEvent.setup();
    mocks.list
      .mockResolvedValueOnce([buybackItem()])
      .mockResolvedValueOnce([buybackItem({ item_label: "Replacement authority item" })]);
    const view = renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    const opener = screen.getAllByRole("button", { name: "New transparent quote" })[0]!;
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const focus = vi.spyOn(opener, "focus");
    await user.click(opener);
    expect(await screen.findByRole("dialog", { name: "New transparent quote" })).toBeVisible();

    mocks.shell = shellState({
      activeStore: {
        id: "store-replacement",
        membershipId: "membership-replacement",
        name: "Replacement store",
        role: "owner",
      },
    });
    act(() => view.rerenderBuyback());

    expect(await screen.findByText("Replacement authority item")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(focus.mock.calls.some(([options]) => options?.preventScroll === true)).toBe(false);
    expect(opener).not.toHaveFocus();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "restores inbound q/id/new without serializing local state in %s",
    async (locale) => {
      mocks.searchParams = "q=动态查询&id=record-dynamic&new=1";
      renderBuyback(locale);
      expect(await screen.findByRole("dialog")).toBeVisible();
      expect(screen.getAllByDisplayValue("动态查询").length).toBeGreaterThan(0);
      expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({
        sourceTypes: ["buyback"],
        categories: ["phone"],
        search: "动态查询",
      });
      expect(mocks.routerPush).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.cancel"),
        }),
      );
      expect(mocks.routerReplace).toHaveBeenCalledWith("/buyback", { scroll: false });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps live phone and scan IMEI searches local-only in %s",
    async (locale) => {
      const phoneSentinel = "+393330001122";
      const imeiSentinel = "490154203237518";
      mocks.scanClickValue = imeiSentinel;
      window.history.replaceState({}, "", "/buyback");
      const user = userEvent.setup();
      renderBuyback(locale);
      await screen.findByText("华为 Mate 客制 Ω");
      const searchInput = screen.getAllByLabelText(
        translateMessage(locale, "buyback2b5.search"),
      )[0]!;
      await user.clear(searchInput);
      await user.type(searchInput, phoneSentinel);
      await waitFor(() =>
        expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({ search: phoneSentinel }),
      );
      expect(window.location.href).not.toContain(encodeURIComponent(phoneSentinel));
      expect(window.location.href).not.toContain(phoneSentinel);
      expect(mocks.routerReplace).not.toHaveBeenCalled();
      expect(mocks.routerPush).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "scan" }));
      await waitFor(() =>
        expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({ search: imeiSentinel }),
      );
      expect(window.location.href).not.toContain(imeiSentinel);
      expect(mocks.routerReplace).not.toHaveBeenCalled();
      expect(mocks.routerPush).not.toHaveBeenCalled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "shows localized no-store and read-denied states with no unsafe text in %s",
    async (locale) => {
      mocks.shell = shellState({ activeStore: undefined, status: "error" });
      const noStore = renderBuyback(locale);
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "buyback2b5.store.error.title"),
        }),
      ).toBeVisible();
      expect(mocks.list).not.toHaveBeenCalled();
      noStore.unmount();

      mocks.shell = shellState();
      mocks.list.mockRejectedValue({ status: 403, message: "PROVIDER-SECRET-SENTINEL" });
      const { container } = renderBuyback(locale);
      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "buyback2b5.loadError.title"),
        }),
      ).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "buyback2b5.error.permission")),
      ).toBeVisible();
      expect(container.textContent).not.toContain("PROVIDER-SECRET-SENTINEL");
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "separates store loading from the no-store state in %s",
    (locale) => {
      mocks.shell = shellState({ activeStore: undefined, status: "loading" });
      const loading = renderBuyback(locale);
      expect(screen.getByLabelText(translateMessage(locale, "buyback2b5.loading"))).toBeVisible();
      expect(mocks.list).not.toHaveBeenCalled();
      loading.unmount();

      mocks.shell = shellState({ activeStore: undefined, status: "onboarding_required" });
      renderBuyback(locale);
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "buyback2b5.store.none.title"),
        }),
      ).toBeVisible();
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );

  it("validates before create, focuses the first field, and performs zero writes", async () => {
    const user = userEvent.setup();
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    await user.click(screen.getByRole("button", { name: "Save transparent quote" }));
    const model = screen.getByRole("textbox", { name: "Model" });
    expect(await screen.findByText("Enter the device model")).toBeVisible();
    expect(model).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(model).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "blocks sensitive create reasons locally with fixed accessible feedback in %s",
    async (locale) => {
      const user = userEvent.setup();
      renderBuyback(locale);
      await screen.findByText("华为 Mate 客制 Ω");
      await user.click(
        screen.getAllByRole("button", {
          name: translateMessage(locale, "buyback2b5.new"),
        })[0]!,
      );
      await user.type(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "buyback2b5.workspace.model"),
        }),
        "iPhone 15 Pro",
      );
      fireEvent.change(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "buyback2b5.workspace.finalOffer"),
        }),
        { target: { value: "400" } },
      );
      const reason = await screen.findByRole("textbox", {
        name: translateMessage(locale, "buyback2b5.workspace.reason"),
      });
      const sentinel = "49/015420/323751/8";
      await user.type(reason, sentinel);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.save"),
        }),
      );
      await waitFor(() => expect(reason).toHaveFocus());
      expect(reason).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getAllByText(translateMessage(locale, "buyback2b5.validation.sensitive")).length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("alert").textContent).not.toContain(sentinel);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "blocks sensitive revise change reasons locally with zero writes in %s",
    async (locale) => {
      const user = userEvent.setup();
      mocks.searchParams = "id=record-dynamic";
      renderBuyback(locale);
      const detail = await screen.findByRole("dialog");
      const revise = within(detail).getByRole("button", {
        name: translateMessage(locale, "buyback2b5.detail.revise"),
      });
      await waitFor(() => expect(revise).toBeEnabled());
      await user.click(revise);
      const reason = await screen.findByRole("textbox", {
        name: translateMessage(locale, "buyback2b5.workspace.reason"),
      });
      const sentinel = "documento: AB/12/CD/34/EF note operative lunghe";
      await user.type(reason, sentinel);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.saveRevision"),
        }),
      );
      await waitFor(() => expect(reason).toHaveFocus());
      expect(reason).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getAllByText(translateMessage(locale, "buyback2b5.validation.sensitive")).length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("alert").textContent).not.toContain(sentinel);
      expect(mocks.revise).not.toHaveBeenCalled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "blocks sensitive response notes locally and focuses the note in %s",
    async (locale) => {
      const user = userEvent.setup();
      mocks.searchParams = "id=record-dynamic";
      renderBuyback(locale);
      const detail = await screen.findByRole("dialog");
      await user.click(
        within(detail).getByRole("radio", {
          name: translateMessage(locale, "buyback2b5.response.defer"),
        }),
      );
      await user.click(
        within(detail).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.addNote"),
        }),
      );
      const note = within(detail).getByRole("textbox", {
        name: translateMessage(locale, "buyback2b5.detail.notePlaceholder"),
      });
      const sentinel = "telefono 333 123 4567 - 03/09/2026";
      await user.type(note, sentinel);
      fireEvent.click(
        within(detail).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.saveOutcome", {
            outcome: translateMessage(locale, "buyback2b5.response.defer"),
          }),
        }),
      );
      await waitFor(() => expect(note).toHaveFocus());
      expect(note).toHaveAttribute("aria-invalid", "true");
      expect(
        within(detail).getByText(translateMessage(locale, "buyback2b5.validation.sensitive")),
      ).toBeVisible();
      expect(within(detail).getByRole("alert").textContent).not.toContain(sentinel);
      expect(mocks.respond).not.toHaveBeenCalled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "submits ordinary document-related prose unchanged in %s",
    async (locale) => {
      const user = userEvent.setup();
      mocks.searchParams = "id=record-dynamic";
      renderBuyback(locale);
      const detail = await screen.findByRole("dialog");
      await user.click(
        within(detail).getByRole("radio", {
          name: translateMessage(locale, "buyback2b5.response.defer"),
        }),
      );
      await user.click(
        within(detail).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.addNote"),
        }),
      );
      const note = within(detail).getByRole("textbox", {
        name: translateMessage(locale, "buyback2b5.detail.notePlaceholder"),
      });
      const prose = "Passaporto da controllare tra 2 giorni";
      await user.type(note, prose);
      fireEvent.click(
        within(detail).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.saveOutcome", {
            outcome: translateMessage(locale, "buyback2b5.response.defer"),
          }),
        }),
      );
      await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(1));
      expect(mocks.respond.mock.calls[0]![1]).toMatchObject({
        outcome: "deferred",
        note: prose,
      });
    },
  );

  it("covers loading, empty, offline, readonly and stale-data states without extra writes", async () => {
    mocks.list.mockImplementation(() => new Promise(() => undefined));
    const loading = renderBuyback("en");
    expect(screen.getByLabelText("Loading buyback quotes")).toBeVisible();
    loading.unmount();

    mocks.list.mockReset().mockResolvedValue([]);
    const empty = renderBuyback("it-IT");
    expect(
      await screen.findByRole("heading", { name: "Nessuna offerta trasparente" }),
    ).toBeVisible();
    empty.unmount();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    mocks.shell = shellState({
      activeStore: { id: "store-dynamic", name: "门店 动态 Ω", role: "viewer" },
    });
    mocks.list.mockReset().mockResolvedValue([buybackItem()]);
    const offline = renderBuyback("en");
    expect(await screen.findByText(translateMessage("en", "buyback2b5.offline"))).toBeVisible();
    expect(screen.getByText(translateMessage("en", "buyback2b5.readOnly"))).toBeVisible();
    expect(screen.getAllByRole("button", { name: "New transparent quote" })[0]).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
    offline.unmount();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    mocks.shell = shellState();
    mocks.list.mockReset().mockResolvedValue([buybackItem()]);
    const stale = renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    mocks.list.mockRejectedValue({ status: 503, message: "PROVIDER-SECRET-SENTINEL" });
    await stale.queryClient.refetchQueries({ queryKey: ["buyback"] });
    expect(await screen.findByText(translateMessage("en", "buyback2b5.stale"))).toBeVisible();
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET-SENTINEL");
  });

  it("keeps canonical create payload locale-invariant while localizing presentation", async () => {
    const payloads: unknown[] = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const user = userEvent.setup();
      const view = renderBuyback(locale);
      await screen.findByText("华为 Mate 客制 Ω");
      await user.click(
        screen.getAllByRole("button", {
          name: translateMessage(locale, "buyback2b5.new"),
        })[0]!,
      );
      await user.type(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "buyback2b5.workspace.model"),
        }),
        "Modello 动态 Ω",
      );
      expect(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "buyback2b5.workspace.imeiInputAria"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.scanner.cameraAction", {
            identifier: translateMessage(locale, "buyback2b5.workspace.imeiIdentifier"),
          }),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.scanner.pasteAction", {
            identifier: translateMessage(locale, "buyback2b5.workspace.imeiIdentifier"),
          }),
        }),
      ).toBeVisible();
      const screenAmount = screen.getByLabelText(
        translateMessage(locale, "buyback2b5.workspace.screenDeduction"),
      );
      const batteryAmount = screen.getByLabelText(
        translateMessage(locale, "buyback2b5.workspace.batteryDeduction"),
      );
      await user.clear(screenAmount);
      await user.type(screenAmount, "12.5");
      await user.clear(batteryAmount);
      await user.type(batteryAmount, "7.25");
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.useSuggestion"),
        }),
      );
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.save"),
        }),
      );
      await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
      payloads.push(normalizeIds(structuredClone(mocks.create.mock.calls[0]![0])));
      mocks.create.mockClear();
      view.unmount();
    }
    expect(payloads[1]).toEqual(payloads[0]);
    expect(payloads[2]).toEqual(payloads[0]);
    expect(payloads[0]).toMatchObject({
      record_id: "<uuid>",
      idempotency_key: "<uuid>",
      device: { brand: "Apple", model: "Modello 动态 Ω", storage_capacity: "128GB" },
      quote: {
        reference_low: 350,
        reference_high: 420,
        final_offer: 400.25,
        deductions: [
          { code: "screen", label: "屏幕状况调整", amount: 12.5 },
          { code: "battery", label: "电池健康调整", amount: 7.25 },
        ],
        risk_level: "low",
        hard_block: false,
      },
    });
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "preserves response/history facts and sanitizes 409 failures in %s",
    async (locale) => {
      mocks.searchParams = "id=record-dynamic";
      mocks.respond.mockRejectedValue({ status: 409, message: "PROVIDER-SECRET-SENTINEL" });
      const user = userEvent.setup();
      const { container } = renderBuyback(locale);
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("动态扣减 Ω")).toBeVisible();
      expect(within(dialog).getByText(/future-risk/)).toBeVisible();
      await user.click(
        within(dialog).getByRole("radio", {
          name: translateMessage(locale, "buyback2b5.response.accept"),
        }),
      );
      await user.click(
        within(dialog).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.saveOutcome", {
            outcome: translateMessage(locale, "buyback2b5.response.accept"),
          }),
        }),
      );
      await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(1));
      expect(mocks.respond.mock.calls[0]![0]).toBe("record-dynamic");
      expect(normalizeIds(mocks.respond.mock.calls[0]![1])).toEqual({
        expected_updated_at: "2026-10-25T00:30:00.000Z",
        idempotency_key: "<uuid>",
        quote_revision_id: "revision-dynamic",
        outcome: "accepted",
        reason_code: undefined,
        note: undefined,
      });
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage(locale, "buyback2b5.error.conflict"),
      );
      expect(container.textContent).not.toContain("PROVIDER-SECRET-SENTINEL");
      await user.click(
        within(dialog).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.expand"),
        }),
      );
      expect(await screen.findByText("动态改价原因 Ω")).toBeVisible();
      expect(screen.getByText("员工 动态 Ω", { exact: false })).toBeVisible();
      if (locale !== "zh-CN") {
        const fixedCopy = (dialog.textContent ?? "")
          .replaceAll("华为 Mate 客制 Ω", "")
          .replaceAll("BB-动态-001", "")
          .replaceAll("动态扣减 Ω", "")
          .replaceAll("动态改价原因 Ω", "")
          .replaceAll("员工 动态 Ω", "");
        expect(fixedCopy).not.toMatch(/[\p{Script=Han}]/u);
      }
    },
  );

  it("keeps the create dialog and draft after a sanitized provider failure", async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValue({
      status: 503,
      code: "FUTURE_PROVIDER",
      message: "PROVIDER-SECRET-SENTINEL",
    });
    renderBuyback("it-IT");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "Nuova offerta trasparente" })[0]!);
    const model = screen.getByRole("textbox", { name: "Modello" });
    await user.type(model, "Bozza 动态 Ω");
    await user.click(screen.getByRole("button", { name: "Salva offerta trasparente" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(model).toHaveValue("Bozza 动态 Ω");
    expect(screen.getByRole("dialog")).toBeVisible();
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage("it-IT", "buyback2b5.operation.unknown"),
      ),
    );
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET-SENTINEL");
  });

  it("keeps revise CAS, UUID and persisted Chinese default change reason invariant", async () => {
    const payloads: unknown[] = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const user = userEvent.setup();
      mocks.searchParams = "id=record-dynamic";
      const view = renderBuyback(locale);
      const detail = await screen.findByRole("dialog");
      await user.click(
        within(detail).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.detail.revise"),
        }),
      );
      const workspace = await screen.findByRole("dialog");
      await user.click(
        within(workspace).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.useSuggestion"),
        }),
      );
      await user.click(
        within(workspace).getByRole("button", {
          name: translateMessage(locale, "buyback2b5.workspace.saveRevision"),
        }),
      );
      await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(1));
      expect(mocks.revise.mock.calls[0]![0]).toBe("record-dynamic");
      payloads.push(normalizeIds(structuredClone(mocks.revise.mock.calls[0]![1])));
      mocks.revise.mockClear();
      view.unmount();
    }
    expect(payloads[1]).toEqual(payloads[0]);
    expect(payloads[2]).toEqual(payloads[0]);
    expect(payloads[0]).toMatchObject({
      expected_updated_at: "2026-10-25T00:30:00.000Z",
      idempotency_key: "<uuid>",
      change_reason: "重新检测后更新报价",
      quote: { final_offer: 420, deductions: [] },
    });
  });

  it("keeps draft, focus, URL and reads stable across an in-place locale switch", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "q=canonical-query&new=1";
    window.history.replaceState({}, "", "/buyback?q=canonical-query&new=1");
    renderBuyback("en", true);
    const model = await screen.findByRole("textbox", { name: "Model" });
    await user.type(model, "Draft 动态 Ω");
    model.focus();
    const reads = mocks.list.mock.calls.length;
    const replaceCalls = mocks.routerReplace.mock.calls.length;
    const pushCalls = mocks.routerPush.mock.calls.length;
    const urlBefore = `${window.location.pathname}${window.location.search}`;
    await act(async () => mocks.setLocale?.("it-IT"));
    const localizedModel = await screen.findByRole("textbox", { name: "Modello" });
    expect(localizedModel).toBe(model);
    expect(localizedModel).toHaveValue("Draft 动态 Ω");
    expect(localizedModel).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getAllByDisplayValue("canonical-query").length).toBeGreaterThan(0);
    expect(`${window.location.pathname}${window.location.search}`).toBe(urlBefore);
    expect(mocks.list).toHaveBeenCalledTimes(reads);
    expect(mocks.routerReplace).toHaveBeenCalledTimes(replaceCalls);
    expect(mocks.routerPush).toHaveBeenCalledTimes(pushCalls);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(mocks.respond).not.toHaveBeenCalled();
  });

  it("locks create synchronously and reuses or rotates its key from the canonical body", async () => {
    const user = userEvent.setup();
    let rejectFirst: (error: unknown) => void = () => undefined;
    mocks.create
      .mockReset()
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
      )
      .mockRejectedValue({ status: 400, message: "PROVIDER-SECRET-SENTINEL" });
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    const model = screen.getByRole("textbox", { name: "Model" });
    await user.type(model, "Stable model");
    const save = screen.getByRole("button", { name: "Save transparent quote" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await act(async () => rejectFirst({ status: 400, message: "PROVIDER-SECRET-SENTINEL" }));
    await screen.findByRole("alert");

    fireEvent.click(save);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const firstKey = mocks.create.mock.calls[0]![0].idempotency_key;
    expect(mocks.create.mock.calls[1]![0].idempotency_key).toBe(firstKey);

    fireEvent.change(model, { target: { value: "Changed model" } });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3));
    expect(mocks.create.mock.calls[2]![0].idempotency_key).not.toBe(firstKey);
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET-SENTINEL");
  });

  it("preserves the failed create key across a locale-only rerender", async () => {
    const user = userEvent.setup();
    mocks.create.mockReset().mockRejectedValue({ status: 400, message: "PROVIDER-SECRET" });
    renderBuyback("en", true);
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    await user.type(screen.getByRole("textbox", { name: "Model" }), "Locale draft");
    fireEvent.click(screen.getByRole("button", { name: "Save transparent quote" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    const firstKey = mocks.create.mock.calls[0]![0].idempotency_key;
    const readsAfterSubmit = mocks.list.mock.calls.length;

    await act(async () => mocks.setLocale?.("it-IT"));
    expect(screen.getByRole("textbox", { name: "Modello" })).toHaveValue("Locale draft");
    fireEvent.click(screen.getByRole("button", { name: "Salva offerta trasparente" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1]![0].idempotency_key).toBe(firstKey);
    expect(mocks.list).toHaveBeenCalledTimes(readsAfterSubmit);
  });

  it.each([
    ["5xx", { status: 503, message: "PROVIDER-SECRET" }],
    ["Abort", { name: "AbortError", message: "PROVIDER-SECRET" }],
    ["timeout", { name: "TimeoutError", message: "PROVIDER-SECRET" }],
  ] as const)("keeps a %s create locked through readback and explicit retry", async (_, error) => {
    const user = userEvent.setup();
    mocks.create.mockReset().mockRejectedValue(error);
    renderBuyback("it-IT");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "Nuova offerta trasparente" })[0]!);
    await user.type(screen.getByRole("textbox", { name: "Modello" }), "Bozza stabile");
    const save = screen.getByRole("button", { name: "Salva offerta trasparente" });
    fireEvent.click(save);
    expect(await screen.findByRole("button", { name: "Abilita un nuovo invio" })).toBeVisible();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const firstKey = mocks.create.mock.calls[0]![0].idempotency_key;
    await user.click(screen.getByRole("button", { name: "Abilita un nuovo invio" }));
    fireEvent.click(save);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1]![0].idempotency_key).toBe(firstKey);
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET");
  });

  it("confirms a lost create from its client record id without replaying the write", async () => {
    const user = userEvent.setup();
    mocks.create.mockReset().mockRejectedValueOnce({ status: 503, message: "CREATE-SECRET" });
    mocks.list
      .mockReset()
      .mockResolvedValueOnce([buybackItem()])
      .mockImplementation(async () => {
        const recordId = mocks.create.mock.calls[0]?.[0].record_id;
        return [buybackItem({ id: recordId })];
      });
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    await user.type(screen.getByRole("textbox", { name: "Model" }), "Committed create");
    fireEvent.click(screen.getByRole("button", { name: "Save transparent quote" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.list.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toContain("CREATE-SECRET");
  });

  it("refreshes a revise conflict without losing draft and uses the latest CAS with a new key", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.revise.mockReset().mockRejectedValue({ status: 409, message: "PROVIDER-SECRET" });
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("button", { name: "Revise quote" }));
    const workspace = await screen.findByRole("dialog");
    await user.click(within(workspace).getByRole("button", { name: "Use suggestion" }));
    const save = within(workspace).getByRole("button", { name: "Save new version" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(1));
    const first = structuredClone(mocks.revise.mock.calls[0]![1]);

    mocks.list.mockResolvedValue([buybackItem({ updated_at: "2026-10-25T01:30:00.000Z" })]);
    await user.click(await screen.findByRole("button", { name: "Refresh latest quote" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(save);
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(2));
    const second = mocks.revise.mock.calls[1]![1];
    expect(second.expected_updated_at).toBe("2026-10-25T01:30:00.000Z");
    expect(second.idempotency_key).not.toBe(first.idempotency_key);
    expect(second.quote).toEqual(first.quote);
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET");
  });

  it("reuses a revise key for the same failed body and rotates it after a quote change", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.revise.mockReset().mockRejectedValue({ status: 400, message: "PROVIDER-SECRET" });
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("button", { name: "Revise quote" }));
    const workspace = await screen.findByRole("dialog");
    await user.click(within(workspace).getByRole("button", { name: "Use suggestion" }));
    const save = within(workspace).getByRole("button", { name: "Save new version" });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(1));
    const firstKey = mocks.revise.mock.calls[0]![1].idempotency_key;
    fireEvent.click(save);
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(2));
    expect(mocks.revise.mock.calls[1]![1].idempotency_key).toBe(firstKey);

    const screenDeduction = within(workspace).getByLabelText("Screen deduction €");
    fireEvent.change(screenDeduction, { target: { value: "5" } });
    await user.click(within(workspace).getByRole("button", { name: "Use suggestion" }));
    fireEvent.click(save);
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(3));
    expect(mocks.revise.mock.calls[2]![1].idempotency_key).not.toBe(firstKey);
    expect(mocks.revise.mock.calls[2]![1].quote.deductions).toContainEqual({
      code: "screen",
      label: "屏幕状况调整",
      amount: 5,
    });
  });

  it.each(
    (
      [
        ["Abort", { name: "AbortError", message: "REVISE-SECRET" }],
        ["timeout", { name: "TimeoutError", message: "REVISE-SECRET" }],
        ["5xx", { status: 503, message: "REVISE-SECRET" }],
      ] as const
    ).flatMap(([failureName, error]) =>
      (["own", "competing", "none", "readback-error"] as const).map(
        (readbackKind) => [failureName, readbackKind, error] as const,
      ),
    ),
  )("handles %s revise readback as %s without replay", async (_, readbackKind, error) => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.revise.mockReset().mockRejectedValue(error);
    let historyCalls = 0;
    mocks.history.mockReset().mockImplementation(async () => {
      historyCalls += 1;
      const baseline = historyResult();
      if (historyCalls === 1) return baseline;
      if (readbackKind === "readback-error") throw new Error("READBACK-SECRET");
      if (readbackKind === "none") return baseline;
      const submitted = mocks.revise.mock.calls[0]![1];
      return {
        ...baseline,
        revisions: [
          ...baseline.revisions,
          {
            id: `revision-${readbackKind}`,
            revision_no: 2,
            kind: "reprice" as const,
            quote:
              readbackKind === "own"
                ? submitted.quote
                : { ...submitted.quote, final_offer: submitted.quote.final_offer - 1 },
            change_reason: submitted.change_reason,
            actor_name: "Concurrent employee",
            created_at: "2026-10-25T01:00:00.000Z",
          },
        ],
      };
    });
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    const revise = within(detail).getByRole("button", { name: "Revise quote" });
    await waitFor(() => expect(revise).toBeEnabled());
    await user.click(revise);
    const workspace = await screen.findByRole("dialog");
    await user.click(within(workspace).getByRole("button", { name: "Use suggestion" }));
    const save = within(workspace).getByRole("button", { name: "Save new version" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledTimes(1));

    if (readbackKind === "own") {
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Allow another submission" })).toBeNull();
    } else {
      expect(await screen.findByRole("button", { name: "Allow another submission" })).toBeVisible();
      expect(screen.getByRole("dialog")).toBeVisible();
    }
    expect(mocks.revise).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toMatch(/REVISE-SECRET|READBACK-SECRET/);
  });

  it("does not enable revise when a successful history baseline is unavailable", async () => {
    mocks.searchParams = "id=record-dynamic";
    mocks.history.mockReset().mockRejectedValue(new Error("HISTORY-SECRET"));
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    expect(within(detail).getByRole("button", { name: "Revise quote" })).toBeDisabled();
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("HISTORY-SECRET");
  });

  it("keeps response unknown-result retries on one key and changes key for a new decision", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.respond.mockReset().mockRejectedValue({ status: 503, message: "PROVIDER-SECRET" });
    mocks.history.mockResolvedValue(historyResult());
    renderBuyback("en");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Defer" }));
    const saveDeferred = within(dialog).getByRole("button", { name: "Save Defer" });
    fireEvent.click(saveDeferred);
    fireEvent.click(saveDeferred);
    const retry = await screen.findByRole("button", {
      name: "Allow another submission",
    });
    const firstKey = mocks.respond.mock.calls[0]![1].idempotency_key;
    await user.click(retry);
    fireEvent.click(saveDeferred);
    await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(2));
    expect(mocks.respond.mock.calls[1]![1].idempotency_key).toBe(firstKey);

    await user.click(await screen.findByRole("button", { name: "Allow another submission" }));
    await user.click(within(dialog).getByRole("radio", { name: "Accept quote" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Accept quote" }));
    await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(3));
    expect(mocks.respond.mock.calls[2]![1].idempotency_key).not.toBe(firstKey);
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET");
  });

  it("keeps response writing locked while unknown-result readback is pending", async () => {
    const user = userEvent.setup();
    let finishReadback: (value: ReturnType<typeof historyResult>) => void = () => undefined;
    mocks.searchParams = "id=record-dynamic";
    mocks.respond.mockReset().mockRejectedValueOnce({ status: 503, message: "PENDING-SECRET" });
    mocks.history
      .mockReset()
      .mockResolvedValueOnce(historyResult())
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishReadback = resolve;
        }),
      );
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("radio", { name: "Defer" }));
    const save = within(detail).getByRole("button", { name: "Save Defer" });
    fireEvent.click(save);
    await screen.findByText("Checking the server result…");
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    await act(async () => finishReadback(historyResult()));
    expect(await screen.findByRole("button", { name: "Allow another submission" })).toBeVisible();
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("PENDING-SECRET");
  });

  it("confirms a lost response from history readback without replaying the write", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.respond.mockReset().mockRejectedValueOnce({ status: 503, message: "PROVIDER-SECRET" });
    mocks.history
      .mockReset()
      .mockResolvedValueOnce(historyResult())
      .mockResolvedValue({
        ...historyResult(),
        responses: [
          {
            id: "response-confirmed",
            quote_revision_id: "revision-dynamic",
            outcome: "deferred",
            channel: "staff_recorded_verbal",
            actor_name: "Employee",
            created_at: "2026-10-25T01:00:00.000Z",
          },
        ],
      });
    renderBuyback("en");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Defer" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Defer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Allow another submission" })).toBeNull();
    expect(document.body.textContent).not.toContain("PROVIDER-SECRET");
  });

  it("does not confirm an old matching response when the initial history baseline failed", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.respond.mockReset().mockRejectedValueOnce({ status: 503, message: "RESPONSE-SECRET" });
    mocks.history
      .mockReset()
      .mockRejectedValueOnce(new Error("BASELINE-SECRET"))
      .mockResolvedValue({
        ...historyResult(),
        responses: [
          {
            id: "old-matching-response",
            quote_revision_id: "revision-dynamic",
            outcome: "deferred",
            channel: "staff_recorded_verbal",
            actor_name: "Employee",
            created_at: "2026-10-24T01:00:00.000Z",
          },
        ],
      });
    renderBuyback("en");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Defer" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Defer" }));
    expect(await screen.findByRole("button", { name: "Allow another submission" })).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(mocks.history).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toMatch(/RESPONSE-SECRET|BASELINE-SECRET/);
  });

  it("refreshes a response conflict to the latest CAS and rotates the key", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.respond.mockReset().mockRejectedValue({ status: 409, message: "CONFLICT-SECRET" });
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("radio", { name: "Defer" }));
    const save = within(detail).getByRole("button", { name: "Save Defer" });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(1));
    const first = structuredClone(mocks.respond.mock.calls[0]![1]);
    mocks.list.mockResolvedValue([buybackItem({ updated_at: "2026-10-25T01:30:00.000Z" })]);
    await user.click(await screen.findByRole("button", { name: "Refresh latest quote" }));
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(2));
    expect(mocks.respond.mock.calls[1]![1]).toMatchObject({
      expected_updated_at: "2026-10-25T01:30:00.000Z",
      outcome: "deferred",
    });
    expect(mocks.respond.mock.calls[1]![1].idempotency_key).not.toBe(first.idempotency_key);
    expect(document.body.textContent).not.toContain("CONFLICT-SECRET");
  });

  it("keeps a conflict locked when the latest target projection cannot be refreshed", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    mocks.respond.mockReset().mockRejectedValueOnce({ status: 409, message: "CONFLICT-SECRET" });
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("radio", { name: "Defer" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Save Defer" }));
    mocks.list.mockResolvedValue([]);
    const refresh = await screen.findByRole("button", { name: "Refresh latest quote" });
    await user.click(refresh);
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage("en", "buyback2b5.operation.refreshFailed"),
      ),
    );
    expect(refresh).toBeVisible();
    expect(within(detail).getByRole("button", { name: "Save Defer" })).toBeDisabled();
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("CONFLICT-SECRET");
  });

  it("keeps the owner workspace offline with zero create writes", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const user = userEvent.setup();
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    await user.type(screen.getByRole("textbox", { name: "Model" }), "Offline draft");
    expect(screen.getByRole("button", { name: "Save transparent quote" })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps revise and response offline with zero writes", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    renderBuyback("it-IT");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("radio", { name: "Rinvia" }));
    expect(within(detail).getByRole("button", { name: "Salva: Rinvia" })).toBeDisabled();
    const revise = within(detail).getByRole("button", { name: "Nuova valutazione" });
    await waitFor(() => expect(revise).toBeEnabled());
    await user.click(revise);
    const workspace = await screen.findByRole("dialog");
    await user.click(within(workspace).getByRole("button", { name: "Usa suggerimento" }));
    expect(within(workspace).getByRole("button", { name: "Salva nuova versione" })).toBeDisabled();
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(mocks.respond).not.toHaveBeenCalled();
  });

  it("retries only synchronization after a committed create and never writes twice", async () => {
    const user = userEvent.setup();
    renderBuyback("en");
    await screen.findByText("华为 Mate 客制 Ω");
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    await user.type(screen.getByRole("textbox", { name: "Model" }), "Committed model");
    mocks.list.mockRejectedValue({ status: 503, message: "SYNC-SECRET" });
    fireEvent.click(screen.getByRole("button", { name: "Save transparent quote" }));
    const retrySync = await screen.findByRole("button", { name: "Retry synchronization" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeVisible();
    mocks.list.mockResolvedValue([buybackItem()]);
    await user.click(retrySync);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("SYNC-SECRET");
  });

  it("retries only synchronization after a committed revise and never writes twice", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    const revise = within(detail).getByRole("button", { name: "Revise quote" });
    await waitFor(() => expect(revise).toBeEnabled());
    await user.click(revise);
    const workspace = await screen.findByRole("dialog");
    await user.click(within(workspace).getByRole("button", { name: "Use suggestion" }));
    mocks.list.mockRejectedValue({ status: 503, message: "REVISE-SYNC-SECRET" });
    fireEvent.click(within(workspace).getByRole("button", { name: "Save new version" }));
    const retrySync = await screen.findByRole("button", { name: "Retry synchronization" });
    expect(mocks.revise).toHaveBeenCalledTimes(1);
    mocks.list.mockResolvedValue([buybackItem()]);
    await user.click(retrySync);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.revise).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("REVISE-SYNC-SECRET");
  });

  it("retries only synchronization after a committed response and never writes twice", async () => {
    const user = userEvent.setup();
    mocks.searchParams = "id=record-dynamic";
    renderBuyback("en");
    const detail = await screen.findByRole("dialog");
    await user.click(within(detail).getByRole("radio", { name: "Defer" }));
    mocks.list.mockRejectedValue({ status: 503, message: "RESPONSE-SYNC-SECRET" });
    fireEvent.click(within(detail).getByRole("button", { name: "Save Defer" }));
    const retrySync = await screen.findByRole("button", { name: "Retry synchronization" });
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    mocks.list.mockResolvedValue([buybackItem()]);
    await user.click(retrySync);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("RESPONSE-SYNC-SECRET");
  });

  it.each(
    (["create", "response"] as const).flatMap((operation) =>
      (
        [
          ["Abort", { name: "AbortError", message: "LATE-SECRET" }],
          ["timeout", { name: "TimeoutError", message: "LATE-SECRET" }],
          ["5xx", { status: 503, message: "LATE-SECRET" }],
        ] as const
      ).map(([failureName, error]) => [operation, failureName, error] as const),
    ),
  )(
    "does not read back or toast a late %s %s failure after authority replacement",
    async (operation, _, error) => {
      const user = userEvent.setup();
      let rejectWrite: (reason: unknown) => void = () => undefined;
      const pendingWrite = new Promise((__, reject) => {
        rejectWrite = reject;
      });
      if (operation === "create") mocks.create.mockReset().mockReturnValue(pendingWrite);
      else mocks.respond.mockReset().mockReturnValue(pendingWrite);
      const view = renderBuyback("en");
      await screen.findByText("华为 Mate 客制 Ω");
      if (operation === "create") {
        await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
        await user.type(screen.getByRole("textbox", { name: "Model" }), "Pending authority");
        fireEvent.click(screen.getByRole("button", { name: "Save transparent quote" }));
        await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
      } else {
        await user.click(screen.getByRole("button", { name: /BB-动态-001/ }));
        const detail = await screen.findByRole("dialog");
        await user.click(within(detail).getByRole("radio", { name: "Defer" }));
        fireEvent.click(within(detail).getByRole("button", { name: "Save Defer" }));
        await waitFor(() => expect(mocks.respond).toHaveBeenCalledTimes(1));
      }

      mocks.shell = shellState({
        activeStore: {
          id: "store-replacement",
          membershipId: "membership-replacement",
          name: "Replacement store",
          role: "owner",
        },
      });
      act(() => view.rerenderBuyback());
      await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
      const listReads = mocks.list.mock.calls.length;
      const historyReads = mocks.history.mock.calls.length;
      await act(async () => rejectWrite(error));
      await waitFor(() => {
        expect(mocks.list).toHaveBeenCalledTimes(listReads);
        expect(mocks.history).toHaveBeenCalledTimes(historyReads);
      });
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(operation === "create" ? mocks.create : mocks.respond).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).not.toContain("LATE-SECRET");
    },
  );

  it("fails closed across store A to no authority to store B without stale reads or writes", async () => {
    const user = userEvent.setup();
    const storeAItem = buybackItem({ item_label: "A-AUTHORITY-SENTINEL" });
    const storeBItem = buybackItem({ item_label: "B-authority item" });
    mocks.list.mockReset().mockResolvedValueOnce([storeAItem]).mockResolvedValueOnce([storeBItem]);
    const view = renderBuyback("en");
    await screen.findByText("A-AUTHORITY-SENTINEL");
    await user.click(screen.getByRole("button", { name: /BB-动态-001/ }));
    expect(await screen.findByRole("dialog")).toBeVisible();

    mocks.shell = shellState({ activeStore: undefined, status: "loading" });
    act(() => view.rerenderBuyback());
    expect(screen.queryAllByText("A-AUTHORITY-SENTINEL")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(1);

    mocks.shell = shellState({
      activeStore: {
        id: "store-second",
        membershipId: "membership-second",
        name: "Second store",
        role: "owner",
      },
    });
    act(() => view.rerenderBuyback());
    expect(screen.queryAllByText("A-AUTHORITY-SENTINEL")).toHaveLength(0);
    expect(await screen.findByText("B-authority item")).toBeVisible();
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.list.mock.calls[1]?.[0]).toHaveProperty("search", undefined);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(mocks.respond).not.toHaveBeenCalled();
  });

  it("clears same-store owner state before rendering the viewer authority", async () => {
    const user = userEvent.setup();
    const ownerItem = buybackItem({ item_label: "OWNER-AUTHORITY-SENTINEL" });
    const viewerItem = buybackItem({ item_label: "Viewer-safe item" });
    mocks.list
      .mockReset()
      .mockResolvedValueOnce([ownerItem])
      .mockResolvedValueOnce([ownerItem])
      .mockResolvedValueOnce([viewerItem]);
    mocks.create.mockReset().mockRejectedValue({ status: 400, message: "PROVIDER-SECRET" });
    const view = renderBuyback("en");
    await screen.findByText("OWNER-AUTHORITY-SENTINEL");
    fireEvent.change(screen.getAllByLabelText("Search buyback record or device")[0]!, {
      target: { value: "OWNER-SEARCH-SENTINEL" },
    });
    await user.click(screen.getAllByRole("button", { name: "New transparent quote" })[0]!);
    await user.type(screen.getByRole("textbox", { name: "Model" }), "OWNER-DRAFT-SENTINEL");
    fireEvent.click(screen.getByRole("button", { name: "Save transparent quote" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));

    mocks.shell = shellState({
      activeStore: {
        id: "store-dynamic",
        membershipId: "membership-owner",
        name: "Same store",
        role: "viewer",
      },
    });
    act(() => view.rerenderBuyback());
    expect(screen.queryAllByText("OWNER-AUTHORITY-SENTINEL")).toHaveLength(0);
    expect(screen.queryByDisplayValue("OWNER-DRAFT-SENTINEL")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("Viewer-safe item")).toBeVisible();
    expect(screen.getAllByLabelText("Search buyback record or device")[0]).toHaveValue("");
    expect(mocks.list).toHaveBeenCalledTimes(3);
    expect(mocks.list.mock.calls[2]?.[0]).toHaveProperty("search", undefined);
    expect(screen.getAllByRole("button", { name: "New transparent quote" })[0]).toBeDisabled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(mocks.respond).not.toHaveBeenCalled();
  });

  it("clears selected state before rendering a replacement membership in the same store", async () => {
    const user = userEvent.setup();
    const firstMembershipItem = buybackItem({ item_label: "MEMBERSHIP-A-SENTINEL" });
    const replacementItem = buybackItem({ item_label: "Replacement membership item" });
    mocks.list
      .mockReset()
      .mockResolvedValueOnce([firstMembershipItem])
      .mockResolvedValueOnce([replacementItem]);
    const view = renderBuyback("en");
    await screen.findByText("MEMBERSHIP-A-SENTINEL");
    await user.click(screen.getByRole("button", { name: /BB-动态-001/ }));
    expect(await screen.findByRole("dialog")).toBeVisible();

    mocks.shell = shellState({
      activeStore: {
        id: "store-dynamic",
        membershipId: "membership-replacement",
        name: "Same store",
        role: "owner",
      },
    });
    act(() => view.rerenderBuyback());
    expect(screen.queryAllByText("MEMBERSHIP-A-SENTINEL")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("Replacement membership item")).toBeVisible();
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(mocks.respond).not.toHaveBeenCalled();
  });
});

function LocaleController() {
  const { setLocale } = useLocale();
  mocks.setLocale = setLocale;
  return null;
}

function renderBuyback(locale: AppLocale, switcher = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale={locale}>
        <SidebarProvider>
          {switcher ? <LocaleController /> : null}
          <BuybackScreen />
        </SidebarProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
  const view = render(tree());
  return {
    ...view,
    queryClient: client,
    rerenderBuyback: () => view.rerender(tree()),
  };
}

function shellState(overrides: Record<string, unknown> = {}) {
  const activeStore = Object.prototype.hasOwnProperty.call(overrides, "activeStore")
    ? (overrides.activeStore as Record<string, unknown> | undefined)
    : {
        id: "store-dynamic",
        membershipId: "membership-owner",
        name: "门店 动态 Ω",
        role: "owner",
      };
  const status = (overrides.status as string | undefined) ?? "ready";
  const authorityFingerprint =
    (overrides.authorityFingerprint as string | undefined) ??
    [
      activeStore?.id ?? "no-store",
      activeStore?.membershipId ?? "no-membership",
      activeStore?.role ?? "no-role",
    ].join("|");
  return {
    status,
    isLoading: false,
    activeStore,
    authorityFingerprint,
    retry: vi.fn(),
    statusLabel: "RAW-STORE-TITLE",
    statusDescription: "RAW-STORE-DESCRIPTION",
    ...overrides,
  };
}

function buybackItem(overrides: Partial<InventoryListItem> = {}): InventoryListItem {
  return {
    id: "record-dynamic",
    public_no: "BB-动态-001",
    status: "offer_made",
    source_type: "buyback",
    category: "phone",
    brand: "华为",
    model: "Mate 客制 Ω",
    color: "朱红 客制",
    storage_capacity: "256GB",
    identifier_kind: "imei1",
    serial_or_imei: "490154203237518",
    imei_check_status: "pass",
    activation_lock_status: "pass",
    data_wipe_status: "unchecked",
    cosmetic_grade: "good",
    functional_grade: "passed",
    battery_health: 87,
    buyback_price: 0,
    list_price: 0,
    sale_price: 0,
    deposit_amount: 0,
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: "EUR",
    warranty_months: 0,
    legacy_payload: {
      buyback_quote: {
        reference_low: 350,
        reference_high: 420,
        final_offer: 400,
        deductions: [{ code: "custom-dynamic", label: "动态扣减 Ω", amount: 20 }],
        current_revision_id: "revision-dynamic",
        intent_outcome: "future-outcome",
        risk_level: "future-risk",
        expires_at: "2026-10-28T01:30:00.000Z",
      },
    },
    created_at: "2026-10-24T00:30:00.000Z",
    updated_at: "2026-10-25T00:30:00.000Z",
    item_label: "华为 Mate 客制 Ω",
    profit: 0,
    ...overrides,
  };
}

function historyResult() {
  return {
    revisions: [
      {
        id: "revision-dynamic",
        revision_no: 1,
        kind: "reprice" as const,
        quote: {
          reference_low: 350,
          reference_high: 420,
          final_offer: 400,
          deductions: [],
          risk_level: "low" as const,
          hard_block: false,
          expires_at: "2026-10-28T01:30:00.000Z",
        },
        change_reason: "动态改价原因 Ω",
        actor_name: "员工 动态 Ω",
        created_at: "2026-10-25T00:30:00.000Z",
      },
    ],
    responses: [],
  };
}

function commandResult(code: "created" | "revised" | "response_recorded") {
  return {
    ok: true as const,
    code,
    item_id: "record-dynamic",
    quote_revision_id: "revision-dynamic",
    updated_at: "2026-10-25T00:30:00.000Z",
  };
}

function normalizeIds<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, current) =>
      key === "record_id" || key === "idempotency_key"
        ? "<uuid>"
        : key === "expires_at"
          ? "<iso>"
          : current,
    ),
  ) as T;
}
