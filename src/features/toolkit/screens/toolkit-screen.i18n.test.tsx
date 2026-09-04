import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

import { ToolkitScreen } from "./toolkit-screen";

const api = vi.hoisted(() => ({
  listToolkitResources: vi.fn(),
  createToolkitLink: vi.fn(),
  prepareToolkitFileUpload: vi.fn(),
  uploadToolkitFile: vi.fn(),
  finalizeToolkitFileUpload: vi.fn(),
  updateToolkitResourceStatus: vi.fn(),
  accessToolkitResource: vi.fn(),
}));
const shell = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
let compactViewport = false;

vi.mock("@/lib/repairdesk/api", async (original) => ({
  ...(await original<typeof import("@/lib/repairdesk/api")>()),
  ...api,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shell.value,
}));
vi.mock("@/features/settings/model/store-lifecycle-mfa", () => ({
  verifyRecentLifecycleAal2: vi.fn(),
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      get matches() {
        return compactViewport;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  compactViewport = false;
  shell.value = { isLoading: false, activeStore: { id: "store-a" }, isPlatformAdmin: true };
  api.listToolkitResources.mockResolvedValue({
    canManage: true,
    resources: [
      {
        id: "resource-a",
        kind: "link",
        title: "DYNAMIC 北店 Tool",
        description: "DYNAMIC 说明",
        url: "https://example.test/tool",
        platform: "DYNAMIC OS",
        version: "v1.2",
        state: "published",
        revision: 4,
      },
    ],
  });
});

afterEach(cleanup);

describe("ToolkitScreen localization", () => {
  it.each([
    ["zh-CN" as const, "添加网页工具", "打开"],
    ["it-IT" as const, "Aggiungi strumento web", "Apri"],
    ["en" as const, "Add web tool", "Open"],
  ])("localizes fixed UI in %s and preserves resource bytes", async (locale, add, open) => {
    renderToolkit(locale);
    expect(await screen.findByText("DYNAMIC 北店 Tool")).toBeVisible();
    expect(screen.getAllByRole("button", { name: new RegExp(add) }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: open })).toBeVisible();
    expect(screen.getByText("DYNAMIC 说明")).toBeVisible();
    expect(screen.getByText("DYNAMIC OS")).toBeVisible();
  });

  it("preserves an open form draft across locale changes without a business action", async () => {
    renderToolkit("zh-CN", true);
    await screen.findByText("DYNAMIC 北店 Tool");
    fireEvent.click(screen.getAllByRole("button", { name: /添加网页工具/ })[0]);
    fireEvent.change(screen.getByLabelText("工具名称"), { target: { value: "Draft 北店" } });
    act(() => setTestLocale("it-IT"));
    expect(screen.getByLabelText("Nome strumento")).toHaveValue("Draft 北店");
    expect(api.createToolkitLink).not.toHaveBeenCalled();
    expect(api.updateToolkitResourceStatus).not.toHaveBeenCalled();
  });

  it("preserves compact search across locale changes", async () => {
    compactViewport = true;
    renderToolkit("zh-CN", true);
    await screen.findByText("DYNAMIC 北店 Tool");
    fireEvent.change(screen.getByPlaceholderText("搜索工具名称、平台或版本"), {
      target: { value: "DYNAMIC" },
    });
    act(() => setTestLocale("it-IT"));
    expect(screen.getByPlaceholderText("Cerca per nome, piattaforma o versione")).toHaveValue(
      "DYNAMIC",
    );
    expect(api.createToolkitLink).not.toHaveBeenCalled();
  });

  it("localizes denied and read-error states", async () => {
    shell.value = { isLoading: false, isPlatformAdmin: false };
    const denied = renderToolkit("en");
    expect(screen.getByText(/cannot view the toolkit/)).toBeVisible();
    denied.unmount();
    shell.value = { isLoading: false, isPlatformAdmin: true };
    api.listToolkitResources.mockRejectedValueOnce(new Error("DYNAMIC backend detail"));
    renderToolkit("it-IT");
    expect(await screen.findByText("Impossibile leggere gli strumenti.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeVisible();
  });
});

function renderToolkit(locale: "zh-CN" | "it-IT" | "en", switches = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={client}>
        <SidebarProvider>
          {switches ? <LocaleCapture /> : null}
          <ToolkitScreen />
        </SidebarProvider>
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

let setTestLocale: (locale: "zh-CN" | "it-IT" | "en") => void = () => undefined;

function LocaleCapture() {
  const { setLocale } = useLocale();
  setTestLocale = setLocale;
  return null;
}
