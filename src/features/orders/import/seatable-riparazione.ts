import crypto from "node:crypto";

import type { RepairOrderStatus, RepairOrderType } from "@/lib/mock/enums";
import { CURRENCY_CODE } from "@/lib/money";
import { normalizePhoneBook } from "@/shared/lib/phone";

export interface SeaTableImportOptions {
  now?: Date;
  delimiter?: string;
  idFactory?: (prefix: string, rowNumber: number) => string;
  limit?: number;
}

export interface SeaTableImportRowSet {
  customers: Record<string, unknown>[];
  devices: Record<string, unknown>[];
  suppliers: Record<string, unknown>[];
  repairOrders: Record<string, unknown>[];
  orderEvents: Record<string, unknown>[];
  report: SeaTableImportReport;
}

export interface SeaTableImportReport {
  totalRows: number;
  importedRows: number;
  customerCount: number;
  deviceCount: number;
  supplierCount: number;
  orderCount: number;
  totalQuotation: number;
  totalDeposit: number;
  warnings: SeaTableImportWarning[];
}

export interface SeaTableImportWarning {
  row: number;
  field: string;
  message: string;
  value?: string;
}

interface NormalizedRow {
  rowNumber: number;
  raw: Record<string, string>;
  stato: string;
  nome: string;
  oggetto: string;
  daRiparare: string;
  telefono: string;
  prezzoTotale: string;
  acconto: string;
  marca: string;
  modello: string;
  problema: string;
  garanzia: string;
  dataRitiro: string;
  dataAggiunta: string;
  tecnico: string;
  imei: string;
  supplier: string;
}

const FIELD_ALIASES = {
  stato: ["stato", "status"],
  nome: ["nome", "cliente", "nominativo"],
  oggetto: ["oggetto"],
  daRiparare: ["dariparare", "intervento", "lavoro", "riparazione"],
  telefono: ["numerotelefono", "telefono", "tel", "cellulare", "numero"],
  prezzoTotale: ["prezzototale", "totale", "prezzo", "preventivo"],
  acconto: ["acconto", "deposito", "caparra"],
  marca: ["marca", "brand"],
  modello: ["modello", "model"],
  problema: ["problema", "difetto", "note", "descrizione"],
  garanzia: ["garanzia", "warranty"],
  dataRitiro: ["dataritiro", "ritiro", "dataconsegna"],
  dataAggiunta: ["dataaggiunta", "data", "datainserimento", "creato"],
  tecnico: ["tecnico", "technician"],
  imei: ["snoimei", "snimei", "imei", "seriale", "serial"],
  supplier: ["fornitore", "supplier", "supplysource", "货源"],
} satisfies Record<keyof Omit<NormalizedRow, "rowNumber" | "raw">, string[]>;

const ACCESSORY_PATTERNS = [
  "sim",
  "scheda sim",
  "卡",
  "卡托",
  "手机壳",
  "保护壳",
  "cover",
  "custodia",
  "caricatore",
  "充电器",
  "cavo",
  "数据线",
  "scatola",
  "盒子",
  "sd",
  "memoria",
];

const EMPTY_OBJECT_MARKERS = new Set(["", "-", "no", "non", "nessuno", "null", "lasciatto"]);
const OBJECT_STATUS_MARKERS = new Set([
  ...EMPTY_OBJECT_MARKERS,
  "lasciato",
  "non lasciatto",
  "non lasciato",
  "riparazione veloce",
]);

