import { Buffer } from "node:buffer";

import type { AiInventoryVisionRequest } from "@/features/ai-assistant/model/contracts";
import {
  detectAiInventoryImageMime,
  isAnimatedAiInventoryImage,
  readAiInventoryImageDimensions,
} from "@/features/ai-assistant/model/inventory-image-format";
import {
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_EDGE,
  AI_INVENTORY_IMAGE_MAX_PIXELS,
} from "@/features/ai-assistant/model/inventory-image-policy";

export class AiVisionInputValidationError extends Error {
  constructor() {
    super("invalid derived image");
    this.name = "AiVisionInputValidationError";
  }
}

export function validateAiInventoryVisionInput(input: AiInventoryVisionRequest) {
  const prefix = `data:${input.mime_type};base64,`;
  if (!input.image_data_url.startsWith(prefix)) throw new AiVisionInputValidationError();
  const encoded = input.image_data_url.slice(prefix.length);
  if (!isCanonicalBase64(encoded)) throw new AiVisionInputValidationError();

  const buffer = Buffer.from(encoded, "base64");
  if (
    buffer.length === 0 ||
    buffer.length > AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES ||
    buffer.length !== input.byte_length ||
    buffer.toString("base64") !== encoded
  ) {
    throw new AiVisionInputValidationError();
  }

  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const detectedMime = detectAiInventoryImageMime(bytes);
  if (detectedMime !== input.mime_type) throw new AiVisionInputValidationError();
  if (isAnimatedAiInventoryImage(bytes, detectedMime)) throw new AiVisionInputValidationError();

  const dimensions = readAiInventoryImageDimensions(bytes, detectedMime);
  if (
    !dimensions ||
    dimensions.width !== input.width ||
    dimensions.height !== input.height ||
    dimensions.width > AI_INVENTORY_IMAGE_MAX_EDGE ||
    dimensions.height > AI_INVENTORY_IMAGE_MAX_EDGE ||
    dimensions.width * dimensions.height > AI_INVENTORY_IMAGE_MAX_PIXELS
  ) {
    throw new AiVisionInputValidationError();
  }

  return { byteLength: buffer.length, dimensions, detectedMime };
}

function isCanonicalBase64(value: string) {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
