import { Buffer } from "node:buffer";

import sharp from "sharp";

import type { AiInventoryVisionRequest } from "@/features/ai-assistant/model/contracts";
import {
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_PIXELS,
} from "@/features/ai-assistant/model/inventory-image-policy";
import { AiVisionInputValidationError, validateAiInventoryVisionInput } from "./vision-input";

const AI_PROVIDER_IMAGE_MAX_EDGE = 2_048;

export type SanitizedAiInventoryImage = {
  bytes: Uint8Array;
  dataUrl: string;
  mimeType: "image/jpeg";
  byteLength: number;
  width: number;
  height: number;
};

/**
 * Treat browser-derived image bytes as untrusted. Fully decode a single static
 * frame, apply orientation, flatten transparency, bound dimensions and encode
 * a fresh JPEG without metadata before the budget fingerprint/provider call.
 */
export async function sanitizeAiInventoryImageForProvider(
  input: AiInventoryVisionRequest,
): Promise<SanitizedAiInventoryImage> {
  try {
    validateAiInventoryVisionInput(input);
    const prefix = `data:${input.mime_type};base64,`;
    const source = Buffer.from(input.image_data_url.slice(prefix.length), "base64");
    const image = sharp(source, {
      animated: false,
      failOn: "warning",
      limitInputPixels: AI_INVENTORY_IMAGE_MAX_PIXELS,
      pages: 1,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1 ||
      metadata.width * metadata.height > AI_INVENTORY_IMAGE_MAX_PIXELS ||
      !["jpeg", "png", "webp"].includes(metadata.format ?? "")
    ) {
      throw new AiVisionInputValidationError();
    }

    const { data, info } = await image
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: AI_PROVIDER_IMAGE_MAX_EDGE,
        height: AI_PROVIDER_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 86, chromaSubsampling: "4:2:0", force: true })
      .toBuffer({ resolveWithObject: true });

    if (
      data.length === 0 ||
      data.length > AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES ||
      info.width < 1 ||
      info.height < 1 ||
      info.width > AI_PROVIDER_IMAGE_MAX_EDGE ||
      info.height > AI_PROVIDER_IMAGE_MAX_EDGE
    ) {
      throw new AiVisionInputValidationError();
    }

    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return {
      bytes,
      dataUrl: `data:image/jpeg;base64,${data.toString("base64")}`,
      mimeType: "image/jpeg",
      byteLength: data.length,
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof AiVisionInputValidationError) throw error;
    throw new AiVisionInputValidationError();
  }
}
