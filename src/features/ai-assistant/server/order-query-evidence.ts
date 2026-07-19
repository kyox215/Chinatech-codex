import {
  type AiOrderConstraintEvidenceField,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import { normalizeDeviceSearchKey, parseDeviceSearchIntent } from "@/entities/order";
import { parseTrustedOrderDateFilter } from "./order-query-date";

type SearchArguments = Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"];
type ExecutableSearchArguments = Omit<SearchArguments, "evidence">;

export type EvidenceCompilation = {
  constraints: Partial<ExecutableSearchArguments>;
  acceptedFields: AiOrderConstraintEvidenceField[];
  rejectedFields: AiOrderConstraintEvidenceField[];
};

const instructionLikeEvidence =
  /忽略|无视|切换.{0,6}(?:门店|店铺)|显示.{0,8}(?:秘密|客户数据)|替代|伪造|编造|ignore|previous\s+instructions?|change\s+the\s+store|return\s+every|invent|override|ignora|regole\s+precedenti|cambia.{0,8}negozio|mostra.{0,8}dati\s+cliente|inventa/i;

export function compileEvidenceBackedProviderConstraints(
  message: string,
  args: SearchArguments,
): EvidenceCompilation {
  const attempted = nonDefaultFields(args);
  const constraints: Partial<ExecutableSearchArguments> = {};
  const acceptedFields: AiOrderConstraintEvidenceField[] = [];
  const rejectedFields: AiOrderConstraintEvidenceField[] = [];

  for (const field of attempted) {
    const quotes = (args.evidence ?? [])
      .filter((item) => item.field === field)
      .map((item) => item.quote)
      .filter((quote) => isExactMessageEvidence(message, quote));
    const accepted = quotes.some((quote) => acceptFieldEvidence(field, quote, args, constraints));
    (accepted ? acceptedFields : rejectedFields).push(field);
  }

  return { constraints, acceptedFields, rejectedFields };
}

export function stripOrderSearchEvidence(args: SearchArguments): ExecutableSearchArguments {
  const { evidence: _evidence, ...executable } = args;
  return executable;
}

function nonDefaultFields(args: SearchArguments): AiOrderConstraintEvidenceField[] {
  const fields: AiOrderConstraintEvidenceField[] = [];
  if (args.search) fields.push("search");
  if (args.device_search) fields.push("device_search");
  if (args.view !== "active") fields.push("view");
  if (args.paid !== "all") fields.push("paid");
  if (args.overdue) fields.push("overdue");
  if (args.queue_group) fields.push("queue_group");
  if (args.financial_review) fields.push("financial_review");
  if (args.date_filter) fields.push("date_filter");
  if (args.service_group) fields.push("service_group");
  if (args.completed_only) fields.push("completed_only");
  if (args.parts_status) fields.push("parts_status");
  return fields;
}

function acceptFieldEvidence(
  field: AiOrderConstraintEvidenceField,
  quote: string,
  args: SearchArguments,
  output: Partial<ExecutableSearchArguments>,
) {
  if (instructionLikeEvidence.test(quote)) return false;
  if (field === "search") {
    // Free-form search may resolve to a customer, phone, identifier, or order
    // reference. Those stay on local/manual paths and are never authorized by
    // model evidence alone.
    return false;
  }
  if (field === "device_search") {
    const parsed = parseDeviceSearchIntent(quote);
    if (!parsed || !args.device_search) return false;
    if (normalizeDeviceSearchKey(parsed) !== normalizeDeviceSearchKey(args.device_search)) {
      return false;
    }
    output.device_search = parsed;
    return true;
  }
  if (field === "view") {
    const value = parseViewEvidence(quote);
    if (!value || value !== args.view) return false;
    output.view = value;
    return true;
  }
  if (field === "paid") {
    const value = parsePaidEvidence(quote);
    if (!value || value !== args.paid) return false;
    output.paid = value;
    return true;
  }
  if (field === "overdue") {
    const value = parseOverdueEvidence(quote);
    if (!value || value !== args.overdue) return false;
    output.overdue = value;
    return true;
  }
  if (field === "queue_group") {
    const value = parseQueueEvidence(quote);
    if (!value || value !== args.queue_group) return false;
    output.queue_group = value;
    return true;
  }
  if (field === "financial_review") {
    if (
      args.financial_review !== "amount_anomaly" ||
      !/(?:金额|报价|定金|尾款|付款).{0,8}(?:异常|不一致|对不上)|amount.{0,12}(?:anomal|inconsisten)|import[oi].{0,12}(?:anomal|incoerent)/i.test(
        quote,
      )
    ) {
      return false;
    }
    output.financial_review = "amount_anomaly";
    return true;
  }
  if (field === "date_filter") {
    if (!args.date_filter) return false;
    const parsed = parseTrustedOrderDateFilter(quote, args.date_filter.field);
    if (!parsed || JSON.stringify(parsed) !== JSON.stringify(args.date_filter)) return false;
    output.date_filter = parsed;
    return true;
  }
  if (field === "service_group") {
    const value = parseServiceEvidence(quote);
    if (!value || value !== args.service_group) return false;
    output.service_group = value;
    return true;
  }
  if (field === "completed_only") {
    if (
      !args.completed_only ||
      !/处理过|处理完|已完成|完成的|修好|修过|换过|更换过|交付完毕|completed|finished|repaired|riparat[oaie]|completat[oaie]|consegnat[oaie]/i.test(
        quote,
      )
    ) {
      return false;
    }
    output.completed_only = true;
    return true;
  }
  if (field === "parts_status") {
    const value = parsePartsEvidence(quote);
    if (!value || value !== args.parts_status) return false;
    output.parts_status = value;
    return true;
  }
  return false;
}

function isExactMessageEvidence(message: string, quote: string) {
  const normalizedMessage = normalizeEvidenceText(message);
  const normalizedQuote = normalizeEvidenceText(quote);
  return normalizedQuote.length > 0 && normalizedMessage.includes(normalizedQuote);
}

function normalizeEvidenceText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseViewEvidence(value: string): ExecutableSearchArguments["view"] | null {
  if (/归档|archive|archivio/i.test(value)) return "archive";
  if (
    /历史|全部|所有|从开店到现在|all\s+(?:orders|time)|storico|tutti\s+gli\s+ordini/i.test(value)
  ) {
    return "all";
  }
  return null;
}

function parsePaidEvidence(
  value: string,
): Exclude<ExecutableSearchArguments["paid"], "all"> | null {
  if (
    /未付|欠款|没付|未结清|没结清|待收款|尾款未结|尾款没结|unpaid|not\s+(?:yet\s+)?paid|outstanding|balance\s+due|da\s+pagare|non\s+pagat|saldo\s+(?:aperto|da\s+pagare)/i.test(
      value,
    )
  ) {
    return "unpaid";
  }
  if (/已付|已结清|结清|paid|fully\s+paid|settled|pagat|saldat/i.test(value)) return "paid";
  return null;
}

function parseOverdueEvidence(value: string): ExecutableSearchArguments["overdue"] {
  if (/报价.{0,6}(?:待确认|超时)|approval.{0,8}overdue|preventiv[oi].{0,8}scadut/i.test(value)) {
    return "approval";
  }
  if (/待取.{0,6}(?:超时|逾期)|pickup.{0,8}overdue|ritiro.{0,8}(?:scadut|ritardo)/i.test(value)) {
    return "pickup";
  }
  if (/超时|逾期|overdue|in\s+ritardo|scadut/i.test(value)) return "any";
  return null;
}

function parseQueueEvidence(value: string): ExecutableSearchArguments["queue_group"] {
  if (
    /修好.{0,10}通知|维修完成.{0,10}通知|repaired.{0,8}notified|riparat[oaie].{0,8}avvisat/i.test(
      value,
    )
  ) {
    return "repaired_notified";
  }
  if (/到货.{0,6}已通知|arrived.{0,8}notified|arrivat[oaie].{0,8}avvisat/i.test(value)) {
    return "arrived_notified";
  }
  if (
    /正在维修|处理中|维修中|in\s+(?:processing|repair)|being\s+repaired|in\s+lavorazione|in\s+riparazione/i.test(
      value,
    )
  ) {
    return "processing";
  }
  if (/已修好|已维修|维修完成|repaired|riparat[oaie]/i.test(value)) return "repaired";
  if (/配件.{0,4}(?:已到|到货)|parts?.{0,8}arrived|ricamb[io].{0,8}arrivat/i.test(value)) {
    return "arrived";
  }
  if (/配件.{0,4}(?:已订|下单)|parts?.{0,8}ordered|ricamb[io].{0,8}ordinat/i.test(value)) {
    return "ordered";
  }
  return null;
}

function parsePartsEvidence(value: string): ExecutableSearchArguments["parts_status"] {
  if (
    /未订配件|还没订|待订|待下单|需要.{0,4}(?:下单|采购)|等着采购|parts?.{0,8}to\s+order|need.{0,8}parts?|ricamb[io].{0,8}da\s+ordinare/i.test(
      value,
    )
  ) {
    return "needed";
  }
  if (/配件.{0,4}(?:已订|下单)|parts?.{0,8}ordered|ricamb[io].{0,8}ordinat/i.test(value)) {
    return "ordered";
  }
  if (/配件.{0,4}(?:已到|到货)|parts?.{0,8}arrived|ricamb[io].{0,8}arrivat/i.test(value)) {
    return "arrived";
  }
  if (/缺货|无货|out\s+of\s+stock|unavailable|esaurit|non\s+disponibil/i.test(value)) {
    return "out_of_stock";
  }
  return null;
}

function parseServiceEvidence(value: string): ExecutableSearchArguments["service_group"] {
  const patterns: Array<[NonNullable<ExecutableSearchArguments["service_group"]>, RegExp]> = [
    ["display", /屏幕|换屏|显示屏|显示总成|display|screen|schermo|display\s+assembly/i],
    ["battery", /电池|battery|batteria/i],
    [
      "charging",
      /尾插|充电口|充电接口|charging\s+port|dock\s+connector|connettore\s+di\s+ricarica/i,
    ],
    ["camera", /摄像头|相机|camera|fotocamera/i],
    ["liquid", /进水|液体|water\s+damage|liquid|liquido|ossidazione/i],
    ["mainboard", /主板|逻辑板|mainboard|motherboard|logic\s+board|scheda\s+madre/i],
    ["system", /系统|刷机|software|firmware|sistema/i],
    ["back-cover", /后盖|后壳|back\s+(?:cover|glass)|cover\s+posteriore|vetro\s+posteriore/i],
    ["face", /面容|指纹|face\s*id|touch\s*id|fingerprint|impronta/i],
    ["speaker", /扬声器|听筒|speaker|earpiece|altoparlante|capsula/i],
    ["microphone", /麦克风|microphone|microfono/i],
    ["button", /按键|电源键|音量键|button|power\s+key|volume\s+key|tasto/i],
  ];
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}
