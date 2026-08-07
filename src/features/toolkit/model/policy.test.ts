import { describe, expect, it } from "vitest";

import {
  assertToolkitFileHeader,
  assertToolkitFileMetadata,
  isToolkitFilePublicationAllowed,
  normalizeToolkitHttpsUrl,
  normalizeToolkitFileName,
} from "./policy";

describe("toolkit file policy", () => {
  it("accepts only the explicit extension allowlist and matching metadata", () => {
    expect(normalizeToolkitFileName("RepairDesk.pdf")).toBe("RepairDesk.pdf");
    expect(() => normalizeToolkitFileName("../../payload.sh")).toThrow();
    expect(() =>
      assertToolkitFileMetadata({
        title: "工具",
        description: "",
        platform: "",
        version: "",
        fileName: "tool.pdf",
        mimeType: "application/zip",
        sizeBytes: 1,
      }),
    ).toThrow("媒体类型");
  });

  it("rejects private or credential-bearing HTTPS links", () => {
    expect(normalizeToolkitHttpsUrl("https://www.example.com/tool")).toBe(
      "https://www.example.com/tool",
    );
    for (const url of [
      "http://www.example.com",
      "https://user:pass@example.com/tool",
      "https://example.com/tool?token=secret",
      "https://example.com/tool#fragment",
      "https://localhost/tool",
      "https://127.0.0.1/tool",
      "https://192.168.1.5/tool",
      "https://[::1]/tool",
    ]) {
      expect(() => normalizeToolkitHttpsUrl(url)).toThrow();
    }
  });

  it("checks reliable magic bytes before file publication", () => {
    expect(() =>
      assertToolkitFileHeader("tool.pdf", new TextEncoder().encode("%PDF-1.7")),
    ).not.toThrow();
    expect(() =>
      assertToolkitFileHeader("tool.pdf", new TextEncoder().encode("not pdf")),
    ).toThrow();
    expect(() =>
      assertToolkitFileHeader("tool.msi", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])),
    ).not.toThrow();
    expect(() => assertToolkitFileHeader("tool.msi", new Uint8Array([0x4d, 0x5a]))).toThrow();
  });

  it("keeps hosted files fail-closed until a scanner marks them clean", () => {
    expect(
      isToolkitFilePublicationAllowed({
        securityReviewState: "pending",
        provenanceNote: "owner review",
        trustAttestation: true,
      }),
    ).toBe(false);
    expect(
      isToolkitFilePublicationAllowed({
        securityReviewState: "clean",
      }),
    ).toBe(true);
  });
});
