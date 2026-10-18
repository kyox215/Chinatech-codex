import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend/database";
import { generateRepairReceipt, receiptFailure, type ReceiptRequest } from "@/lib/backend/repair-receipt";
import { ReceiptRenderError } from "@/lib/backend/repair-receipt-renderer";
import { localIntakeId } from "@/lib/repair-intake-record";
import { isSupabaseMode } from "@/lib/supabase/config";
import { observeRoute } from "@/lib/backend/request-observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Vary": "Cookie" };
export function POST(request: Request) { return observeRoute(request, handlePost); }
async function handlePost(request: Request) {
  if (!isSupabaseMode()) return NextResponse.json({ code: "receiptUnavailable" }, { status: 404, headers });
  try {
    const origin = process.env.APP_ORIGIN;
    if (!origin || request.headers.get("origin") !== new URL(origin).origin) throw receiptFailure("receiptUnavailable", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw receiptFailure("receiptUnavailable", 415);
    const storeId = request.headers.get("x-ct-store-id");
    if (!storeId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(storeId)) throw receiptFailure("receiptUnavailable", 400);
    const reader = request.body?.getReader();
    if (!reader) throw receiptFailure("receiptUnavailable", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024) { await reader.cancel(); throw receiptFailure("receiptUnavailable", 413); } chunks.push(value); }
    let input: ReceiptRequest;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw receiptFailure("receiptUnavailable", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["id", "paper", "language", "expectedRevision"].includes(k)) || typeof input.id !== "string" || !localIntakeId(input.id) || !["a4", "a5", "half", "double"].includes(input.paper) || !["it", "en", "zh"].includes(input.language) || (input.expectedRevision !== undefined && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1))) throw receiptFailure("receiptUnavailable", 400);
    const result = await generateRepairReceipt(input, origin, storeId);
    return new NextResponse(new Uint8Array(result.bytes).buffer, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${input.id}-${input.language}-${input.paper}.pdf"`, "X-Receipt-Revision": String(result.revision), "X-Receipt-Source": result.token } });
  } catch (error) {
    if (error instanceof ReceiptRenderError) return NextResponse.json({ code: error.code === "overflow" ? "printOverflow" : error.code === "font" ? "printFontError" : "printLayoutError", blocks: error.blocks }, { status: 422, headers });
    return NextResponse.json({ code: error instanceof BackendError && ["receiptChanged", "receiptBusy"].includes(error.message) ? error.message : "receiptUnavailable" }, { status: error instanceof BackendError ? error.status : 503, headers });
  }
}
