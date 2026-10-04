import { legacyServiceWorkerRetirement } from "@/lib/legacy-service-worker-retirement";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(legacyServiceWorkerRetirement, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
