export type AttachmentDraftKind =
  | "device_front"
  | "device_back"
  | "screen_on"
  | "fault_photo"
  | "signature"
  | "other";

export interface AttachmentDraft {
  id: string;
  kind: AttachmentDraftKind;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export const attachmentAccept = "image/*,.pdf";
export const attachmentMaxBytes = 8 * 1024 * 1024;

export const attachmentKindLabels: Record<AttachmentDraftKind, string> = {
  device_front: "正面",
  device_back: "背面",
  screen_on: "亮屏",
  fault_photo: "故障",
  signature: "签名",
  other: "其他",
};

export function validateAttachmentFile(file: File) {
  if (file.size > attachmentMaxBytes) {
    return `文件不能超过 ${Math.round(attachmentMaxBytes / 1024 / 1024)}MB。`;
  }

  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return "仅支持图片或 PDF。";
  }

  return undefined;
}

export function createAttachmentDraft(
  file: File,
  kind: AttachmentDraftKind = "other",
): AttachmentDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
  };
}

export function revokeAttachmentDraft(draft: AttachmentDraft) {
  URL.revokeObjectURL(draft.previewUrl);
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
