import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerCreateInput, CustomerListItem } from "@/lib/repairdesk/types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

type MutationOptions = {
  mutationFn: (input: unknown) => Promise<unknown> | unknown;
  onSuccess?: (value: unknown, input: unknown) => void | Promise<void>;
  onError?: (error: unknown, input: unknown) => void | Promise<void>;
};

const customer: CustomerListItem = {
  id: "customer-dynamic",
  name: "动态中文客户 Ω",
  phone_e164: "+393330001122",
  phone_raw: "3330001122",
  contact_phones: [],
  consent_marketing: true,
  consent_sms: true,
  email: "dynamic@example.invalid",
  tags: [{ id: "tag-dynamic", name: "动态标签 Ω", color: "#123456" }],
  device_count: 2,
  order_count: 4,
  valid_order_count: 4,
  active_order_count: 2,
  lifetime_quoted_amount: 180,
  outstanding_amount: 60,
  latest_device_label: "华为 Mate 自定义 Ω",
};

const listData = {
  items: [customer],
  tags: customer.tags,
  stats: {
    total: 1,
    repeat: 1,
    activeRepairs: 1,
    unpaid: 1,
    withDevices: 1,
    dueFollowups: 0,
    marketable: 1,
    financeRedacted: false,
  },
  total: 1,
  page: 1,
  pageSize: 30,
  pageCount: 1,
};

const mocks = vi.hoisted(() => ({
  data: undefined as typeof listData | undefined,
  isError: false,
  isFetching: false,
  isPending: false,
  isPlaceholderData: false,
  viewport: "desktop" as "pending" | "compact" | "desktop",
  searchParams: "",
  shellStatus: "ready" as "loading" | "ready" | "error" | "platform_admin" | "onboarding_required",
  activeStore: { id: "store-1", name: "动态门店 Ω", role: "owner" } as
    | { id: string; name: string; role: string }
    | undefined,
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  refetch: vi.fn(),
  invalidateQueries: vi.fn(),
  createCustomer: vi.fn(),
  createError: undefined as unknown,
  mutationInputs: [] as unknown[],
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/customers",
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/hooks/use-mobile", () => ({
  useViewportMode: () => mocks.viewport,
  useIsCompactWorkspace: () => mocks.viewport === "compact",
  useIsMobile: () => mocks.viewport === "compact",
}));
vi.mock("@/features/customers/api/query-options", () => ({
  CUSTOMER_LIST_PAGE_SIZE: 30,
  customerListPageQueryOptions: () => ({ queryKey: ["customers", "list"] }),
}));
vi.mock("@/features/customers/api/query-keys", () => ({
  customersKeys: {
    lists: () => ["customers", "list"],
    detail: (id: string, storeId?: string) => ["customers", "detail", storeId, id],
  },
}));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keep-previous-data"),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: () => ({
    data: mocks.data,
    isError: mocks.isError,
    isFetching: mocks.isFetching,
    isPending: mocks.isPending,
    isPlaceholderData: mocks.isPlaceholderData,
    refetch: mocks.refetch,
  }),
  useMutation: (options: MutationOptions) => ({
    isPending: false,
    mutateAsync: async (input: unknown) => {
      mocks.mutationInputs.push(structuredClone(input));
      try {
        const value = await options.mutationFn(input);
        await options.onSuccess?.(value, input);
        return value;
      } catch (error) {
        await options.onError?.(error, input);
        throw error;
      }
    },
  }),
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => ({
    status: mocks.shellStatus,
    activeStore: mocks.activeStore,
    retry: vi.fn(),
    statusLabel: "RAW-STORE-TITLE",
    statusDescription: "RAW-STORE-DESCRIPTION",
  }),
}));
vi.mock("@/features/realtime", () => ({
  useRealtimeSync: () => ({ coordinator: undefined }),
}));
vi.mock("@/features/capture", () => ({
  consumeScanSearchIntent: () => "",
  subscribeScanSearchIntent: () => () => undefined,
  ScanSearchButton: ({ onSearch }: { onSearch: (value: string) => void }) => (
    <button type="button" onClick={() => onSearch("490154203237518")}>
      Harness scan
    </button>
  ),
}));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  return {
    ...actual,
    createCustomer: (input: CustomerCreateInput) => {
      if (mocks.createError) return Promise.reject(mocks.createError);
      return mocks.createCustomer(input);
    },
  };
});
vi.mock("@/features/customers/forms/customer-form-dialog", () => ({
  CustomerFormDialog: ({
    open,
    title,
    initial,
    onSave,
  }: {
    open: boolean;
    title: string;
    initial: CustomerCreateInput;
    onSave: (input: CustomerCreateInput, intent: "view_customer" | "new_order") => Promise<unknown>;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <span>{title}</span>
        <span>动态创建草稿 Ω</span>
        <button
          type="button"
          onClick={() =>
            void onSave(
              {
                ...initial,
                name: "动态中文客户 Ω",
                phone_e164: "+393330001122",
                email: "dynamic@example.invalid",
              },
              "view_customer",
            ).catch(() => undefined)
          }
        >
          Harness view customer
        </button>
        <button
          type="button"
          onClick={() =>
            void onSave(
              {
                ...initial,
                name: "动态中文客户 Ω",
                phone_e164: "+393330001122",
                email: "dynamic@example.invalid",
              },
              "new_order",
            ).catch(() => undefined)
          }
        >
          Harness new order
        </button>
      </div>
    ) : null,
}));
vi.mock("@/features/customers/screens/customer-detail-screen", () => ({
  CustomerDetailScreen: () => <div>动态客户详情 Ω</div>,
}));

import { CustomerListScreen } from "@/features/customers/screens/customer-list-screen";

function renderScreen(locale: "zh-CN" | "it-IT" | "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <SidebarProvider>
        <CustomerListScreen />
      </SidebarProvider>
    </LocaleProvider>,
  );
}

