import type { ApprovedStoreRole, StoreMember, StoreRole } from "@/lib/repairdesk/types";

export function canManageStoreMemberRole(
  actorRole: StoreRole | undefined,
  member: StoreMember,
  currentMembershipId: string | undefined,
  nextRole: ApprovedStoreRole,
) {
  if (member.role === "owner" || member.id === currentMembershipId) return false;
  if (actorRole === "owner") return true;
  if (actorRole !== "manager") return false;
  return member.role !== "manager" && nextRole !== "manager";
}

export function canManageStoreMemberStatus(
  actorRole: StoreRole | undefined,
  member: StoreMember,
  currentMembershipId: string | undefined,
) {
  if (member.role === "owner" || member.id === currentMembershipId) return false;
  if (actorRole === "owner") return true;
  return actorRole === "manager" && member.role !== "manager";
}
