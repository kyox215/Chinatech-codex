"use client";

import { useMemo, useState } from "react";
import { Search, Settings2, UserMinus, UserRoundCheck } from "lucide-react";

import { RepairOsBusinessCard } from "@/shared/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMemberPermissionOptions,
  getMemberRoleLabels,
  getMemberStatusLabels,
} from "@/features/settings/model/member-settings-editor";
import { cn } from "@/lib/utils";
import type { StoreMember, StoreRole } from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";

export interface MemberListProps {
  members: StoreMember[];
  currentMembershipId?: string;
  pendingMemberId?: string;
  onOpenEditor: (member: StoreMember, trigger: HTMLButtonElement) => void;
  onRequestDisable: (member: StoreMember, trigger: HTMLButtonElement) => void;
  onRequestRestore: (member: StoreMember, trigger: HTMLButtonElement) => void;
}

export function MemberList({
  members,
  currentMembershipId,
  pendingMemberId,
  onOpenEditor,
  onRequestDisable,
  onRequestRestore,
}: MemberListProps) {
  const { locale, t } = useLocale();
  const roleLabels = getMemberRoleLabels(locale);
  const statusLabels = getMemberStatusLabels(locale);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<StoreRole | "all">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      if (role !== "all" && member.role !== role) return false;
      if (status !== "all" && member.status !== status) return false;
      if (!term) return true;
      return `${member.display_name ?? ""} ${member.email}`.toLowerCase().includes(term);
    });
  }, [members, role, search, status]);

  return (
    <section aria-labelledby="members-list-title" className="space-y-3">
      <h3 id="members-list-title" className="sr-only">
        {t("settings.members.list.title")}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("settings.members.list.searchAria")}
            className="h-[38px] pl-9 text-base sm:text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("settings.members.list.searchPlaceholder")}
          />
        </div>
        <Select value={role} onValueChange={(value) => setRole(value as StoreRole | "all")}>
          <SelectTrigger
            className="h-[38px] text-base sm:text-sm"
            aria-label={t("settings.members.list.roleFilterAria")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("settings.members.list.allRoles")}</SelectItem>
            {(["owner", "manager", "technician", "sales", "viewer"] as const).map((value) => (
              <SelectItem key={value} value={value}>
                {roleLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger
            className="h-[38px] text-base sm:text-sm"
            aria-label={t("settings.members.list.statusFilterAria")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("settings.members.list.allStatuses")}</SelectItem>
            <SelectItem value="active">{statusLabels.active}</SelectItem>
            <SelectItem value="inactive">{statusLabels.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!filtered.length ? (
        <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {members.length ? t("settings.members.list.noMatches") : t("settings.members.list.empty")}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[var(--border-panel)] xl:block">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-[var(--surface-panel-muted)] text-[10px] uppercase tracking-wide text-muted-foreground lg:text-[11px] lg:leading-4 lg:tracking-normal">
                <tr>
                  <th className="w-[30%] px-3 py-2 font-medium">
                    {t("settings.members.list.staff")}
                  </th>
                  <th className="w-[13%] px-3 py-2 font-medium">
                    {t("settings.members.list.role")}
                  </th>
                  <th className="w-[12%] px-3 py-2 font-medium">
                    {t("settings.members.list.status")}
                  </th>
                  <th className="w-[27%] px-3 py-2 font-medium">
                    {t("settings.members.list.grants")}
                  </th>
                  <th className="w-[18%] px-3 py-2 text-right font-medium">
                    {t("settings.members.list.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr
                    key={member.id}
                    data-member-id={member.id}
                    className="border-t border-[var(--border-panel)]"
                  >
                    <td className="min-w-0 px-3 py-2.5">
                      <p className="truncate font-medium">{member.display_name || member.email}</p>
                      <p
                        className="truncate text-[11px] text-muted-foreground lg:text-xs lg:leading-4"
                        title={member.email}
                      >
                        {member.email}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <MemberRoleBadge member={member} />
                    </td>
                    <td className="px-3 py-2.5">
                      <MemberStatusBadge member={member} />
                    </td>
                    <td className="min-w-0 px-3 py-2.5">
                      <MemberGrantSummary member={member} />
                    </td>
                    <td className="px-3 py-2.5">
                      <MemberActions
                        member={member}
                        isPending={pendingMemberId === member.id}
                        onOpenEditor={onOpenEditor}
                        onRequestDisable={onRequestDisable}
                        onRequestRestore={onRequestRestore}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 xl:hidden">
            {filtered.map((member) => (
              <RepairOsBusinessCard
                key={member.id}
                as="div"
                data-member-id={member.id}
                className={cn(
                  "grid-cols-1 gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
                  member.status === "inactive" && "bg-muted/30",
                )}
                trailing={
                  <MemberActions
                    member={member}
                    isPending={pendingMemberId === member.id}
                    onOpenEditor={onOpenEditor}
                    onRequestDisable={onRequestDisable}
                    onRequestRestore={onRequestRestore}
                  />
                }
                trailingClassName="min-w-0"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 break-words text-sm font-semibold">
                    {member.display_name || member.email}
                  </p>
                  <MemberRoleBadge member={member} />
                  <MemberStatusBadge member={member} />
                  {member.id === currentMembershipId ? (
                    <Badge variant="outline">{t("settings.members.list.currentAccount")}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">{member.email}</p>
                <div className="mt-2">
                  <MemberGrantSummary member={member} />
                </div>
              </RepairOsBusinessCard>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function MemberActions({
  member,
  isPending,
  onOpenEditor,
  onRequestDisable,
  onRequestRestore,
  compact = false,
}: Omit<MemberListProps, "members" | "currentMembershipId" | "pendingMemberId"> & {
  member: StoreMember;
  isPending: boolean;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const management = member.management;
  return (
    <div className={cn("flex flex-wrap gap-2", compact && "justify-end")} aria-busy={isPending}>
      <Button
        type="button"
        variant="outline"
        className={cn("min-h-9", compact && "xl:min-h-8 xl:px-2")}
        onClick={(event) => onOpenEditor(member, event.currentTarget)}
      >
        <Settings2 className="size-4" />
        {management?.can_update_role || management?.can_update_permissions
          ? t("settings.members.list.manage")
          : t("settings.members.list.view")}
      </Button>
      {management?.can_disable ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-h-11 text-destructive hover:text-destructive",
            compact && "xl:min-h-8 xl:px-2",
          )}
          disabled={isPending}
          onClick={(event) => onRequestDisable(member, event.currentTarget)}
        >
          <UserMinus className="size-4" /> {t("settings.members.list.disable")}
        </Button>
      ) : null}
      {management?.can_restore ? (
        <Button
          type="button"
          variant="outline"
          className={cn("min-h-9", compact && "xl:min-h-8 xl:px-2")}
          disabled={isPending}
          onClick={(event) => onRequestRestore(member, event.currentTarget)}
        >
          <UserRoundCheck className="size-4" /> {t("settings.members.list.restore")}
        </Button>
      ) : null}
    </div>
  );
}

function MemberRoleBadge({ member }: { member: StoreMember }) {
  const { locale } = useLocale();
  return (
    <Badge variant={member.role === "owner" ? "default" : "outline"}>
      {getMemberRoleLabels(locale)[member.role]}
    </Badge>
  );
}

function MemberStatusBadge({ member }: { member: StoreMember }) {
  const { locale } = useLocale();
  return (
    <Badge variant={member.status === "active" ? "secondary" : "outline"}>
      {getMemberStatusLabels(locale)[member.status]}
    </Badge>
  );
}

function MemberGrantSummary({ member }: { member: StoreMember }) {
  const { locale, t } = useLocale();
  const labels = getMemberPermissionOptions(locale)
    .filter((option) => member.permission_grants?.includes(option.action))
    .map((option) => option.label);
  return labels.length ? (
    <p className="line-clamp-2 text-[11px] leading-5 text-muted-foreground lg:text-xs lg:leading-5">
      {labels.join(" · ")}
    </p>
  ) : (
    <p className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
      {t("settings.members.list.noGrants")}
    </p>
  );
}
