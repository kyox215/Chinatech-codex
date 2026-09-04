"use client";

import { useRef, useState } from "react";
import { ChevronDown, Copy, Link2, MailPlus, RotateCcw } from "lucide-react";

import { RepairOsBusinessCard } from "@/shared/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMemberRoleLabels } from "@/features/settings/model/member-settings-editor";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { DEFAULT_LOCALE, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";
import type {
  ApprovedStoreRole,
  StoreInvitation,
  StoreInvitationEmailDeliveryStatus,
  StoreInviteLink,
  StoreInviteLinkCreateInput,
  StoreInviteInput,
} from "@/lib/repairdesk/types";

export interface MemberInviteToolsProps {
  invitations: StoreInvitation[];
  inviteLinks: StoreInviteLink[];
  roleOptions: readonly ApprovedStoreRole[];
  latestInviteCode: string;
  canInvite: boolean;
  canRevoke: boolean;
  isInviting: boolean;
  isCreatingLink: boolean;
  isRevokingInvitation: boolean;
  isRevokingLink: boolean;
  onInvite: (input: StoreInviteInput) => Promise<void>;
  onCreateLink: (input: StoreInviteLinkCreateInput) => Promise<void>;
  onCopyCode: () => void;
  onRequestRevokeInvitation: (invitation: StoreInvitation, trigger: HTMLButtonElement) => void;
  onRequestRevokeLink: (link: StoreInviteLink, trigger: HTMLButtonElement) => void;
}

