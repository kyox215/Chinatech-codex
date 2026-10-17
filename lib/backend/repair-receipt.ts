import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { MultiFormatWriter, BarcodeFormat } from "@zxing/library";
import { getServerAccess, memberInTransaction } from "./context";
import { withDatabase, BackendError } from "./database";
import { can } from "../staff";
import { intakeDirectoryEntry, matchingIntakeSignature, validLocalIntake, validIntakePolicy, parseIntakeSignatures } from "../repair-intake-record";
import { initialRepairWorkflow, validateWorkflowExtensions, type RepairWorkflow } from "../repair-workflow";
import { repairStatusOptions } from "../repair-fixtures";
import { currentRepairRequirements } from "../repair-requirements";
import { itemQuoteTotal } from "../repair-item-pricing";
import { printLabel, type PrintLanguage } from "../print-language";
import { canonicalPrintJson, repairPrintProjection, type ReceiptPaper } from "../repair-print-layout";
import { renderRepairReceipt } from "./repair-receipt-renderer";

// Transport codes are translated by the independent PrintLabel registry at the UI boundary.
export function receiptFailure(code: "receiptUnavailable" | "receiptChanged" | "receiptBusy" | "printLayoutError", status: number) { return new BackendError(code, status); }

export type ReceiptRequest = { id: string; paper: ReceiptPaper; language: PrintLanguage; expectedRevision?: number };
type Access = NonNullable<Awaited<ReturnType<typeof getServerAccess>>>;
export async function loadRepairReceipt(tx: TransactionSql, access: Access, request: ReceiptRequest) {
  const member = await memberInTransaction(tx, access.storeId, access.identity.userId);
  if (!can(member, "repairs.view")) throw receiptFailure("receiptUnavailable", 403);
  const [row] = await tx`select data,signatures,workflow from chinatech_v2_private.repair_intakes where store_id=${access.storeId} and id=${request.id}`;
  if (!row) throw receiptFailure("receiptUnavailable", 404);
  // Only the four print policy fields and revision leave this settings row.
  const [settings] = await tx`select revision,settings->>'shopName' as shop_name,settings->>'address' as address,settings->>'phone' as phone,settings->'repairWarrantyMonths' as months,settings->'repairWarrantyMonths' is null as missing_months from chinatech_v2_private.store_state where store_id=${access.storeId}`;
  if (!settings) throw receiptFailure("receiptUnavailable", 503);
  if (!validLocalIntake(row.data) || row.data.id !== request.id || !Array.isArray(row.signatures)) throw receiptFailure("receiptUnavailable", 422);
  const data = row.data;
  if (request.expectedRevision !== undefined && request.expectedRevision !== (data.revision ?? 1)) throw receiptFailure("receiptChanged", 409);
  const token = createHash("sha256").update(canonicalPrintJson([access.storeId, access.identity, member, row, settings])).digest("hex");
  const policy = data.policy ?? { shopName: settings.shop_name, address: settings.address, phone: settings.phone, months: settings.missing_months === true ? 6 : settings.months };
  if (!validIntakePolicy(policy)) throw receiptFailure("receiptUnavailable", 422);
  const order = intakeDirectoryEntry(data), workflow = row.workflow as RepairWorkflow | null;
  if (workflow !== null && workflow !== undefined) {
    try {
      if (typeof workflow !== "object" || !repairStatusOptions.some(option => option.value === workflow.status) || !["unknown", "store", "customer"].includes(workflow.custody) || !Array.isArray(workflow.events) || workflow.revision !== workflow.events.length || typeof workflow.updatedAt !== "string" || workflow.events.some(event => !event || typeof event.id !== "string" || typeof event.label !== "string" || typeof event.time !== "string" || typeof event.note !== "string") || (workflow.notice !== null && (!workflow.notice || typeof workflow.notice.signature !== "string" || !["notified", "unreachable"].includes(workflow.notice.outcome)))) throw receiptFailure("receiptUnavailable", 422);
      validateWorkflowExtensions(workflow);
    } catch { throw receiptFailure("receiptUnavailable", 422); }
  }
  const requirements = currentRepairRequirements(order, workflow ?? initialRepairWorkflow(order));
  let signatures;
  try { signatures = parseIntakeSignatures(JSON.stringify({ version: 1, records: [data], signatures: row.signatures })); } catch { throw receiptFailure("receiptUnavailable", 422); }
  if (signatures.some(signature => signature.orderId !== data.id)) throw receiptFailure("receiptUnavailable", 422);
  return { token, data, policy, requirements, workflow, signature: matchingIntakeSignature(signatures, data, policy), hasHistory: signatures.some(s => s.orderId === data.id) };
}

let activeRenders = 0;
export async function generateRepairReceipt(request: ReceiptRequest, origin: string, storeId?: string) {
  const access = await getServerAccess(undefined,storeId);
  if (!access) throw receiptFailure("receiptUnavailable", 403);
  const source = await withDatabase(access.identity, access.storeId, tx => loadRepairReceipt(tx, access, request));
  if (activeRenders >= 2) throw receiptFailure("receiptBusy", 503);
  activeRenders++;
  try {
    const matrix = new MultiFormatWriter().encode(new URL("/app/repairs/" + request.id + "?storeId=" + access.storeId, origin).href, BarcodeFormat.QR_CODE, 0, 0, new Map());
    let path = "";
    for (let y = 0; y < matrix.getHeight(); y++) for (let x = 0; x < matrix.getWidth(); x++) if (matrix.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
    const projection = repairPrintProjection({ ...source, language: request.language, totalCents: source.data.itemQuotes?.length ? itemQuoteTotal(source.data.itemQuotes, source.requirements.map(r => r.title)) : null, technician: printLabel("unassigned", request.language), status: source.workflow?.status ?? "diagnosis", custody: source.workflow?.custody ?? source.data.custody ?? "unknown", formal: true, qr: { path, size: matrix.getWidth() } });
    // The rendering process holds no database transaction or row lock.
    const result = await renderRepairReceipt(projection, request.paper);
    const currentAccess = await getServerAccess(undefined,storeId);
    if (!currentAccess || canonicalPrintJson([currentAccess.identity, currentAccess.storeId]) !== canonicalPrintJson([access.identity, access.storeId])) throw receiptFailure("receiptUnavailable", 403);
    const current = await withDatabase(currentAccess.identity, currentAccess.storeId, tx => loadRepairReceipt(tx, currentAccess, request));
    if (current.token !== source.token) throw receiptFailure("receiptChanged", 409);
    if (result.bytes.length > 4 * 1024 * 1024) throw receiptFailure("printLayoutError", 422);
    return { bytes: result.bytes, revision: source.data.revision ?? 1, token: source.token };
  } finally { activeRenders--; }
}
