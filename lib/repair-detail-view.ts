import type { IntakeReceiptData } from "./repair-intake-record";
import type { RepairRequirement } from "./repair-requirements";
import type { ProcurementRecord } from "./procurement";

/** Quote keys remain the existing canonical item keys. Ambiguous history is never guessed. */
export function repairDetailProjects(data: Pick<IntakeReceiptData, "itemQuotes">, requirements: readonly RepairRequirement[], records: readonly ProcurementRecord[]) {
  const titles = new Map<string, number>();
  requirements.forEach(row => titles.set(row.title, (titles.get(row.title) ?? 0) + 1));
  const rows = requirements.map(requirement => ({
    id: requirement.id, title: requirement.title, request: requirement.request, requirement,
    quote: titles.get(requirement.title) === 1 ? data.itemQuotes?.find(row => row.item === requirement.title) : undefined,
    ambiguous: titles.get(requirement.title)! > 1,
    purchases: records.filter(row => row.requirementId === requirement.id),
  }));
  const unmatchedQuotes = (data.itemQuotes ?? []).filter(row => !requirements.some(item => item.title === row.item));
  const unmatchedPurchases = records.filter(row => !requirements.some(item => item.id === row.requirementId));
  return { rows, unmatchedQuotes, unmatchedPurchases };
}
