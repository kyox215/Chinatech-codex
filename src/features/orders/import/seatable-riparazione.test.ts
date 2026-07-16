import { describe, expect, it } from "vitest";

import {
  buildSeaTableRiparazioneImport,
  mapSeaTableStatus,
  parseMoney,
  parseSeaTableCsv,
} from "./seatable-riparazione";
import { isKnownRepairDeskDemoOrder, seaTableImportPublicNo } from "./seatable-import-provenance";

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
      consent_required_notify: false,
      consent_sms: false,
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
    expect(mapSeaTableStatus("正在处理中", "", undefined, 2)).toBe("diagnosing");
    expect(mapSeaTableStatus("IN CORSO", "", "2025-07-10T19:07:20.739+02:00", 2)).toBe(
      "diagnosing",
    );
    expect(mapSeaTableStatus("PEZZI ORDINATI", "", undefined, 2)).toBe("parts_ordered");
    expect(mapSeaTableStatus("已经下单了", "", undefined, 2)).toBe("parts_ordered");
    expect(mapSeaTableStatus("到货", "", undefined, 2)).toBe("parts_arrived");
    expect(mapSeaTableStatus("到货一通知", "", undefined, 2)).toBe("parts_arrived");
    expect(mapSeaTableStatus("到货已通知", "", undefined, 2)).toBe("parts_arrived");
    expect(mapSeaTableStatus("修好", "", undefined, 2)).toBe("repaired");
    expect(mapSeaTableStatus("修好", "下单 配件", undefined, 2)).toBe("repaired");
    expect(mapSeaTableStatus("修好一通知", "", undefined, 2)).toBe("notified");
    expect(mapSeaTableStatus("修好已通知", "下单 配件", undefined, 2)).toBe("notified");
    expect(mapSeaTableStatus("寄修", "修好", undefined, 2)).toBe("mail_in_progress");
    expect(mapSeaTableStatus("RITIRATO", "", undefined, 2)).toBe("completed");
    expect(mapSeaTableStatus("完成", "", undefined, 2)).toBe("completed");
    expect(mapSeaTableStatus("欠款 已拿走", "", undefined, 2)).toBe("completed");
    expect(mapSeaTableStatus("ANNULLATO", "", undefined, 2)).toBe("cancelled");
    expect(mapSeaTableStatus("作废", "", undefined, 2)).toBe("cancelled");
  });

  it("keeps authoritative SeaTable states ahead of misleading problem text", () => {
    expect(mapSeaTableStatus("FATTO", "未修 下单", undefined, 2)).toBe("completed");
    expect(mapSeaTableStatus("IN CORSO", "下单 配件", undefined, 2)).toBe("diagnosing");
    expect(mapSeaTableStatus("到货", "未修", undefined, 2)).toBe("parts_arrived");
    expect(mapSeaTableStatus("到货已通知", "未修", undefined, 2)).toBe("parts_arrived");
    expect(mapSeaTableStatus("修好", "未修", undefined, 2)).toBe("repaired");
    expect(mapSeaTableStatus("修好已通知", "未修", undefined, 2)).toBe("notified");
    expect(mapSeaTableStatus("作废", "修好 已通知", undefined, 2)).toBe("cancelled");
    expect(mapSeaTableStatus("UNKNOWN", "客户已通知", undefined, 2)).toBe("diagnosing");
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
      status: "notified",
      workflow_status: "pickup",
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

  it("keeps unpaid balance on picked-up completed orders", () => {
    const csv = [
      "STATO,NOME,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,DATA RITIRO,DATA AGGIUNTA",
      "欠款 已拿走,Mario,+39 333 111 222,80,20,Apple,14,Display,20/05/2026,18/05/2026",
    ].join("\n");

    const result = buildSeaTableRiparazioneImport(csv, {
      idFactory: (prefix, row) => `${prefix}_${row}`,
      now: new Date("2026-06-01T10:00:00.000Z"),
    });

    expect(result.repairOrders[0]).toMatchObject({
      status: "completed",
      balance_amount: 60,
      payment_status: "partial",
      completed_at: new Date(2026, 4, 20).toISOString(),
    });
  });

  it("raises quotation to the source deposit when the owner approves that policy", () => {
    const csv = [
      "STATO,NOME,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,DATA AGGIUNTA",
      "FATTO,Mario,+39 333 111 222,15,19,Apple,11,Camera glass,08/05/2023",
    ].join("\n");

    const result = buildSeaTableRiparazioneImport(csv, {
      idFactory: (prefix, row) => `${prefix}_${row}`,
      now: new Date("2026-06-01T10:00:00.000Z"),
      moneyOveragePolicy: "raise_quotation_to_deposit",
    });

    expect(result.repairOrders[0]).toMatchObject({
      quotation_amount: 19,
      deposit_amount: 19,
      balance_amount: 0,
      is_paid: true,
      payment_status: "paid",
      fault_prices: [{ price: 19 }],
    });
    expect(result.orderEvents[0].payload).toMatchObject({
      money_adjustment: {
        policy: "raise_quotation_to_deposit",
        source_quotation_amount: 15,
        source_deposit_amount: 19,
      },
    });
    expect(result.report.totalQuotation).toBe(19);
    expect(result.report.totalDeposit).toBe(19);
  });

  it("stores canonical side statuses for modern workflow columns", () => {
    const csv = [
      "STATO,NOME,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,DATA AGGIUNTA",
      "到货一通知,Mario,+39 333 111 222,80,20,Apple,14,Display,18/05/2026",
      "修好一通知,Luigi,+39 333 222 333,50,50,Samsung,S24,Batteria,19/05/2026",
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
      payment_status: "partial",
    });
    expect(result.repairOrders[1]).toMatchObject({
      status: "notified",
      workflow_status: "pickup",
      notify_status: "sent",
      payment_status: "paid",
    });
  });

  it("adds deterministic batch provenance without copying the raw source row", () => {
    const csv = [
      "STATO,NOME,NUMERO TELEFONO,PREZZO TOTALE,ACCONTO,MARCA,MODELLO,PROBLEMA,DATA AGGIUNTA",
      "INCORSO,Mario,+39 333 111 222,80,20,Apple,14,Display,18/05/2026",
    ].join("\n");
    const provenance = {
      importBatchId: "chinatech-riparazione-20260710-v1",
      sourceFileName: "riparazione-default.csv",
      sourceFileSha256: "a".repeat(64),
      fallbackTimestamp: "2026-07-10T22:36:20.000Z",
      targetStoreId: "00000000-0000-4000-8000-000000000001",
    };

    const first = buildSeaTableRiparazioneImport(csv, { provenance });
    const second = buildSeaTableRiparazioneImport(csv, { provenance });

    expect(second.customers[0].id).toBe(first.customers[0].id);
    expect(second.devices[0].id).toBe(first.devices[0].id);
    expect(second.repairOrders[0].id).toBe(first.repairOrders[0].id);
    expect(second.orderEvents[0].id).toBe(first.orderEvents[0].id);
    expect(first.repairOrders[0]).toMatchObject({
      public_no: seaTableImportPublicNo(provenance.importBatchId, 2, provenance.sourceFileSha256),
      internal_tag: `seatable:${provenance.importBatchId}`,
    });
    expect(first.orderEvents[0].payload).toMatchObject({
      import_batch_id: provenance.importBatchId,
      provenance_version: 1,
      mapper_version: "2026-07-16",
      source_file: provenance.sourceFileName,
      source_file_sha256: provenance.sourceFileSha256,
      fallback_timestamp: provenance.fallbackTimestamp,
      source_row: 2,
    });
    expect(first.orderEvents[0].payload).not.toHaveProperty("raw");
    expect(first.repairOrders[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.customers[0]).toMatchObject({
      consent_required_notify: false,
      consent_marketing: false,
      consent_sms: false,
    });
  });

  it("only classifies demo-reset orders with all known test markers", () => {
    expect(
      isKnownRepairDeskDemoOrder({
        public_no: "TEST-0001",
        internal_tag: "AI_TEST_BATCH_20260613 · 新建",
      }),
    ).toBe(true);
    expect(
      isKnownRepairDeskDemoOrder({
        public_no: "TEST-0001",
        internal_tag: "customer supplied label",
      }),
    ).toBe(false);
    expect(
      isKnownRepairDeskDemoOrder({
        public_no: "R2026001",
        internal_tag: "AI_TEST_BATCH_20260613 · 新建",
      }),
    ).toBe(false);
  });

  it("parses Italian money formats", () => {
    expect(parseMoney("€1.250,50")).toBe(1250.5);
    expect(parseMoney("80,00")).toBe(80);
    expect(parseMoney("80.50")).toBe(80.5);
  });
});
