import type { AuditActor } from "@/lib/repairdesk/types";
import { fail, requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

import type { RepairDeskRealtimeDomain } from "../model/realtime-events";

export type RepairDeskDomainRevisions = Partial<Record<RepairDeskRealtimeDomain, string>>;

export async function getRepairDeskDomainRevisions(
  domains: readonly RepairDeskRealtimeDomain[],
  actor: AuditActor,
): Promise<{ revisions: RepairDeskDomainRevisions }> {
  const storeId = requireStoreIdFromActor(actor, "读取同步版本");
  const uniqueDomains = [...new Set(domains)];
  const revisions: RepairDeskDomainRevisions = Object.fromEntries(
    uniqueDomains.map((domain) => [domain, "0"]),
  );

  const { data, error } = await getSupabaseAdmin()
    .from("repairdesk_store_domain_versions")
    .select("domain,version")
    .eq("store_id", storeId)
    .in("domain", uniqueDomains);
  fail(error, "读取同步版本失败");

  for (const row of data ?? []) {
    const domain = row.domain as RepairDeskRealtimeDomain;
    if (!uniqueDomains.includes(domain)) continue;
    revisions[domain] = String(row.version ?? 0);
  }
  return { revisions };
}
