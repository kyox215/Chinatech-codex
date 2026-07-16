import { Buffer } from "node:buffer";

import ExcelJS, { type Cell, type Row, type Worksheet } from "exceljs";
import { fromBufferPromise, type Entry } from "yauzl";

import {
  ORDER_DATA_MAX_CELL_CHARS,
  ORDER_DATA_MAX_FILE_BYTES,
  ORDER_DATA_MAX_REPAIR_ITEM_ROWS,
  ORDER_DATA_MAX_ROWS,
  ORDER_DATA_PARSER_VERSION,
  ORDER_DATA_TEMPLATE_VERSION,
  LEGACY_ORDER_DATA_TEMPLATE_VERSION,
  allowedOrderDataSheetNames,
  legacyOrderDataHeaders,
  orderDataColumns,
  orderDataHeaders,
  repairItemColumns,
  repairItemHeaders,
} from "@/features/orders/model/order-data-contract";
import type { CustomerStats } from "@/lib/repairdesk/types";

const MAX_ZIP_ENTRIES = 250;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type WorkbookCellValue = string | number | null | undefined;
export type WorkbookDataRow = Record<string, WorkbookCellValue>;

export interface ParsedOrderDataWorkbook {
  templateVersion: string;
  parserVersion?: string;
  exportBatchId?: string;
  orderRows: Record<string, string>[];
  repairItemRows: Record<string, string>[];
}

export async function buildOrderDataWorkbook(input: {
  kind: "template" | "export";
  exportBatchId?: string;
  orderRows?: WorkbookDataRow[];
  repairItemRows?: WorkbookDataRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RepairDesk";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "RepairDesk 工单数据";
  workbook.title = input.kind === "template" ? "RepairDesk 工单导入模板" : "RepairDesk 工单导出";

  const orderSheet = workbook.addWorksheet("工单", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  setColumns(
    orderSheet,
    orderDataColumns.map((column) => ({
      header: column.header,
      key: column.key,
      width: columnWidth(column.header),
    })),
  );
  for (const row of input.orderRows ?? []) appendSafeRow(orderSheet, row);
  styleDataSheet(orderSheet);
  orderSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, orderSheet.rowCount), column: orderDataColumns.length },
  };
  applyOrderValidations(orderSheet);

  const repairSheet = workbook.addWorksheet("维修项目", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  setColumns(
    repairSheet,
    repairItemColumns.map((column) => ({
      header: column.header,
      key: column.key,
      width: columnWidth(column.header),
    })),
  );
  for (const row of input.repairItemRows ?? []) appendSafeRow(repairSheet, row);
  styleDataSheet(repairSheet);

  addFieldGuideSheet(workbook);
  addEnumSheet(workbook);
  addExampleSheet(workbook);
  addMetadataSheet(workbook, input.exportBatchId);

  const bytes = await workbook.xlsx.writeBuffer();
  return checkedWorkbookBuffer(bytes);
}

export async function buildCustomerStatsWorkbook(rows: WorkbookDataRow[], stats: CustomerStats) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RepairDesk";
  workbook.created = new Date();
  workbook.title = "RepairDesk 客户统计";
  const summarySheet = workbook.addWorksheet("客户汇总");
  summarySheet.columns = [
    { header: "指标", key: "metric", width: 28 },
    { header: "数量", key: "value", width: 16 },
  ];
  [
    ["客户总数", stats.total],
    ["复购客户", stats.repeat],
    ["进行中维修客户", stats.activeRepairs],
    ["有待收金额客户", stats.unpaid],
    ["已有设备客户", stats.withDevices],
    ["待跟进客户", stats.dueFollowups],
    ["允许营销客户", stats.marketable],
  ].forEach(([metric, value]) => summarySheet.addRow({ metric, value }));
  styleDataSheet(summarySheet);
  const sheet = workbook.addWorksheet("客户统计", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const columns = [
    ["customer_id", "客户ID"],
    ["name", "客户姓名"],
    ["phone", "客户电话"],
    ["order_count", "历史工单数"],
    ["valid_order_count", "有效工单数"],
    ["active_order_count", "进行中工单"],
    ["device_count", "设备数"],
    ["total_spent", "有效工单额"],
    ["unpaid_amount", "待收金额"],
    ["last_order_at", "最近工单时间"],
    ["next_followup_at", "下次跟进时间"],
    ["tags", "标签"],
  ] as const;
  setColumns(
    sheet,
    columns.map(([key, header]) => ({ key, header, width: columnWidth(header) })),
  );
  for (const row of rows) appendSafeRow(sheet, row);
  styleDataSheet(sheet);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: columns.length },
  };
  const bytes = await workbook.xlsx.writeBuffer();
  return checkedWorkbookBuffer(bytes);
}

