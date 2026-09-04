import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/features/messages/model/message-template-defaults";
import { storesKeys } from "@/features/stores/api/query-keys";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type { MessageTemplate, StoreContext, StoreSettings } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

import { MessagesScreen } from "./messages-screen";

const apiMocks = vi.hoisted(() => ({
  getStoreSettings: vi.fn(),
  listMessageTemplates: vi.fn(),
  resetMessageTemplate: vi.fn(),
  updateMessageTemplate: vi.fn(),
}));
const shellMocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  ...apiMocks,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  document.cookie = "repairdesk_locale=; Max-Age=0; path=/";
  window.history.replaceState({}, "", "/");
});

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = shellContext();
  apiMocks.listMessageTemplates.mockResolvedValue(templateFixtures());
  apiMocks.getStoreSettings.mockResolvedValue(storeSettingsFixture());
  apiMocks.updateMessageTemplate.mockImplementation(
    async (id: string, input: Partial<MessageTemplate>) => ({
      ...templateFixtures().find((template) => template.id === id)!,
      ...input,
    }),
  );
  apiMocks.resetMessageTemplate.mockImplementation(async (id: string) => ({
    ...templateFixtures().find((template) => template.id === id)!,
  }));
});

describe("MessagesScreen i18n and authority boundaries", () => {
  it.each([
    ["zh-CN" as const, "工单通知", "后台标签", "变量助手", "实时预览"],
    [
      "it-IT" as const,
      "Notifiche ordine",
      "Etichetta interna",
      "Assistente variabili",
      "Anteprima in tempo reale",
    ],
    ["en" as const, "Order notifications", "Internal label", "Variable assistant", "Live preview"],
  ])(
    "localizes fixed staff presentation in %s without changing customer bytes",
    async (locale, domain, label, assistant, previewTitle) => {
      const originalTemplates = structuredClone(templateFixtures());
      const originalStoreSettings = storeSettingsFixture();
      apiMocks.getStoreSettings.mockResolvedValueOnce(originalStoreSettings);
      renderMessages(locale);

      expect(await screen.findByText(domain)).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByText(assistant)).toBeVisible();
      expect(screen.getByText(previewTitle)).toBeVisible();
      expect(screen.getByDisplayValue(originalTemplates[0].label)).toHaveValue(
        "报价审批 RAW_LABEL 北店",
      );
      expect(screen.getByLabelText(bodyLabelCopy(locale))).toHaveValue(
        originalTemplates[0].body_template,
      );
      expect(document.querySelector("pre")?.textContent).toBe(expectedPreview());
      fireEvent.click(screen.getByRole("button", { name: /客户通用 RAW_LABEL/ }));
      await waitFor(() =>
        expect(document.querySelector("pre")?.textContent).toBe(expectedCustomerPreview()),
      );
      expect(screen.getByLabelText(bodyLabelCopy(locale))).toHaveValue(
        originalTemplates[1].body_template,
      );
      expect(apiMocks.listMessageTemplates.mock.calls[0]?.[0]).toEqual({
        signal: expect.any(AbortSignal),
      });
      expect(apiMocks.getStoreSettings.mock.calls[0]?.[0]).toEqual({
        signal: expect.any(AbortSignal),
      });
      expect(templateFixtures()).toEqual(originalTemplates);
      expect(originalStoreSettings.message_signature).toBe("Firma RAW 北店");
      expect(originalStoreSettings.print_footer).toBe("Footer italiano RAW 北店");
    },
  );

  it("keeps every enabled production default sendable while preserving its canonical bytes", async () => {
    const defaults = DEFAULT_MESSAGE_TEMPLATES.filter((template) => template.enabled).map(
      (template) => ({
        ...template,
        store_id: "store-a",
        created_at: "2026-09-03T08:00:00.000Z",
        updated_at: "2026-09-03T08:00:00.000Z",
      }),
    );
    const originalDefaults = structuredClone(defaults);
    apiMocks.listMessageTemplates.mockResolvedValueOnce(defaults);
    const user = userEvent.setup();
    renderMessages("en");

    for (const kind of ["parts_update", "repair_status", "cancelled"]) {
      const template = defaults.find((candidate) => candidate.kind === kind)!;
      await user.click(await screen.findByRole("button", { name: new RegExp(template.label) }));
      expect(screen.getByLabelText("Template body")).toHaveValue(template.body_template);
      expect(screen.queryByText(/Unknown variables:/)).not.toBeInTheDocument();
      expect(screen.getAllByText("Ready to send").length).toBeGreaterThan(0);
    }
    expect(defaults).toEqual(originalDefaults);
  });

  it.each([
    ["zh-CN" as const, "店铺对外信息读取失败，预览暂不可用。"],
    [
      "it-IT" as const,
      "Lettura dei dati pubblici del negozio non riuscita; anteprima non disponibile.",
    ],
    ["en" as const, "Could not load public store details; preview is unavailable."],
  ])("fails closed when the store preview context rejects in %s", async (locale, copy) => {
    apiMocks.getStoreSettings.mockRejectedValueOnce(
      Object.assign(new Error("RAW_STORE_PROVIDER_SENTINEL"), {
        code: "RAW_STORE_CODE_SENTINEL",
        details: { sql: "RAW_STORE_DETAILS_SENTINEL" },
      }),
    );
    renderMessages(locale);
    expect(await screen.findByText(copy)).toBeVisible();
    expect(document.querySelector("pre")?.textContent).not.toContain("Gentile Mario Rossi");
    expect(document.body.textContent).not.toMatch(/RAW_STORE_(PROVIDER|CODE|DETAILS)_SENTINEL/);
  });

  it("does not issue either read or any write when template read permission is absent", async () => {
    shellMocks.value = shellContext({ canReadMessageTemplates: false });
    renderMessages("en");

    expect(await screen.findByText("Message templates cannot be opened")).toBeVisible();
    await waitFor(() => {
      expect(apiMocks.listMessageTemplates).not.toHaveBeenCalled();
      expect(apiMocks.getStoreSettings).not.toHaveBeenCalled();
    });
    expect(apiMocks.updateMessageTemplate).not.toHaveBeenCalled();
    expect(apiMocks.resetMessageTemplate).not.toHaveBeenCalled();
  });

  it("omits the store-settings read and shows a truthful unavailable preview without that capability", async () => {
    shellMocks.value = shellContext({ canReadStoreSettings: false });
    renderMessages("it-IT");

    expect(await screen.findByText(/anteprima non disponibile/i)).toBeVisible();
    expect(apiMocks.listMessageTemplates).toHaveBeenCalledTimes(1);
    expect(apiMocks.getStoreSettings).not.toHaveBeenCalled();
    expect(document.querySelector("pre")?.textContent).not.toContain("Firma RAW 北店");
  });

  it("shows safe localized template and store-setting loading/error/empty states", async () => {
    const templatesDeferred = deferred<MessageTemplate[]>();
    apiMocks.listMessageTemplates.mockReturnValueOnce(templatesDeferred.promise);
    const loading = renderMessages("en");
    expect(
      document.querySelectorAll("[data-ui='repair-os-list-content'] .animate-pulse"),
    ).toHaveLength(6);
    loading.unmount();

    apiMocks.listMessageTemplates.mockRejectedValueOnce(
      Object.assign(new Error("RAW_SQL_TEMPLATE_SENTINEL"), {
        code: "RAW_CODE_SENTINEL",
        details: { provider: "RAW_DETAILS_SENTINEL" },
        fieldErrors: { body_template: ["RAW_FIELD_SENTINEL"] },
      }),
    );
    const failed = renderMessages("it-IT");
    expect(await screen.findByText("Lettura dei modelli non riuscita")).toBeVisible();
    expect(document.body.textContent).not.toMatch(/RAW_(SQL|CODE|DETAILS|FIELD)_SENTINEL/);
    failed.unmount();

    apiMocks.listMessageTemplates.mockResolvedValueOnce([]);
    renderMessages("zh-CN");
    expect(await screen.findByText("暂无消息模板")).toBeVisible();
  });

  it.each([
    ["zh-CN" as const, "正在读取店铺对外信息，预览暂不可用。"],
    ["it-IT" as const, "Lettura dei dati pubblici del negozio; anteprima non disponibile."],
    ["en" as const, "Loading public store details; preview is unavailable."],
  ])(
    "does not fabricate a partial preview while store settings load in %s",
    async (locale, copy) => {
      apiMocks.getStoreSettings.mockReturnValueOnce(deferred<StoreSettings>().promise);
      renderMessages(locale);
      expect(await screen.findByText(copy)).toBeVisible();
      expect(document.querySelector("pre")?.textContent).not.toContain("Gentile Mario Rossi");
    },
  );

  it("localizes search, readonly, selection and stable health/variable identities without reverse-mapping labels", async () => {
    shellMocks.value = shellContext({ canUpdateMessageTemplates: false });
    renderMessages("en");
    expect(await screen.findByText(/cannot edit, restore, or save/)).toBeVisible();
    expect(screen.getByDisplayValue("报价审批 RAW_LABEL 北店")).toBeDisabled();
    expect(screen.getByTitle("Insert Customer name")).toHaveTextContent("Customer name");

    const search = screen.getAllByPlaceholderText("Search templates")[0];
    fireEvent.change(search, { target: { value: "customer_general" } });
    fireEvent.click(await screen.findByRole("button", { name: /客户通用 RAW_LABEL/ }));
    expect(await screen.findByDisplayValue("客户通用 RAW_LABEL")).toBeVisible();
    expect(screen.getByText("No matching templates")).toBeVisible();
  });

  it.each([
    ["zh-CN" as const, "存在未知变量：{{RAW_unknown_token}}"],
    ["it-IT" as const, "Variabili sconosciute: {{RAW_unknown_token}}"],
    ["en" as const, "Unknown variables: {{RAW_unknown_token}}"],
  ])("uses stable health issue keys for unknown variables in %s", async (locale, issueCopy) => {
    apiMocks.listMessageTemplates.mockResolvedValueOnce([
      { ...templateFixtures()[0], body_template: "Ciao {{RAW_unknown_token}}" },
    ]);
    renderMessages(locale);
    expect(await screen.findByText(issueCopy)).toBeVisible();
    if (locale !== "zh-CN") {
      expect(document.body.textContent).not.toContain("存在未知变量");
      expect(document.body.textContent).not.toContain("模板包含阻断问题");
    }
  });

  it.each([
    ["zh-CN" as const, "已停用", "模板已启用，但正文为空", "建议复核"],
    [
      "it-IT" as const,
      "Disattivato",
      "Il modello è attivo ma il corpo è vuoto",
      "Controllo consigliato",
    ],
    [
      "en" as const,
      "Disabled",
      "The template is enabled but its body is empty",
      "Review recommended",
    ],
  ])(
    "presents disabled, blocking and warning health states from stable state in %s",
    async (locale, disabled, empty, warning) => {
      renderMessages(locale);
      fireEvent.click(await screen.findByRole("button", { name: /客户通用 RAW_LABEL/ }));
      expect(screen.getAllByText(disabled).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button", { name: /Empty RAW_LABEL/ }));
      expect(await screen.findByText(empty)).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: /Long RAW_LABEL/ }));
      expect((await screen.findAllByText(warning)).length).toBeGreaterThan(0);
    },
  );

  it.each([
    ["zh-CN" as const, "模板已保存", "已恢复默认模板"],
    ["it-IT" as const, "Modello salvato", "Modello predefinito ripristinato"],
    ["en" as const, "Template saved", "Default template restored"],
  ])(
    "submits byte-exact save/reset requests once per same-tick activation in %s",
    async (locale, savedCopy, resetCopy) => {
      const saveDeferred = deferred<MessageTemplate>();
      apiMocks.updateMessageTemplate.mockReturnValueOnce(saveDeferred.promise);
      const user = userEvent.setup();
      renderMessages(locale);

      const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
      const body = screen.getByLabelText(bodyLabelCopy(locale));
      await user.clear(label);
      await user.type(label, "Etichetta draft 北店");
      fireEvent.change(body, {
        target: { value: "Gentile {{customer_name}},\nFirma {{message_signature}}" },
      });
      const saveButtons = screen.getAllByRole("button", {
        name:
          locale === "zh-CN" ? /保存模板/ : locale === "it-IT" ? /Salva modello/ : /Save template/,
      });
      fireEvent.click(saveButtons[0]);
      fireEvent.click(saveButtons.at(-1)!);
      await waitFor(() => expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateMessageTemplate).toHaveBeenCalledWith("template-order", {
        label: "Etichetta draft 北店",
        body_template: "Gentile {{customer_name}},\nFirma {{message_signature}}",
        enabled: true,
      });
      await act(async () =>
        saveDeferred.resolve({
          ...templateFixtures()[0],
          label: "Etichetta draft 北店",
          body_template: "Gentile {{customer_name}},\nFirma {{message_signature}}",
        }),
      );
      await waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith(savedCopy));

      const resetDeferred = deferred<MessageTemplate>();
      apiMocks.resetMessageTemplate.mockReturnValueOnce(resetDeferred.promise);
      const resetButton = screen.getByRole("button", {
        name:
          locale === "zh-CN"
            ? "恢复默认"
            : locale === "it-IT"
              ? "Ripristina predefinito"
              : "Restore default",
      });
      await waitFor(() => expect(resetButton).toBeEnabled());
      fireEvent.click(resetButton);
      fireEvent.click(resetButton);
      await waitFor(() => expect(apiMocks.resetMessageTemplate).toHaveBeenCalledTimes(1));
      expect(apiMocks.resetMessageTemplate).toHaveBeenCalledWith("template-order");
      await act(async () => resetDeferred.resolve(templateFixtures()[0]));
      expect(toastMocks.success).toHaveBeenCalledWith(resetCopy);
    },
  );

  it.each([
    ["zh-CN" as const, "保存失败，请稍后重试。", "恢复失败，请稍后重试。"],
    [
      "it-IT" as const,
      "Salvataggio non riuscito. Riprova più tardi.",
      "Ripristino non riuscito. Riprova più tardi.",
    ],
    [
      "en" as const,
      "Could not save. Try again later.",
      "Could not restore the template. Try again later.",
    ],
  ])(
    "contains rejected save/reset diagnostics and preserves the focused draft in %s",
    async (locale, saveCopy, resetCopy) => {
      const raw = new RepairDeskApiError(
        "RAW_PROVIDER_MESSAGE_SENTINEL",
        500,
        "RAW_CODE_SENTINEL",
        { sql: "RAW_DETAILS_SENTINEL" },
        "RAW_REQUEST_SENTINEL",
        { label: ["RAW_FIELD_SENTINEL"] },
      );
      apiMocks.updateMessageTemplate.mockRejectedValueOnce(raw);
      apiMocks.resetMessageTemplate.mockRejectedValueOnce(raw);
      const user = userEvent.setup();
      renderMessages(locale);
      const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
      await user.clear(label);
      await user.type(label, "Draft retained 北店");
      label.focus();
      await user.click(
        screen.getAllByRole("button", { name: new RegExp(saveButtonCopy(locale)) })[0],
      );
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(saveCopy));
      expect(screen.getByDisplayValue("Draft retained 北店")).toBe(label);
      expect(document.body.textContent).not.toMatch(
        /RAW_(PROVIDER|CODE|DETAILS|FIELD|REQUEST)_SENTINEL/,
      );

      apiMocks.updateMessageTemplate.mockResolvedValueOnce({
        ...templateFixtures()[0],
        label: "Draft retained 北店",
      });
      await user.click(
        screen.getAllByRole("button", { name: new RegExp(saveButtonCopy(locale)) })[0],
      );
      await waitFor(() => expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(2));
      expect(apiMocks.updateMessageTemplate.mock.calls[1]).toEqual(
        apiMocks.updateMessageTemplate.mock.calls[0],
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: resetButtonCopy(locale) })).toBeEnabled(),
      );

      await user.click(screen.getByRole("button", { name: resetButtonCopy(locale) }));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(resetCopy));
      expect(screen.getByDisplayValue("Draft retained 北店")).toBe(label);
    },
  );

  it("switches locale without domain I/O and preserves search, selection, draft, focus, cursor and exact preview", async () => {
    window.history.replaceState({}, "", "/messages?source=staff");
    const routeBefore = `${window.location.pathname}${window.location.search}`;
    const user = userEvent.setup();
    renderMessages("zh-CN", true);
    await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
    const search = screen.getAllByPlaceholderText("搜索模板")[0];
    await user.type(search, "customer_general");
    await user.click(await screen.findByRole("button", { name: /客户通用 RAW_LABEL/ }));
    const label = await screen.findByDisplayValue("客户通用 RAW_LABEL");
    await user.clear(label);
    await user.type(label, "Focused draft 北店");
    const body = screen.getByLabelText("模板正文") as HTMLTextAreaElement;
    body.focus();
    body.setSelectionRange(7, 18);
    const previewBefore = document.querySelector("pre")?.textContent;
    const readsBefore = [
      apiMocks.listMessageTemplates.mock.calls.length,
      apiMocks.getStoreSettings.mock.calls.length,
    ];

    fireEvent.click(screen.getByRole("button", { name: "switch-it" }));
    expect(await screen.findByText("Messaggi cliente")).toBeVisible();
    expect(screen.getByDisplayValue("Focused draft 北店")).toBe(label);
    expect(screen.getByLabelText("Corpo del modello")).toBe(body);
    expect(body).toHaveFocus();
    expect([body.selectionStart, body.selectionEnd]).toEqual([7, 18]);
    expect(document.querySelector("pre")?.textContent).toBe(previewBefore);
    expect(screen.getAllByPlaceholderText("Cerca modelli")[0]).toHaveValue("customer_general");
    expect(apiMocks.listMessageTemplates).toHaveBeenCalledTimes(readsBefore[0]);
    expect(apiMocks.getStoreSettings).toHaveBeenCalledTimes(readsBefore[1]);
    expect(`${window.location.pathname}${window.location.search}`).toBe(routeBefore);

    fireEvent.click(screen.getByRole("button", { name: "switch-en" }));
    expect(await screen.findByText("Customer messages")).toBeVisible();
    expect(body).toHaveFocus();
    expect([body.selectionStart, body.selectionEnd]).toEqual([7, 18]);
    expect(apiMocks.updateMessageTemplate).not.toHaveBeenCalled();
    expect(apiMocks.resetMessageTemplate).not.toHaveBeenCalled();
    expect(`${window.location.pathname}${window.location.search}`).toBe(routeBefore);
  });

  it.each(["resolve", "reject"] as const)(
    "suppresses stale save %s after a same-store authority downgrade",
    async (outcome) => {
      const pending = deferred<MessageTemplate>();
      void pending.promise.catch(() => undefined);
      apiMocks.updateMessageTemplate.mockReturnValueOnce(pending.promise);
      const { queryClient, rerender } = renderMessages("en");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const user = userEvent.setup();
      const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
      await user.clear(label);
      await user.type(label, "Pending secret draft");
      await user.click(screen.getAllByRole("button", { name: /Save template/ })[0]);
      expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(1);

      shellMocks.value = shellContext({ canUpdateMessageTemplates: false });
      rerender(messagesTree("en", queryClient));
      await screen.findByText(/cannot edit, restore, or save/);
      invalidate.mockClear();
      toastMocks.success.mockClear();
      toastMocks.error.mockClear();
      await act(async () => {
        if (outcome === "resolve")
          pending.resolve({ ...templateFixtures()[0], label: "STALE_RESULT" });
        else pending.reject(new Error("RAW_LATE_REJECT_SENTINEL"));
      });
      await waitFor(() => expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(1));
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(/STALE_RESULT|RAW_LATE_REJECT_SENTINEL/);
    },
  );

  it.each(["resolve", "reject"] as const)(
    "suppresses stale reset %s after switching store A through none to B",
    async (outcome) => {
      const pending = deferred<MessageTemplate>();
      void pending.promise.catch(() => undefined);
      apiMocks.resetMessageTemplate.mockReturnValueOnce(pending.promise);
      const { queryClient, rerender } = renderMessages("it-IT");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Ripristina predefinito" }));
      shellMocks.value = shellContext({ storeId: null });
      rerender(messagesTree("it-IT", queryClient));
      shellMocks.value = shellContext({ storeId: "store-b" });
      apiMocks.listMessageTemplates.mockResolvedValueOnce([]);
      rerender(messagesTree("it-IT", queryClient));
      invalidate.mockClear();
      toastMocks.success.mockClear();
      toastMocks.error.mockClear();
      await act(async () => {
        if (outcome === "resolve")
          pending.resolve({ ...templateFixtures()[0], label: "STALE_RESET" });
        else pending.reject(new Error("RAW_LATE_RESET_SENTINEL"));
      });
      await waitFor(() => expect(apiMocks.resetMessageTemplate).toHaveBeenCalledTimes(1));
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(/STALE_RESET|RAW_LATE_RESET_SENTINEL/);
      expect(apiMocks.resetMessageTemplate).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["resolve", "reject"] as const)(
    "suppresses stale save %s after switching store A through none to B",
    async (outcome) => {
      const pending = deferred<MessageTemplate>();
      void pending.promise.catch(() => undefined);
      apiMocks.updateMessageTemplate.mockReturnValueOnce(pending.promise);
      const { queryClient, rerender } = renderMessages("en");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const user = userEvent.setup();
      const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
      await user.clear(label);
      await user.type(label, "Pending store-switch draft");
      await user.click(screen.getAllByRole("button", { name: /Save template/ })[0]);
      shellMocks.value = shellContext({ storeId: null });
      rerender(messagesTree("en", queryClient));
      shellMocks.value = shellContext({ storeId: "store-b" });
      apiMocks.listMessageTemplates.mockResolvedValueOnce([]);
      rerender(messagesTree("en", queryClient));
      invalidate.mockClear();
      toastMocks.success.mockClear();
      toastMocks.error.mockClear();
      await act(async () => {
        if (outcome === "resolve")
          pending.resolve({ ...templateFixtures()[0], label: "STALE_SAVE_STORE" });
        else pending.reject(new Error("RAW_LATE_SAVE_STORE_SENTINEL"));
      });
      await waitFor(() => expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(1));
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(
        /STALE_SAVE_STORE|RAW_LATE_SAVE_STORE_SENTINEL/,
      );
    },
  );

  it.each(["resolve", "reject"] as const)(
    "suppresses stale reset %s after a same-store authority downgrade",
    async (outcome) => {
      const pending = deferred<MessageTemplate>();
      void pending.promise.catch(() => undefined);
      apiMocks.resetMessageTemplate.mockReturnValueOnce(pending.promise);
      const { queryClient, rerender } = renderMessages("zh-CN");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "恢复默认" }));
      shellMocks.value = shellContext({ canUpdateMessageTemplates: false });
      rerender(messagesTree("zh-CN", queryClient));
      await screen.findByText(/不能修改、恢复或保存/);
      invalidate.mockClear();
      toastMocks.success.mockClear();
      toastMocks.error.mockClear();
      await act(async () => {
        if (outcome === "resolve")
          pending.resolve({ ...templateFixtures()[0], label: "STALE_RESET_AUTH" });
        else pending.reject(new Error("RAW_LATE_RESET_AUTH_SENTINEL"));
      });
      await waitFor(() => expect(apiMocks.resetMessageTemplate).toHaveBeenCalledTimes(1));
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(
        /STALE_RESET_AUTH|RAW_LATE_RESET_AUTH_SENTINEL/,
      );
    },
  );

  it.each([
    ["save", "downgrade", "resolve"],
    ["save", "downgrade", "reject"],
    ["save", "switch", "resolve"],
    ["save", "switch", "reject"],
    ["reset", "downgrade", "resolve"],
    ["reset", "downgrade", "reject"],
    ["reset", "switch", "resolve"],
    ["reset", "switch", "reject"],
  ] as const)(
    "consults live cached authority before a %s %s %s without waiting for rerender",
    async (action, authorityChange, outcome) => {
      const pending = deferred<MessageTemplate>();
      void pending.promise.catch(() => undefined);
      if (action === "save") apiMocks.updateMessageTemplate.mockReturnValueOnce(pending.promise);
      else apiMocks.resetMessageTemplate.mockReturnValueOnce(pending.promise);
      const { queryClient } = renderMessages("en");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const user = userEvent.setup();
      if (action === "save") {
        const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
        await user.clear(label);
        await user.type(label, "CACHE_AUTH_DRAFT");
        await user.click(screen.getAllByRole("button", { name: /Save template/ })[0]);
        await waitFor(() => expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(1));
      } else {
        await user.click(await screen.findByRole("button", { name: "Restore default" }));
        await waitFor(() => expect(apiMocks.resetMessageTemplate).toHaveBeenCalledTimes(1));
      }

      if (authorityChange === "downgrade") {
        queryClient.setQueryData(
          storesKeys.context,
          cachedStoreContext("store-a", { canUpdateMessageTemplates: false }),
        );
      } else {
        queryClient.setQueryData(storesKeys.context, cachedStoreContext(null));
        queryClient.setQueryData(storesKeys.context, cachedStoreContext("store-b"));
      }
      invalidate.mockClear();
      toastMocks.success.mockClear();
      toastMocks.error.mockClear();
      await act(async () => {
        if (outcome === "resolve") {
          pending.resolve({ ...templateFixtures()[0], label: "STALE_CACHE_RESULT" });
          await pending.promise;
        } else {
          pending.reject(new Error("RAW_CACHE_AUTH_REJECT"));
          await pending.promise.catch(() => undefined);
        }
      });

      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(/STALE_CACHE_RESULT|RAW_CACHE_AUTH_REJECT/);
    },
  );

  it.each([
    ["save", "resolve"],
    ["save", "reject"],
    ["reset", "resolve"],
    ["reset", "reject"],
  ] as const)(
    "rejects a no-rerender same-store membership replacement before %s %s side effects",
    async (action, outcome) => {
      const pending = deferred<MessageTemplate>();
      void pending.promise.catch(() => undefined);
      if (action === "save") apiMocks.updateMessageTemplate.mockReturnValueOnce(pending.promise);
      else apiMocks.resetMessageTemplate.mockReturnValueOnce(pending.promise);
      const { queryClient } = renderMessages("it-IT");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const user = userEvent.setup();
      if (action === "save") {
        const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
        await user.clear(label);
        await user.type(label, "MEMBERSHIP_PENDING_DRAFT");
        await user.click(screen.getAllByRole("button", { name: /Salva modello/ })[0]);
        await waitFor(() => expect(apiMocks.updateMessageTemplate).toHaveBeenCalledTimes(1));
      } else {
        await user.click(await screen.findByRole("button", { name: "Ripristina predefinito" }));
        await waitFor(() => expect(apiMocks.resetMessageTemplate).toHaveBeenCalledTimes(1));
      }

      queryClient.setQueryData(
        storesKeys.context,
        cachedStoreContext(
          "store-a",
          { canReadMessageTemplates: true, canUpdateMessageTemplates: true },
          { membershipId: "replacement-membership", role: "viewer", status: "inactive" },
        ),
      );
      invalidate.mockClear();
      toastMocks.success.mockClear();
      toastMocks.error.mockClear();
      await act(async () => {
        if (outcome === "resolve") {
          pending.resolve({ ...templateFixtures()[0], label: "STALE_MEMBERSHIP_RESULT" });
          await pending.promise;
        } else {
          pending.reject(new Error("RAW_MEMBERSHIP_REJECT_SENTINEL"));
          await pending.promise.catch(() => undefined);
        }
      });

      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(
        screen.getByDisplayValue(
          action === "save" ? "MEMBERSHIP_PENDING_DRAFT" : "报价审批 RAW_LABEL 北店",
        ),
      ).toBeVisible();
      expect(document.body.textContent).not.toMatch(
        /STALE_MEMBERSHIP_RESULT|RAW_MEMBERSHIP_REJECT_SENTINEL/,
      );
    },
  );

  it.each(["downgrade", "identity"] as const)(
    "drops sensitive drafts on same-store %s authority replacement",
    async (replacement) => {
      const { queryClient, rerender } = renderMessages("en");
      const user = userEvent.setup();
      const label = await screen.findByDisplayValue("报价审批 RAW_LABEL 北店");
      const body = screen.getByLabelText("Template body");
      await user.clear(label);
      await user.type(label, "SENSITIVE_AUTH_DRAFT");
      fireEvent.change(body, { target: { value: "SENSITIVE_PREVIEW_DRAFT" } });
      expect(document.body.textContent).toContain("SENSITIVE_PREVIEW_DRAFT");

      if (replacement === "downgrade") {
        queryClient.setQueryData(
          storesKeys.context,
          cachedStoreContext("store-a", { canUpdateMessageTemplates: false }),
        );
        shellMocks.value = shellContext({ canUpdateMessageTemplates: false });
      } else {
        shellMocks.value = shellContext({ identity: "replacement-user" });
      }
      rerender(messagesTree("en", queryClient));
      await waitFor(() => {
        expect(document.body.textContent).not.toMatch(
          /SENSITIVE_AUTH_DRAFT|SENSITIVE_PREVIEW_DRAFT/,
        );
      });
      expect(screen.getByDisplayValue("报价审批 RAW_LABEL 北店")).toBeVisible();
      expect(apiMocks.updateMessageTemplate).not.toHaveBeenCalled();
      expect(apiMocks.resetMessageTemplate).not.toHaveBeenCalled();
    },
  );
});

