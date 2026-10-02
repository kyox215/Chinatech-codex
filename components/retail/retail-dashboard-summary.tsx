"use client";

import Link from "next/link";
import { Boxes, CheckCircle2, Clock3 } from "lucide-react";
import { useRetail } from "./retail-provider";

export function RetailDashboardSummary() {
  const { units } = useRetail();
  return <article className="panel retail-panel"><div className="panel__header"><div><h2>整机商品</h2></div><Link className="button button--secondary button--tiny" href="/app/retail">查看商品</Link></div><div className="retail-metrics"><Link href="/app/retail?status=available"><span className="retail-icon retail-icon--violet"><Boxes size={19} /></span><p><strong>{units.filter((unit) => unit.status === "available").length}</strong><small>可售单机</small></p></Link><Link href="/app/retail?status=inspecting"><span className="retail-icon retail-icon--amber"><Clock3 size={19} /></span><p><strong>{units.filter((unit) => unit.status === "inspecting").length}</strong><small>待检测</small></p></Link><Link href="/app/retail?status=reserved"><span className="retail-icon retail-icon--mint"><CheckCircle2 size={19} /></span><p><strong>{units.filter((unit) => unit.status === "reserved").length}</strong><small>已预留</small></p></Link></div></article>;
}
