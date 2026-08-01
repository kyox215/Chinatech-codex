"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, MessagesSquare, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { SettingsField } from "@/features/settings/components/settings-field";
import type { SettingsFieldErrors } from "@/features/settings/model/settings-field-errors";
import {
  getSettingsFieldError,
  getSettingsFieldErrorId,
} from "@/features/settings/model/settings-field-errors";
import type { StoreSettingsDraftValues } from "@/features/settings/model/store-settings-draft";
import { getStoreOutputDraftProjectionCopy } from "@/features/settings/model/store-output-draft-projection";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";

export interface NotificationsSettingsSectionProps {
  draft: StoreSettingsDraftValues["notifications"];
  savedOutputIdentity: StoreOutputIdentity;
  draftOutputIdentity: StoreOutputIdentity;
  isDraftDirty: boolean;
  canUpdateSettings: boolean;
  canReadMessageTemplates: boolean;
  fieldErrors: SettingsFieldErrors;
  messagePreview: string;
  printPreview: string;
  onDraftChange: (patch: Partial<StoreSettingsDraftValues["notifications"]>) => void;
}

export function NotificationsSettingsSection({
  draft,
  savedOutputIdentity,
  draftOutputIdentity,
  isDraftDirty,
  canUpdateSettings,
  canReadMessageTemplates,
  fieldErrors,
  messagePreview,
  printPreview,
  onDraftChange,
}: NotificationsSettingsSectionProps) {
  return (
    <div data-settings-notifications-section className="min-w-0 space-y-3">
      <NotificationFieldsCard
        draft={draft}
        canUpdateSettings={canUpdateSettings}
        fieldErrors={fieldErrors}
        onDraftChange={onDraftChange}
      />
      <NotificationPreviewCard
        savedOutputIdentity={savedOutputIdentity}
        draftOutputIdentity={draftOutputIdentity}
        isDraftDirty={isDraftDirty}
        canUpdateSettings={canUpdateSettings}
        messagePreview={messagePreview}
        printPreview={printPreview}
      />
      <MessageTemplatesCard canReadMessageTemplates={canReadMessageTemplates} />
    </div>
  );
}

function NotificationFieldsCard({
  draft,
  canUpdateSettings,
  fieldErrors,
  onDraftChange,
}: Pick<
  NotificationsSettingsSectionProps,
  "draft" | "canUpdateSettings" | "fieldErrors" | "onDraftChange"
>) {
  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={Printer}
        iconFrame={false}
        title="输出配置"
        action={
          <Badge variant="outline" className="text-[10px]">
            {canUpdateSettings ? "可编辑" : "只读"}
          </Badge>
        }
      />
      {canUpdateSettings ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          <SettingsField
            label="客户消息签名"
            htmlFor="message-signature"
            icon={MessageSquare}
            error={getSettingsFieldError(fieldErrors, "message_signature")}
          >
            <Textarea
              id="message-signature"
              rows={4}
              maxLength={300}
              className="min-h-28 text-base sm:text-sm"
              value={draft.message_signature}
              aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "message_signature"))}
              aria-describedby={getSettingsFieldErrorId(
                fieldErrors,
                "message_signature",
                "message-signature",
              )}
              onChange={(event) => onDraftChange({ message_signature: event.target.value })}
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {draft.message_signature.length}/300
            </p>
          </SettingsField>
          <SettingsField
            label="打印页脚"
            htmlFor="print-footer"
            icon={Printer}
            error={getSettingsFieldError(fieldErrors, "print_footer")}
          >
            <Textarea
              id="print-footer"
              rows={4}
              maxLength={500}
              className="min-h-28 text-base sm:text-sm"
              value={draft.print_footer}
              aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "print_footer"))}
              aria-describedby={getSettingsFieldErrorId(
                fieldErrors,
                "print_footer",
                "print-footer",
              )}
              onChange={(event) => onDraftChange({ print_footer: event.target.value })}
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {draft.print_footer.length}/500
            </p>
          </SettingsField>
        </div>
      ) : (
        <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
          <ReadOnlyOutputValue label="客户消息签名" value={draft.message_signature} />
          <ReadOnlyOutputValue label="打印页脚" value={draft.print_footer} />
        </dl>
      )}
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        这里只保存当前店铺的消息签名与打印页脚；消息模板正文继续在“消息模板”中维护。未保存草稿只更新下方预览，不会立即改变客户输出。
      </p>
    </section>
  );
}

function ReadOnlyOutputValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-4">
        {value.trim() || "未填写"}
      </dd>
    </div>
  );
}

function NotificationPreviewCard({
  savedOutputIdentity,
  draftOutputIdentity,
  isDraftDirty,
  canUpdateSettings,
  messagePreview,
  printPreview,
}: Pick<
  NotificationsSettingsSectionProps,
  | "savedOutputIdentity"
  | "draftOutputIdentity"
  | "isDraftDirty"
  | "canUpdateSettings"
  | "messagePreview"
  | "printPreview"
>) {
  const projection = isDraftDirty
    ? getStoreOutputDraftProjectionCopy(
        savedOutputIdentity.canOutput,
        draftOutputIdentity.canOutput,
      )
    : null;
  const recoveryHref =
    savedOutputIdentity.recoveryTarget === "store" ? "/settings?section=store" : null;

  return (
    <section className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={MessageSquare}
        iconFrame={false}
        title="客户输出与预览"
        action={
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              savedOutputIdentity.canOutput
                ? "border-status-success-foreground/30 text-status-success-foreground"
                : "border-status-warn-foreground/30 text-status-warn-foreground",
            )}
          >
            {savedOutputIdentity.canOutput ? "当前已就绪" : "当前已暂停"}
          </Badge>
        }
      />

      <div
        role={savedOutputIdentity.canOutput ? "status" : "alert"}
        className={cn(
          "rounded-xl border px-3 py-2.5",
          savedOutputIdentity.canOutput
            ? "border-status-success-foreground/25 bg-status-success/10 text-status-success-foreground"
            : "border-status-warn-foreground/25 bg-status-warn/10 text-status-warn-foreground",
        )}
      >
        <p className="text-xs font-semibold">
          {savedOutputIdentity.canOutput
            ? "当前已保存资料可用于客户消息与打印"
            : "客户消息、打印和票据当前保持关闭"}
        </p>
        <p className="mt-1 text-[11px] leading-4">
          {savedOutputIdentity.canOutput
            ? "实际输出继续使用服务器已保存的店铺身份。"
            : savedOutputIdentity.blockReason}
        </p>
        {recoveryHref ? (
          <Button
            asChild
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 min-h-9 w-full border-status-warn-foreground/30 bg-background sm:w-auto"
          >
            <Link href={recoveryHref}>{canUpdateSettings ? "补充店铺资料" : "查看店铺资料"}</Link>
          </Button>
        ) : null}
      </div>

      {projection ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-primary"
        >
          <p className="text-xs font-semibold">未保存草稿预估</p>
          <p className="mt-1 text-[11px] leading-4">{projection}</p>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <OutputPreview
          title={isDraftDirty ? "未保存草稿 · 客户消息" : "客户消息预览"}
          icon={MessageSquare}
          value={messagePreview}
        />
        <OutputPreview
          title={isDraftDirty ? "未保存草稿 · 打印资料" : "打印资料预览"}
          icon={Printer}
          value={printPreview}
        />
      </div>
    </section>
  );
}

function OutputPreview({
  title,
  icon: Icon,
  value,
}: {
  title: string;
  icon: typeof Printer;
  value: string;
}) {
  const titleId = `settings-output-preview-${title.includes("消息") ? "message" : "print"}`;
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card p-3">
      <p id={titleId} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-primary" />
        {title}
      </p>
      <pre
        aria-labelledby={titleId}
        tabIndex={0}
        className="max-h-48 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-panel-muted)] p-2.5 text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]"
      >
        {value}
      </pre>
    </div>
  );
}

function MessageTemplatesCard({
  canReadMessageTemplates,
}: Pick<NotificationsSettingsSectionProps, "canReadMessageTemplates">) {
  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={MessagesSquare} iconFrame={false} title="消息模板" />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold">维护工单与客户消息正文</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            模板编辑、语言、渠道和启用状态在独立页面管理；设置页不会复制模板编辑器，也不会发送测试消息。
          </p>
        </div>
        {canReadMessageTemplates ? (
          <Button
            asChild
            type="button"
            variant="outline"
            className="min-h-10 w-full shrink-0 sm:w-auto"
          >
            <Link href="/messages">
              打开消息模板
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Badge variant="outline" className="w-fit shrink-0 text-[10px]">
            当前账号无模板读取权限
          </Badge>
        )}
      </div>
    </section>
  );
}
