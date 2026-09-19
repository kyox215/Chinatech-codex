import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { getOrderAmountAnomalyReasons } from "@/entities/order/model/order-calculations";
import { customersKeys } from "@/features/customers/api/query-keys";
import { getCustomerPaymentState } from "@/features/customers/model/customer-list";
import { invalidateOrderReadCaches } from "@/features/orders/api/cache-sync";
import { deriveOrderFinancialState } from "@/features/orders/model/order-payment-state";
import {
  createOrder,
  decideOrderApproval,
  getOrder,
  recordPayment,
  transitionOrder,
} from "@/features/orders/testing/mock-api";

import { getCustomerDetail, listCustomersPage } from "./mock-api";

let sequence = 0;

async function createPaymentFixture(amount: number, customerId?: string) {
  sequence += 1;
  const created = await createOrder({
    operation_id: crypto.randomUUID(),
    ...(customerId ? { customer_id: customerId } : {}),
    customer_name: `Synthetic balance diagnostic ${String.fromCharCode(64 + sequence)}`,
    customer_phone: customerId ? undefined : `+39333179${String(sequence).padStart(4, "0")}`,
    device_brand: "Test",
    device_model: `Balance fixture ${sequence}`,
    device_imei: `SYNTHETIC-BALANCE-${sequence}`,
    order_type: "quick_repair",
    status: "new",
    issue_description: "Synthetic payment balance verification",
    fault_prices: [{ name: "Synthetic service", price: amount }],
    deposit_amount: 0,
  });
  await transitionOrder(created.id, "diagnosing");
  await transitionOrder(created.id, "quoted");
  const quoted = await getOrder(created.id);
  await decideOrderApproval(created.id, {
    expected_updated_at: quoted.order.updated_at,
    idempotency_key: crypto.randomUUID(),
    quote_event_id: quoted.latest_quote_event_id ?? null,
    decision: "approved",
    next_status: "repairing",
    reason: "Synthetic approval for payment verification",
  });
  const detail = await getOrder(created.id);
  return { ...detail, searchName: detail.customer!.name };
}

async function pay(orderId: string, amount: number) {
  const before = await getOrder(orderId);
  return recordPayment(
    orderId,
    amount,
    "现金",
    "Synthetic cashier",
    before.order.updated_at,
    crypto.randomUUID(),
  );
}