function renderMessages(locale: "zh-CN" | "it-IT" | "en", switches = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(storesKeys.context, cachedStoreContextFromShell());
  const view = render(messagesTree(locale, queryClient, switches));
  return { ...view, queryClient };
}

function cachedStoreContextFromShell(): StoreContext {
  const activeStore = shellMocks.value.activeStore as StoreContext["activeStore"];
  const permissions = shellMocks.value.permissions as StoreContext["permissions"];
  return {
    activeStore,
    stores: activeStore ? [activeStore] : [],
    permissions,
  };
}

function cachedStoreContext(
  storeId: string | null,
  permissionOverrides: Partial<NonNullable<StoreContext["permissions"]>> = {},
  membershipOverrides: Partial<NonNullable<StoreContext["activeStore"]>> = {},
): StoreContext {
  const activeStore = storeId
    ? {
        id: storeId,
        membershipId: `membership-${storeId}`,
        name: `Store ${storeId}`,
        slug: storeId,
        role: "owner" as const,
        status: "active" as const,
        ...membershipOverrides,
      }
    : undefined;
  return {
    activeStore,
    stores: activeStore ? [activeStore] : [],
    permissions: activeStore
      ? {
          canReadSuppliers: true,
          canAssignSuppliers: true,
          canManageSuppliers: true,
          canReadMessageTemplates: true,
          canUpdateMessageTemplates: true,
          ...permissionOverrides,
        }
      : undefined,
  };
}

