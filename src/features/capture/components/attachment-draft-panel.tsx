"use client";

import { useRef } from "react";
import { Camera, FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  attachmentAccept,
  attachmentKindLabels,
  createAttachmentDraft,
  formatAttachmentSize,
  revokeAttachmentDraft,
  validateAttachmentFile,
  type AttachmentDraft,
  type AttachmentDraftKind,
} from "@/features/capture/model/attachment-rules";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

interface AttachmentDraftPanelProps {
  attachments: AttachmentDraft[];
  onChange: (attachments: AttachmentDraft[]) => void;
  onOpenCamera?: () => void;
  defaultKind?: AttachmentDraftKind;
  className?: string;
}

export function AttachmentDraftPanel({
  attachments,
  onChange,
  onOpenCamera,
  defaultKind = "other",
  className,
}: AttachmentDraftPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (files: FileList | File[]) => {
    const next: AttachmentDraft[] = [];

    for (const file of Array.from(files)) {
      const error = validateAttachmentFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }
      next.push(createAttachmentDraft(file, defaultKind));
    }

    if (next.length > 0) {
      onChange([...attachments, ...next]);
      toast.success(`已加入 ${next.length} 个附件草稿`);
    }
  };

  const remove = (id: string) => {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed) revokeAttachmentDraft(removed);
    onChange(attachments.filter((attachment) => attachment.id !== id));
  };

  return (
    <section className={cn(componentOverlay.flatSection, "space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={attachmentAccept}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Paperclip className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">附件草稿</h3>
            <p className="truncate text-xs text-muted-foreground">
              {attachments.length > 0 ? `${attachments.length} 个待处理附件` : "暂无附件"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {onOpenCamera ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenCamera}>
              <Camera className="mr-1.5 size-3.5" />
              拍照
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 size-3.5" />
            选择
          </Button>
        </div>
      </div>

      {attachments.length > 0 ? (
        <ul className="grid gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2"
            >
              <AttachmentPreviewIcon attachment={attachment} />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{attachment.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {attachmentKindLabels[attachment.kind]} · {formatAttachmentSize(attachment.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => remove(attachment.id)}
                aria-label={`删除附件 ${attachment.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-[var(--border-panel)] px-3 py-4 text-center text-xs text-muted-foreground">
          可添加设备外观、故障位置、签名或凭证图片。
        </div>
      )}
    </section>
  );
}

function AttachmentPreviewIcon({ attachment }: { attachment: AttachmentDraft }) {
  if (attachment.mimeType.startsWith("image/")) {
    return (
      <span className="relative size-10 overflow-hidden rounded-md border border-[var(--border-panel)] bg-muted">
        <img src={attachment.previewUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }

  if (attachment.mimeType === "application/pdf") {
    return (
      <span className="grid size-10 place-items-center rounded-md bg-status-info text-status-info-foreground">
        <FileText className="size-4" />
      </span>
    );
  }

  return (
    <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
      <ImageIcon className="size-4" />
    </span>
  );
}
