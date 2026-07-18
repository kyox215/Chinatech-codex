import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_ORIGINAL_BYTES,
  AiInventoryImageError,
  detectAiInventoryImageMime,
  inspectAiInventoryImage,
  isAnimatedAiInventoryImage,
  prepareAiInventoryImage,
  type AiInventoryImageRuntime,
} from "./inventory-image";

const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("AI inventory image preparation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("accepts only matching JPEG, PNG and WebP magic signatures", async () => {
    const jpegBytes = jpegFile(2, 2);
    const pngBytes = concat(pngSignature, pngChunk("IEND"));
    const webpBytes = webpFile("VP8 ");

    expect(detectAiInventoryImageMime(jpegBytes)).toBe("image/jpeg");
    expect(detectAiInventoryImageMime(pngBytes)).toBe("image/png");
    expect(detectAiInventoryImageMime(webpBytes)).toBe("image/webp");
    await expect(inspectAiInventoryImage(file(jpegBytes, "image/jpeg"))).resolves.toMatchObject({
      mimeType: "image/jpeg",
    });
    await expect(inspectAiInventoryImage(file(pngBytes, "image/jpeg"))).rejects.toMatchObject({
      code: "mime_mismatch",
    });
    await expect(
      inspectAiInventoryImage(file(new Uint8Array([1, 2, 3]), "image/png")),
    ).rejects.toMatchObject({ code: "unsupported_type" });
  });

  it("rejects APNG and animated WebP markers before browser decode", async () => {
    const apngBytes = concat(pngSignature, pngChunk("acTL"), pngChunk("IEND"));
    const animatedWebpBytes = webpFile("ANIM");

    expect(isAnimatedAiInventoryImage(apngBytes, "image/png")).toBe(true);
    expect(isAnimatedAiInventoryImage(animatedWebpBytes, "image/webp")).toBe(true);
    await expect(inspectAiInventoryImage(file(apngBytes, "image/png"))).rejects.toMatchObject({
      code: "animated",
    });
    await expect(
      inspectAiInventoryImage(file(animatedWebpBytes, "image/webp")),
    ).rejects.toMatchObject({ code: "animated" });
  });

  it("rejects empty and over-4-MiB originals before decode", async () => {
    await expect(
      inspectAiInventoryImage(file(new Uint8Array(), "image/jpeg")),
    ).rejects.toMatchObject({ code: "empty" });
    const oversized = new File(
      [new Uint8Array(AI_INVENTORY_IMAGE_MAX_ORIGINAL_BYTES + 1)],
      "ignored.jpg",
      { type: "image/jpeg" },
    );
    await expect(inspectAiInventoryImage(oversized)).rejects.toMatchObject({ code: "too_large" });
  });

  it("rejects oversized JPEG, PNG and WebP headers before browser decode", async () => {
    for (const [bytes, mime] of [
      [jpegFile(4097, 1000), "image/jpeg"],
      [pngFile(1000, 20_000), "image/png"],
      [webpVp8xFile(5000, 5000), "image/webp"],
    ] as const) {
      const harness = runtimeHarness({ width: 1, height: 1 });
      await expect(
        prepareAiInventoryImage(file(bytes, mime), harness.runtime),
      ).rejects.toMatchObject({ code: "dimensions" });
      expect(harness.decode).not.toHaveBeenCalled();
    }
  });

  it("validates decoded dimensions and always disposes the decoded source", async () => {
    const harness = runtimeHarness({ width: 4097, height: 1000 });
    await expect(
      prepareAiInventoryImage(file(jpegFile(3000, 1500), "image/jpeg"), harness.runtime),
    ).rejects.toMatchObject({ code: "dimensions" });
    expect(harness.disposeDecoded).toHaveBeenCalledOnce();
    expect(harness.createCanvas).not.toHaveBeenCalled();
  });

  it("re-encodes to a capped metadata-free JPEG and revokes preview URLs once", async () => {
    const harness = runtimeHarness({
      width: 3000,
      height: 1500,
      blobSizes: [AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES + 1, 48_000],
    });
    const prepared = await prepareAiInventoryImage(
      file(jpegFile(3000, 1500), "image/jpeg"),
      harness.runtime,
    );

    expect(prepared).toMatchObject({
      mimeType: "image/jpeg",
      byteLength: 48_000,
      width: 2048,
      height: 1024,
      previewUrl: "blob:safe-derived-image",
    });
    expect(prepared.blob).not.toBeInstanceOf(File);
    expect(harness.drawImage).toHaveBeenCalledTimes(2);
    expect(harness.disposeDecoded).toHaveBeenCalledOnce();
    prepared.dispose();
    prepared.dispose();
    expect(harness.revokeObjectUrl).toHaveBeenCalledOnce();
    expect(harness.revokeObjectUrl).toHaveBeenCalledWith("blob:safe-derived-image");
  });

  it("returns a typed safe error when every derived encoding remains too large", async () => {
    const harness = runtimeHarness({
      width: 1600,
      height: 1200,
      blobSizes: Array(7).fill(AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES + 1),
    });
    const operation = prepareAiInventoryImage(
      file(jpegFile(1600, 1200), "image/jpeg"),
      harness.runtime,
    );
    await expect(operation).rejects.toBeInstanceOf(AiInventoryImageError);
    await expect(operation).rejects.toMatchObject({ code: "derived_too_large" });
    expect(harness.disposeDecoded).toHaveBeenCalledOnce();
  });
});

