import { describe, expect, it } from "vitest";

import { buildCustomerMessage } from "@/features/customers/forms/customer-message-dialog";
import { getCustomerDetail } from "@/features/customers/testing/mock-api";
import { customers } from "@/lib/mock/state";

describe("customer message identity", () => {
  it("uses the selected tenant signature and never injects a global store fallback", async () => {
    const detail = await getCustomerDetail(customers[0].id);
    const message = buildCustomerMessage(detail, "https://example.test", {
      storeName: "Etna Phone Lab",
      messageSignature: "Etna Phone Lab · Assistenza",
    });

    expect(message).toContain("Etna Phone Lab");
    expect(message).toContain("Etna Phone Lab · Assistenza");
    expect(message).not.toContain("Area assistenza:");
    expect(message).not.toContain(`/customers/${customers[0].id}`);
    expect(message).not.toMatch(/ChinaTech|Chinatech|Floridia|Viale Vittorio Veneto/i);
  });

  it("omits the assistance link when the store has no safe public base URL", async () => {
    const detail = await getCustomerDetail(customers[0].id);
    const message = buildCustomerMessage(detail, "", {
      storeName: "Etna Phone Lab",
      messageSignature: "Etna Phone Lab · Assistenza",
    });

    expect(message).toContain("Etna Phone Lab");
    expect(message).not.toContain("Area assistenza:");
    expect(message).not.toMatch(/chinatech\\.in|ChinaTech|Floridia|Viale Vittorio Veneto/i);
  });
});
