import { describe, expect, it } from "vitest";

import { customers, orders } from "@/lib/mock/state";
import { getOrder } from "@/features/orders/testing/mock-api";

import {
  acceptKioskSession,
  createKioskDevicePairing,
  createKioskSession,
  getKioskPublicSession,
  pairKioskDevice,
  revokeKioskDevice,
  returnKioskSession,
  submitKioskPublicSession,
} from "./mock-api";

const actor = {
  storeId: "00000000-0000-0000-0000-000000000001",
  displayName: "Kiosk Tester",
};

describe("kiosk mock API review flow", () => {
  it.each([null, "with_customer"] as const)(
    "blocks pickup evidence when custody is %s",
    async (custody) => {
      const order = orders[0]!;
      const original = order.device_custody_status;
      order.device_custody_status = custody;
      try {
        await expect(
          createKioskSession(
            {
              device_id: "kiosk_device_demo",
              session_type: "pickup_signature",
              order_id: order.id,
              customer_id: order.customer_id,
            },
            actor,
          ),
        ).rejects.toThrow("只有已确认由门店保管的设备可以发起取机确认");
      } finally {
        order.device_custody_status = original;
      }
    },
  );

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
    expect(session.request_payload).toMatchObject({
      order_public_no: order.public_no,
      device_label: expect.any(String),
    });
    expect(session.request_payload).not.toHaveProperty("customer_name");
    expect(session.request_payload).not.toHaveProperty("customer_phone");
    expect(session.request_payload).not.toHaveProperty("balance_amount");

    await submitKioskPublicSession("demo-kiosk-token", {
      customer_name: "Cliente Kiosk",
      customer_phone: "+39 388 777 6601",
      backup_phone: "+39 388 777 6602",
      confirmation_checked: true,
    });

    await expect(
      acceptKioskSession(
        { id: session.id, expected_submission_version: session.submission_version },
        actor,
      ),
    ).resolves.toMatchObject({
      status: "accepted",
      accepted_at: expect.any(String),
    });
    expect(customer.name).toBe("Cliente Kiosk");
    expect(customer.phone_raw).toBe("393887776601");
    expect(customer.contact_phones).toContain("+39 388 777 6602");
  });

  it("returns a submitted session with only the customer-facing correction draft", async () => {
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
      signature_data_url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    });

    const returned = await returnKioskSession(
      {
        id: session.id,
        expected_submission_version: session.submission_version,
        reason: "Telefono non leggibile",
      },
      actor,
    );
    expect(returned.status).toBe("returned");
    expect(returned.submission_payload?.customer_return_reason).toBe("Telefono non leggibile");
    expect(returned.submission_payload).toMatchObject({ has_signature: true });
    expect(returned.submission_payload).not.toHaveProperty("signature_data_url");

    const publicSession = await getKioskPublicSession("demo-kiosk-token");
    expect(publicSession?.session.status).toBe("returned");
    expect(publicSession?.session.correction_message).toBe("Telefono non leggibile");
    expect(publicSession?.session.submission_draft).toMatchObject({
      customer_name: "Da Correggere",
      customer_phone: "+39 388 777 6611",
      has_signature: true,
    });
    expect(publicSession?.session).not.toHaveProperty("request_payload");
    expect(publicSession?.order).not.toHaveProperty("id");
    expect(publicSession?.order).not.toHaveProperty("balance_amount");
  });

  it("stores accepted iPad signatures as order evidence without retaining the raw data URL", async () => {
    const order = orders[2]!;
    const session = await createKioskSession(
      {
        device_id: "kiosk_device_demo",
        session_type: "pickup_signature",
        order_id: order.id,
        customer_id: order.customer_id,
      },
      actor,
    );

    await submitKioskPublicSession("demo-kiosk-token", {
      confirmation_checked: true,
      signature_data_url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    });

    const pickupPublicSession = await getKioskPublicSession("demo-kiosk-token");
    expect(pickupPublicSession?.order).not.toHaveProperty("customer_name");
    expect(pickupPublicSession?.order).not.toHaveProperty("customer_phone");

    const accepted = await acceptKioskSession(
      { id: session.id, expected_submission_version: session.submission_version },
      actor,
    );
    expect(accepted.status).toBe("accepted");
    expect(accepted.submission_payload).toMatchObject({
      has_signature: true,
      signature_attachment_id: expect.any(String),
    });
    expect(accepted.submission_payload).not.toHaveProperty("signature_data_url");

    const detail = await getOrder(order.id, actor);
    expect(detail.order.customer_signature).toContain("order_attachment:");
    expect(detail.attachments[0]).toMatchObject({
      kind: "signature",
      mime_type: "image/png",
      note: "iPad pickup/customer signature",
    });
  });

  it("rejects invalid and replayed pairing codes and revokes the issued token", async () => {
    await expect(pairKioskDevice("NOT-A-REAL-CODE")).rejects.toThrow("配对码无效或已过期");

    const pairing = await createKioskDevicePairing({ label: "Test iPad" }, actor);
    const paired = await pairKioskDevice(pairing.pairing_code);
    await expect(pairKioskDevice(pairing.pairing_code)).rejects.toThrow("配对码无效或已过期");

    await expect(getKioskPublicSession(paired.token)).resolves.toBeNull();
    await revokeKioskDevice(pairing.device.id, actor);
    await expect(getKioskPublicSession(paired.token)).rejects.toThrow("iPad 未绑定或已撤销");
  });

  it("does not let another store bind or revoke the demo store device", async () => {
    const otherStoreActor = {
      ...actor,
      storeId: "00000000-0000-0000-0000-000000000002",
      storeName: "Other Store",
    };

    await expect(
      createKioskSession(
        {
          device_id: "kiosk_device_demo",
          session_type: "intake_contact",
        },
        otherStoreActor,
      ),
    ).rejects.toThrow("客户 iPad 未绑定或不可用");
    await expect(revokeKioskDevice("kiosk_device_demo", otherStoreActor)).rejects.toThrow(
      "不属于当前店铺",
    );
  });
});
