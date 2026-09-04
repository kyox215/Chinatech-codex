import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { getCustomerDetail as getMockCustomerDetail } from "@/features/customers/testing/mock-api";
import { customers } from "@/lib/mock/state";
import type {
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerMessageInput,
  CustomerUpdateInput,
} from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

type MutationOptions = {
  mutationFn: (input: unknown) => Promise<unknown> | unknown;
  onSuccess?: (value: unknown, input: unknown) => void | Promise<void>;
  onError?: (error: unknown, input: unknown) => void | Promise<void>;
};

const updateInput: CustomerUpdateInput = {
  name: "动态客户 Ω",
  phone_e164: "+393330001122",
  contact_phones: ["+393330009999"],
  email: "dynamic@example.invalid",
  preferred_channel: "sms",
  language: "en",
  consent_marketing: true,
  consent_sms: false,
  notes: "动态备注 中文 Ω",
  marketing_notes: "动态联系备注 Ω",
  blacklisted: false,
};
const deviceInput: CustomerDeviceInput = {
  id: "device-dynamic",
  brand: "华为 Dynamic Ω",
  model: "Mate 自定义 Ω",
  serial_or_imei: "359999999999991",
  device_notes: "动态设备备注 Ω",
};
const followupInput: CustomerFollowupInput = {
  title: "维修后联系客户",
  due_at: "2026-09-03T10:30",
  owner_name: "动态员工 Ω",
  note: "动态待办备注 Ω",
  order_id: "ord_1",
};
const messageInput: CustomerMessageInput = {
  channel: "whatsapp",
  body: "Gentile 动态客户 Ω,\n\nCorpo canonico",
  recipient_phone: "+393330001122",
};
const tagIds = ["tag_vip", "tag-dynamic"];
let detailData: CustomerDetail;

const mocks = vi.hoisted(() => ({
  data: undefined as CustomerDetail | undefined,
  isError: false,
  isLoading: false,
  isPending: false,
  isFetching: false,
  shellStatus: "ready" as "loading" | "ready",
  rejectMutations: false,
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  invalidateQueries: vi.fn(),
  refetch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  updateCustomer: vi.fn(),
  upsertCustomerDevice: vi.fn(),
  deleteCustomerDevice: vi.fn(),
  createCustomerFollowup: vi.fn(),
  completeCustomerFollowup: vi.fn(),
  sendCustomerMessage: vi.fn(),
  setCustomerTags: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.routerBack, push: mocks.routerPush }),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => ({
    status: mocks.shellStatus,
    activeStore: { id: "store-dynamic", name: "动态门店 Ω", role: "owner" },
    permissions: { canReadStoreSettings: true, canUpdateStoreSettings: true },
    retry: vi.fn(),
  }),
}));
vi.mock("@/features/messages/api/query-options", () => ({
  storeSettingsQueryOptions: () => ({ queryKey: ["store-settings"] }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: (options: { queryKey?: unknown[] }) =>
    options.queryKey?.[0] === "store-settings"
      ? {
          data: { store_id: "store-dynamic", store_name: "动态门店 Ω" },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }
      : {
          data: mocks.data,
          isError: mocks.isError,
          isLoading: mocks.isLoading,
          isPending: mocks.isPending,
          isFetching: mocks.isFetching,
          refetch: mocks.refetch,
        },
  useMutation: (options: MutationOptions) => {
    const execute = async (input: unknown) => {
      try {
        const value = await options.mutationFn(input);
        await options.onSuccess?.(value, input);
        return value;
      } catch (error) {
        await options.onError?.(error, input);
        throw error;
      }
    };
    return {
      isPending: false,
      mutateAsync: execute,
      mutate: (input: unknown) => void execute(input).catch(() => undefined),
    };
  },
}));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  const result = (mock: ReturnType<typeof vi.fn>, args: unknown[]) => {
    (mock as unknown as (...values: unknown[]) => unknown)(...args);
    return mocks.rejectMutations
      ? Promise.reject(new Error("RAW-CUSTOMER-MUTATION-SENTINEL"))
      : Promise.resolve({ id: "result" });
  };
  return {
    ...actual,
    getCustomerDetail: vi.fn(),
    updateCustomer: (...args: unknown[]) => result(mocks.updateCustomer, args),
    upsertCustomerDevice: (...args: unknown[]) => result(mocks.upsertCustomerDevice, args),
    deleteCustomerDevice: (...args: unknown[]) => result(mocks.deleteCustomerDevice, args),
    createCustomerFollowup: (...args: unknown[]) => result(mocks.createCustomerFollowup, args),
    completeCustomerFollowup: (...args: unknown[]) => result(mocks.completeCustomerFollowup, args),
    sendCustomerMessage: (...args: unknown[]) => result(mocks.sendCustomerMessage, args),
    setCustomerTags: (...args: unknown[]) => result(mocks.setCustomerTags, args),
  };
});

