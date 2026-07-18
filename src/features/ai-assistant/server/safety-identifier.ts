import { createHmac } from "node:crypto";

import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import type { AuditActor } from "@/lib/repairdesk/types";

const namespace = "repairdesk-ai:v1";

export function createAiSafetyIdentifier(actor: AuditActor, secret: string) {
  if (!actor.id) throw new Error("stable actor id is required");
  if (secret.trim().length < 32) throw new Error("safety identifier secret is too short");
  const digest = createHmac("sha256", secret)
    .update(`${namespace}:${actor.id}`)
    .digest("base64url");
  return `u1_${digest}`;
}

export function createAiSafetyIdentifierIfConfigured(
  actor: AuditActor,
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  const secret = env.AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET;
  return secret ? createAiSafetyIdentifier(actor, secret) : undefined;
}
