export const aiInventoryImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type AiInventoryImageMimeType = (typeof aiInventoryImageMimeTypes)[number];

export function detectAiInventoryImageMime(bytes: Uint8Array): AiInventoryImageMimeType | null {
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function isAnimatedAiInventoryImage(bytes: Uint8Array, mimeType: AiInventoryImageMimeType) {
  if (mimeType === "image/png") return pngHasAnimationControl(bytes);
  if (mimeType === "image/webp") return webpHasAnimation(bytes);
  return false;
}

export function readAiInventoryImageDimensions(
  bytes: Uint8Array,
  mimeType: AiInventoryImageMimeType,
) {
  if (mimeType === "image/png") return readPngDimensions(bytes);
  if (mimeType === "image/webp") return readWebpDimensions(bytes);
  return readJpegDimensions(bytes);
}

function hasBytes(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  if (start < 0 || start + length > bytes.length) return "";
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function readUint16BigEndian(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function readPngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  return width && height ? { width, height } : null;
}

function readJpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const length = readUint16BigEndian(bytes, offset);
    if (length === null || length < 2 || offset + length > bytes.length) return null;
    if (isJpegStartOfFrame(marker) && length >= 7) {
      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      return width && height ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

function isJpegStartOfFrame(marker: number) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  );
}

function readWebpDimensions(bytes: Uint8Array) {
  const type = ascii(bytes, 12, 4);
  if (type === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + readUint24LittleEndian(bytes, 24),
      height: 1 + readUint24LittleEndian(bytes, 27),
    };
  }
  if (
    type === "VP8 " &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
    };
  }
  if (type === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21]! | ((bytes[22]! & 0x3f) << 8)),
      height: 1 + ((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10)),
    };
  }
  return null;
}

function pngHasAnimationControl(bytes: Uint8Array) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BigEndian(bytes, offset);
    if (length === null) return false;
    const type = ascii(bytes, offset + 4, 4);
    if (type === "acTL") return true;
    const nextOffset = offset + 12 + length;
    if (nextOffset <= offset || nextOffset > bytes.length) return false;
    if (type === "IEND") return false;
    offset = nextOffset;
  }
  return false;
}

function webpHasAnimation(bytes: Uint8Array) {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = readUint32LittleEndian(bytes, offset + 4);
    if (length === null) return false;
    const dataOffset = offset + 8;
    if (type === "ANIM" || type === "ANMF") return true;
    if (type === "VP8X" && dataOffset < bytes.length && ((bytes[dataOffset] ?? 0) & 0x02) !== 0) {
      return true;
    }
    const paddedLength = length + (length % 2);
    const nextOffset = dataOffset + paddedLength;
    if (nextOffset <= offset || nextOffset > bytes.length) return false;
    offset = nextOffset;
  }
  return false;
}