function file(bytes: Uint8Array, type: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new File([buffer], "ignored-name.bin", { type });
}

function concat(...parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function ascii(value: string) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function pngChunk(type: string) {
  return concat(new Uint8Array(4), ascii(type), new Uint8Array(4));
}

function webpFile(chunkType: string) {
  const chunk = concat(ascii(chunkType), new Uint8Array(4));
  return concat(ascii("RIFF"), new Uint8Array([12, 0, 0, 0]), ascii("WEBP"), chunk);
}

function jpegFile(width: number, height: number) {
  const segment = new Uint8Array(17);
  segment[0] = 0;
  segment[1] = 17;
  segment[2] = 8;
  segment[3] = (height >> 8) & 0xff;
  segment[4] = height & 0xff;
  segment[5] = (width >> 8) & 0xff;
  segment[6] = width & 0xff;
  segment[7] = 3;
  return concat(new Uint8Array([0xff, 0xd8, 0xff, 0xc0]), segment, new Uint8Array([0xff, 0xd9]));
}

function pngFile(width: number, height: number) {
  const dimensions = new Uint8Array(8);
  dimensions[0] = (width >>> 24) & 0xff;
  dimensions[1] = (width >>> 16) & 0xff;
  dimensions[2] = (width >>> 8) & 0xff;
  dimensions[3] = width & 0xff;
  dimensions[4] = (height >>> 24) & 0xff;
  dimensions[5] = (height >>> 16) & 0xff;
  dimensions[6] = (height >>> 8) & 0xff;
  dimensions[7] = height & 0xff;
  return concat(
    pngSignature,
    new Uint8Array([0, 0, 0, 13]),
    ascii("IHDR"),
    dimensions,
    new Uint8Array(9),
    pngChunk("IEND"),
  );
}

function webpVp8xFile(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set(ascii("RIFF"), 0);
  bytes.set(ascii("WEBP"), 8);
  bytes.set(ascii("VP8X"), 12);
  bytes[16] = 10;
  writeUint24LittleEndian(bytes, 24, width - 1);
  writeUint24LittleEndian(bytes, 27, height - 1);
  return bytes;
}

function writeUint24LittleEndian(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

function runtimeHarness({
  width,
  height,
  blobSizes = [48_000],
}: {
  width: number;
  height: number;
  blobSizes?: number[];
}) {
  const disposeDecoded = vi.fn();
  const createCanvas = vi.fn();
  const drawImage = vi.fn();
  const revokeObjectUrl = vi.fn();
  const decode = vi.fn().mockResolvedValue({
    source: {} as CanvasImageSource,
    width,
    height,
    dispose: disposeDecoded,
  });
  let encodeIndex = 0;
  const runtime: AiInventoryImageRuntime = {
    decode,
    createCanvas: (canvasWidth, canvasHeight) => {
      createCanvas(canvasWidth, canvasHeight);
      return {
        width: canvasWidth,
        height: canvasHeight,
        getContext: () => ({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage,
        }),
        toBlob: (callback: BlobCallback) => {
          const size = blobSizes[Math.min(encodeIndex, blobSizes.length - 1)] ?? 0;
          encodeIndex += 1;
          callback(new Blob([new Uint8Array(size)], { type: "image/jpeg" }));
        },
      } as unknown as HTMLCanvasElement;
    },
    createObjectUrl: vi.fn(() => "blob:safe-derived-image"),
    revokeObjectUrl,
  };
  return { runtime, decode, disposeDecoded, createCanvas, drawImage, revokeObjectUrl };
}