export async function parseOrderDataWorkbook(input: {
  bytes: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<ParsedOrderDataWorkbook> {
  validateWorkbookUpload(input);
  await inspectZipContainer(input.bytes);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(input.bytes).buffer, {
    ignoreNodes: ["dataValidations", "extLst", "drawing", "picture"],
  });

  if (workbook.worksheets.length > allowedOrderDataSheetNames.size) {
    throw new Error("工作簿包含过多工作表");
  }
  for (const worksheet of workbook.worksheets) {
    if (!allowedOrderDataSheetNames.has(worksheet.name)) {
      throw new Error(`不支持的工作表：${worksheet.name}`);
    }
  }

  const orderSheet = workbook.getWorksheet("工单");
  if (!orderSheet) throw new Error("缺少“工单”工作表");
  const repairSheet = workbook.getWorksheet("维修项目");
  const metadataSheet = workbook.getWorksheet("_元数据");

  const metadata = metadataSheet ? readMetadata(metadataSheet) : new Map<string, string>();
  const declaredTemplateVersion = metadata.get("template_version");
  const expectedOrderHeaders = resolveOrderDataHeaders(orderSheet, declaredTemplateVersion);
  const orderRows = readSheetRows(orderSheet, expectedOrderHeaders, ORDER_DATA_MAX_ROWS);
  const repairItemRows = repairSheet
    ? readSheetRows(repairSheet, repairItemHeaders, ORDER_DATA_MAX_REPAIR_ITEM_ROWS)
    : [];
  const rowVersion = orderRows.find((row) => row["数据版本"])?.["数据版本"];
  const templateVersion = declaredTemplateVersion || rowVersion || "";
  if (
    templateVersion !== ORDER_DATA_TEMPLATE_VERSION &&
    templateVersion !== LEGACY_ORDER_DATA_TEMPLATE_VERSION
  ) {
    throw new Error("模板版本不匹配，请重新下载最新模板");
  }
  if (declaredTemplateVersion && rowVersion && declaredTemplateVersion !== rowVersion) {
    throw new Error("工作簿数据版本与元数据不一致");
  }

  return {
    templateVersion,
    parserVersion: metadata.get("parser_version"),
    exportBatchId: metadata.get("export_batch_id") || undefined,
    orderRows,
    repairItemRows,
  };
}

export function workbookDownloadHeaders(fileName: string) {
  const asciiName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return {
    "content-type": XLSX_MIME,
    "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
  };
}

function validateWorkbookUpload(input: { bytes: Buffer; fileName: string; mimeType?: string }) {
  const lowerName = input.fileName.toLowerCase();
  if (!lowerName.endsWith(".xlsx") || lowerName.endsWith(".xlsm")) {
    throw new Error("只支持 .xlsx 文件，不支持 .xls 或含宏工作簿");
  }
  if (input.bytes.length === 0 || input.bytes.length > ORDER_DATA_MAX_FILE_BYTES) {
    throw new Error("文件为空或超过 4 MB 限制");
  }
  if (input.bytes[0] !== 0x50 || input.bytes[1] !== 0x4b) {
    throw new Error("文件内容不是有效的 XLSX 工作簿");
  }
  if (input.mimeType && ![XLSX_MIME, "application/octet-stream"].includes(input.mimeType)) {
    throw new Error("文件类型与 XLSX 不匹配");
  }
}

async function inspectZipContainer(bytes: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error("XLSX 压缩目录无效");
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const directorySize = bytes.readUInt32LE(eocdOffset + 12);
  const directoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0 || entryCount > MAX_ZIP_ENTRIES) throw new Error("XLSX 压缩条目数量异常");
  if (directoryOffset + directorySize > bytes.length) throw new Error("XLSX 压缩目录越界");

  let cursor = directoryOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("XLSX 压缩目录损坏");
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const fileNameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const entryName = bytes.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    if ((flags & 0x1) !== 0) throw new Error("不支持加密工作簿");
    if (method !== 0 && method !== 8) throw new Error("XLSX 使用了不支持的压缩方式");
    if (uncompressedSize > MAX_ZIP_ENTRY_BYTES) throw new Error("XLSX 单个内容过大");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error("XLSX 解压后超过 25 MB 限制");
    if (entryName.startsWith("/") || entryName.split("/").includes("..")) {
      throw new Error("XLSX 包含不安全路径");
    }
    if (/vbaProject|macrosheets|externalLinks|ddeLink|embeddings/i.test(entryName)) {
      throw new Error("不支持宏、外部链接或嵌入对象");
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
    if (cursor > directoryOffset + directorySize) throw new Error("XLSX 压缩目录损坏");
  }

  await inspectActualZipPayload(bytes);
}

