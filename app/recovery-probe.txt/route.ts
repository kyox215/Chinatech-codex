export const dynamic = "force-dynamic";

export function GET() {
  return new Response("repairdesk-recovery-v1", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
