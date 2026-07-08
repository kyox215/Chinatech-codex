import { describe, expect, it } from "vitest";

import {
  attachmentMaxBytes,
  formatAttachmentSize,
  validateAttachmentFile,
} from "./attachment-rules";

function fileOf(size: number, type: string) {
  return new File([new Uint8Array(size)], "test.bin", { type });
}

describe("attachment-rules", () => {
  it("accepts images and PDF files", () => {
    expect(validateAttachmentFile(fileOf(1024, "image/jpeg"))).toBeUndefined();
    expect(validateAttachmentFile(fileOf(1024, "application/pdf"))).toBeUndefined();
  });

  it("rejects oversized files", () => {
    expect(validateAttachmentFile(fileOf(attachmentMaxBytes + 1, "image/png"))).toContain(
      "不能超过",
    );
  });

  it("rejects unsupported mime types", () => {
    expect(validateAttachmentFile(fileOf(1024, "text/plain"))).toBe("仅支持图片或 PDF。");
  });

  it("formats file sizes", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
