import { describe, expect, it } from "vitest";
import type { OrderDetail } from "@/lib/repairdesk/types";
import { getOrderContactPhoneOptions, normalizeOrderContactChanges } from "./order-contact-phones";
import { buildEditForm } from "./edit-order-form";

function detail(): OrderDetail {
  return {
    order: {
      id: "order-1",
      public_no: "TEST-1",
      order_type: "quick_repair",
      status: "new",
      customer_id: "customer-1",
      device_id: "device-1",
      created_at: "2026-09-17T08:00:00Z",
      updated_at: "2026-09-17T08:00:00Z",
      quotation_amount: 0,
      deposit_amount: 0,
      balance_amount: 0,
      currency_code: "EUR",
      is_paid: false,
      approval_status: "pending",
      technician_name: "Synthetic",
      device_custody_status: "with_shop",
      device_label: "Synthetic device",
      device_imei: "",
      approval_overdue: false,
      pickup_overdue: false,
      customer_name: "Historical",
      customer_phone: "+390000000001",
      contact_phones: ["+390000000002"],
      fault_prices: [],
      issue_description: "Synthetic issue",
    },
    customer: {
      id: "customer-1",
      name: "",
      phone_e164: "+390000000003",
      phone_raw: "390000000003",
      contact_phones: ["+390000000004", "+39 0000000003"],
      updated_at: "2026-09-17T08:01:00Z",
      consent_marketing: false,
      consent_sms: false,
    },
    events: [],
    messages: [],
    attachments: [],
  };
}

describe("current order contacts and frozen edit identity", () => {
  it("uses the current profile and freezes its version with separate backup phones", () => {
    const data = detail();
    const draft = buildEditForm(data);
    expect(draft).toMatchObject({
      customer_name: "",
      customer_phone: "+390000000003",
      contact_phones: ["+390000000004"],
      expected_updated_at: "2026-09-17T08:00:00Z",
      expected_customer_updated_at: "2026-09-17T08:01:00Z",
    });
    data.customer!.updated_at = "2026-09-17T09:00:00Z";
    data.customer!.contact_phones.push("+390000000009");
    expect(draft.expected_customer_updated_at).toBe("2026-09-17T08:01:00Z");
    expect(draft.contact_phones).toEqual(["+390000000004"]);
  });

  it("contacts the current primary and backups without reviving historical phones", () => {
    expect(getOrderContactPhoneOptions(detail())).toEqual(["+390000000003", "+390000000004"]);
    const data = detail();
    data.customer!.phone_e164 = "";
    data.customer!.contact_phones = [];
    expect(getOrderContactPhoneOptions(data)).toEqual([]);
  });

  it("keeps omitted backups absent and treats [] as a replacement", () => {
    expect(normalizeOrderContactChanges({ customer_phone: "+39 0000000003" })).toEqual({
      phone_e164: "+39 0000000003",
      phone_raw: "390000000003",
    });
    expect(normalizeOrderContactChanges({ contact_phones: [] })).toEqual({ contact_phones: [] });
    expect(
      normalizeOrderContactChanges({ contact_phones: ["+390000000004", "+39 0000000004"] }),
    ).toEqual({ contact_phones: ["+390000000004"] });
  });

  it.each(["", "abc", "+390000000001 / +390000000002", "123", "+1234567890123456"])(
    "rejects an invalid or combined primary %s",
    (phone) => {
      expect(() => normalizeOrderContactChanges({ customer_phone: phone })).toThrow();
    },
  );
});
