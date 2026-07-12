import { describe, expect, it } from "vitest";

import {
  buildOrderWhatsappMessage,
  getDefaultOrderWhatsappTemplateKind,
  getOrderWhatsappTransition,
  orderWhatsappTemplateOptions,
  replaceOrderWhatsappRecipientPhone,
} from "@/features/orders/model/order-message-templates";
import { translateFaultName } from "@/features/orders/model/order-italian";
import { getOrder, listOrders } from "@/features/orders/testing/mock-api";

describe("order WhatsApp message templates", () => {
  it("builds editable Italian messages for every order template", async () => {
    const [order] = await listOrders();
    const detail = await getOrder(order.id);

    for (const option of orderWhatsappTemplateOptions) {
      const message = buildOrderWhatsappMessage(detail, option.kind, "https://example.com/order", {
        storeIdentity: {
          storeName: "Ripara Subito",
          messageSignature: "Ripara Subito · Assistenza",
        },
      });

      expect(message).toContain(detail.order.public_no);
      expect(message).toContain("Ripara Subito");
      expect(message).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
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
        storeIdentity: {
          storeName: "Etna Phone Lab",
          messageSignature: "Etna Phone Lab",
        },
      },
    );
    const updated = replaceOrderWhatsappRecipientPhone(message, "+39 333 999 0000");

    expect(message).toContain("Telefono cliente: +39 333 111 2222");
    expect(updated).toContain("Telefono cliente: +39 333 999 0000");
    expect(updated).not.toContain("Telefono cliente: +39 333 111 2222");
  });

  it("uses a tenant-neutral closing when identity is unavailable", async () => {
    const [order] = await listOrders();
    const detail = await getOrder(order.id);
    const message = buildOrderWhatsappMessage(detail, "completed", "");

    expect(message).toContain("Grazie per la fiducia.");
    expect(message).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
  });

  it("uses status-safe notification transitions", () => {
    expect(getOrderWhatsappTransition("quoted", "approval_request")).toBe("waiting_approval");
    expect(getOrderWhatsappTransition("repaired", "pickup_ready")).toBe("notified");
    expect(getOrderWhatsappTransition("new", "approval_request")).toBeUndefined();
  });

  it("never describes a cancelled historical balance as payable", async () => {
    const [order] = await listOrders();
    const detail = await getOrder(order.id);
    detail.order = {
      ...detail.order,
      status: "repairing",
      exception_status: "cancelled",
      balance_amount: 70,
      is_paid: false,
    };

    for (const option of orderWhatsappTemplateOptions) {
      const message = buildOrderWhatsappMessage(detail, option.kind, "https://example.com/order");

      expect(message).not.toContain("Saldo da pagare");
      expect(message).not.toContain("Totale preventivo");
    }

    expect(
      buildOrderWhatsappMessage(detail, "repair_status", "https://example.com/order"),
    ).toContain("Stato attuale: Annullato");
  });

  it("translates expanded fault services without splitting slash or hyphen labels", () => {
    expect(translateFaultName("系统 - PIN/图案解锁")).toBe("Sistema - Sblocco PIN o sequenza");
    expect(translateFaultName("主板 - Wi-Fi/蓝牙异常")).toBe(
      "Scheda madre - Wi-Fi/Bluetooth difettoso",
    );
    expect(translateFaultName("系统 - 激活锁核验咨询")).toBe(
      "Sistema - Verifica blocco attivazione",
    );
  });
});
