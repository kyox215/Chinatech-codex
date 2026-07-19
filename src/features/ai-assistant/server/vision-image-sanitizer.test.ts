import { Buffer } from "node:buffer";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { AiInventoryVisionRequest } from "@/features/ai-assistant/model/contracts";
import { sanitizeAiInventoryImageForProvider } from "./vision-image-sanitizer";

describe("server-side AI image sanitizer", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "fully decodes and re-encodes %s as a bounded metadata-free JPEG",
    async (format) => {
      let pipeline = sharp({
        create: { width: 48, height: 32, channels: 3, background: "#3366cc" },
      });
      if (format === "jpeg") pipeline = pipeline.jpeg().withMetadata({ orientation: 6 });
      if (format === "png") pipeline = pipeline.png().withMetadata({ orientation: 6 });
      if (format === "webp") pipeline = pipeline.webp().withMetadata({ orientation: 6 });
      const source = await pipeline.toBuffer();
      const sourceMetadata = await sharp(source).metadata();
      const sanitized = await sanitizeAiInventoryImageForProvider(
        requestFor(
          source,
          format === "jpeg" ? "image/jpeg" : `image/${format}`,
          sourceMetadata.width ?? 48,
          sourceMetadata.height ?? 32,
        ),
      );

      expect(sanitized.mimeType).toBe("image/jpeg");
      expect(sanitized.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(Buffer.from(sanitized.bytes).equals(source)).toBe(false);
      expect(sanitized.width).toBeLessThanOrEqual(2_048);
      expect(sanitized.height).toBeLessThanOrEqual(2_048);
      const metadata = await sharp(sanitized.bytes).metadata();
      expect(metadata.format).toBe("jpeg");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    },
  );

  it("rejects truncated/corrupt input instead of forwarding client bytes", async () => {
    const valid = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();
    const truncated = valid.subarray(0, Math.max(20, Math.floor(valid.length / 3)));
    await expect(
      sanitizeAiInventoryImageForProvider(requestFor(truncated, "image/jpeg", 20, 20)),
    ).rejects.toMatchObject({ name: "AiVisionInputValidationError" });
  });

  it("rejects decoded images above the 16 MP trust boundary", async () => {
    const source = await sharp({
      create: { width: 4_001, height: 4_000, channels: 3, background: "white" },
    })
      .jpeg({ quality: 10 })
      .toBuffer();
    await expect(
      sanitizeAiInventoryImageForProvider(requestFor(source, "image/jpeg", 4_001, 4_000)),
    ).rejects.toMatchObject({ name: "AiVisionInputValidationError" });
  });
});

function requestFor(
  bytes: Uint8Array,
  mimeType: AiInventoryVisionRequest["mime_type"],
  width: number,
  height: number,
): AiInventoryVisionRequest {
  return {
    client_request_id: "00000000-0000-4000-8000-000000000001",
    image_data_url: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
    mime_type: mimeType,
    byte_length: bytes.length,
    width,
    height,
    locale: "zh-CN",
  };
}
