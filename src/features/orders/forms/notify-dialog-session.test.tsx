import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { orders } from "@/lib/mock/fixtures";
import type { OrderDetail } from "@/lib/repairdesk/types";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { NotifyDialog } from "./notify-dialog";

const v1 = "2026-09-16T04:00:00.123456Z",
  v2 = "2026-09-16T04:00:01.123456Z";
const identity = {
  storeName: "Synthetic Store",
  storeAddress: "Synthetic Street",
  contactLine: "Test",
  messageSignature: "Signature A",
  printFooter: "",
  publicBaseUrl: "https://example.invalid",
  canOutput: true,
  missingFields: [],
  warnings: [],
};
const fixture = (version = v1): OrderDetail => ({
  order: {
    ...orders[0]!,
    id: "notification-session",
    updated_at: version,
    status: "repairing",
    customer_phone: "+393335719865",
    contact_phones: ["+393335719865"],
    customer_name: "Synthetic Customer",
  } as OrderDetail["order"],
  messages: [],
  events: [],
  attachments: [],
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup() {
  vi.spyOn(window, "open").mockReturnValue({} as Window);
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  let data = fixture(),
    storeIdentity = identity,
    open = true;
  const props = () => (
    <LocaleProvider initialLocale="zh-CN">
      <NotifyDialog
        open={open}
        onOpenChange={onOpenChange}
        data={data}
        storeIdentity={storeIdentity}
        orderUrl="https://example.invalid/order/test"
        canReadStoreSettings
        canUpdateStoreSettings
        busy={false}
        onConfirm={onConfirm}
      />
    </LocaleProvider>
  );
  const view = render(props());
  return {
    onConfirm,
    onOpenChange,
    change(next: { data?: OrderDetail; identity?: typeof identity; open?: boolean }) {
      data = next.data ?? data;
      storeIdentity = next.identity ?? storeIdentity;
      open = next.open ?? open;
      view.rerender(props());
    },
  };
}
const bodyField = () => screen.getByRole("textbox", { name: "通知内容" });
const openChat = () => fireEvent.click(screen.getByRole("button", { name: "打开 WhatsApp" }));
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "我已发送，记录并继续" }));

