import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { decorate, orders } from "@/lib/mock/state";

import { OrderListPrintSheet } from "./order-list-print-sheet";

afterEach(cleanup);

describe("OrderListPrintSheet store identity", () => {
  it("prints the active partner store address without leaking the legacy default store", () => {
    render(
      <OrderListPrintSheet
        orders={[decorate(orders[0])]}
        activeStore={{ id: "store-partner", name: "ZYG HOME Demo" }}
        storeSettings={{
          store_id: "store-partner",
          store_name: "ZYG HOME Demo",
          store_address: "Via Demo 12, Siracusa",
          store_phone: "+39 000 000000",
          message_signature: "ZYG HOME Demo",
          print_footer: "Grazie per aver scelto ZYG HOME Demo.",
        }}
      />,
    );

    expect(document.body).toHaveTextContent("ZYG HOME Demo");
    expect(document.body).toHaveTextContent("Via Demo 12, Siracusa");
    expect(document.body).toHaveTextContent("Tel: +39 000 000000");
    expect(document.body).not.toHaveTextContent("ChinaTech");
    expect(document.body).not.toHaveTextContent("Floridia");
    expect(document.body).not.toHaveTextContent("Viale Vittorio Veneto");
  });
});