export function MemberInviteTools({
  invitations,
  inviteLinks,
  roleOptions,
  latestInviteCode,
  canInvite,
  canRevoke,
  isInviting,
  isCreatingLink,
  isRevokingInvitation,
  isRevokingLink,
  onInvite,
  onCreateLink,
  onCopyCode,
  onRequestRevokeInvitation,
  onRequestRevokeLink,
}: MemberInviteToolsProps) {
  const { locale, t } = useLocale();
  const roleLabels = getMemberRoleLabels(locale);
  const defaultRole = roleOptions[0] ?? "viewer";
  const [inviteOpen, setInviteOpen] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [invite, setInvite] = useState<StoreInviteInput>({ email: "", role: defaultRole });
  const [link, setLink] = useState<StoreInviteLinkCreateInput>({
    label: "",
    role: defaultRole,
    expires_in_days: 7,
    max_uses: 1,
  });
  const inviteSubmittingRef = useRef(false);
  const linkSubmittingRef = useRef(false);
  const resendSubmittingRef = useRef(new Set<string>());

  const submitInvite = () => {
    if (inviteSubmittingRef.current) return;
    inviteSubmittingRef.current = true;
    void onInvite({ ...invite, email: invite.email.trim() })
      .then(() => setInvite({ email: "", role: defaultRole }))
      .catch(() => undefined)
      .finally(() => {
        inviteSubmittingRef.current = false;
      });
  };
  const submitInviteLink = () => {
    if (linkSubmittingRef.current) return;
    linkSubmittingRef.current = true;
    void onCreateLink({
      ...link,
      label: link.label?.trim() || undefined,
    })
      .then(() => setLink((current) => ({ ...current, label: "" })))
      .catch(() => undefined)
      .finally(() => {
        linkSubmittingRef.current = false;
      });
  };
  const resendInvitation = (item: StoreInvitation) => {
    if (resendSubmittingRef.current.has(item.id)) return;
    resendSubmittingRef.current.add(item.id);
    void onInvite({
      email: item.email,
      role: item.role as ApprovedStoreRole,
    })
      .catch(() => undefined)
      .finally(() => {
        resendSubmittingRef.current.delete(item.id);
      });
  };

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      {canInvite ? (
        <InvitePanel
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title={t("settings.members.invite.emailTitle")}
          summary={t("settings.members.invite.pendingCount", { count: invitations.length })}
          icon={<MailPlus className="size-4" />}
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="invite-email">{t("settings.members.invite.staffEmail")}</Label>
              <Input
                id="invite-email"
                type="email"
                className="h-[38px] text-base sm:text-sm"
                value={invite.email}
                onChange={(event) =>
                  setInvite((current) => ({ ...current, email: event.target.value }))
                }
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("settings.members.invite.emailHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">{t("settings.members.roleLabel")}</Label>
              <Select
                value={invite.role}
                onValueChange={(role) =>
                  setInvite((current) => ({ ...current, role: role as ApprovedStoreRole }))
                }
              >
                <SelectTrigger id="invite-role" className="h-[38px] text-base sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="min-h-11 self-end"
              disabled={
                isInviting || invite.email.trim().length < 3 || !roleOptions.includes(invite.role)
              }
              onClick={submitInvite}
            >
              {isInviting
                ? t("settings.members.invite.sending")
                : t("settings.members.invite.send")}
            </Button>
          </div>
        </InvitePanel>
      ) : null}

      {canInvite || canRevoke ? (
        <InvitePanel
          open={linkOpen}
          onOpenChange={setLinkOpen}
          title={t("settings.members.invite.codeTitle")}
          summary={t("settings.members.invite.activeCount", { count: inviteLinks.length })}
          icon={<Link2 className="size-4" />}
        >
          {canInvite ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="invite-code-label">{t("settings.members.invite.note")}</Label>
                <Input
                  id="invite-code-label"
                  className="h-[38px] text-base sm:text-sm"
                  maxLength={120}
                  value={link.label ?? ""}
                  onChange={(event) =>
                    setLink((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder={t("settings.members.invite.notePlaceholder")}
                />
              </div>
              <InviteRoleSelect
                value={link.role}
                roleOptions={roleOptions}
                onChange={(role) => setLink((current) => ({ ...current, role }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  id="invite-code-days"
                  label={t("settings.members.invite.validDays")}
                  value={link.expires_in_days ?? 7}
                  max={30}
                  onChange={(value) =>
                    setLink((current) => ({ ...current, expires_in_days: value }))
                  }
                />
                <NumberField
                  id="invite-code-uses"
                  label={t("settings.members.invite.maxUses")}
                  value={link.max_uses ?? 1}
                  max={50}
                  onChange={(value) => setLink((current) => ({ ...current, max_uses: value }))}
                />
              </div>
              <Button
                type="button"
                className="min-h-11 sm:col-span-2"
                disabled={isCreatingLink || !roleOptions.includes(link.role)}
                onClick={submitInviteLink}
              >
                {isCreatingLink
                  ? t("settings.members.invite.generating")
                  : t("settings.members.invite.generate")}
              </Button>
            </div>
          ) : null}

          {latestInviteCode ? (
            <RepairOsBusinessCard
              as="div"
              className="mt-3 grid-cols-1 gap-2 border-primary/25 bg-primary/5 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              trailing={
                <Button type="button" variant="outline" className="min-h-11" onClick={onCopyCode}>
                  <Copy className="size-4" /> {t("settings.members.invite.copy")}
                </Button>
              }
            >
              <p className="text-xs text-muted-foreground">
                {t("settings.members.invite.latestCodeOnly")}
              </p>
              <code className="mt-1 block select-all break-all font-mono text-sm font-semibold">
                {latestInviteCode}
              </code>
            </RepairOsBusinessCard>
          ) : null}

          <div className="mt-3 space-y-2">
            {inviteLinks.map((item) => (
              <RepairOsBusinessCard
                key={item.id}
                as="div"
                className="grid-cols-1 gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                trailing={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{roleLabels[item.role]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.used_count}/{item.max_uses ?? t("settings.members.invite.unlimited")}
                    </span>
                    {canRevoke ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={isRevokingLink}
                        onClick={(event) => onRequestRevokeLink(item, event.currentTarget)}
                      >
                        {t("settings.members.invite.revoke")}
                      </Button>
                    ) : null}
                  </div>
                }
              >
                <p className="break-words text-sm font-medium">
                  {item.label || t("settings.members.invite.unnamedCode")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.members.invite.expires", {
                    date: formatMemberDate(item.expires_at, locale),
                  })}
                </p>
              </RepairOsBusinessCard>
            ))}
          </div>
        </InvitePanel>
      ) : null}

      {invitations.length ? (
        <section className="space-y-2 xl:col-span-2" aria-labelledby="pending-invitations-title">
          <h3
            id="pending-invitations-title"
            className="text-xs font-semibold text-muted-foreground"
          >
            {t("settings.members.invite.pendingTitle")}
          </h3>
          {invitations.map((item) => (
            <RepairOsBusinessCard
              key={item.id}
              as="div"
              className="grid-cols-1 gap-2 border-dashed px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              trailing={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{roleLabels[item.role]}</Badge>
                  <Badge
                    variant={item.email_delivery_status === "failed" ? "destructive" : "secondary"}
                  >
                    {emailDeliveryLabel(item.email_delivery_status, locale)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatMemberDate(item.expires_at, locale)}
                  </span>
                  {canInvite && item.role !== "owner" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={isInviting}
                      onClick={() => resendInvitation(item)}
                    >
                      <RotateCcw className="size-4" /> {t("settings.members.invite.resend")}
                    </Button>
                  ) : null}
                  {canRevoke ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={isRevokingInvitation}
                      onClick={(event) => onRequestRevokeInvitation(item, event.currentTarget)}
                    >
                      {t("settings.members.invite.revoke")}
                    </Button>
                  ) : null}
                </div>
              }
            >
              <p className="break-all text-sm">{item.email}</p>
            </RepairOsBusinessCard>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function InvitePanel({
  open,
  onOpenChange,
  title,
  summary,
  icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border border-[var(--border-panel)] bg-card"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
        >
          <span className="text-primary">{icon}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">{summary}</span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[var(--border-panel)] px-3 py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InviteRoleSelect({
  value,
  roleOptions,
  onChange,
}: {
  value: ApprovedStoreRole;
  roleOptions: readonly ApprovedStoreRole[];
  onChange: (role: ApprovedStoreRole) => void;
}) {
  const { locale, t } = useLocale();
  const roleLabels = getMemberRoleLabels(locale);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="invite-code-role">{t("settings.members.roleLabel")}</Label>
      <Select value={value} onValueChange={(role) => onChange(role as ApprovedStoreRole)}>
        <SelectTrigger id="invite-code-role" className="h-[38px] text-base sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roleOptions.map((role) => (
            <SelectItem key={role} value={role}>
              {roleLabels[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={max}
        className="h-[38px] text-base sm:text-sm"
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(1, Number(event.target.value) || 1)))}
      />
    </div>
  );
}

export function formatMemberDate(value: string, locale: AppLocale = DEFAULT_LOCALE) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Rome",
  }).format(date);
}

const emailDeliveryKeys: Record<StoreInvitationEmailDeliveryStatus, MessageKey> = {
  sent: "settings.members.invite.emailSent",
  pending: "settings.members.invite.emailPending",
  failed: "settings.members.invite.emailFailed",
  not_requested: "settings.members.invite.emailNotSent",
};

export function emailDeliveryLabel(
  status: StoreInvitation["email_delivery_status"],
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return translateMessage(locale, emailDeliveryKeys[status ?? "not_requested"]);
}
