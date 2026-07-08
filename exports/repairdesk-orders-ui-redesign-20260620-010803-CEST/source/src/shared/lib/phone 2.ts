const PHONE_SEPARATOR_RE = /[/\\,，;；、\r\n]+/;

export interface NormalizedPhoneBook {
  primary: string;
  primaryRaw: string;
  contacts: string[];
}

const LOCAL_PHONE_PREFIXES = ["39", "86"];

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
  const seen = new Set(phoneIdentityKeys(primaryRaw));

  for (const candidate of candidates) {
    const raw = normalizePhoneRaw(candidate);
    if (!raw || hasSeenPhone(seen, raw)) continue;
    addPhoneIdentity(seen, raw);
    contacts.push(candidate.trim());
  }

  return { primary, primaryRaw, contacts };
}

export function uniqueContactPhones(primaryValue: string, contactValues: readonly string[] = []) {
  const primaryRaw = primaryPhoneRaw(primaryValue);
  const seen = new Set(phoneIdentityKeys(primaryRaw));
  const contacts: string[] = [];

  for (const value of contactValues) {
    for (const candidate of splitPhoneCandidates(value)) {
      const raw = normalizePhoneRaw(candidate);
      if (!raw || hasSeenPhone(seen, raw)) continue;
      addPhoneIdentity(seen, raw);
      contacts.push(candidate.trim());
    }
  }

  return contacts;
}

function phoneIdentityKeys(raw: string) {
  if (!raw) return [];
  const keys = new Set([raw]);
  const withoutInternationalPrefix = raw.startsWith("00") ? raw.slice(2) : raw;
  if (withoutInternationalPrefix !== raw) keys.add(withoutInternationalPrefix);

  for (const prefix of LOCAL_PHONE_PREFIXES) {
    if (withoutInternationalPrefix.startsWith(prefix)) {
      const local = withoutInternationalPrefix.slice(prefix.length);
      if (local.length >= 8) keys.add(local);
    }
  }

  return [...keys];
}

function hasSeenPhone(seen: Set<string>, raw: string) {
  return phoneIdentityKeys(raw).some((key) => seen.has(key));
}

function addPhoneIdentity(seen: Set<string>, raw: string) {
  for (const key of phoneIdentityKeys(raw)) seen.add(key);
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
