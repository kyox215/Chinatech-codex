import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

import {
  aiOrderSearchArgumentsSchema,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import type { AuditActor } from "@/lib/repairdesk/types";

const continuationNamespace = "repairdesk-ai-order-continuation:v1";
const continuationLifetimeSeconds = 10 * 60;
const continuationTokenVersion = "v1";
const continuationIvBytes = 12;

const continuationClaimsSchema = z
  .object({
    version: z.literal(1),
    scope_hmac: z.string().length(43),
    expires_at: z.number().int().positive(),
    search: aiOrderSearchArgumentsSchema,
  })
  .strict();

type SearchToolCall = Extract<AiOrderToolCall, { name: "search_orders" }>;

export function createAiOrderContinuationToken({
  actor,
  toolCall,
  secret,
  now = new Date(),
}: {
  actor: AuditActor;
  toolCall: SearchToolCall;
  secret: string | undefined;
  now?: Date;
}) {
  if (!secret || secret.trim().length < 32 || !actor.id || !actor.storeId) return null;
  const claims = continuationClaimsSchema.parse({
    version: 1,
    scope_hmac: scopeHmac(actor.id, actor.storeId, secret),
    expires_at: Math.floor(now.getTime() / 1000) + continuationLifetimeSeconds,
    search: { ...toolCall.arguments, evidence: [] },
  });
  const sealed = sealClaims(claims, secret);
  return `${sealed}.${sign(sealed, secret)}`;
}

export function verifyAiOrderContinuationToken({
  actor,
  token,
  secret,
  now = new Date(),
}: {
  actor: AuditActor;
  token: string;
  secret: string | undefined;
  now?: Date;
}): SearchToolCall {
  if (!secret || secret.trim().length < 32 || !actor.id || !actor.storeId) {
    throw new Error("AI continuation is unavailable");
  }
  const parts = token.split(".");
  if (
    parts.length !== 5 ||
    parts[0] !== continuationTokenVersion ||
    parts.slice(1).some((part) => !part)
  ) {
    throw new Error("invalid AI continuation");
  }
  const sealed = parts.slice(0, 4).join(".");
  const expected = Buffer.from(sign(sealed, secret), "utf8");
  const supplied = Buffer.from(parts[4], "utf8");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("invalid AI continuation signature");
  }

  let decoded: unknown;
  try {
    decoded = openClaims(parts[1], parts[2], parts[3], secret);
  } catch {
    throw new Error("invalid AI continuation payload");
  }
  const claims = continuationClaimsSchema.parse(decoded);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (
    !safeEqual(claims.scope_hmac, scopeHmac(actor.id, actor.storeId, secret)) ||
    claims.expires_at < nowSeconds ||
    claims.expires_at > nowSeconds + continuationLifetimeSeconds + 30
  ) {
    throw new Error("AI continuation scope expired or changed");
  }
  return { name: "search_orders", arguments: { ...claims.search, evidence: [] } };
}

function sealClaims(claims: z.infer<typeof continuationClaimsSchema>, secret: string) {
  const iv = randomBytes(continuationIvBytes);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(claims), "utf8"), cipher.final()]);
  return [
    continuationTokenVersion,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

function openClaims(iv: string, ciphertext: string, authTag: string, secret: string): unknown {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as unknown;
}

function encryptionKey(secret: string) {
  return createHmac("sha256", secret).update(`${continuationNamespace}:encryption-key`).digest();
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${continuationNamespace}:${payload}`)
    .digest("base64url");
}

function scopeHmac(actorId: string, storeId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${continuationNamespace}:scope:${actorId}:${storeId}`)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
