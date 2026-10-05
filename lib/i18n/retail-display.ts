import type { RetailUnit } from "../retail";
import type { Locale } from "./locale";
import { translate } from "./translate";

/** Format known specification labels for display; keep stored and searchable facts original. */
export function retailDisplaySpec(unit: RetailUnit, locale: Locale) {
  const t = (value: string) => translate(value, locale);
  const disks = unit.disks.map(disk => `${disk.capacity ?? t("容量待确认")} ${disk.unit} ${disk.type}`);
  const body = unit.bodyStorage ? `${unit.bodyStorage.capacity ?? t("容量待确认")} ${unit.bodyStorage.unit} ${t("机身存储")}` : "";
  return [unit.ramGb === null ? "" : `${unit.ramGb} GB RAM`, unit.category === "laptop" || unit.category === "desktop" ? disks.join(" + ") : body, unit.edition].filter(Boolean).join(" · ") || t("规格待确认");
}
