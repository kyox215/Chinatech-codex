import { describe, expect, it } from "vitest";

import { buildSeaTableElectronicsImport } from "./seatable-electronics";

describe("seatable electronics import", () => {
  it("maps sold electronics rows and preserves raw legacy payload", () => {
    const csv = [
      "状态,NOME,NUMERO TELEFONO,CATEGORIA,MARCA,MODELLO,COLORE,MEMORIA,METODO DI PAGAMENTO,PREZZO,PREZZO PAGATO,ACCONTO,NOTE,BATTERIA,IMEI/序列号,DATA RITIRO,1,DATA,-",
      "Venduto,Mario,+39 333 111 2222,phone,Apple,iPhone 13,nero,128GB,carta,399,250,50,ok,86%,356000000000001,10/06/2026,legacy,01/06/2026,7",
    ].join("\n");

    const result = buildSeaTableElectronicsImport(csv, {
      now: new Date("2026-06-10T12:00:00.000Z"),
      idFactory: (prefix, row) => `${prefix}_${row}`,
    });

    expect(result.report.itemCount).toBe(1);
    expect(result.report.customerCount).toBe(1);
    expect(result.report.transactionCount).toBe(2);
    expect(result.items[0]).toMatchObject({
      id: "inv_electronics_2",
      status: "sold",
      brand: "Apple",
      model: "iPhone 13",
      buyback_price: 250,
      list_price: 399,
      sale_price: 399,
      deposit_amount: 50,
      battery_health: 86,
      serial_or_imei: "356000000000001",
    });
    expect(result.items[0].legacy_payload).toMatchObject({
      source: "seatable:电子产品",
      raw: { "1": "legacy", "-": "7" },
    });
  });

  it("infers listed and purchased statuses from prices", () => {
    const csv = [
      "NOME,NUMERO TELEFONO,MARCA,MODELLO,PREZZO,PREZZO PAGATO,DATA",
      "A,+39 333 111 0000,Samsung,S22,329,210,01/06/2026",
      "B,+39 333 111 0001,Xiaomi,13,,120,01/06/2026",
    ].join("\n");

    const result = buildSeaTableElectronicsImport(csv, {
      now: new Date("2026-06-10T12:00:00.000Z"),
      idFactory: (prefix, row) => `${prefix}_${row}`,
    });

    expect(result.items.map((item) => item.status)).toEqual(["listed", "purchased"]);
  });
});
