import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend/database";
import { getV2Access, loadPageState } from "@/lib/backend/page-state";
import { parsePageReadPlan } from "@/lib/backend/read-plan";
import { isSupabaseMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const started = performance.now(); let accessMs = 0, readMs = 0;
  function response(data: unknown, status = 200) {
    const serializing = performance.now(), body = JSON.stringify(data);
    return new NextResponse(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Vary": "Cookie, x-ct-store-id", "X-Content-Type-Options": "nosniff", "X-CT-Body-Bytes": String(Buffer.byteLength(body)), "Server-Timing": `access;dur=${accessMs.toFixed(1)}, read;dur=${readMs.toFixed(1)}, serialize;dur=${(performance.now()-serializing).toFixed(1)}, total;dur=${(performance.now()-started).toFixed(1)}` } });
  }
  if (!isSupabaseMode()) return response({ message: "正式后台未启用。" }, 404);
  try {
    const url = new URL(request.url), raw = url.searchParams.get("plan");
    let plan;
    try { if (!raw || raw.length > 512) throw new Error(); plan = parsePageReadPlan(JSON.parse(raw)); } catch { throw new BackendError("请求资料无效。", 400); }
    const access = await getV2Access(request); accessMs = performance.now() - started;
    const reading = performance.now();
    const result = await loadPageState(access, plan, url.searchParams.get("known") ?? undefined, request.headers.get("x-ct-read-scope") ?? undefined);
    readMs = performance.now() - reading;
    return response(result);
  } catch (error) {
    return response({ message: error instanceof BackendError ? error.message : "后台暂时不可用，请稍后重试。", code: error instanceof BackendError ? error.code : undefined }, error instanceof BackendError ? error.status : 503);
  }
}