export function buildSeaTableRiparazioneImport(
  csvContent: string,
  options: SeaTableImportOptions = {},
): SeaTableImportRowSet {
  const now = options.now ?? new Date();
  const parsed = parseSeaTableCsv(csvContent, options.delimiter);
  const records = rowsToObjects(parsed).slice(0, options.limit);
  const warnings: SeaTableImportWarning[] = [];
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const customersByRaw = new Map<
    string,
    { id: string; name: string; phone: string; contactPhones: string[]; createdAt: string }
  >();
  const customers: Record<string, unknown>[] = [];
  const devices: Record<string, unknown>[] = [];
  const suppliers: Record<string, unknown>[] = [];
  const suppliersByName = new Map<string, { id: string; name: string; shortName: string }>();
  const repairOrders: Record<string, unknown>[] = [];
  const orderEvents: Record<string, unknown>[] = [];

  for (const record of records) {
    const row = normalizeRecord(record);
    const phoneBook = normalizePhoneBook(row.telefono);
    const phoneRaw = phoneBook.primaryRaw || missingPhoneRaw(row.rowNumber);
    const primaryPhone = phoneBook.primary || `NO_PHONE_ROW_${row.rowNumber}`;
    const createdAt = parseSeaTableDate(
      row.dataAggiunta,
      now,
      row.rowNumber,
      "DATA AGGIUNTA",
      warnings,
    );
    const status = mapSeaTableStatus(
      row.stato,
      `${row.daRiparare} ${row.problema}`,
      undefined,
      row.rowNumber,
      warnings,
    );
    const deliveredAt =
      row.dataRitiro && shouldUsePickupTimestamp(status, row.stato, row.daRiparare, row.problema)
        ? parseSeaTableDate(row.dataRitiro, now, row.rowNumber, "DATA RITIRO", warnings)
        : undefined;
    const quotation = parseMoney(row.prezzoTotale, row.rowNumber, "PREZZO TOTALE", warnings);
    const deposit = parseMoney(row.acconto, row.rowNumber, "ACCONTO", warnings);
    const balance = Math.max(0, quotation - deposit);
    const customerName =
      cleanText(row.nome) || primaryPhone || `Cliente senza nome ${row.rowNumber}`;
    const deviceBrand =
      cleanText(row.marca) || warnDefault(row.rowNumber, "MARCA", "Sconosciuto", warnings);
    const deviceModel =
      cleanText(row.modello) || warnDefault(row.rowNumber, "MODELLO", "Sconosciuto", warnings);
    const issueDescription =
      cleanText(row.problema) || cleanText(row.daRiparare) || "Da verificare";
    const accessoryNotes = buildAccessoryNotes(row.oggetto, row.problema);
    const orderType = mapSeaTableOrderType(row.oggetto);
    const warrantyText = cleanText(row.garanzia) || "6个月";
    const technicianName = cleanText(row.tecnico) || "未分配";
    const supplier = getOrCreateSupplier(row.supplier, suppliersByName, suppliers, createdAt);

    if (!phoneBook.primaryRaw) {
      warnings.push({
        row: row.rowNumber,
        field: "NUMERO TELEFONO",
        message: "缺少有效手机号，已生成占位客户号码",
        value: row.telefono,
      });
    }
    if (phoneBook.contacts.length > 0) {
      warnings.push({
        row: row.rowNumber,
        field: "NUMERO TELEFONO",
        message: `检测到备用号码 ${phoneBook.contacts.length} 个`,
        value: row.telefono,
      });
    }

    let customer = customersByRaw.get(phoneRaw);
    if (!customer) {
      customer = {
        id: idFactory("cus_import", row.rowNumber),
        name: customerName,
        phone: primaryPhone,
        contactPhones: phoneBook.contacts,
        createdAt,
      };
      customersByRaw.set(phoneRaw, customer);
      customers.push({
        id: customer.id,
        name: customer.name,
        phone_e164: customer.phone,
        phone_raw: phoneRaw,
        contact_phones: customer.contactPhones,
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
        created_at: createdAt,
        updated_at: createdAt,
      });
    } else {
      customer.contactPhones = mergeContacts(customer.contactPhones, phoneBook.contacts, phoneRaw);
      const target = customers.find((item) => item.id === customer?.id);
      if (target) target.contact_phones = customer.contactPhones;
    }

    const deviceId = idFactory("dev_import", row.rowNumber);
    const orderId = idFactory("ord_import", row.rowNumber);
    const eventId = idFactory("evt_import", row.rowNumber);
    const updatedAt = deliveredAt ?? createdAt;
    const faultPrices = buildFaultPrices(row.daRiparare, issueDescription, quotation);

    devices.push({
      id: deviceId,
      customer_id: customer.id,
      brand: deviceBrand,
      model: deviceModel,
      serial_or_imei: cleanText(row.imei),
      device_notes: null,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    repairOrders.push({
      id: orderId,
      public_no: `SEA-${String(row.rowNumber - 1).padStart(6, "0")}`,
      order_type: orderType,
      status,
      status_raw: row.stato || null,
      customer_id: customer.id,
      device_id: deviceId,
      issue_description: issueDescription,
      diagnosis_result: null,
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: balance,
      currency_code: CURRENCY_CODE,
      is_paid: balance === 0,
      approval_status: "pending",
      approval_sent_at: null,
      approval_confirmed_at: null,
      technician_name: technicianName,
      internal_tag: null,
      accessory_notes: accessoryNotes || null,
      warranty_text: warrantyText,
      completed_at: status === "completed" ? (deliveredAt ?? updatedAt) : null,
      delivered_at: deliveredAt ?? null,
      pause_reason: null,
      cancel_reason: status === "cancelled" ? "SeaTable import" : null,
      supplier_id: supplier?.id ?? null,
      original_order_id: null,
      contact_phones: customer.contactPhones,
      fault_prices: faultPrices,
      device_snapshot: {
        brand: deviceBrand,
        model: deviceModel,
        serial_or_imei: cleanText(row.imei),
      },
      customer_signature: null,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    orderEvents.push({
      id: eventId,
      order_id: orderId,
      event_type: "created",
      payload: {
        action: "seatable_imported",
        source: "RIPARAZIONE",
        source_row: row.rowNumber,
        source_status: row.stato || null,
        source_supplier: supplier?.name ?? null,
        raw: row.raw,
        currency_code: CURRENCY_CODE,
      },
      operator_name: "SeaTable 导入",
      created_at: createdAt,
    });
  }

  return {
    customers,
    devices,
    suppliers,
    repairOrders,
    orderEvents,
    report: {
      totalRows: records.length,
      importedRows: repairOrders.length,
      customerCount: customers.length,
      deviceCount: devices.length,
      supplierCount: suppliers.length,
      orderCount: repairOrders.length,
      totalQuotation: roundMoney(
        repairOrders.reduce((sum, row) => sum + Number(row.quotation_amount), 0),
      ),
      totalDeposit: roundMoney(
        repairOrders.reduce((sum, row) => sum + Number(row.deposit_amount), 0),
      ),
      warnings,
    },
  };
}

export function parseSeaTableCsv(content: string, delimiter?: string): string[][] {
  const normalized = content.replace(/^\uFEFF/, "");
  const targetDelimiter = delimiter ?? detectDelimiter(normalized);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === targetDelimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

export function mapSeaTableStatus(
  statusValue: string,
  problemValue: string,
  _deliveredAt: string | undefined,
  row: number,
  warnings: SeaTableImportWarning[] = [],
): RepairOrderStatus {
  const status = `${statusValue} ${problemValue}`.toLowerCase();
  if (/(annull|cancel|作废|取消)/i.test(status)) return "cancelled";
  if (/(non\s*riparat|未修|不修|unfixed)/i.test(status)) return "unfixed_pickup";
  if (/(consegn|ritirat|completed|fatto|完成|取走)/i.test(status)) return "completed";
  if (/(avvis|notificat|已通知)/i.test(status)) return "notified";
  if (/(pronto|riparat|修好|可取)/i.test(status)) return "repaired";
  if (/(arrivat|到货)/i.test(status)) return "parts_arrived";
  if (/(pezzi|ricambi|ordinat|配件|订|下单)/i.test(status)) return "parts_ordered";
  if (/(sped|mail|laboratorio|寄修|外修)/i.test(status)) return "mail_in_progress";
  if (/(approv|preventiv|报价|确认)/i.test(status)) return "waiting_approval";
  if (/(incorso|in corso|诊断|检查|controll|检测)/i.test(status)) return "diagnosing";
  if (status.trim()) {
    warnings.push({
      row,
      field: "STATO",
      message: "未识别状态，默认导入为检测中",
      value: statusValue,
    });
  }
  return "diagnosing";
}

function shouldUsePickupTimestamp(
  status: RepairOrderStatus,
  statusValue: string,
  workValue: string,
  problemValue: string,
) {
  const text = `${statusValue} ${workValue} ${problemValue}`.toLowerCase();
  return (
    status === "completed" ||
    status === "unfixed_pickup" ||
    /(consegn|ritirat|completed|完成|取走|fatto|修好已通知|作废已通知)/i.test(text)
  );
}

export function parseMoney(
  value: string,
  row = 0,
  field = "amount",
  warnings: SeaTableImportWarning[] = [],
) {
  const input = value.trim();
  if (!input) return 0;
  const cleaned = input.replace(/[€￥¥\s]/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  const amount = Number(normalized.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    warnings.push({ row, field, message: "金额无法解析，已按 0 导入", value });
    return 0;
  }
  return roundMoney(amount);
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  const [headers = [], ...records] = rows;
  return records.map((record, index) => {
    const row: Record<string, string> = { __rowNumber: String(index + 2) };
    headers.forEach((header, headerIndex) => {
      row[header.trim()] = record[headerIndex]?.trim() ?? "";
    });
    return row;
  });
}

function normalizeRecord(record: Record<string, string>): NormalizedRow {
  const indexed = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    indexed.set(compactHeader(key), value);
  }
  const pick = (field: keyof typeof FIELD_ALIASES) => {
    for (const alias of FIELD_ALIASES[field]) {
      const value = indexed.get(alias);
      if (value !== undefined) return value.trim();
    }
    return "";
  };
  return {
    rowNumber: Number(record.__rowNumber ?? 0),
    raw: Object.fromEntries(Object.entries(record).filter(([key]) => key !== "__rowNumber")),
    stato: pick("stato"),
    nome: pick("nome"),
    oggetto: pick("oggetto"),
    daRiparare: pick("daRiparare"),
    telefono: pick("telefono"),
    prezzoTotale: pick("prezzoTotale"),
    acconto: pick("acconto"),
    marca: pick("marca"),
    modello: pick("modello"),
    problema: pick("problema"),
    garanzia: pick("garanzia"),
    dataRitiro: pick("dataRitiro"),
    dataAggiunta: pick("dataAggiunta"),
    tecnico: pick("tecnico"),
    imei: pick("imei"),
    supplier: pick("supplier"),
  };
}

function buildFaultPrices(daRiparare: string, issueDescription: string, quotation: number) {
  const name = cleanText(daRiparare) || cleanText(issueDescription) || "Intervento richiesto";
  return [{ name, price: quotation, currency_code: CURRENCY_CODE }];
}

function mapSeaTableOrderType(oggetto: string): RepairOrderType {
  return /veloce|quick|快修/i.test(oggetto) ? "quick_repair" : "dropoff_repair";
}

function getOrCreateSupplier(
  value: string,
  suppliersByName: Map<string, { id: string; name: string; shortName: string }>,
  suppliers: Record<string, unknown>[],
  createdAt: string,
) {
  const name = cleanText(value);
  if (!name || name === "-") return undefined;
  const key = name.toLowerCase();
  const existing = suppliersByName.get(key);
  if (existing) return existing;
  const supplier = {
    id: stableUuidFromText(`seatable-supplier:${key}`),
    name,
    shortName: name.length > 12 ? name.slice(0, 12) : name,
  };
  suppliersByName.set(key, supplier);
  suppliers.push({
    id: supplier.id,
    name: supplier.name,
    short_name: supplier.shortName,
    color: supplierColor(key),
  });
  return supplier;
}

function supplierColor(key: string) {
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444"];
  const hash = crypto.createHash("sha1").update(key).digest();
  return colors[hash[0] % colors.length];
}

function stableUuidFromText(value: string) {
  const chars = crypto.createHash("sha1").update(value).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

function buildAccessoryNotes(oggetto: string, problem: string) {
  const notes = new Set<string>();
  const objectText = cleanText(oggetto);
  if (objectText && !OBJECT_STATUS_MARKERS.has(objectText.toLowerCase())) notes.add(objectText);
  const lowerProblem = problem.toLowerCase();
  for (const pattern of ACCESSORY_PATTERNS) {
    if (lowerProblem.includes(pattern.toLowerCase())) notes.add(pattern);
  }
  return Array.from(notes).join("；");
}

function parseSeaTableDate(
  value: string,
  fallback: Date,
  row: number,
  field: string,
  warnings: SeaTableImportWarning[],
) {
  const input = value.trim();
  if (!input) {
    warnings.push({ row, field, message: "日期为空，已使用导入时间" });
    return fallback.toISOString();
  }

  const normalized = input.replace(/\./g, "/").replace(/-/g, "/");
  const dmy = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  const ymd = normalized.match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  const parts = ymd
    ? {
        year: Number(ymd[1]),
        month: Number(ymd[2]),
        day: Number(ymd[3]),
        hour: Number(ymd[4] ?? 0),
        minute: Number(ymd[5] ?? 0),
        second: Number(ymd[6] ?? 0),
      }
    : dmy
      ? {
          year: normalizeYear(Number(dmy[3])),
          month: Number(dmy[2]),
          day: Number(dmy[1]),
          hour: Number(dmy[4] ?? 0),
          minute: Number(dmy[5] ?? 0),
          second: Number(dmy[6] ?? 0),
        }
      : undefined;

  const date = parts
    ? new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    : new Date(input);
  if (Number.isNaN(date.getTime())) {
    warnings.push({ row, field, message: "日期无法解析，已使用导入时间", value });
    return fallback.toISOString();
  }
  return date.toISOString();
}

function detectDelimiter(content: string) {
  const firstLine = readFirstLine(content);
  const candidates = [",", ";", "\t"];
  return (
    candidates
      .map((delimiter) => ({ delimiter, count: countUnquoted(firstLine, delimiter) }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
  );
}

function readFirstLine(content: string) {
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (char === '"') quoted = !quoted;
    if (!quoted && (char === "\n" || char === "\r")) return content.slice(0, index);
  }
  return content;
}

function countUnquoted(line: string, delimiter: string) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    if (!quoted && char === delimiter) count++;
  }
  return count;
}

function compactHeader(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeYear(year: number) {
  return year < 100 ? 2000 + year : year;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function missingPhoneRaw(rowNumber: number) {
  return `000000${String(rowNumber).padStart(6, "0")}`;
}

function warnDefault(
  row: number,
  field: string,
  fallback: string,
  warnings: SeaTableImportWarning[],
) {
  warnings.push({ row, field, message: `字段为空，已使用 ${fallback}` });
  return fallback;
}

function mergeContacts(existing: string[], incoming: string[], primaryRaw: string) {
  const result: string[] = [];
  const seen = new Set<string>(primaryRaw ? [primaryRaw] : []);
  for (const phone of [...existing, ...incoming]) {
    const book = normalizePhoneBook(phone);
    if (!book.primaryRaw || seen.has(book.primaryRaw)) continue;
    seen.add(book.primaryRaw);
    result.push(book.primary);
  }
  return result;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
