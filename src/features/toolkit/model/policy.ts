import type {
  ToolkitFilePrepareInput,
  ToolkitSecurityReviewState,
} from "@/features/toolkit/model/contracts";

export const TOOLKIT_FILE_MAX_BYTES = 200 * 1024 * 1024;
export const TOOLKIT_FILE_BUCKET = "repairdesk-toolkit-files";
export const TOOLKIT_DOWNLOAD_TTL_SECONDS = 60;

const extensionMimeTypes: Record<string, readonly string[]> = {
  ".zip": ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
  ".7z": ["application/x-7z-compressed", "application/octet-stream"],
  ".rar": ["application/vnd.rar", "application/x-rar-compressed", "application/octet-stream"],
  ".exe": [
    "application/vnd.microsoft.portable-executable",
    "application/x-msdownload",
    "application/octet-stream",
  ],
  ".msi": ["application/x-msi", "application/octet-stream"],
  ".dmg": ["application/x-apple-diskimage", "application/octet-stream"],
  ".pkg": ["application/octet-stream", "application/x-newton-compatible-pkg"],
  ".apk": ["application/vnd.android.package-archive", "application/octet-stream"],
  ".deb": [
    "application/vnd.debian.binary-package",
    "application/x-deb",
    "application/octet-stream",
  ],
  ".pdf": ["application/pdf"],
};

export const TOOLKIT_ALLOWED_EXTENSIONS = Object.freeze(Object.keys(extensionMimeTypes));

export class ToolkitPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolkitPolicyError";
  }
}

export function normalizeToolkitText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new ToolkitPolicyError(`${field}格式无效`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new ToolkitPolicyError(`${field}不能为空且不能超过 ${maxLength} 个字符`);
  }
  if (hasToolkitControlCharacters(normalized))
    throw new ToolkitPolicyError(`${field}包含不可用字符`);
  return normalized;
}

export function normalizeToolkitFileName(value: unknown) {
  const name = normalizeToolkitText(value, "文件名", 160);
  if (/[\\/]/.test(name) || hasToolkitControlCharacters(name)) {
    throw new ToolkitPolicyError("文件名不能包含路径分隔符或控制字符");
  }
  const extension = toolkitFileExtension(name);
  if (!extension || !TOOLKIT_ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ToolkitPolicyError("文件类型不在允许的工具集白名单内");
  }
  if (/\.\./.test(name) || /\.{2,}$/.test(name)) {
    throw new ToolkitPolicyError("文件名格式无效");
  }
  return name;
}

export function toolkitFileExtension(fileName: string) {
  const match = /\.[^./\\\s]+$/.exec(fileName.trim().toLowerCase());
  return match?.[0] ?? "";
}

export function assertToolkitFileMetadata(input: ToolkitFilePrepareInput) {
  const fileName = normalizeToolkitFileName(input.fileName);
  const mimeType = typeof input.mimeType === "string" ? input.mimeType.trim().toLowerCase() : "";
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > TOOLKIT_FILE_MAX_BYTES) {
    throw new ToolkitPolicyError("文件大小必须在 1 字节到 200 MiB 之间");
  }
  const allowedMimeTypes = extensionMimeTypes[toolkitFileExtension(fileName)] ?? [];
  if (!allowedMimeTypes.includes(mimeType))
    throw new ToolkitPolicyError("文件媒体类型与扩展名不匹配");
  return { fileName, mimeType, sizeBytes };
}

export function assertToolkitStorageMetadata({
  fileName,
  mimeType,
  sizeBytes,
  storageSizeBytes,
  storageMimeType,
  header,
}: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageSizeBytes: number;
  storageMimeType?: string | null;
  header: Uint8Array;
}) {
  const expected = assertToolkitFileMetadata({
    title: "文件",
    description: "",
    platform: "",
    version: "",
    fileName,
    mimeType,
    sizeBytes,
  });
  if (storageSizeBytes !== expected.sizeBytes || storageSizeBytes < 1) {
    throw new ToolkitPolicyError("存储文件大小与上传元数据不一致");
  }
  if (storageSizeBytes > TOOLKIT_FILE_MAX_BYTES)
    throw new ToolkitPolicyError("存储文件超过 200 MiB 限制");
  if (storageMimeType && !mimeTypeCompatible(expected.mimeType, storageMimeType)) {
    throw new ToolkitPolicyError("存储媒体类型与上传元数据不一致");
  }
  assertToolkitFileHeader(expected.fileName, header);
  return expected;
}

export function assertToolkitFileHeader(fileName: string, header: Uint8Array) {
  const extension = toolkitFileExtension(fileName);
  const startsWith = (bytes: number[]) => bytes.every((value, index) => header[index] === value);
  const hasAscii = (value: string) =>
    new TextDecoder().decode(header.slice(0, value.length)) === value;
  const valid =
    extension === ".zip" || extension === ".apk"
      ? startsWith([0x50, 0x4b])
      : extension === ".7z"
        ? startsWith([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
        : extension === ".rar"
          ? startsWith([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])
          : extension === ".exe" || extension === ".msi"
            ? extension === ".exe"
              ? startsWith([0x4d, 0x5a])
              : startsWith([0xd0, 0xcf, 0x11, 0xe0])
            : extension === ".pdf"
              ? hasAscii("%PDF-")
              : extension === ".deb"
                ? hasAscii("!<arch>")
                : extension === ".dmg"
                  ? containsAscii(header, "koly")
                  : extension === ".pkg"
                    ? hasAscii("xar!")
                    : false;
  if (!valid) throw new ToolkitPolicyError("文件头与扩展名不匹配");
}

export function normalizeToolkitHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new ToolkitPolicyError("工具链接不能为空");
  const raw = value.trim();
  if (hasToolkitControlCharacters(raw)) throw new ToolkitPolicyError("工具链接包含不可用字符");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ToolkitPolicyError("工具链接格式无效");
  }
  if (/[?#]/.test(raw) || url.search || url.hash) {
    throw new ToolkitPolicyError("工具链接不能包含查询参数或片段");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    throw new ToolkitPolicyError("工具链接必须是不带账号信息的 HTTPS 地址");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isBlockedToolkitHost(hostname)) throw new ToolkitPolicyError("工具链接目标主机不受支持");
  url.hostname = hostname;
  return url.toString();
}

export function isToolkitFilePublicationAllowed({
  securityReviewState,
  provenanceNote,
  trustAttestation,
}: {
  securityReviewState: ToolkitSecurityReviewState;
  provenanceNote?: string | null;
  trustAttestation?: boolean | null;
}) {
  return securityReviewState === "clean";
}

function mimeTypeCompatible(expected: string, actual: string) {
  return expected === actual || actual === "application/octet-stream";
}

function isBlockedToolkitHost(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "local")
    return true;
  if (isIpv4Literal(hostname)) {
    const octets = hostname.split(".").map(Number);
    return (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      octets[0] === 0
    );
  }
  if (!hostname.includes(":")) return false;
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isIpv4Literal(value: string) {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
  );
}

function containsAscii(bytes: Uint8Array, value: string) {
  const needle = new TextEncoder().encode(value);
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

function hasToolkitControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
}
