import { describe, expect, it } from "vitest";

import {
  buildOrderWhatsappMessage,
  getDefaultOrderWhatsappTemplateKind,
  getOrderWhatsappTransition,
  orderWhatsappTemplateOptions,
  replaceOrderWhatsappRecipientPhone,
} from "@/features/orders/model/order-message-templates";
import { getOrder, listOrders } from "@/features/orders/testing/mock-api";

describe("order WhatsApp message templates", () => {
  it("builds editable Italian messages for every order template", async () => {
    const [order] = await listOrders();
    const detail = await getOrder(order.id);

    for (const option of orderWhatsappTemplateOptions) {
      const message = buildOrderWhatsappMessage(detail, option.kind, "https://example.com/order");

      expect(message).toContain(detail.order.public_no);
      expect(message).toContain("ChinaTech");
      expect(message).not.toContain("您好");
    }
  });

  it("uses approval and pickup defaults for customer-facing status points", () => {
    expect(getDefaultOrderWhatsappTemplateKind("quoted")).toBe("approval_request");
    expect(getDefaultOrderWhatsappTemplateKind("waiting_approval")).toBe("approval_request");
    expect(getDefaultOrderWhatsappTemplateKind("repaired")).toBe("pickup_ready");
    expect(getDefaultOrderWhatsappTemplateKind("unfixed_pickup")).toBe("unfixed_pickup");
  });

  it("keeps the selected recipient phone in the editable message body", async () => {
    const [order] = await listOrders();
    const detail = await getOrder(order.id);

    const message = buildOrderWhatsappMessage(
      detail,
      "repair_status",
      "https://example.com/order",
      {
        recipientPhone: "+39 333 111 2222",
      },
    );
    const updated = replaceOrderWhatsappRecipientPhone(message, "+39 333 999 0000");

    expect(message).toContain("Telefono cliente: +39 333 111 2222");
    expect(updated).toContain("Telefono cliente: +39 333 999 0000");
    expect(updated).not.toContain("Telefono cliente: +39 333 111 2222");
  });

  it("uses status-safe notification transitions", () => {
    expect(getOrderWhatsappTransition("quoted", "approval_request")).toBe("waiting_approval");
    expect(getOrderWhatsappTransition("repaired", "pickup_ready")).toBe("notified");
    expect(getOrderWhatsappTransition("new", "approval_request")).toBeUndefined();
  });
});
