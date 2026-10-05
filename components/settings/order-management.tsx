"use client";

import { useLanguage } from "@/components/language-provider";
import { useState } from "react";
import { Check, ClipboardList, PackageSearch } from "lucide-react";
import { RepairGroupEditor } from "@/components/repairs/repair-group-editor";
import { useStaff } from "@/components/staff/use-staff";
import { backendSnapshot, isBackendClient } from "@/lib/backend/client";
import { defaultRepairGroups, visibleRepairGroups, type RepairGroupKind } from "@/lib/repair-groups";
import type { StoreSettings } from "@/lib/store-settings";

const kinds = [
  { kind: "workflow", label: "维修状态分组", icon: ClipboardList },
  { kind: "parts", label: "配件分组", icon: PackageSearch },
] as const;

export function OrderManagement({ settings, disabled = false }: { settings: StoreSettings; disabled?: boolean }) {
  const { t } = useLanguage();
  const staff = useStaff();
  const scope = JSON.stringify([isBackendClient() ? backendSnapshot()?.storeId : "preview", staff.member?.id, staff.member?.revision, staff.member?.permissions.toSorted()]);
  const [editing, setEditing] = useState<{ kind: RepairGroupKind; scope: string } | null>(null);
  const [saved, setSaved] = useState("");
  const groups = settings.repairGroups ?? defaultRepairGroups();
  const canManage = staff.ready && !staff.error && staff.can("settings.edit");

  function closeEditor() {
    const kind = editing?.kind;
    setEditing(null);
    if (kind) requestAnimationFrame(() => document.getElementById(`manage-repair-${kind}-groups`)?.focus({ preventScroll: true }));
  }

  return <>
    <div className="settings-section-title"><ClipboardList size={22} /><h3>{t("订单管理")}</h3></div>
    {saved ? <p className="settings-saved" role="status"><Check size={16} />{t(saved)}</p> : null}
    <div className="settings-order-groups">{kinds.map(({ kind, label, icon: Icon }) => <article className="settings-order-group" key={kind}>
      <header className="settings-order-group__heading"><Icon size={19} aria-hidden="true" /><h4>{t(label)}</h4>{canManage ? <button id={`manage-repair-${kind}-groups`} className="button button--secondary button--compact" type="button" disabled={disabled} onClick={() => { setSaved(""); setEditing({ kind, scope }); }} aria-label={t("管理{v0}", { v0: t(label) })}>{t("管理")}</button> : null}</header>
      <ol className="settings-order-group__names">{visibleRepairGroups(groups, kind).map(group => <li key={group.key}>{kind === "workflow" ? t(group.label) : group.label}</li>)}</ol>
    </article>)}</div>
    {canManage && !disabled && editing?.scope === scope ? <RepairGroupEditor key={`${scope}:${editing.kind}`} settings={settings} kind={editing.kind} onClose={closeEditor} onSaved={() => { setSaved("分组已保存"); closeEditor(); }} /> : null}
  </>;
}
