import type {
  Customer,
  CustomerIntakeCandidate,
  CustomerIntakeNameMatchKind,
  CustomerIntakeNewCustomerPolicy,
  CustomerIntakePhoneMatchKind,
  CustomerIntakePhoneMatchMode,
  CustomerIntakeSearchInput,
} from "@/lib/repairdesk/types";
import { normalizePhoneRaw, primaryPhoneRaw } from "@/shared/lib/phone";

export type NormalizedCustomerIntakeSearch = {
  kind: "legacy" | "structured";
  query: string;
  phone: string;
  phoneRaw: string;
  name: string;
  normalizedName: string;
  phoneMatchMode: CustomerIntakePhoneMatchMode;
  limit: number;
  deviceLimit: number;
};

export function normalizeCustomerIntakeSearch(
  input: CustomerIntakeSearchInput,
): NormalizedCustomerIntakeSearch {
  const limit = clampInteger(input.limit, 8, 1, 12);
  const deviceLimit = clampInteger(input.deviceLimit, 4, 1, 8);

  if ("q" in input && input.q !== undefined) {
    return {
      kind: "legacy",
      query: input.q.trim(),
      phone: "",
      phoneRaw: "",
      name: "",
      normalizedName: "",
      phoneMatchMode: "progressive",
      limit,
      deviceLimit,
    };
  }

  const phone = input.phone?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  return {
    kind: "structured",
    query: "",
    phone,
    phoneRaw: primaryPhoneRaw(phone),
    name,
    normalizedName: normalizeCustomerIntakeName(name),
    phoneMatchMode: input.phoneMatchMode ?? "progressive",
    limit,
    deviceLimit,
  };
}

export function normalizeCustomerIntakeName(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT")
    .replace(/\s+/g, " ");
}

export function getCustomerIntakeNameMatchKind(
  customerName: string,
  normalizedQuery: string,
): CustomerIntakeNameMatchKind {
  if (!normalizedQuery) return "none";
  const normalizedName = normalizeCustomerIntakeName(customerName);
  if (normalizedName === normalizedQuery) return "exact";
  if (normalizedName.startsWith(normalizedQuery)) return "prefix";
  if (normalizedName.includes(normalizedQuery)) return "contains";
  return "none";
}

export function getCustomerIntakePhoneMatchKind(
  customer: Customer,
  queryRaw: string,
  mode: CustomerIntakePhoneMatchMode,
): CustomerIntakePhoneMatchKind | null {
  if (!queryRaw) return null;
  const primaryRaw = customer.phone_raw || normalizePhoneRaw(customer.phone_e164);
  const alternateRaws = customer.contact_phones.map(normalizePhoneRaw).filter(Boolean);

  if (primaryRaw === queryRaw) return "exact_primary";
  if (alternateRaws.includes(queryRaw)) return "exact_alternate";
  if (mode === "exact") return null;
  if (primaryRaw.startsWith(queryRaw)) return "prefix_primary";
  if (primaryRaw.includes(queryRaw)) return "partial_primary";
  if (alternateRaws.some((phone) => phone.includes(queryRaw))) return "partial_alternate";
  return null;
}

export function compareCustomerIntakeMatches(
  left: Pick<CustomerIntakeCandidate, "phoneMatchKind" | "nameMatchKind" | "customer">,
  right: Pick<CustomerIntakeCandidate, "phoneMatchKind" | "nameMatchKind" | "customer">,
) {
  return (
    phoneMatchRank(left.phoneMatchKind) - phoneMatchRank(right.phoneMatchKind) ||
    nameMatchRank(left.nameMatchKind) - nameMatchRank(right.nameMatchKind) ||
    left.customer.name.localeCompare(right.customer.name, "it-IT") ||
    left.customer.id.localeCompare(right.customer.id)
  );
}

export function getCustomerIntakeNewCustomerPolicy(
  candidates: readonly CustomerIntakeCandidate[],
  phone: string,
  name: string,
): CustomerIntakeNewCustomerPolicy {
  const phoneRaw = primaryPhoneRaw(phone);
  if (!phoneRaw) return "allowed";
  const normalizedName = normalizeCustomerIntakeName(name);
  const exactPhoneCandidates = candidates.filter(
    (candidate) =>
      candidate.phoneMatchKind === "exact_primary" ||
      candidate.phoneMatchKind === "exact_alternate" ||
      (candidate.phoneMatchKind === undefined && candidate.exactMatch),
  );
  if (!exactPhoneCandidates.length) return "allowed";
  if (!normalizedName) return "blocked_missing_name";
  if (
    exactPhoneCandidates.some(
      (candidate) =>
        (candidate.nameMatchKind ??
          getCustomerIntakeNameMatchKind(candidate.customer.name, normalizedName)) === "exact",
    )
  ) {
    return "blocked_exact_duplicate";
  }
  return "requires_shared_phone_confirmation";
}

export function customerIntakePolicyBlocksSubmit(
  policy: CustomerIntakeNewCustomerPolicy | null | undefined,
) {
  return policy === "blocked_exact_duplicate" || policy === "blocked_missing_name";
}

function phoneMatchRank(kind?: CustomerIntakePhoneMatchKind) {
  switch (kind) {
    case "exact_primary":
      return 0;
    case "exact_alternate":
      return 1;
    case "prefix_primary":
      return 2;
    case "partial_primary":
      return 3;
    case "partial_alternate":
      return 4;
    default:
      return 5;
  }
}

function nameMatchRank(kind?: CustomerIntakeNameMatchKind) {
  switch (kind) {
    case "exact":
      return 0;
    case "prefix":
      return 1;
    case "contains":
      return 2;
    default:
      return 3;
  }
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  const numeric = Math.floor(Number(value ?? fallback));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}
