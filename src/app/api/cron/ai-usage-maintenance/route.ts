import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

import { runAiUsageMaintenance } from "@/features/ai-assistant/server/ai-usage-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await runAiUsageMaintenance();
    return Response.json({ ok: true, ...result });
  } catch {
    console.error("[ai-assistant] usage maintenance unavailable", {
      errorCode: "AI_USAGE_MAINTENANCE_UNAVAILABLE",
    });
    return Response.json({ ok: false, code: "AI_USAGE_MAINTENANCE_UNAVAILABLE" }, { status: 503 });
  }
}

function isAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