describe("CustomerListScreen i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    mocks.data = listData;
    mocks.isError = false;
    mocks.isFetching = false;
    mocks.isPending = false;
    mocks.isPlaceholderData = false;
    mocks.viewport = "desktop";
    mocks.searchParams = "";
    mocks.shellStatus = "ready";
    mocks.activeStore = { id: "store-1", name: "动态门店 Ω", role: "owner" };
    mocks.createError = undefined;
    mocks.mutationInputs = [];
    mocks.createCustomer.mockResolvedValue({ id: "customer-created" });
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "renders localized list chrome and preserves dynamic values in %s",
    (locale) => {
      renderScreen(locale);
      expect(
        screen.getByRole("heading", { name: translateMessage(locale, "customers.title") }),
      ).toBeVisible();
      expect(
        screen.getByPlaceholderText(
          translateMessage(locale, "customers.list.searchPlaceholderDesktop"),
        ),
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", {
          name: translateMessage(locale, "customers.list.headerCustomer"),
        }),
      ).toBeVisible();
      expect(screen.getByText(customer.name)).toBeVisible();
      expect(screen.getByText(customer.latest_device_label!)).toBeVisible();
      expect(screen.getByText("动态标签 Ω")).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "customers.summary.activeAction")),
      ).toBeVisible();
      if (locale !== "zh-CN") {
        expect(screen.queryByText("现在要做什么")).not.toBeInTheDocument();
        expect(screen.queryByText("跟进维修进度")).not.toBeInTheDocument();
      }
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "covers localized loading, empty, stale, fatal, and redacted states in %s",
    (locale) => {
      mocks.data = undefined;
      mocks.isPending = true;
      const loading = renderScreen(locale);
      expect(
        screen.getByText(translateMessage(locale, "customers.list.preparing"), {
          selector: '[role="status"]',
        }),
      ).toBeVisible();
      loading.unmount();

      mocks.data = { ...listData, items: [], total: 0, pageCount: 1 };
      mocks.isPending = false;
      const empty = renderScreen(locale);
      expect(screen.getByText(translateMessage(locale, "customers.list.emptyTitle"))).toBeVisible();
      empty.unmount();

      mocks.data = listData;
      mocks.isError = true;
      const stale = renderScreen(locale);
      expect(
        screen.getByText(translateMessage(locale, "customers.list.refreshWarning")),
      ).toBeVisible();
      stale.unmount();

      mocks.data = undefined;
      const fatal = renderScreen(locale);
      expect(
        screen.getByText(translateMessage(locale, "customers.list.loadErrorTitle")),
      ).toBeVisible();
      expect(screen.queryByText("RAW-STORAGE-ERROR")).not.toBeInTheDocument();
      fatal.unmount();

      mocks.data = {
        ...listData,
        items: [{ ...customer, finance_redacted: true }],
        stats: { ...listData.stats, financeRedacted: true },
      };
      mocks.isError = false;
      const redacted = renderScreen(locale);
      expect(
        screen.getByText(translateMessage(locale, "customers.list.financeRestricted")),
      ).toBeVisible();
      redacted.unmount();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "passes localized compact search ARIA without changing canonical URL state in %s",
    (locale) => {
      mocks.viewport = "compact";
      mocks.searchParams = "q=dynamic&group=active&page=2";
      mocks.data = { ...listData, total: 31, page: 2, pageCount: 2 };
      renderScreen(locale);

      const search = screen.getByRole("textbox", {
        name: translateMessage(locale, "customers.list.searchPlaceholder"),
      });
      expect(search).toHaveValue("dynamic");
      expect(search).toHaveClass("text-base");
      expect(
        screen.getByText(translateMessage(locale, "customers.list.searchPrefix")),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "customers.list.clearSearch"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "customers.list.filters") }),
      ).toHaveClass("size-11");
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "customers.list.new") }),
      ).toHaveClass("size-11");
      expect(mocks.routerReplace).not.toHaveBeenCalled();
    },
  );

  it("renders a localized role=status fallback while the create dialog is lazy", async () => {
    renderScreen("it-IT");
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("it-IT", "customers.list.new") }),
    );
    expect(
      screen.getByText(translateMessage("it-IT", "customers.list.createLoading"), {
        selector: '[role="status"]',
      }),
    ).toBeVisible();
    await screen.findByRole("dialog", {
      name: translateMessage("it-IT", "customers.list.new"),
    });
  });

  it("keeps create payloads and intents byte-equivalent across employee locales", async () => {
    const capturedByLocale: unknown[][] = [];

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const user = userEvent.setup();
      const view = renderScreen(locale);
      await user.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.list.new") }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: translateMessage(locale, "customers.list.new"),
      });
      expect(dialog).toHaveTextContent("动态创建草稿 Ω");
      await user.click(screen.getByRole("button", { name: "Harness view customer" }));
      await waitFor(() => expect(mocks.createCustomer).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mocks.routerPush).toHaveBeenLastCalledWith("/customers/customer-created"),
      );

      await user.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.list.new") }),
      );
      await user.click(await screen.findByRole("button", { name: "Harness new order" }));
      await waitFor(() => expect(mocks.createCustomer).toHaveBeenCalledTimes(2));
      capturedByLocale.push(structuredClone(mocks.mutationInputs));
      view.unmount();
      mocks.mutationInputs = [];
      mocks.createCustomer.mockClear();
      mocks.routerPush.mockClear();
    }

    expect(capturedByLocale[1]).toEqual(capturedByLocale[0]);
    expect(capturedByLocale[2]).toEqual(capturedByLocale[0]);
    expect(capturedByLocale[0]).toEqual([
      {
        input: {
          name: "动态中文客户 Ω",
          phone_e164: "+393330001122",
          email: "dynamic@example.invalid",
          contact_phones: [],
          consent_marketing: true,
          consent_sms: true,
          preferred_channel: "whatsapp",
          language: "it",
          notes: "",
          marketing_notes: "",
          blacklisted: false,
        },
        intent: "view_customer",
      },
      {
        input: {
          name: "动态中文客户 Ω",
          phone_e164: "+393330001122",
          email: "dynamic@example.invalid",
          contact_phones: [],
          consent_marketing: true,
          consent_sms: true,
          preferred_channel: "whatsapp",
          language: "it",
          notes: "",
          marketing_notes: "",
          blacklisted: false,
        },
        intent: "new_order",
      },
    ]);
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps the create dialog open and shows a safe localized error in %s",
    async (locale) => {
      mocks.createError = new Error("RAW-STORAGE-SECRET");
      const user = userEvent.setup();
      renderScreen(locale);
      await user.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.list.new") }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: translateMessage(locale, "customers.list.new"),
      });
      await user.click(screen.getByRole("button", { name: "Harness view customer" }));
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "customers.list.saveFailed"),
        ),
      );
      expect(dialog).toBeVisible();
      expect(dialog).not.toHaveTextContent("RAW-STORAGE-SECRET");
      expect(mocks.createCustomer).not.toHaveBeenCalled();
      expect(mocks.mutationInputs).toHaveLength(1);
    },
  );
});
