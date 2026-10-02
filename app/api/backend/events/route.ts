import { createBackendEventsResponse } from "@/lib/backend/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return createBackendEventsResponse(request);
}
