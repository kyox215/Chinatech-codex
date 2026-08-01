import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerIntakeCandidate } from "@/lib/repairdesk/types";

import { CustomerFormDialog } from "./customer-form-dialog";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const { searchCustomerIntakeCandidates } = vi.hoisted(() => ({
  searchCustomerIntakeCandidates: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  return { ...actual, searchCustomerIntakeCandidates };
});

function renderDialog({ onSave = vi.fn().mockResolvedValue(undefined) } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CustomerFormDialog
        open
        title="新建客户"
        activeStoreId="store-1"
        initial={{
          name: "",
          phone_e164: "",
          contact_phones: [],
          preferred_channel: "whatsapp",
          language: "it",
          consent_marketing: false,
          consent_sms: false,
        }}
        busy={false}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onOpenExisting={vi.fn()}
        onStartOrderForExisting={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { onSave };
}

describe("CustomerFormDialog", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    searchCustomerIntakeCandidates.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps optional details collapsed and enables both continuations after identity verification", async () => {
    searchCustomerIntakeCandidates.mockResolvedValue([]);
    const { onSave } = renderDialog();
    const user = userEvent.setup();

    expect(screen.queryByLabelText("邮箱")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/手机号/), "+39 333 123 4567");
    await user.type(screen.getByLabelText(/姓名/), "Mario Rossi");

    expect(
      await screen.findByText("未发现相同手机号，可以继续创建。", {}, { timeout: 2_000 }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "仅保存并查看客户" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mario Rossi", phone_e164: "+39 333 123 4567" }),
      "view_customer",
    );
  });

  it("blocks creation and offers reuse actions for an exact phone match", async () => {
    searchCustomerIntakeCandidates.mockResolvedValue([
      {
        customer: {
          id: "customer-existing",
          name: "Mario Rossi",
          phone_e164: "+393331234567",
          phone_raw: "393331234567",
          contact_phones: [],
          consent_marketing: false,
          consent_sms: false,
          preferred_channel: "whatsapp",
          language: "it",
        },
        exactMatch: true,
        phoneMatchKind: "exact_primary",
        nameMatchKind: "exact",
        historyDevices: [],
      } satisfies CustomerIntakeCandidate,
    ]);
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/手机号/), "+39 333 123 4567");
    await user.type(screen.getByLabelText(/姓名/), "Mario Rossi");

    expect(await screen.findByText("这个手机号已经关联客户", {}, { timeout: 2_000 })).toBeVisible();
    expect(screen.getByRole("button", { name: "打开客户" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "用此客户开单" })).toBeEnabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "保存并新建工单" })).toBeDisabled(),
    );
  });

  it("does not treat an identity lookup error as no match", async () => {
    searchCustomerIntakeCandidates.mockRejectedValue(new Error("offline"));
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/手机号/), "+39 333 987 6543");
    await user.type(screen.getByLabelText(/姓名/), "Cliente Offline");

    expect(
      await screen.findByText("身份核对失败，当前不能把它当作新客户。", {}, { timeout: 2_000 }),
    ).toBeVisible();
    expect(screen.queryByText("未发现相同手机号，可以继续创建。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存并新建工单" })).toBeDisabled();
  });

  it("disables submit immediately when the verified phone changes inside the debounce window", async () => {
    searchCustomerIntakeCandidates.mockResolvedValue([]);
    renderDialog();
    const user = userEvent.setup();
    const phoneInput = screen.getByLabelText(/手机号/);

    await user.type(phoneInput, "+39 333 123 4567");
    await user.type(screen.getByLabelText(/姓名/), "Mario Rossi");
    expect(
      await screen.findByText("未发现相同手机号，可以继续创建。", {}, { timeout: 2_000 }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "保存并新建工单" })).toBeEnabled();

    fireEvent.change(phoneInput, { target: { value: "+39 333 123 4568" } });

    expect(screen.getByRole("button", { name: "保存并新建工单" })).toBeDisabled();
    expect(screen.getByText("正在核对客户身份…")).toBeVisible();
  });
});
