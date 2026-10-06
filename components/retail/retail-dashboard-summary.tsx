"use client";

import { useMemo } from "react";
import { buildRetailListIndex } from "@/lib/retail-list-model";
import { useRetailHistory } from "./retail-history-store";
import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { Boxes, CheckCircle2, Clock3 } from "lucide-react";
import { useRetail } from "./retail-provider";

export function RetailDashboardSummary() {
  const { t } = useLanguage();
  const { units, ready } = useRetail(); const history = useRetailHistory();
  const index = useMemo(() => buildRetailListIndex(units, history.records), [units, history.records]);
  const counts = { available: 0, sold: 0, other: 0 }; for (const item of index) counts[item.view]++;
  return <article className="panel retail-panel"><div className="panel__header"><div><h2>{t("整机商品")}</h2></div><Link className="button button--secondary button--tiny" href="/app/retail">{t("查看商品")}</Link></div><div className="retail-metrics"><Link href="/app/retail"><span className="retail-icon retail-icon--violet"><Boxes size={19} /></span><p><strong>{ready && history.ready ? counts.available : "—"}</strong><small>{t("在售商品")}</small></p></Link><Link href="/app/retail?view=other"><span className="retail-icon retail-icon--amber"><Clock3 size={19} /></span><p><strong>{ready && history.ready ? counts.other : "—"}</strong><small>{t("其他状态")}</small></p></Link><Link href="/app/retail?view=sold"><span className="retail-icon retail-icon--mint"><CheckCircle2 size={19} /></span><p><strong>{ready && history.ready ? counts.sold : "—"}</strong><small>{t("已售历史")}</small></p></Link></div></article>;
}
