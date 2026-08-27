"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare, MessagesSquare, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
        canReadMessageTemplates={canReadMessageTemplates}
        messagePreview={messagePreview}
        printPreview={printPreview}
      />
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
          <Badge variant="outline" className="text-[10px] lg:text-[11px] lg:leading-4">
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
            <p className="text-right text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
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
            <p className="text-right text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
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
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        这里只保存当前店铺的消息签名与打印页脚；消息模板正文继续在“消息模板”中维护。未保存草稿只更新下方预览，不会立即改变客户输出。
      </p>
    </section>
  );
}

function ReadOnlyOutputValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
      <dt className="text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
        {label}
      </dt>
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
  canReadMessageTemplates,
  messagePreview,
  printPreview,
}: Pick<
  NotificationsSettingsSectionProps,
  | "savedOutputIdentity"
  | "draftOutputIdentity"
  | "isDraftDirty"
  | "canUpdateSettings"
  | "canReadMessageTemplates"
  | "messagePreview"
  | "printPreview"
>) {
  const [preview, setPreview] = useState<"message" | "print" | null>(null);
  const projection = isDraftDirty
    ? getStoreOutputDraftProjectionCopy(
        savedOutputIdentity.canOutput,
        draftOutputIdentity.canOutput,
      )
    : null;
  const recoveryHref =
    savedOutputIdentity.recoveryTarget === "store" ? "/settings?section=store" : null;
  const outputWarning = !savedOutputIdentity.canOutput
    ? (projection ?? savedOutputIdentity.blockReason)
    : isDraftDirty && !draftOutputIdentity.canOutput
      ? projection
      : null;

  return (
    <div className="min-w-0 space-y-2">
      {outputWarning ? (
        <div
          data-settings-output-warning
          role="alert"
          className="rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2.5 text-status-warn-foreground"
        >
          <p className="text-xs font-semibold">
            {savedOutputIdentity.canOutput ? "保存后将暂停客户输出" : "客户输出当前保持关闭"}
          </p>
          <p className="mt-1 text-[11px] leading-4 lg:text-xs lg:leading-4">{outputWarning}</p>
          {recoveryHref ? (
            <Button
              asChild
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 min-h-11 w-full border-status-warn-foreground/30 bg-background sm:w-auto sm:min-h-9"
            >
              <Link href={recoveryHref}>{canUpdateSettings ? "补充店铺资料" : "查看店铺资料"}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2",
          outputWarning ? "justify-end" : "justify-between",
        )}
      >
        {!outputWarning ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MessageSquare className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            预览与消息模板
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:w-auto sm:flex-none"
          onClick={() => setPreview("message")}
        >
          <MessageSquare className="size-3.5" />
          预览客户消息
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:w-auto sm:flex-none"
          onClick={() => setPreview("print")}
        >
          <Printer className="size-3.5" />
          预览打印资料
        </Button>
        <MessageTemplatesAction canReadMessageTemplates={canReadMessageTemplates} />
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent data-settings-preview-dialog closeClassName="size-11 sm:size-8">
          <DialogHeader>
            <DialogTitle>
              {preview === "message"
                ? isDraftDirty
                  ? "未保存草稿 · 客户消息"
                  : "客户消息预览"
                : isDraftDirty
                  ? "未保存草稿 · 打印资料"
                  : "打印资料预览"}
            </DialogTitle>
            <DialogDescription>
              {isDraftDirty
                ? "这是当前草稿的预览；保存后才会影响客户输出。"
                : "这是当前已保存店铺资料生成的预览。"}
            </DialogDescription>
          </DialogHeader>
          {preview === "message" ? (
            <OutputPreview
              title={isDraftDirty ? "未保存草稿 · 客户消息" : "客户消息预览"}
              icon={MessageSquare}
              value={messagePreview}
            />
          ) : preview === "print" ? (
            <OutputPreview
              title={isDraftDirty ? "未保存草稿 · 打印资料" : "打印资料预览"}
              icon={Printer}
              value={printPreview}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
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
        className="max-h-48 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-panel-muted)] p-2.5 text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere] lg:text-xs lg:leading-4"
      >
        {value}
      </pre>
    </div>
  );
}

function MessageTemplatesAction({
  canReadMessageTemplates,
}: Pick<NotificationsSettingsSectionProps, "canReadMessageTemplates">) {
  return canReadMessageTemplates ? (
    <Button
      asChild
      type="button"
      variant="ghost"
      className="min-h-11 shrink-0 px-2 text-xs sm:min-h-9"
      data-settings-message-templates
    >
      <Link href="/messages">
        <MessagesSquare className="size-3.5" aria-hidden="true" />
        打开消息模板
        <ArrowRight className="size-3.5" />
      </Link>
    </Button>
  ) : (
    <Badge
      variant="outline"
      data-settings-message-templates
      className="min-h-11 shrink-0 px-2 text-[10px] lg:min-h-9 lg:text-[11px] lg:leading-4"
    >
      当前账号无模板读取权限
    </Badge>
  );
}