function messagesTree(locale: "zh-CN" | "it-IT" | "en", queryClient: QueryClient, switches = true) {
  return (
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          {switches ? <LocaleSwitches /> : null}
          <MessagesScreen />
        </SidebarProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}

function LocaleSwitches() {
  const { setLocale } = useLocale();
  return (
    <>
      <button type="button" onClick={() => setLocale("it-IT")}>
        switch-it
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        switch-en
      </button>
    </>
  );
}

function shellContext({
  storeId = "store-a",
  canReadMessageTemplates = true,
  canReadStoreSettings = true,
  canUpdateMessageTemplates = true,
  identity = "owner-user",
}: {
  storeId?: string | null;
  canReadMessageTemplates?: boolean;
  canReadStoreSettings?: boolean;
  canUpdateMessageTemplates?: boolean;
  identity?: string;
} = {}) {
  return {
    activeStore: storeId
      ? {
          id: storeId,
          membershipId: `membership-${storeId}`,
          name: `Store ${storeId}`,
          role: "owner",
          status: "active",
        }
      : undefined,
    authorityFingerprint: `${identity}|${storeId ?? "none"}|${canReadMessageTemplates}|${canReadStoreSettings}|${canUpdateMessageTemplates}`,
    isLoading: false,
    permissions: {
      canReadMessageTemplates,
      canReadStoreSettings,
      canUpdateMessageTemplates,
    },
  };
}

function templateFixtures(): MessageTemplate[] {
  return [
    {
      id: "template-order",
      store_id: "store-a",
      domain: "order",
      kind: "approval_request",
      channel: "whatsapp",
      language: "it",
      label: "报价审批 RAW_LABEL 北店",
      body_template: "Gentile {{customer_name}},\nOrdine {{order_no}}\n{{message_signature}}",
      enabled: true,
      sort_order: 10,
      created_at: "2026-09-03T08:00:00.000Z",
      updated_at: "2026-09-03T08:00:00.000Z",
    },
    {
      id: "template-customer",
      store_id: "store-a",
      domain: "customer",
      kind: "customer_general",
      channel: "sms",
      language: "it",
      label: "客户通用 RAW_LABEL",
      body_template: "Gentile {{customer_name}},\n{{latest_order_line}}\n{{message_signature}}",
      enabled: false,
      sort_order: 20,
      created_at: "2026-09-03T08:00:00.000Z",
      updated_at: "2026-09-03T08:00:00.000Z",
    },
    {
      id: "template-empty",
      store_id: "store-a",
      domain: "order",
      kind: "repair_status",
      channel: "whatsapp",
      language: "it",
      label: "Empty RAW_LABEL",
      body_template: "",
      enabled: true,
      sort_order: 30,
      created_at: "2026-09-03T08:00:00.000Z",
      updated_at: "2026-09-03T08:00:00.000Z",
    },
    {
      id: "template-long",
      store_id: "store-a",
      domain: "order",
      kind: "parts_update",
      channel: "whatsapp",
      language: "it",
      label: "Long RAW_LABEL",
      body_template: Array.from({ length: 19 }, (_, index) => `Riga ${index + 1}`).join("\n"),
      enabled: true,
      sort_order: 40,
      created_at: "2026-09-03T08:00:00.000Z",
      updated_at: "2026-09-03T08:00:00.000Z",
    },
  ];
}

function storeSettingsFixture(): StoreSettings {
  return {
    id: "settings-a",
    store_id: "store-a",
    store_name: "Ripara Subito 北店",
    store_address: "Via Roma 12",
    store_phone: "+39 06 0000 0000",
    store_whatsapp: "+39 333 000 0000",
    store_email: "store@example.test",
    public_base_url: "https://客户.example.test",
    default_order_warranty_text: "6 mesi",
    default_order_warranty_months: 6,
    default_inventory_warranty_months: 12,
    print_footer: "Footer italiano RAW 北店",
    message_signature: "Firma RAW 北店",
    created_at: "2026-09-03T08:00:00.000Z",
    updated_at: "2026-09-03T08:00:00.000Z",
  };
}

function expectedPreview() {
  return "Gentile Mario Rossi,\nOrdine RD-2406-001\nFirma RAW 北店";
}

function expectedCustomerPreview() {
  return "Gentile Mario Rossi,\nUltimo ordine: RD-2406-001 - iPhone 13 128GB\nFirma RAW 北店";
}

function saveButtonCopy(locale: "zh-CN" | "it-IT" | "en") {
  return locale === "zh-CN" ? "保存模板" : locale === "it-IT" ? "Salva modello" : "Save template";
}

function resetButtonCopy(locale: "zh-CN" | "it-IT" | "en") {
  return locale === "zh-CN"
    ? "恢复默认"
    : locale === "it-IT"
      ? "Ripristina predefinito"
      : "Restore default";
}

function bodyLabelCopy(locale: "zh-CN" | "it-IT" | "en") {
  return locale === "zh-CN"
    ? "模板正文"
    : locale === "it-IT"
      ? "Corpo del modello"
      : "Template body";
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