describe("customer balance after recorded payments (synthetic data only)", () => {
  it("clears a single €5 order from customer receivables only after full payment succeeds", async () => {
    const { order, searchName } = await createPaymentFixture(5);
    expect(await pay(order.id, 5)).toMatchObject({ ok: true, balance: 0, is_paid: true });

    const detail = await getCustomerDetail(order.customer_id);
    expect(detail.stats).toMatchObject({ outstanding_amount: 0, unpaid_amount: 0 });
    const all = await listCustomersPage({ search: searchName, pageSize: 100 });
    const customer = all.items.find((item) => item.id === order.customer_id)!;
    expect(getCustomerPaymentState(customer).kind).toBe("settled");
    const unpaid = await listCustomersPage({
      search: searchName,
      work: "unpaid",
      pageSize: 100,
    });
    expect(unpaid.items.some((item) => item.id === order.customer_id)).toBe(false);
  });

  it("keeps the remaining €65 when €5 is recorded against a €70 order", async () => {
    const { order } = await createPaymentFixture(70);
    expect(await pay(order.id, 5)).toMatchObject({ ok: true, balance: 65, is_paid: false });
    const detail = await getCustomerDetail(order.customer_id);
    expect(detail.stats).toMatchObject({ outstanding_amount: 65, unpaid_amount: 65 });
    expect(getCustomerPaymentState(detail.stats)).toMatchObject({
      kind: "outstanding",
      amount: 65,
    });
  });

  it("recognizes valid zero-deposit partial payments and still allows collection of the remainder", async () => {
    const { order } = await createPaymentFixture(70);
    expect(deriveOrderFinancialState(order).collectible).toBe(true);
    await pay(order.id, 5);
    const after = await getOrder(order.id);
    expect(after.order).toMatchObject({
      quotation_amount: 70,
      deposit_amount: 0,
      balance_amount: 65,
      is_paid: false,
      payment_status: "partial",
    });
    expect(
      getOrderAmountAnomalyReasons({
        quotationAmount: after.order.quotation_amount,
        depositAmount: after.order.deposit_amount,
        balanceAmount: after.order.balance_amount,
        isPaid: after.order.is_paid,
        paymentStatus: after.order.payment_status,
      }),
    ).toEqual([]);
    expect(deriveOrderFinancialState(after.order)).toMatchObject({
      settlement: "partial",
      collectible: true,
    });
    expect(after.capabilities?.canCollectPayment).toBe(true);
    expect(await pay(order.id, 65)).toMatchObject({ balance: 0, is_paid: true });
    expect((await getCustomerDetail(order.customer_id)).stats.outstanding_amount).toBe(0);
  });

  it("keeps other unpaid orders in the customer total after one order is settled", async () => {
    const first = await createPaymentFixture(5);
    const second = await createPaymentFixture(20, first.order.customer_id);
    await pay(first.order.id, 5);
    const detail = await getCustomerDetail(first.order.customer_id);
    expect(detail.stats).toMatchObject({ outstanding_amount: 20, unpaid_amount: 20 });
    expect((await getOrder(second.order.id)).order.balance_amount).toBe(20);
  });

  it("leaves balances unchanged after rejection and does not apply an idempotent payment twice", async () => {
    const { order } = await createPaymentFixture(70);
    await expect(
      recordPayment(order.id, 5, "现金", "Synthetic cashier", "stale", crypto.randomUUID()),
    ).rejects.toThrow("工单已被更新");
    expect((await getCustomerDetail(order.customer_id)).stats.outstanding_amount).toBe(70);

    const key = crypto.randomUUID();
    const submit = () =>
      recordPayment(order.id, 5, "现金", "Synthetic cashier", order.updated_at, key);
    expect(await submit()).toMatchObject({ code: "recorded", balance: 65 });
    expect(await submit()).toMatchObject({ code: "idempotent_replay", balance: 65 });
    expect((await getCustomerDetail(order.customer_id)).stats.outstanding_amount).toBe(65);
  });

  it("refreshes an active paginated customer list after payment cache invalidation", async () => {
    const { order, searchName } = await createPaymentFixture(5);
    const client = new QueryClient();
    const input = { search: searchName, pageSize: 100 };
    const query = {
      queryKey: customersKeys.listPage(input, "synthetic-store"),
      queryFn: () => listCustomersPage(input),
      staleTime: Infinity,
    };
    const before = await client.fetchQuery(query);
    expect(before.items.find((item) => item.id === order.customer_id)?.outstanding_amount).toBe(5);
    const observer = new QueryObserver(client, query);
    const unsubscribe = observer.subscribe(() => {});
    try {
      await pay(order.id, 5);
      invalidateOrderReadCaches(client, order.id);
      await expect
        .poll(
          () =>
            observer.getCurrentResult().data?.items.find((item) => item.id === order.customer_id)
              ?.outstanding_amount,
        )
        .toBe(0);
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it("reloads an inactive unpaid list on return after its cached balance is invalidated", async () => {
    const { order, searchName } = await createPaymentFixture(5);
    const client = new QueryClient();
    const input = { search: searchName, work: "unpaid" as const, pageSize: 100 };
    const query = {
      queryKey: customersKeys.listPage(input, "synthetic-store"),
      queryFn: () => listCustomersPage(input),
      staleTime: Infinity,
    };
    const before = await client.fetchQuery(query);
    expect(before.items.map((item) => item.id)).toContain(order.customer_id);
    await pay(order.id, 5);
    invalidateOrderReadCaches(client, order.id);
    expect(client.getQueryState(query.queryKey)?.isInvalidated).toBe(true);
    const observer = new QueryObserver(client, query);
    const unsubscribe = observer.subscribe(() => {});
    try {
      await expect.poll(() => observer.getCurrentResult().data?.items.length).toBe(0);
      expect(client.getQueryState(query.queryKey)?.isInvalidated).toBe(false);
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it("keeps the previous balance on a failed refresh and converges after retry", async () => {
    const { order, searchName } = await createPaymentFixture(5);
    const client = new QueryClient();
    const input = { search: searchName, pageSize: 100 };
    let failRead = false;
    const query = {
      queryKey: customersKeys.listPage(input, "synthetic-store"),
      queryFn: () => {
        if (failRead) throw new Error("Synthetic offline read failure");
        return listCustomersPage(input);
      },
      staleTime: Infinity,
      retry: false,
    };
    await client.fetchQuery(query);
    const observer = new QueryObserver(client, query);
    const unsubscribe = observer.subscribe(() => {});
    try {
      await pay(order.id, 5);
      failRead = true;
      invalidateOrderReadCaches(client, order.id);
      await expect.poll(() => observer.getCurrentResult().status).toBe("error");
      expect(
        observer.getCurrentResult().data?.items.find((item) => item.id === order.customer_id)
          ?.outstanding_amount,
      ).toBe(5);
      failRead = false;
      await observer.refetch();
      expect(
        observer.getCurrentResult().data?.items.find((item) => item.id === order.customer_id)
          ?.outstanding_amount,
      ).toBe(0);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
