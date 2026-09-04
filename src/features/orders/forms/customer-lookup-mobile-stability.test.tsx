import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreShellContextSnapshot } from "@/features/stores/model/store-shell-context";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import type {
  Customer,
  CustomerIntakeCandidate,
  CustomerIntakeNewCustomerPolicy,
} from "@/lib/repairdesk/api";

import { CustomerIdentityLookup } from "./customer-intake-lookup";
import { CustomerPhoneLookup } from "./customer-phone-lookup";

const apiMocks = vi.hoisted(() => ({
  searchCustomerIntakeCandidates: vi.fn(),
  searchCustomers: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", () => apiMocks);

vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: vi.fn(),
}));

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("customer identity lookup mobile stability", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    apiMocks.searchCustomerIntakeCandidates.mockReset();
    apiMocks.searchCustomers.mockReset();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([]);
    apiMocks.searchCustomers.mockResolvedValue([]);
    vi.mocked(useStoreShellContext).mockReturnValue(makeShellContext());
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("keeps lookup closed until phone input reaches 3 digits", async () => {
    const user = userEvent.setup();

    renderWithClient(<CustomerIdentityLookupHarness />);

    await user.click(screen.getByRole("combobox", { name: "客户电话号码" }));
    await user.click(screen.getByRole("button", { name: "3" }));

    expect(screen.queryByRole("listbox", { name: "客户匹配结果" })).not.toBeInTheDocument();
    expect(apiMocks.searchCustomerIntakeCandidates).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "5" }));

    expect(await screen.findByRole("listbox", { name: "客户匹配结果" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.searchCustomerIntakeCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "345", phoneMatchMode: "progressive" }),
      );
    });
    expect(screen.getByRole("button", { name: "请先输入完整电话号码" })).toBeDisabled();
  });

  it("keeps the reusable phone lookup popover closed until phone input reaches 3 digits", async () => {
    const user = userEvent.setup();

    renderWithClient(<CustomerPhoneLookupHarness />);

    const input = screen.getByRole("combobox");
    expect(input).toHaveClass("h-[38px]", "text-base", "lg:h-9", "lg:text-sm");
    await user.type(input, "12");

    expect(screen.queryByRole("listbox", { name: "客户搜索结果" })).not.toBeInTheDocument();
    expect(apiMocks.searchCustomers).not.toHaveBeenCalled();

    await user.type(input, "3");

    expect(await screen.findByRole("listbox", { name: "客户搜索结果" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.searchCustomers).toHaveBeenCalledWith("123", 8);
    });
  });

  it("closes the reusable lookup only after an asynchronous customer pick succeeds", async () => {
    const user = userEvent.setup();
    const customer = {
      id: "customer-pick-success",
      name: "Alice Dynamic",
      phone_e164: "+393335719865",
      phone_raw: "3335719865",
      contact_phones: [],
      consent_marketing: false,
      consent_sms: true,
    } satisfies Customer;
    let resolvePick: (() => void) | undefined;
    const onPick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePick = resolve;
        }),
    );
    apiMocks.searchCustomers.mockResolvedValue([customer]);

    renderWithClient(<CustomerPhoneLookupHarness onPick={onPick} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "Alice");
    await user.click(await screen.findByRole("option", { name: /Alice Dynamic/ }));

    expect(onPick).toHaveBeenCalledWith(customer);
    expect(screen.getByRole("listbox", { name: "客户搜索结果" })).toBeInTheDocument();
    resolvePick?.();
    await waitFor(() =>
      expect(screen.queryByRole("listbox", { name: "客户搜索结果" })).not.toBeInTheDocument(),
    );
  });

  it("contains a rejected asynchronous reusable customer pick and preserves its search state", async () => {
    const user = userEvent.setup();
    const customer = {
      id: "customer-pick-reject",
      name: "Alice Dynamic",
      phone_e164: "+393335719865",
      phone_raw: "3335719865",
      contact_phones: [],
      consent_marketing: false,
      consent_sms: true,
    } satisfies Customer;
    const onPick = vi.fn().mockRejectedValue(new Error("CUSTOMER_PICK_SECRET_SENTINEL"));
    apiMocks.searchCustomers.mockResolvedValue([customer]);

    renderWithClient(<CustomerPhoneLookupHarness onPick={onPick} />);
    await user.type(screen.getByRole("combobox"), "Alice");
    await user.click(await screen.findByRole("option", { name: /Alice Dynamic/ }));

    await waitFor(() => expect(onPick).toHaveBeenCalledWith(customer));
    await waitFor(() =>
      expect(screen.getByRole("listbox", { name: "客户搜索结果" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("combobox")).toHaveValue("Alice");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("CUSTOMER_PICK_SECRET_SENTINEL")).not.toBeInTheDocument();
  });

  it("still searches by name when phone is empty", async () => {
    const user = userEvent.setup();

    renderWithClient(<CustomerIdentityLookupHarness />);
    await user.type(screen.getByRole("combobox", { name: "客户姓名" }), "Al");

    expect(await screen.findByRole("listbox", { name: "客户匹配结果" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.searchCustomerIntakeCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Al", phone: undefined }),
      );
    });
    expect(screen.getByRole("button", { name: "先填写电话，再按当前资料新建" })).toBeDisabled();
  });

  it("does not select the first customer on bare Enter", async () => {
    const user = userEvent.setup();
    const onPickCustomer = vi.fn();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([
      makeIntakeCandidate({ phoneRaw: "3335719865" }),
    ]);

    renderWithClient(
      <CustomerIdentityLookupHarness onPickCustomer={onPickCustomer} initialName="Alice" />,
    );
    const input = screen.getByRole("combobox", { name: "客户姓名" });
    expect(await screen.findByRole("option")).toBeInTheDocument();

    await user.click(input);
    await user.keyboard("{Enter}");
    expect(onPickCustomer).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPickCustomer).toHaveBeenCalledTimes(1);
  });

  it("supports explicit keyboard selection from the phone combobox", async () => {
    const user = userEvent.setup();
    const onPickCustomer = vi.fn();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([
      makeIntakeCandidate({ phoneRaw: "3335719865" }),
    ]);

    renderWithClient(
      <CustomerIdentityLookupHarness initialPhone="3335719865" onPickCustomer={onPickCustomer} />,
    );

    const phone = screen.getByRole("combobox", { name: "客户电话号码" });
    expect(await screen.findByRole("option")).toBeInTheDocument();
    phone.focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPickCustomer).toHaveBeenCalledTimes(1);
  });

  it("only marks the combobox expanded while its listbox exists", async () => {
    apiMocks.searchCustomerIntakeCandidates.mockImplementation(
      () => new Promise<CustomerIntakeCandidate[]>(() => undefined),
    );

    renderWithClient(<CustomerIdentityLookupHarness initialPhone="3335719865" />);

    const phone = screen.getByRole("combobox", { name: "客户电话号码" });
    expect(await screen.findByText("正在核对客户…")).toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { name: "客户匹配结果" })).not.toBeInTheDocument();
  });

  it("keeps error feedback outside the combobox popup contract", async () => {
    apiMocks.searchCustomerIntakeCandidates.mockRejectedValue(new Error("lookup unavailable"));

    renderWithClient(<CustomerIdentityLookupHarness initialPhone="3335719865" />);

    const phone = screen.getByRole("combobox", { name: "客户电话号码" });
    expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法确认是否已有客户。");
    expect(screen.queryByText("lookup unavailable")).not.toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { name: "客户匹配结果" })).not.toBeInTheDocument();
  });

  it("defensively hides different-phone same-name candidates when phone is present", async () => {
    const samePhone = makeIntakeCandidate({
      id: "same-phone",
      name: "Marco",
      phoneRaw: "3335719865",
      nameMatchKind: "none",
    });
    const differentPhone = makeIntakeCandidate({
      id: "different-phone",
      name: "Alessio",
      phoneRaw: "33357198650",
      nameMatchKind: "exact",
    });
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([differentPhone, samePhone]);

    renderWithClient(
      <CustomerIdentityLookupHarness initialPhone="3335719865" initialName="Alessio" />,
    );

    const listbox = await screen.findByRole("listbox", { name: "客户匹配结果" });
    expect(within(listbox).getByText("Marco")).toBeInTheDocument();
    expect(within(listbox).queryByText("Alessio")).not.toBeInTheDocument();
    expect(within(listbox).getByText("电话相同 · 姓名不同，请确认")).toBeInTheDocument();
    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    await waitFor(() => {
      expect(apiMocks.searchCustomerIntakeCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ phoneMatchMode: "exact" }),
      );
    });
  });

  it("records a new-customer intent without claiming a customer was created", async () => {
    const user = userEvent.setup();
    const onClearCustomerSelection = vi.fn();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([]);

    renderWithClient(
      <CustomerIdentityLookupHarness
        initialPhone="3335719865"
        initialName="Nuovo Cliente"
        onClearCustomerSelection={onClearCustomerSelection}
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "不使用这些结果，按当前资料新建客户",
      }),
    );
    expect(onClearCustomerSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByText("将按当前资料新建客户")).toBeInTheDocument();
    expect(screen.queryByText(/新客户已创建/)).not.toBeInTheDocument();
  });

  it("blocks an explicit duplicate identity intent and offers the existing customer", async () => {
    const user = userEvent.setup();
    const onPickCustomer = vi.fn();
    const onNewCustomerIntentChange = vi.fn();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([
      makeIntakeCandidate({ name: "Alice", phoneRaw: "3335719865", nameMatchKind: "exact" }),
    ]);

    renderWithClient(
      <CustomerIdentityLookupHarness
        initialPhone="3335719865"
        initialName="Alice"
        onPickCustomer={onPickCustomer}
        onNewCustomerIntentChange={onNewCustomerIntentChange}
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "不使用这些结果，按当前资料新建客户",
      }),
    );
    expect(screen.getByText("已有姓名和电话完全相同的客户")).toBeInTheDocument();
    expect(onNewCustomerIntentChange).toHaveBeenLastCalledWith("blocked_exact_duplicate");
    await user.click(screen.getByRole("button", { name: "使用已有客户" }));
    expect(onPickCustomer).toHaveBeenCalledTimes(1);
    expect(onNewCustomerIntentChange).toHaveBeenLastCalledWith(null);
  });

  it("blocks a shared-phone create intent until a distinguishing name is present", async () => {
    const user = userEvent.setup();
    const onNewCustomerIntentChange = vi.fn();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([
      makeIntakeCandidate({ name: "Alice", phoneRaw: "3335719865", nameMatchKind: "none" }),
    ]);

    renderWithClient(
      <CustomerIdentityLookupHarness
        initialPhone="3335719865"
        onNewCustomerIntentChange={onNewCustomerIntentChange}
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "不使用这些结果，按当前资料新建客户",
      }),
    );

    expect(screen.getByText("请先填写可区分的客户姓名")).toBeInTheDocument();
    expect(onNewCustomerIntentChange).toHaveBeenLastCalledWith("blocked_missing_name");
  });
});