vi.mock("@/features/customers/forms/customer-edit-dialog", () => ({
  CustomerEditDialog: ({
    open,
    onSave,
  }: {
    open: boolean;
    onSave: (input: CustomerUpdateInput) => Promise<unknown>;
  }) =>
    open ? (
      <button onClick={() => void onSave(updateInput).catch(() => undefined)}>
        Harness save edit
      </button>
    ) : null,
}));
vi.mock("@/features/customers/forms/customer-device-dialog", () => ({
  CustomerDeviceDialog: ({
    open,
    onSave,
  }: {
    open: boolean;
    onSave: (input: CustomerDeviceInput) => Promise<unknown>;
  }) =>
    open ? (
      <button onClick={() => void onSave(deviceInput).catch(() => undefined)}>
        Harness save device
      </button>
    ) : null,
}));
vi.mock("@/features/customers/forms/customer-followup-dialog", () => ({
  CustomerFollowupDialog: ({
    open,
    onSave,
  }: {
    open: boolean;
    onSave: (input: CustomerFollowupInput) => Promise<unknown>;
  }) =>
    open ? (
      <button onClick={() => void onSave(followupInput).catch(() => undefined)}>
        Harness save followup
      </button>
    ) : null,
}));
vi.mock("@/features/customers/forms/customer-message-dialog", () => ({
  CustomerMessageDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (input: CustomerMessageInput) => Promise<unknown>;
  }) =>
    open ? (
      <button onClick={() => void onConfirm(messageInput).catch(() => undefined)}>
        Harness confirm message
      </button>
    ) : null,
}));
vi.mock("@/features/customers/forms/customer-tags-dialog", () => ({
  CustomerTagsDialog: ({
    open,
    onSave,
  }: {
    open: boolean;
    onSave: (ids: string[]) => Promise<unknown>;
  }) =>
    open ? (
      <button onClick={() => void onSave(tagIds).catch(() => undefined)}>Harness save tags</button>
    ) : null,
}));

import { CustomerDetailScreen } from "@/features/customers/screens/customer-detail-screen";

function renderScreen(locale: "zh-CN" | "it-IT" | "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <SidebarProvider>
        <CustomerDetailScreen id={mocks.data?.customer.id ?? "cus_1"} />
      </SidebarProvider>
    </LocaleProvider>,
  );
}

function clickFirstButton(name: string | RegExp) {
  fireEvent.click(screen.getAllByRole("button", { name })[0]);
}

async function exerciseMutations(locale: "zh-CN" | "it-IT" | "en") {
  clickFirstButton(translateMessage(locale, "customers.detail.edit"));
  fireEvent.click(screen.getByRole("button", { name: "Harness save edit" }));

  fireEvent.click(
    screen.getAllByRole("tab", {
      name: new RegExp(translateMessage(locale, "customers.tab.devices")),
    })[0],
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(translateMessage(locale, "customers.detail.addDevice")),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Harness save device" }));

  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`${translateMessage(locale, "customers.detail.delete")}.*`),
    }),
  );

  fireEvent.click(
    screen.getAllByRole("tab", {
      name: new RegExp(translateMessage(locale, "customers.tab.followups")),
    })[0],
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(translateMessage(locale, "customers.detail.markComplete")),
    }),
  );
  clickFirstButton(translateMessage(locale, "customers.detail.addFollowup"));
  fireEvent.click(screen.getByRole("button", { name: "Harness save followup" }));

  clickFirstButton(translateMessage(locale, "customers.detail.sendMessage"));
  fireEvent.click(screen.getByRole("button", { name: "Harness confirm message" }));

  fireEvent.click(
    screen.getAllByRole("tab", {
      name: new RegExp(translateMessage(locale, "customers.tab.profile")),
    })[0],
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(translateMessage(locale, "customers.detail.manageTags")),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Harness save tags" }));

  await waitFor(() => expect(mocks.setCustomerTags).toHaveBeenCalledTimes(1));
  expect(mocks.updateCustomer).toHaveBeenCalledTimes(1);
  expect(mocks.upsertCustomerDevice).toHaveBeenCalledTimes(1);
  expect(mocks.deleteCustomerDevice).toHaveBeenCalledTimes(1);
  expect(mocks.createCustomerFollowup).toHaveBeenCalledTimes(1);
  expect(mocks.completeCustomerFollowup).toHaveBeenCalledTimes(1);
  expect(mocks.sendCustomerMessage).toHaveBeenCalledTimes(1);
  expect(mocks.setCustomerTags).toHaveBeenCalledTimes(1);
  return {
    update: mocks.updateCustomer.mock.calls[0],
    upsert: mocks.upsertCustomerDevice.mock.calls[0],
    delete: mocks.deleteCustomerDevice.mock.calls[0],
    followup: mocks.createCustomerFollowup.mock.calls[0],
    complete: mocks.completeCustomerFollowup.mock.calls[0],
    message: mocks.sendCustomerMessage.mock.calls[0],
    tags: mocks.setCustomerTags.mock.calls[0],
  };
}

