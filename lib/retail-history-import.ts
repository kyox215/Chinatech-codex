import { isRetailHistoryDate, isRetailHistoryTimestamp, validateRetailHistoryRecord, type RetailHistoryRecord } from "./retail-history";

export const seaTableRetailColumns = ["状态","NOME","NUMERO TELEFONO","CATEGORIA","MARCA","MODELLO","COLORE","MEMORIA","METODO DI PAGAMENTO","PREZZO","PREZZO PAGATO","ACCONTO","NOTE","BATTERIA","IMEI/序列号","DATA RITIRO","1","DATA","-"] as const;
export type SeaTableRetailRow = { sourceExcelRow: number; [key: string]: unknown };
type ImportContext = { id: string; sourceSnapshot: string; importedAt: string };
function cell(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("原始单元格格式不支持。");
  return String(value);
}
function cents(value: unknown): number | null {
  const raw = cell(value); if (raw === null) return null;
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("原金额格式无效，不能自动取整。");
  const [whole,fraction=""] = normalized.split(".");
  const result = Number(whole)*100 + Number(fraction.padEnd(2,"0"));
  if (!Number.isSafeInteger(result) || result>100000000) throw new Error("原金额超出范围。");
  return result;
}

export function importRetailHistoryRow(row: SeaTableRetailRow, context: ImportContext): RetailHistoryRecord {
  const battery = row.BATTERIA === null || row.BATTERIA === undefined || row.BATTERIA === "" ? null : Number(row.BATTERIA)*100;
  if (battery !== null && (!Number.isFinite(battery) || Math.abs(battery-Math.round(battery))>0.000001)) throw new Error("原电池百分比无效。");
  const pickup = cell(row["DATA RITIRO"]);
  if (pickup !== null && !isRetailHistoryDate(pickup) && !isRetailHistoryTimestamp(pickup)) throw new Error("原拿走日期无效，不能截断后接受。");
  const record: RetailHistoryRecord = {
    ...context, source: "seatable", sourceRow: row.sourceExcelRow, condition: "翻新机",
    sourceStatus:cell(row["状态"]),customerName:cell(row.NOME),customerPhone:cell(row["NUMERO TELEFONO"]),
    category:cell(row.CATEGORIA),brand:cell(row.MARCA),model:cell(row.MODELLO),color:cell(row.COLORE),
    memory:cell(row.MEMORIA),paymentMethod:cell(row["METODO DI PAGAMENTO"]),
    askingPriceCents:cents(row.PREZZO),salePriceCents:cents(row["PREZZO PAGATO"]),depositCents:cents(row.ACCONTO),costCents:cents(row["-"]),
    notes:cell(row.NOTE),batteryPercent:battery===null?null:Math.round(battery),identifier:cell(row["IMEI/序列号"]),
    intakeAt:cell(row.DATA)??"",pickupDate:pickup?.slice(0,10)??null,sourceUpdatedAt:cell(row["1"])??"",reviewReasons:[],
  };
  const reasons = record.reviewReasons;
  if (!record.sourceStatus || !["以售","在售","分期中","处理中","到货已通知","同行","作废"].includes(record.sourceStatus)) reasons.push("原状态缺失或误填");
  if (!record.model) reasons.push("型号未记录");
  if (!record.category) reasons.push("商品类别未记录");
  if (record.sourceStatus==="以售" && record.salePriceCents===null) reasons.push("已售但成交价未记录");
  if (record.sourceStatus==="以售" && !record.pickupDate) reasons.push("已售但拿走日期未记录");
  if (record.sourceStatus==="在售" && record.pickupDate) reasons.push("在售状态已有拿走日期");
  if (record.sourceStatus==="在售" && record.salePriceCents!==null) reasons.push("在售状态已有成交价");
  if (record.pickupDate && record.pickupDate<record.intakeAt.slice(0,10)) reasons.push("拿走日期早于入库日期");
  if (record.depositCents!==null && record.salePriceCents!==null && record.depositCents>record.salePriceCents) reasons.push("原定金高于成交价");
  const identifier = record.identifier?.normalize("NFKC").replace(/[\s-]/g, "");
  if (identifier && /^0+$/.test(identifier)) reasons.push("设备标识原填零");
  else if (identifier && (/^\d{14}$|^\d{16}$|^\d+\.\d+$/.test(identifier))) reasons.push("设备标识格式待核对");
  return validateRetailHistoryRecord(record);
}

/** Mark exact 15-digit candidates only. Zero placeholders and packaging codes never merge physical identities. */
export function markRetailHistoryConflicts(records: RetailHistoryRecord[]): RetailHistoryRecord[] {
  const counts = new Map<string,number>();
  for (const record of records) {
    const key=record.identifier?.replace(/[\s-]/g,"");
    if(key && /^\d{15}$/.test(key) && !/^0+$/.test(key)) counts.set(key,(counts.get(key)??0)+1);
  }
  return records.map(record=>{
    const key=record.identifier?.replace(/[\s-]/g,"");
    return key && (counts.get(key)??0)>1 && !record.reviewReasons.includes("设备标识与其他来源记录重复") ? {...record,reviewReasons:[...record.reviewReasons,"设备标识与其他来源记录重复"]} : record;
  });
}

/** Stable, unambiguous UTF-8 framing mirrored by the import transaction's SQL function. */
export function retailHistoryCanonicalText(value: unknown): string {
  const utf8 = new TextEncoder();
  const frame = (tag: string, text: string) => `${tag}${utf8.encode(text).length}:${text}`;
  if (value === null) return "n";
  if (typeof value === "string") return frame("s", value);
  if (typeof value === "boolean") return value ? "b1" : "b0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("摘要不接受非有限数值。");
    let decimal = String(value);
    if (/e/i.test(decimal)) {
      const [mantissa, exponent] = decimal.toLowerCase().split("e");
      const negative = mantissa.startsWith("-");
      const unsigned = negative ? mantissa.slice(1) : mantissa;
      const digits = unsigned.replace(".", "");
      const point = (unsigned.indexOf(".") < 0 ? unsigned.length : unsigned.indexOf(".")) + Number(exponent);
      decimal = (negative ? "-" : "") + (point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length ? digits + "0".repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`);
    }
    return frame("d", decimal);
  }
  if (Array.isArray(value)) return `a${value.length}:${value.map(retailHistoryCanonicalText).join("")}`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => {
      const left = utf8.encode(a), right = utf8.encode(b);
      for (let index = 0; index < Math.min(left.length, right.length); index++) if (left[index] !== right[index]) return left[index] - right[index];
      return left.length - right.length;
    });
    return `o${keys.length}:${keys.map(key => frame("s", key) + retailHistoryCanonicalText(record[key])).join("")}`;
  }
  throw new Error("摘要仅接受完整 JSON 值。");
}