function CustomerIdentityLookupHarness({
  initialPhone = "",
  initialName = "",
  onPickCustomer = () => undefined,
  onClearCustomerSelection = () => undefined,
  onNewCustomerIntentChange,
}: {
  initialPhone?: string;
  initialName?: string;
  onPickCustomer?: (candidate: CustomerIntakeCandidate) => void;
  onClearCustomerSelection?: () => void;
  onNewCustomerIntentChange?: (intent: CustomerIntakeNewCustomerPolicy | null) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);

  return (
    <CustomerIdentityLookup
      phone={phone}
      name={name}
      onPhoneChange={setPhone}
      onNameChange={setName}
      onPickCustomer={onPickCustomer}
      onClearCustomerSelection={onClearCustomerSelection}
      onNewCustomerIntentChange={onNewCustomerIntentChange}
    />
  );
}

function makeIntakeCandidate(
  overrides: {
    id?: string;
    name?: string;
    phoneRaw?: string;
    nameMatchKind?: CustomerIntakeCandidate["nameMatchKind"];
  } = {},
): CustomerIntakeCandidate {
  const phoneRaw = overrides.phoneRaw ?? "0000000000";
  return {
    customer: {
      id: overrides.id ?? "customer-1",
      name: overrides.name ?? "Alice",
      phone_e164: phoneRaw,
      phone_raw: phoneRaw,
      contact_phones: [],
      consent_marketing: false,
      consent_sms: true,
    },
    exactMatch: true,
    phoneMatchKind: "exact_primary",
    nameMatchKind: overrides.nameMatchKind ?? "exact",
    historyDevices: [],
  };
}

function CustomerPhoneLookupHarness({
  onPick = () => undefined,
}: { onPick?: (customer: Customer) => void | Promise<void> } = {}) {
  const [value, setValue] = useState("");

  return <CustomerPhoneLookup value={value} onChange={setValue} onPick={onPick} />;
}

function renderWithClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function makeShellContext(): StoreShellContextSnapshot {
  const activeStore = {
    id: storeId,
    name: "Chinatech",
    slug: "chinatech",
    role: "owner",
    status: "active",
  } as const;

  return {
    authorityFingerprint: "test-authority",
    activeStore,
    stores: [activeStore],
    isPlatformAdmin: false,
    isLoading: false,
    isRefreshing: false,
    isError: false,
    isDegraded: false,
    canSwitchStore: false,
    status: "ready",
    statusLabel: "店铺在线",
    statusDescription: "当前店铺上下文已同步。",
  };
}
