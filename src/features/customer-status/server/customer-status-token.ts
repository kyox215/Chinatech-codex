import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "v2";
const TOKEN_CONTEXT = "repairdesk-customer-status:v2";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StableCustomerStatusIdentity {
  publicId: string;
  generation: number;
  keyVersion: number;
}

export function getActiveCustomerStatusKeyVersion() {
  const value = Number(process.env.CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION);
  if (!Number.isSafeInteger(value) || value < 1 || value > 32_767) {
    throw new Error("固定订单二维码签名版本未配置");
  }
  getCustomerStatusSigningKey(value);
  return value;
}

export function createStableCustomerStatusToken(identity: StableCustomerStatusIdentity) {
  assertIdentity(identity);
  const publicId = identity.publicId.toLowerCase();
  const locator = uuidToBase64Url(publicId);
  const keyVersion = identity.keyVersion.toString(36);
  const generation = identity.generation.toString(36);
  const signature = createHmac("sha256", getCustomerStatusSigningKey(identity.keyVersion))
    .update(canonicalPayload(publicId, identity.generation, identity.keyVersion))
    .digest("base64url");
  return `${TOKEN_PREFIX}.${keyVersion}.${locator}.${generation}.${signature}`;
}

export function parseAndVerifyStableCustomerStatusToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== TOKEN_PREFIX) return null;
  const keyVersion = parseBase36Integer(parts[1]);
  const publicId = base64UrlToUuid(parts[2]);
  const generation = parseBase36Integer(parts[3]);
  const receivedSignature = decodeBase64Url(parts[4], 32);
  if (!keyVersion || !publicId || !generation || !receivedSignature) return null;

  let key: Buffer;
  try {
    key = getCustomerStatusSigningKey(keyVersion);
  } catch {
    return null;
  }
  const expectedSignature = createHmac("sha256", key)
    .update(canonicalPayload(publicId, generation, keyVersion))
    .digest();
  if (!timingSafeEqual(expectedSignature, receivedSignature)) return null;
  return { publicId, generation, keyVersion } satisfies StableCustomerStatusIdentity;
}

function canonicalPayload(publicId: string, generation: number, keyVersion: number) {
  return `${TOKEN_CONTEXT}|${keyVersion}|${publicId}|${generation}`;
}

function getCustomerStatusSigningKey(version: number) {
  const raw = process.env.CUSTOMER_STATUS_QR_HMAC_KEYS?.trim();
  if (!raw) throw new Error("固定订单二维码签名密钥未配置");
  let keyring: unknown;
  try {
    keyring = JSON.parse(raw);
  } catch {
    throw new Error("固定订单二维码签名密钥格式无效");
  }
  if (!keyring || typeof keyring !== "object" || Array.isArray(keyring)) {
    throw new Error("固定订单二维码签名密钥格式无效");
  }
  const encoded = (keyring as Record<string, unknown>)[String(version)];
  if (typeof encoded !== "string") throw new Error("固定订单二维码签名版本不可用");
  const key = decodeBase64Url(encoded, undefined);
  if (!key || key.length < 32) throw new Error("固定订单二维码签名密钥强度不足");
  return key;
}

function assertIdentity(identity: StableCustomerStatusIdentity) {
  if (
    !UUID_PATTERN.test(identity.publicId) ||
    !Number.isSafeInteger(identity.generation) ||
    identity.generation < 1 ||
    !Number.isSafeInteger(identity.keyVersion) ||
    identity.keyVersion < 1
  ) {
    throw new Error("固定订单二维码身份无效");
  }
}

function uuidToBase64Url(uuid: string) {
  return Buffer.from(uuid.replaceAll("-", ""), "hex").toString("base64url");
}

function base64UrlToUuid(value: string) {
  const bytes = decodeBase64Url(value, 16);
  if (!bytes) return null;
  const hex = bytes.toString("hex");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID_PATTERN.test(uuid) ? uuid : null;
}

function decodeBase64Url(value: string, exactLength?: number) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value || (exactLength && bytes.length !== exactLength)) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

function parseBase36Integer(value: string) {
  if (!/^[1-9a-z][0-9a-z]*$/.test(value)) return null;
  const parsed = Number.parseInt(value, 36);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