describe("CustomerDetailScreen i18n", () => {
  beforeAll(async () => {
    const base = await getMockCustomerDetail(customers[0].id);
    detailData = {
      ...base,
      customer: { ...base.customer, name: "动态中文客户 Ω", notes: "动态客户备注 Ω" },
      devices: [
        ...base.devices,
        {
          id: "device-deletable",
          customer_id: base.customer.id,
          brand: "华为 Dynamic Ω",
          model: "自定义型号 Ω",
          serial_or_imei: "359999999999991",
          device_notes: "动态设备备注 Ω",
        },
      ],
      followups: [
        ...base.followups,
        {
          id: "followup-done",
          customer_id: base.customer.id,
          title: "动态已完成跟进 Ω",
          note: "动态已完成备注 Ω",
          due_at: "2026-09-02T08:30:00.000Z",
          owner_name: "动态员工 Ω",
          status: "done",
          created_at: "2026-09-01T08:30:00.000Z",
          updated_at: "2026-09-02T08:30:00.000Z",
        },
        {
          id: "followup-open",
          customer_id: base.customer.id,
          title: "动态待办标题 Ω",
          note: "动态待办备注 Ω",
          due_at: "2026-09-03T08:30:00.000Z",
          owner_name: "动态员工 Ω",
          status: "open",
          created_at: "2026-09-01T08:30:00.000Z",
          updated_at: "2026-09-01T08:30:00.000Z",
        },
      ],
      tags: [...base.tags, { id: "tag-dynamic", name: "动态标签 Ω", color: "#123456" }],
    };
    mocks.data = detailData;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.data = detailData;
    mocks.isError = false;
    mocks.isLoading = false;
    mocks.isPending = false;
    mocks.isFetching = false;
    mocks.shellStatus = "ready";
    mocks.rejectMutations = false;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes core chrome and preserves dynamic content in %s",
    (locale) => {
      mocks.isError = true;
      renderScreen(locale);
      expect(
        screen.getByRole("heading", { name: translateMessage(locale, "customers.detail.title") }),
      ).toBeVisible();
      expect(screen.getAllByText("动态中文客户 Ω").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(translateMessage(locale, "customers.detail.currentItems")).length,
      ).toBeGreaterThan(0);
      fireEvent.click(
        screen.getAllByRole("tab", {
          name: new RegExp(translateMessage(locale, "customers.tab.orders")),
        })[0],
      );
      expect(
        screen.getAllByText(translateMessage(locale, "customers.detail.historyOrders")).length,
      ).toBeGreaterThan(0);
      fireEvent.click(
        screen.getAllByRole("tab", {
          name: new RegExp(translateMessage(locale, "customers.tab.devices")),
        })[0],
      );
      expect(
        screen.getAllByText(translateMessage(locale, "customers.detail.deviceRecords")).length,
      ).toBeGreaterThan(0);
      fireEvent.click(
        screen.getAllByRole("tab", {
          name: new RegExp(translateMessage(locale, "customers.tab.followups")),
        })[0],
      );
      expect(
        screen.getAllByText(translateMessage(locale, "customers.detail.customerFollowups")).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("动态待办标题 Ω")).toBeVisible();
      expect(screen.getByText("动态已完成跟进 Ω")).toBeVisible();
      expect(
        screen.getAllByText(translateMessage(locale, "customers.followup.completed")).length,
      ).toBeGreaterThan(0);
      expect(screen.queryByText("done")).not.toBeInTheDocument();
      expect(screen.queryByText("completed")).not.toBeInTheDocument();
      fireEvent.click(
        screen.getAllByRole("tab", {
          name: new RegExp(translateMessage(locale, "customers.tab.profile")),
        })[0],
      );
      expect(screen.getByText("动态标签 Ω")).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "customers.detail.refreshWarning")),
      ).toBeVisible();
      expect(screen.queryByText("RAW-CUSTOMER-MUTATION-SENTINEL")).not.toBeInTheDocument();
    },
  );

  it("keeps the floating customer header mobile-only and removes its md page offset", () => {
    renderScreen("en");

    const page = document.querySelector('[data-ui="customer-detail-page"]');
    const mobileHeader = document.querySelector('[data-ui="customer-detail-mobile-header"]');
    const desktopHero = document.querySelector('[data-ui="customer-detail-desktop-hero"]');
    const mobileActions = document.querySelector('[data-ui="customer-detail-mobile-actions"]');
    const mainTabs = document.querySelector('[data-ui="customer-detail-main-tabs"]');

    expect(page).toHaveClass("md:!pt-5", "md:!pb-20", "lg:!pt-5", "lg:!pb-8");
    expect(page?.className).not.toContain("md:!pt-[var(--repair-os-mobile-floating-offset");
    expect(mobileHeader).toHaveClass("md:!hidden");
    expect(mobileHeader).not.toHaveClass("md:!block");
    expect(desktopHero).toHaveClass("hidden", "lg:block");
    expect(mobileActions).toHaveClass("lg:hidden");
    expect(mobileActions).not.toHaveClass("md:hidden");
    expect(mainTabs).toHaveClass("hidden", "md:sticky", "md:block");
    expect(mainTabs).not.toHaveClass("lg:block");

    const deviceTab = document.querySelector<HTMLButtonElement>(
      "#customer-detail-main-tab-devices",
    );
    expect(deviceTab).toHaveAccessibleName(
      new RegExp(translateMessage("en", "customers.tab.devices")),
    );
    fireEvent.click(deviceTab!);
    expect(deviceTab).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector("#customer-detail-panel-devices")).toHaveAttribute(
      "aria-label",
      expect.stringContaining(translateMessage("en", "customers.tab.devices")),
    );
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "announces loading and exposes a localized fatal recovery state in %s",
    async (locale) => {
      mocks.data = undefined;
      mocks.isPending = true;
      const view = renderScreen(locale);
      expect(
        screen.getByRole("status", {
          name: translateMessage(locale, "customers.detail.loading"),
        }),
      ).toHaveTextContent(translateMessage(locale, "customers.detail.loading"));

      view.unmount();
      mocks.isPending = false;
      mocks.isError = true;
      renderScreen(locale);
      expect(
        screen.getByText(translateMessage(locale, "customers.detail.loadErrorTitle")),
      ).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "customers.detail.loadErrorDescription")),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "customers.detail.reload"),
        }),
      );
      await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce());
      expect(screen.queryByText("RAW-CUSTOMER-MUTATION-SENTINEL")).not.toBeInTheDocument();
    },
  );

  it("uses the same localized skeleton for the server shell-loading and active-store pending branches", () => {
    mocks.data = undefined;
    mocks.shellStatus = "loading";
    const shellLoading = renderScreen("en");
    expect(
      screen.getByRole("status", { name: translateMessage("en", "customers.detail.loading") }),
    ).toBeVisible();
    expect(
      screen.queryByText(translateMessage("en", "customers.detail.loadErrorTitle")),
    ).not.toBeInTheDocument();

    shellLoading.unmount();
    mocks.shellStatus = "ready";
    mocks.isPending = true;
    renderScreen("it-IT");
    expect(
      screen.getByRole("status", { name: translateMessage("it-IT", "customers.detail.loading") }),
    ).toBeVisible();
    expect(
      screen.queryByText(translateMessage("it-IT", "customers.detail.loadErrorTitle")),
    ).not.toBeInTheDocument();
  });

  it("keeps all customer mutation inputs locale-invariant", async () => {
    const byLocale = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const view = renderScreen(locale);
      byLocale.push(await exerciseMutations(locale));
      view.unmount();
      vi.clearAllMocks();
    }
    expect(byLocale[1]).toEqual(byLocale[0]);
    expect(byLocale[2]).toEqual(byLocale[0]);
    expect(byLocale[0]).toEqual({
      update: [mocks.data!.customer.id, updateInput],
      upsert: [mocks.data!.customer.id, deviceInput],
      delete: [mocks.data!.customer.id, "device-deletable"],
      followup: [mocks.data!.customer.id, followupInput],
      complete: [mocks.data!.customer.id, "followup-open"],
      message: [mocks.data!.customer.id, messageInput],
      tags: [mocks.data!.customer.id, tagIds],
    });
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "consumes rejected mutations and shows only localized safe errors in %s",
    async (locale) => {
      mocks.rejectMutations = true;
      renderScreen(locale);
      await exerciseMutations(locale);
      await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(7));
      expect(mocks.toastError.mock.calls.flat()).not.toContain("RAW-CUSTOMER-MUTATION-SENTINEL");
      expect(mocks.updateCustomer).toHaveBeenCalledTimes(1);
      expect(mocks.upsertCustomerDevice).toHaveBeenCalledTimes(1);
      expect(mocks.deleteCustomerDevice).toHaveBeenCalledTimes(1);
      expect(mocks.createCustomerFollowup).toHaveBeenCalledTimes(1);
      expect(mocks.completeCustomerFollowup).toHaveBeenCalledTimes(1);
      expect(mocks.sendCustomerMessage).toHaveBeenCalledTimes(1);
      expect(mocks.setCustomerTags).toHaveBeenCalledTimes(1);
    },
  );
});
