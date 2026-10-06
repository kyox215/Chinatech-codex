"use client";
import { useLanguage } from "@/components/language-provider";
import { useStaff } from "@/components/staff/use-staff";
import { PageTitle } from "@/components/page-title";
import { useRetail } from "./retail-provider";
import { useRetailHistory } from "./retail-history-store";
import { RetailHistoryList } from "./retail-history-list";
import surface from "./retail-surface.module.css";

export function RetailList() {
  const { t } = useLanguage(); const staff = useStaff();
  const { units, ready, error } = useRetail(); const history = useRetailHistory();
  if (!ready || !history.ready) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title={t("整机商品")} /></header><div className="panel module-empty" role="status">{t("正在读取整机记录…")}</div></main>;
  if (!staff.can("retail.view")) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title={t("整机商品")} /></header><div className="panel module-empty"><strong>{t("当前账号无权查看整机记录")}</strong></div></main>;
  return <RetailHistoryList records={history.records} ready={history.ready} error={[history.error, error].filter(Boolean).join(" ")} units={units} />;
}
