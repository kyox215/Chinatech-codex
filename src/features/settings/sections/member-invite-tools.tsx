"use client";

import { useState } from "react";
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
import { MEMBER_ROLE_LABELS } from "@/features/settings/model/member-settings-editor";
import { cn } from "@/lib/utils";
import type {
  ApprovedStoreRole,
  StoreInvitation,
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
  const defaultRole = roleOptions[0] ?? "viewer";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [invite, setInvite] = useState<StoreInviteInput>({ email: "", role: defaultRole });
  const [link, setLink] = useState<StoreInviteLinkCreateInput>({
    label: "",
    role: defaultRole,
    expires_in_days: 7,
    max_uses: 1,
  });

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      {canInvite ? (
        <InvitePanel
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title="邮件邀请员工"
          summary={`${invitations.length} 个待接受`}
          icon={<MailPlus className="size-4" />}
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="invite-email">员工邮箱</Label>
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
                系统会向该邮箱发送一次性加入链接；员工完成登录或注册后才能访问店铺。
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">角色</Label>
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
                      {MEMBER_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="min-h-10 self-end"
              disabled={
                isInviting || invite.email.trim().length < 3 || !roleOptions.includes(invite.role)
              }
              onClick={() =>
                void onInvite({ ...invite, email: invite.email.trim() })
                  .then(() => {
                    setInvite({ email: "", role: defaultRole });
                  })
                  .catch(() => undefined)
              }
            >
              {isInviting ? "正在发送…" : "发送邀请邮件"}
            </Button>
          </div>
        </InvitePanel>
      ) : null}

      {canInvite || canRevoke ? (
        <InvitePanel
          open={linkOpen}
          onOpenChange={setLinkOpen}
          title="邀请码"
          summary={`${inviteLinks.length} 个有效`}
          icon={<Link2 className="size-4" />}
        >
          {canInvite ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="invite-code-label">备注</Label>
                <Input
                  id="invite-code-label"
                  className="h-[38px] text-base sm:text-sm"
                  maxLength={120}
                  value={link.label ?? ""}
                  onChange={(event) =>
                    setLink((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder="例如 临时员工"
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
                  label="有效天数"
                  value={link.expires_in_days ?? 7}
                  max={30}
                  onChange={(value) =>
                    setLink((current) => ({ ...current, expires_in_days: value }))
                  }
                />
                <NumberField
                  id="invite-code-uses"
                  label="可用次数"
                  value={link.max_uses ?? 1}
                  max={50}
                  onChange={(value) => setLink((current) => ({ ...current, max_uses: value }))}
                />
              </div>
              <Button
                type="button"
                className="min-h-10 sm:col-span-2"
                disabled={isCreatingLink || !roleOptions.includes(link.role)}
                onClick={() =>
                  void onCreateLink({
                    ...link,
                    label: link.label?.trim() || undefined,
                  })
                    .then(() => setLink((current) => ({ ...current, label: "" })))
                    .catch(() => undefined)
                }
              >
                {isCreatingLink ? "生成中…" : "生成当前店铺邀请码"}
              </Button>
            </div>
          ) : null}

          {latestInviteCode ? (
            <RepairOsBusinessCard
              as="div"
              className="mt-3 grid-cols-1 gap-2 border-primary/25 bg-primary/5 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              trailing={
                <Button type="button" variant="outline" className="min-h-9" onClick={onCopyCode}>
                  <Copy className="size-4" /> 复制
                </Button>
              }
            >
              <p className="text-xs text-muted-foreground">只显示本次生成的代码</p>
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
                    <Badge variant="outline">{MEMBER_ROLE_LABELS[item.role]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.used_count}/{item.max_uses ?? "不限"}
                    </span>
                    {canRevoke ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-9"
                        disabled={isRevokingLink}
                        onClick={(event) => onRequestRevokeLink(item, event.currentTarget)}
                      >
                        撤销
                      </Button>
                    ) : null}
                  </div>
                }
              >
                <p className="break-words text-sm font-medium">{item.label || "未命名邀请码"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  到期 {formatMemberDate(item.expires_at)}
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
            待接受邀请
          </h3>
          {invitations.map((item) => (
            <RepairOsBusinessCard
              key={item.id}
              as="div"
              className="grid-cols-1 gap-2 border-dashed px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              trailing={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{MEMBER_ROLE_LABELS[item.role]}</Badge>
                  <Badge
                    variant={item.email_delivery_status === "failed" ? "destructive" : "secondary"}
                  >
                    {emailDeliveryLabel(item.email_delivery_status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatMemberDate(item.expires_at)}
                  </span>
                  {canInvite && item.role !== "owner" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-9"
                      disabled={isInviting}
                      onClick={() =>
                        void onInvite({
                          email: item.email,
                          role: item.role as ApprovedStoreRole,
                        }).catch(() => undefined)
                      }
                    >
                      <RotateCcw className="size-4" /> 重新发送
                    </Button>
                  ) : null}
                  {canRevoke ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-9"
                      disabled={isRevokingInvitation}
                      onClick={(event) => onRequestRevokeInvitation(item, event.currentTarget)}
                    >
                      撤销
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
          className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  return (
    <div className="space-y-1.5">
      <Label htmlFor="invite-code-role">角色</Label>
      <Select value={value} onValueChange={(role) => onChange(role as ApprovedStoreRole)}>
        <SelectTrigger id="invite-code-role" className="h-[38px] text-base sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roleOptions.map((role) => (
            <SelectItem key={role} value={role}>
              {MEMBER_ROLE_LABELS[role]}
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

export function formatMemberDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}

export function emailDeliveryLabel(status: StoreInvitation["email_delivery_status"]) {
  if (status === "sent") return "邮件已发送";
  if (status === "pending") return "正在发送";
  if (status === "failed") return "发送失败";
  return "尚未发送";
}
