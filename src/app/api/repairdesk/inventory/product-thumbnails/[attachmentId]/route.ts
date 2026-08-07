import type { NextRequest } from "next/server";

import { readInventoryProductThumbnail } from "@/features/inventory/server/inventory.service";
import { ForbiddenError, UnauthorizedError, getRequestActor } from "@/server/auth-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_IMAGE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type RouteContext = {
  params: Promise<{ attachmentId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      throw new ForbiddenError("请求来源无效");
    }

    const actor = await getRequestActor();
    const { attachmentId } = await context.params;
    const thumbnail = await readInventoryProductThumbnail(attachmentId, actor);
    return new Response(Buffer.from(thumbnail.bytes), {
      status: 200,
      headers: {
        ...PRIVATE_IMAGE_HEADERS,
        "Content-Type": thumbnail.contentType,
        "Content-Length": String(thumbnail.bytes.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return privateImageError(401);
    if (error instanceof ForbiddenError) return privateImageError(403);
    const status = readSafeErrorStatus(error);
    return privateImageError(status);
  }
}

function readSafeErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return 500;
  const status = Number((error as { status?: unknown }).status);
  return [403, 404, 422, 503].includes(status) ? status : 500;
}

function privateImageError(status: number) {
  return new Response(null, { status, headers: PRIVATE_IMAGE_HEADERS });
}