async function inspectActualZipPayload(bytes: Buffer) {
  const zip = await fromBufferPromise(bytes, {
    autoClose: false,
    lazyEntries: true,
    decodeStrings: true,
    validateEntrySizes: true,
    strictFileNames: true,
  });
  let totalActualBytes = 0;
  let actualEntryCount = 0;
  try {
    for await (const entry of zip.eachEntry()) {
      actualEntryCount += 1;
      if (actualEntryCount > MAX_ZIP_ENTRIES) throw new Error("XLSX 压缩条目数量异常");
      assertSafeXlsxEntry(entry);
      if (entry.fileName.endsWith("/")) continue;
      const stream = await zip.openReadStreamPromise(entry);
      let entryActualBytes = 0;
      for await (const chunk of stream) {
        const length = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
        entryActualBytes += length;
        totalActualBytes += length;
        if (entryActualBytes > MAX_ZIP_ENTRY_BYTES) {
          stream.destroy();
          throw new Error("XLSX 单个内容实际解压后过大");
        }
        if (totalActualBytes > MAX_UNCOMPRESSED_BYTES) {
          stream.destroy();
          throw new Error("XLSX 实际解压后超过 25 MB 限制");
        }
      }
      if (entryActualBytes !== entry.uncompressedSize) {
        throw new Error("XLSX 压缩条目声明大小与实际内容不一致");
      }
    }
  } finally {
    zip.close();
  }
}

function assertSafeXlsxEntry(entry: Entry) {
  const name = entry.fileName;
  if (entry.isEncrypted() || !entry.canDecodeFileData()) throw new Error("不支持加密工作簿");
  if (name.startsWith("/") || name.split("/").includes("..")) {
    throw new Error("XLSX 包含不安全路径");
  }
  if (!isAllowedXlsxEntry(name)) {
    throw new Error(`XLSX 包含不支持的内容：${name}`);
  }
}

function isAllowedXlsxEntry(name: string) {
  return [
    /^\[Content_Types\]\.xml$/,
    /^_rels\/\.rels$/,
    /^docProps\/(app|core|custom)\.xml$/,
    /^xl\/(workbook|styles|sharedStrings|calcChain|metadata)\.xml$/,
    /^xl\/_rels\/workbook\.xml\.rels$/,
    /^xl\/worksheets\/sheet\d+\.xml$/,
    /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/,
    /^xl\/theme\/theme\d+\.xml$/,
    /^xl\/tables\/table\d+\.xml$/,
    /\/$/,
  ].some((pattern) => pattern.test(name));
}

