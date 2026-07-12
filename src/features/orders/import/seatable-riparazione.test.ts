import { describe, expect, it } from "vitest";

import {
  buildSeaTableRiparazioneImport,
  mapSeaTableStatus,
  parseMoney,
  parseSeaTableCsv,
} from "./seatable-riparazione";

describe("SeaTable RIPARAZIONE import mapper", () => {
  it("parses quoted CSV cells with commas and new lines", () => {
    const rows = parseSeaTableCsv('NOME,PROBLEMA\n"Rossi, Mario","riga 1\nriga 2"\n');
    expect(rows).toEqual([
      ["NOME", "PROBLEMA"],
      ["Rossi, Mario", "riga 1\nriga 2"],
    ]);
  });

  it("maps SeaTable rows into RepairDesk rows", () => {
    const csv = [
      "STATO,NOME,OGGETTO,DA RIPARARE,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,GARANZIA,DATA RITIRO,DATA AGGIUNTA,TECNICO,S/N o IMEI,FORNITORE",
      'INCORSO,Mario,"SIM card","Display","+39 333 111 222 / +39 333 999 888","80,00",20,Apple,"iPhone 14","Schermo rotto",6 mesi,,18/05/2026 16:38,ALESSIO,IMEI123,MB',
    ].join("\n");

    const result = buildSeaTableRiparazioneImport(csv, {
      now: new Date("2026-06-01T10:00:00.000Z"),
      idFactory: (prefix, row) => `${prefix}_${row}`,
    });

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({
      id: "cus_import_2",
      name: "Mario",
      phone_e164: "+39 333 111 222",
      phone_raw: "39333111222",
      contact_phones: ["+39 333 999 888"],
    });
    expect(result.devices[0]).toMatchObject({
      id: "dev_import_2",
      brand: "Apple",
      model: "iPhone 14",
      serial_or_imei: "IMEI123",
    });
    expect(result.suppliers[0]).toMatchObject({
      name: "MB",
      short_name: "MB",
    });
    expect(result.repairOrders[0]).toMatchObject({
      id: "ord_import_2",
      status: "diagnosing",
      workflow_status: "diagnosis",
      payment_status: "partial",
      notify_status: "not_sent",
      supplier_id: result.suppliers[0].id,
      quotation_amount: 80,
      deposit_amount: 20,
      balance_amount: 60,
      contact_phones: ["+39 333 999 888"],
      accessory_notes: "SIM card",
      warranty_text: "6 mesi",
    });
    expect(result.orderEvents[0]).toMatchObject({
      id: "evt_import_2",
      event_type: "created",
      payload: { source: "RIPARAZIONE", source_row: 2 },
    });
    expect(result.orderEvents[0].payload).not.toHaveProperty("raw");
  });

  it("reuses customers by primary phone while merging backup phones", () => {
    const csv = [
      "STATO,NOME,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,DATA AGGIUNTA,TECNICO",
      "INCORSO,Mario,+39 333 111 222 / +39 333 999 888,80,0,Apple,14,Display,18/05/2026,ALESSIO",
      "INCORSO,Mario,+39 333 111 222 / +39 333 777 666,50,0,Apple,14,Batteria,19/05/2026,ALESSIO",
    ].join("\n");

    const result = buildSeaTableRiparazioneImport(csv, {
      idFactory: (prefix, row) => `${prefix}_${row}`,
      now: new Date("2026-06-01T10:00:00.000Z"),
    });

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].contact_phones).toEqual(["+39 333 999 888", "+39 333 777 666"]);
    expect(result.repairOrders).toHaveLength(2);
  });

  it("uses OGGETTO workflow markers for order type instead of accessory notes", () => {
    const csv = [
      "STATO,NOME,OGGETTO,DA RIPARARE,NUMERO TELEFONO,PREZZO TOTALE,MARCA,MODELLO,PROBLEMA,DATA AGGIUNTA",
      "FATTO,Mario,RIPARAZIONE VELOCE,DISPLAY,+39 333 111 222,50,Apple,14,Display rotto,18/05/2026",
    ].join("\n");

    const result = buildSeaTableRiparazioneImport(csv, {
      idFactory: (prefix, row) => `${prefix}_${row}`,
      now: new Date("2026-06-01T10:00:00.000Z"),
    });

    expect(result.repairOrders[0]).toMatchObject({
      order_type: "quick_repair",
      status: "completed",
      accessory_notes: null,
    });
  });

  it("maps common states", () => {
    expect(mapSeaTableStatus("INCORSO", "", undefined, 2)).toBe("diagnosing");
    expect(mapSeaTableStatus("IN CORSO", "", "2025-07-10T19:07:20.739+02:00", 2)).toBe(
      "diagnosing",
    );
    expect(mapSeaTableStatus("PEZZI ORDINATI", "", undefined, 2)).toBe("parts_ordered");
    expect(mapSeaTableStatus("到货已通知", "未修", undefined, 2)).toBe("parts_arrived");
    expect(mapSeaTableStatus("修好", "下单 配件", undefined, 2)).toBe("repaired");
    expect(mapSeaTableStatus("修好已通知", "未修", undefined, 2)).toBe("repaired");
    expect(mapSeaTableStatus("寄修", "未修", undefined, 2)).toBe("mail_in_progress");
    expect(mapSeaTableStatus("RITIRATO", "", undefined, 2)).toBe("completed");
    expect(mapSeaTableStatus("欠款 已拿走", "", undefined, 2)).toBe("completed");
    expect(mapSeaTableStatus("ANNULLATO", "", undefined, 2)).toBe("cancelled");
  });

  it("keeps notification separate from handover evidence", () => {
    const csv = [
      "STATO,NOME,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,DATA RITIRO,DATA AGGIUNTA",
      "到货已通知,Mario,+39 333 111 222,80,20,Apple,14,Display,20/05/2026,18/05/2026",
      "修好已通知,Luigi,+39 333 222 333,50,50,Samsung,S24,客户说取走旧电池,21/05/2026,19/05/2026",
      "作废已通知,Anna,+39 333 333 444,30,0,Xiaomi,14,Software,22/05/2026,20/05/2026",
      "修好,Paolo,+39 333 444 555,60,0,Apple,13,尚未通知客户且客户说取走旧电池,23/05/2026,21/05/2026",
    ].join("\n");

    const result = buildSeaTableRiparazioneImport(csv, {
      idFactory: (prefix, row) => `${prefix}_${row}`,
      now: new Date("2026-06-01T10:00:00.000Z"),
    });

    expect(result.repairOrders[0]).toMatchObject({
      status: "parts_arrived",
      workflow_status: "parts",
      parts_status: "arrived",
      notify_status: "sent",
      delivered_at: null,
    });
    expect(result.repairOrders[1]).toMatchObject({
      status: "repaired",
      workflow_status: "repair",
      notify_status: "sent",
      delivered_at: null,
    });
    expect(result.repairOrders[2]).toMatchObject({
      status: "cancelled",
      workflow_status: "closed",
      notify_status: "sent",
      delivered_at: null,
    });
    expect(result.repairOrders[3]).toMatchObject({
      status: "repaired",
      workflow_status: "repair",
      notify_status: "not_sent",
      delivered_at: null,
    });
  });

  it("parses Italian money formats", () => {
    expect(parseMoney("€1.250,50")).toBe(1250.5);
    expect(parseMoney("80,00")).toBe(80);
    expect(parseMoney("80.50")).toBe(80.5);
  });
});
