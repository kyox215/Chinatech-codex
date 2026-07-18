import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import type { AiInventoryVisionRequest } from "@/features/ai-assistant/model/contracts";
import { validateAiInventoryVisionInput } from "./vision-input";

describe("AI vision derived-image validation", () => {
  it("accepts a canonical bounded JPEG whose dimensions and length match", () => {
    const input = requestFor(jpeg(3, 2), { width: 3, height: 2 });
    expect(validateAiInventoryVisionInput(input)).toMatchObject({
      byteLength: input.byte_length,
      dimensions: { width: 3, height: 2 },
      detectedMime: "image/jpeg",
    });
  });

  it.each([
    [
      "byte length",
      (input: AiInventoryVisionRequest) => ({ ...input, byte_length: input.byte_length + 1 }),
    ],
    ["dimensions", (input: AiInventoryVisionRequest) => ({ ...input, width: input.width + 1 })],
    [
      "MIME prefix",
      (input: AiInventoryVisionRequest) => ({ ...input, mime_type: "image/png" as const }),
    ],
    [
      "non-canonical base64",
      (input: AiInventoryVisionRequest) => ({
        ...input,
        image_data_url: input.image_data_url.replace(/=$/, ""),
      }),
    ],
  ])("rejects mismatched %s claims", (_label, mutate) => {
    expect(() => validateAiInventoryVisionInput(mutate(requestFor(jpeg(3, 2))))).toThrowError(
      expect.objectContaining({ name: "AiVisionInputValidationError" }),
    );
  });

  it("rejects animated PNG content even when the envelope claims matching dimensions", () => {
    const bytes = png(2, 2, true);
    const input = requestFor(bytes, { mime_type: "image/png", width: 2, height: 2 });
    expect(() => validateAiInventoryVisionInput(input)).toThrowError(
      expect.objectContaining({ name: "AiVisionInputValidationError" }),
    );
  });
});

function requestFor(
  bytes: Uint8Array,
  overrides: Partial<AiInventoryVisionRequest> = {},
): AiInventoryVisionRequest {
  const mimeType = overrides.mime_type ?? "image/jpeg";
  return {
    image_data_url: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
    mime_type: mimeType,
    byte_length: bytes.length,
    width: 3,
    height: 2,
    locale: "zh-CN",
    ...overrides,
  };
}

function jpeg(width: number, height: number) {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x07,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0xff,
    0xd9,
  ]);
}

function png(width: number, height: number, animated: boolean) {
  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Uint8Array.from([
    (width >>> 24) & 0xff,
    (width >>> 16) & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    (height >>> 24) & 0xff,
    (height >>> 16) & 0xff,
    (height >>> 8) & 0xff,
    height & 0xff,
  ]);
  return concat(
    signature,
    pngChunk("IHDR", ihdrData),
    ...(animated ? [pngChunk("acTL", new Uint8Array())] : []),
    pngChunk("IEND", new Uint8Array()),
  );
}

function pngChunk(type: string, data: Uint8Array) {
  const length = Uint8Array.from([
    (data.length >>> 24) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 8) & 0xff,
    data.length & 0xff,
  ]);
  return concat(length, ascii(type), data, new Uint8Array(4));
}

function ascii(value: string) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function concat(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
