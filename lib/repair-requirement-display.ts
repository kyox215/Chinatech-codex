import type { RepairRequirement } from "./repair-requirements";

type RequestSource = Readonly<Pick<RepairRequirement, "id" | "title" | "request" | "sourceFingerprint">>;

/** Only a unique, unchanged current intake source may localize a preset request. */
export function repairRequirementRequest(
  requirement: RequestSource,
  currentIntakeSources: readonly RequestSource[],
  renderIntakePreset: (source: RequestSource) => string,
): string {
  if (requirement.request === "") return "";
  const matches = currentIntakeSources.filter(source => source.id === requirement.id
    && source.title === requirement.title && source.request === requirement.request);
  if (matches.length !== 1) return requirement.request;
  const source = matches[0];
  if (typeof requirement.sourceFingerprint !== "string" || requirement.sourceFingerprint.length === 0
    || typeof source.sourceFingerprint !== "string" || source.sourceFingerprint.length === 0
    || source.sourceFingerprint !== requirement.sourceFingerprint) return requirement.request;
  return renderIntakePreset(source);
}
