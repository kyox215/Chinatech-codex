import { createHash, createHmac } from "node:crypto";

import type { AiAssistantLocale } from "@/features/ai-assistant/model/contracts";
import type { AiAssistantRequestKind } from "./cost-policy";
import type { AuditActor } from "@/lib/repairdesk/types";

const requestNamespace = "repairdesk-ai-request:v1";
const actorNamespace = "repairdesk-ai-rate-actor:v1";

export function createAiRequestFingerprint({
  actor,
  clientRequestId,
  requestKind,
  model,
  locale,
  content,
  secret,
}: {
  actor: AuditActor;
  clientRequestId: string;
  requestKind: AiAssistantRequestKind;
  model: string;
  locale: AiAssistantLocale;
  content: string;
  secret: string;
}) {
  const identity = requireActorIdentity(actor);
  assertSecret(secret);
  const contentDigest = createHash("sha256").update(content.normalize("NFKC")).digest("base64url");
  return createHmac("sha256", secret)
    .update(
      [
        requestNamespace,
        identity.storeId,
        identity.actorId,
        clientRequestId,
        requestKind,
        model,
        locale,
        contentDigest,
      ].join(":"),
    )
    .digest("base64url");
}

export function createAiActorRateFingerprint(actor: AuditActor, secret: string) {
  const identity = requireActorIdentity(actor);
  assertSecret(secret);
  return createHmac("sha256", secret)
    .update(`${actorNamespace}:${identity.storeId}:${identity.actorId}`)
    .digest("base64url");
}

function requireActorIdentity(actor: AuditActor) {
  if (!actor.id || !actor.storeId) throw new Error("stable AI actor and store are required");
  return { actorId: actor.id, storeId: actor.storeId };
}

function assertSecret(secret: string) {
  if (secret.trim().length < 32) throw new Error("AI request fingerprint secret is too short");
}