function findEndOfCentralDirectory(bytes: Buffer) {
  const lowerBound = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= lowerBound; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readSheetRows(worksheet: Worksheet, expectedHeaders: readonly string[], maxRows: number) {
  if (worksheet.rowCount - 1 > maxRows) throw new Error(`${worksheet.name}超过 ${maxRows} 行限制`);
  const headers = readHeaderRow(worksheet.getRow(1));
  if (
    headers.length !== expectedHeaders.length ||
    headers.some((header, index) => header !== expectedHeaders[index])
  ) {
    throw new Error(`${worksheet.name}字段与模板不一致，请重新下载模板`);
  }

  const rows: Record<string, string>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    expectedHeaders.forEach((header, index) => {
      const value = safeCellText(row.getCell(index + 1), worksheet.name, rowNumber, header);
      if (value !== "") hasValue = true;
      record[header] = value;
    });
    if (hasValue) rows.push({ ...record, __row_number: String(rowNumber) });
  });
  return rows;
}

function resolveOrderDataHeaders(worksheet: Worksheet, declaredTemplateVersion?: string) {
  const headers = readHeaderRow(worksheet.getRow(1));
  if (declaredTemplateVersion === ORDER_DATA_TEMPLATE_VERSION) return orderDataHeaders;
  if (declaredTemplateVersion === LEGACY_ORDER_DATA_TEMPLATE_VERSION) {
    return legacyOrderDataHeaders;
  }
  if (headersMatch(headers, orderDataHeaders)) return orderDataHeaders;
  if (headersMatch(headers, legacyOrderDataHeaders)) return legacyOrderDataHeaders;
  return orderDataHeaders;
}

function headersMatch(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length && actual.every((header, index) => header === expected[index])
  );
}

function readHeaderRow(row: Row) {
  const headers: string[] = [];
  for (let index = 1; index <= row.cellCount; index += 1) {
    headers.push(safeCellText(row.getCell(index), "字段行", 1, String(index)));
  }
  return headers;
}

function safeCellText(cell: Cell, sheetName: string, rowNumber: number, field: string) {
  if (cell.type === ExcelJS.ValueType.Formula || isFormulaValue(cell.value)) {
    throw new Error(`${sheetName}第 ${rowNumber} 行“${field}”不允许使用公式`);
  }
  if (cell.type === ExcelJS.ValueType.Error) {
    throw new Error(`${sheetName}第 ${rowNumber} 行“${field}”包含错误值`);
  }

  let value = "";
  if (cell.value instanceof Date) value = cell.value.toISOString();
  else if (isRichTextValue(cell.value))
    value = cell.value.richText.map((part) => part.text).join("");
  else if (isHyperlinkValue(cell.value)) value = cell.value.text;
  else if (cell.value !== null && cell.value !== undefined) value = String(cell.value);
  value = value.trim();
  if (value.length > ORDER_DATA_MAX_CELL_CHARS) {
    throw new Error(
      `${sheetName}第 ${rowNumber} 行“${field}”超过 ${ORDER_DATA_MAX_CELL_CHARS} 字限制`,
    );
  }
  return value;
}

function readMetadata(worksheet: Worksheet) {
  const metadata = new Map<string, string>();
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const key = safeCellText(row.getCell(1), worksheet.name, rowNumber, "key");
    const value = safeCellText(row.getCell(2), worksheet.name, rowNumber, "value");
    if (key) metadata.set(key, value);
  });
  return metadata;
}

function setColumns(
  worksheet: Worksheet,
  columns: { header: string; key: string; width: number }[],
) {
  worksheet.columns = columns;
}

function appendSafeRow(worksheet: Worksheet, row: WorkbookDataRow) {
  const next = worksheet.addRow(row);
  next.eachCell({ includeEmpty: true }, (cell) => {
    if (typeof cell.value === "string") {
      cell.numFmt = "@";
    }
  });
}

function styleDataSheet(worksheet: Worksheet) {
  const header = worksheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { vertical: "middle" };
  });
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
  });
}

function addFieldGuideSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("字段说明");
  sheet.columns = [
    { header: "字段", key: "header", width: 24 },
    { header: "用途", key: "mode", width: 18 },
    { header: "填写说明", key: "description", width: 56 },
  ];
  for (const column of orderDataColumns) {
    sheet.addRow({ header: column.header, mode: column.mode, description: column.description });
  }
  sheet.addRow({
    header: "空白规则",
    mode: "重要",
    description: "更新已有工单时，空白单元格表示保留原值，不会清除数据。",
  });
  sheet.addRow({
    header: "清空规则",
    mode: "重要",
    description: "仅字段说明标注可清空的列可填写 __CLEAR__。",
  });
  styleDataSheet(sheet);
}

function addEnumSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("枚举值");
  sheet.columns = [
    { header: "导入动作", key: "action", width: 18 },
    { header: "订单类型", key: "type", width: 24 },
    { header: "设备保管枚举", key: "custody", width: 24 },
    { header: "质保月数", key: "warranty", width: 18 },
  ];
  const values = [
    ["create", "quick_repair", "with_shop", 0],
    ["update", "dropoff_repair", "with_customer", 3],
    ["skip", "", "", 6],
    ["", "", "", 12],
    ["", "", "", 24],
  ];
  values.forEach((value) => sheet.addRow(value));
  styleDataSheet(sheet);
}

function addExampleSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("示例");
  sheet.columns = orderDataColumns.map((column) => ({
    header: column.header,
    key: column.key,
    width: columnWidth(column.header),
  }));
  appendSafeRow(sheet, {
    template_version: ORDER_DATA_TEMPLATE_VERSION,
    import_action: "create",
    source_system: "seatable",
    external_record_id: "请填写稳定唯一ID",
    order_type: "dropoff_repair",
    device_custody_status: "with_shop",
    device_custody_label: "设备留店",
    customer_name: "示例客户",
    customer_phone: "+39 333 000 0000",
    device_brand: "Apple",
    device_model: "iPhone",
    issue_description: "示例故障描述",
    warranty_months: 6,
    deposit_amount: 0,
  });
  styleDataSheet(sheet);
}

function addMetadataSheet(workbook: ExcelJS.Workbook, exportBatchId?: string) {
  const sheet = workbook.addWorksheet("_元数据");
  sheet.state = "veryHidden";
  sheet.addRow(["template_version", ORDER_DATA_TEMPLATE_VERSION]);
  sheet.addRow(["parser_version", ORDER_DATA_PARSER_VERSION]);
  if (exportBatchId) sheet.addRow(["export_batch_id", exportBatchId]);
}

function applyOrderValidations(worksheet: Worksheet) {
  const actionColumn = orderDataColumns.findIndex((column) => column.key === "import_action") + 1;
  const typeColumn = orderDataColumns.findIndex((column) => column.key === "order_type") + 1;
  const custodyColumn =
    orderDataColumns.findIndex((column) => column.key === "device_custody_status") + 1;
  const warrantyColumn =
    orderDataColumns.findIndex((column) => column.key === "warranty_months") + 1;
  for (let row = 2; row <= ORDER_DATA_MAX_ROWS + 1; row += 1) {
    worksheet.getCell(row, actionColumn).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["'枚举值'!$A$2:$A$4"],
    };
    worksheet.getCell(row, typeColumn).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'枚举值'!$B$2:$B$3"],
    };
    worksheet.getCell(row, custodyColumn).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'枚举值'!$C$2:$C$3"],
    };
    worksheet.getCell(row, warrantyColumn).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'枚举值'!$D$2:$D$6"],
    };
  }
}

function checkedWorkbookBuffer(bytes: ExcelJS.Buffer) {
  const buffer = Buffer.from(bytes);
  if (buffer.length > ORDER_DATA_MAX_FILE_BYTES) {
    throw new Error("生成的工作簿超过 4 MB 同步下载限制");
  }
  return buffer;
}

function columnWidth(header: string) {
  if (/时间|描述|结果|备注|物品/.test(header)) return 26;
  if (/ID|编号|电话|IMEI/.test(header)) return 22;
  return Math.max(14, header.length * 2 + 4);
}

function isFormulaValue(value: Cell["value"]): value is ExcelJS.CellFormulaValue {
  return Boolean(value && typeof value === "object" && "formula" in value);
}

function isRichTextValue(value: Cell["value"]): value is ExcelJS.CellRichTextValue {
  return Boolean(value && typeof value === "object" && "richText" in value);
}

function isHyperlinkValue(value: Cell["value"]): value is ExcelJS.CellHyperlinkValue {
  return Boolean(value && typeof value === "object" && "hyperlink" in value && "text" in value);
}