describe("notification snapshot sessions", () => {
  it("allows manual confirmation after noopener returns null without recording an unconfirmed message", async () => {
    const h = setup();
    vi.mocked(window.open).mockReturnValueOnce(null);
    openChat();
    expect(screen.getByRole("button", { name: "我已发送，记录并继续" })).toBeEnabled();
    expect(h.onConfirm).not.toHaveBeenCalled();
    expect(bodyField()).toBeDisabled();
    confirm();
    await waitFor(() => expect(h.onConfirm).toHaveBeenCalledOnce());
  });
  it("keeps the draft editable and makes no confirmation when opening actually throws", () => {
    const h = setup();
    vi.mocked(window.open).mockImplementationOnce(() => {
      throw new Error("Synthetic browser failure");
    });
    openChat();
    expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeEnabled();
    expect(bodyField()).toBeEnabled();
    expect(h.onConfirm).not.toHaveBeenCalled();
  });
  it("rebases a clean, unopened session when store output identity and order data arrive", async () => {
    const h = setup();
    h.change({ identity: { ...identity, canOutput: false, messageSignature: "" } });
    expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeDisabled();
    h.change({ data: fixture(v2), identity: { ...identity, messageSignature: "Signature B" } });
    await waitFor(() =>
      expect((bodyField() as HTMLTextAreaElement).value).toContain("Signature B"),
    );
    openChat();
    confirm();
    await waitFor(() => expect(h.onConfirm).toHaveBeenCalledOnce());
    expect(h.onConfirm.mock.calls[0][0]).toMatchObject({ expectedUpdatedAt: v2 });
  });
  it("keeps dirty draft and a sticky conflict through version V1 to V2 to V1", async () => {
    const h = setup();
    fireEvent.change(bodyField(), { target: { value: "Local draft" } });
    h.change({ data: fixture(v2) });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeDisabled(),
    );
    h.change({ data: fixture(v1) });
    expect(bodyField()).toHaveValue("Local draft");
    expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "载入最新版本" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeEnabled(),
    );
  });
  it("does not replace an opened chat's body/version when remote data changes", async () => {
    const h = setup();
    const original = (bodyField() as HTMLTextAreaElement).value;
    openChat();
    h.change({ data: fixture(v2) });
    expect(bodyField()).toHaveValue(original);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "我已发送，记录并继续" })).toBeDisabled(),
    );
    expect(h.onConfirm).not.toHaveBeenCalled();
  });
  it("resumes an uncertain request with identical full payload/key after refresh and close/reopen", async () => {
    const h = setup();
    h.onConfirm.mockRejectedValueOnce(new Error("network uncertain"));
    fireEvent.change(bodyField(), { target: { value: "Frozen sent body" } });
    openChat();
    confirm();
    await screen.findByRole("alert");
    h.change({ data: fixture(v2), open: false });
    h.change({ open: true });
    expect(bodyField()).toHaveValue("Frozen sent body");
    confirm();
    await waitFor(() => expect(h.onConfirm).toHaveBeenCalledTimes(2));
    expect(h.onConfirm.mock.calls[1][0]).toEqual(h.onConfirm.mock.calls[0][0]);
    expect(h.onConfirm.mock.calls[1][0]).toMatchObject({ expectedUpdatedAt: v1 });
  });
  it.each([400, 403, 404, 409, 422])(
    "offers explicit recovery after a definite %s rejection",
    async (status) => {
      const h = setup();
      h.onConfirm.mockRejectedValueOnce(new RepairDeskApiError("Rejected", status));
      openChat();
      confirm();
      await screen.findByRole("alert");
      fireEvent.click(screen.getByRole("button", { name: "载入最新版本" }));
      await waitFor(() => expect(bodyField()).toBeEnabled());
      openChat();
      confirm();
      await waitFor(() => expect(h.onConfirm).toHaveBeenCalledTimes(2));
      expect(h.onConfirm.mock.calls[1][0].idempotencyKey).not.toBe(
        h.onConfirm.mock.calls[0][0].idempotencyKey,
      );
    },
  );
  it("keeps the quote pointer and version of an uncertain approval notification", async () => {
    const h = setup();
    h.change({
      data: {
        ...fixture(),
        order: { ...fixture().order, status: "quoted" },
        latest_quote_event_id: "quote-v1",
      },
    });
    h.onConfirm.mockRejectedValueOnce(new Error("network uncertain"));
    openChat();
    confirm();
    await screen.findByRole("alert");
    h.change({
      data: {
        ...fixture(v2),
        order: { ...fixture(v2).order, status: "quoted" },
        latest_quote_event_id: "quote-v2",
      },
    });
    confirm();
    await waitFor(() => expect(h.onConfirm).toHaveBeenCalledTimes(2));
    expect(h.onConfirm.mock.calls[1][0]).toEqual(h.onConfirm.mock.calls[0][0]);
    expect(h.onConfirm.mock.calls[1][0]).toMatchObject({
      orderId: "notification-session",
      quoteEventId: "quote-v1",
      expectedUpdatedAt: v1,
    });
  });
  it("keeps the approval body within the existing 8000-character contract before opening chat", () => {
    const h = setup();
    h.change({
      data: {
        ...fixture(),
        order: { ...fixture().order, status: "quoted" },
        latest_quote_event_id: "quote-v1",
      },
    });
    fireEvent.change(bodyField(), { target: { value: "x".repeat(8001) } });
    expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeDisabled();
    expect(window.open).not.toHaveBeenCalled();
  });
  it("blocks duplicate confirmation and close while the request is pending", async () => {
    const h = setup();
    let resolve!: () => void;
    h.onConfirm.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    openChat();
    confirm();
    expect(screen.getByRole("button", { name: "记录中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(h.onConfirm).toHaveBeenCalledOnce();
    resolve();
    await waitFor(() => expect(h.onOpenChange).toHaveBeenCalledWith(false));
  });
  it("blocks oversized ordinary content before opening an external chat", () => {
    setup();
    fireEvent.change(bodyField(), { target: { value: "x".repeat(10001) } });
    expect(screen.getByRole("button", { name: "打开 WhatsApp" })).toBeDisabled();
    expect(window.open).not.toHaveBeenCalled();
  });
});
