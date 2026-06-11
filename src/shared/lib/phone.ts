const PHONE_SEPARATOR_RE = /[/\\,，;；、\r\n]+/;

export interface NormalizedPhoneBook {
  primary: string;
  primaryRaw: string;
  contacts: string[];
}

export function normalizePhoneRaw(value: string) {
  return value.replace(/\D/g, "");
}

export function splitPhoneCandidates(value: string) {
  return value
    .split(PHONE_SEPARATOR_RE)
    .map((part) => part.trim())
    .filter((part) => normalizePhoneRaw(part).length > 0);
}

export function primaryPhone(value: string) {
  return splitPhoneCandidates(value)[0] ?? value.trim();
}

export function primaryPhoneRaw(value: string) {
  return normalizePhoneRaw(primaryPhone(value));
}

export function normalizePhoneBook(
  primaryValue: string,
  contactValues: readonly string[] = [],
  promoteContactPhone?: string,
): NormalizedPhoneBook {
  const candidates = [
    ...splitPhoneCandidates(primaryValue),
    ...contactValues.flatMap((value) => splitPhoneCandidates(value)),
  ];
  const promotedPhone = promoteContactPhone?.trim();
  const promotedRaw = promotedPhone ? normalizePhoneRaw(promotedPhone) : "";
  const promoted = promotedRaw
    ? (candidates.find((candidate) => normalizePhoneRaw(candidate) === promotedRaw) ??
      promotedPhone)
    : undefined;
  const primary = (promoted ?? candidates[0] ?? primaryValue.trim()).trim();
  const primaryRaw = normalizePhoneRaw(primary);
  const contacts: string[] = [];
  const seen = new Set<string>(primaryRaw ? [primaryRaw] : []);

  for (const candidate of candidates) {
    const raw = normalizePhoneRaw(candidate);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    contacts.push(candidate.trim());
  }

  return { primary, primaryRaw, contacts };
}

export function phoneMatches(value: string, query: string) {
  const q = query.trim().toLowerCase();
  const raw = normalizePhoneRaw(q);
  return (
    value.toLowerCase().includes(q) || (raw.length > 0 && normalizePhoneRaw(value).includes(raw))
  );
}

export function samePhoneRaw(left: string, right: string) {
  return primaryPhoneRaw(left) === primaryPhoneRaw(right);
}
