import { describe, expect, it } from "vitest";

import { customers, orders } from "@/lib/mock/state";

import {
  acceptKioskSession,
  createKioskSession,
  getKioskPublicSession,
  returnKioskSession,
  submitKioskPublicSession,
} from "./mock-api";

const actor = {
  storeId: "00000000-0000-0000-0000-000000000001",
  displayName: "Kiosk Tester",
};

describe("kiosk mock API review flow", () => {
  it("accepts submitted customer data after staff review", async () => {
    const order = orders[0]!;
    const customer = customers.find((item) => item.id === order.customer_id)!;
    const session = await createKioskSession(
      {
        device_id: "kiosk_device_demo",
        session_type: "order_contact_signature",
        order_id: order.id,
        customer_id: order.customer_id,
      },
      actor,
    );

    await submitKioskPublicSession("demo-kiosk-token", {
      customer_name: "Cliente Kiosk",
      customer_phone: "+39 388 777 6601",
      backup_phone: "+39 388 777 6602",
      confirmation_checked: true,
    });

    await expect(acceptKioskSession(session.id, actor)).resolves.toMatchObject({
      status: "accepted",
      accepted_at: expect.any(String),
    });
    expect(customer.name).toBe("Cliente Kiosk");
    expect(customer.phone_raw).toBe("393887776601");
    expect(customer.contact_phones).toContain("+39 388 777 6602");
  });

  it("returns a submitted session for correction without exposing the staff reason publicly", async () => {
    const order = orders[1]!;
    const session = await createKioskSession(
      {
        device_id: "kiosk_device_demo",
        session_type: "order_contact_signature",
        order_id: order.id,
        customer_id: order.customer_id,
      },
      actor,
    );
    await submitKioskPublicSession("demo-kiosk-token", {
      customer_name: "Da Correggere",
      customer_phone: "+39 388 777 6611",
      confirmation_checked: true,
    });

    const returned = await returnKioskSession(
      { id: session.id, reason: "Telefono non leggibile" },
      actor,
    );
    expect(returned.status).toBe("returned");
    expect(returned.submission_payload?.staff_return_reason).toBe("Telefono non leggibile");

    const publicSession = await getKioskPublicSession("demo-kiosk-token");
    expect(publicSession?.session.status).toBe("returned");
    expect(publicSession?.session.request_payload).not.toHaveProperty("staff_return_reason");
  });
});
