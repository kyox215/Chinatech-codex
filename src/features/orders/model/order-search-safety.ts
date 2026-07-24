import { isCustomerStatusLinkCandidate } from "@/entities/customer-status/model/customer-status-link";

export function sanitizeOrderSearchValue(value: string | undefined) {
  if (!value || !isCustomerStatusLinkCandidate(value)) return value;
  return undefined;
}

export function sanitizeOrderSearchDraft(value: string) {
  return sanitizeOrderSearchValue(value) ?? "";
}

export function sanitizeOrderSearchInput<
  T extends { search?: string; searchScope?: "current" | "archive_exact" },
>(input: T): T {
  if (!isCustomerStatusLinkCandidate(input.search)) return input;
  return {
    ...input,
    search: undefined,
    searchScope: "current",
  };
}
