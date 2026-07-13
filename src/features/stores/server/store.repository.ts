import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import {
  canStoreReviewAccessRequest,
  createOnboardingAuditSnapshot,
} from "@/features/platform/model/onboarding-review-policy";
import type {
  ActorStoreMembership,
  ApprovedStoreRole,
  AuditActor,
  OnboardingDecisionInput,
  OnboardingRequest,
  StoreContext,
  StoreCreateInput,
  StoreInvitation,
  StoreInvitationDecisionInput,
  StoreInviteLink,
  StoreInviteLinkCreateInput,
  StoreInviteLinkCreateResult,
  StoreInviteLinkDecisionInput,
  StoreInviteLinkRedeemInput,
  StoreInviteInput,
  StoreMemberDecisionInput,
  StoreMemberPermissionUpdateInput,
  StoreMemberRoleUpdateInput,
  StoreMember,
  StoreMembersResult,
  StoreMembershipStatus,
  StorePermissionAction,
  StoreRole,
} from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";
import { assertVerifiedEmail, ForbiddenError } from "@/server/auth-context";
import { assertPermission, can } from "@/server/permissions";
import { isPrimaryStoreOwner } from "@/features/stores/server/primary-store-owner";
import {
  isOrderDataApplyEnabled,
  isOrderDataExportEnabled,
} from "@/features/orders/server/order-data-feature-flags";
import { type DbRecord, fail, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  deleteProvisionedStoreDefaults,
  provisionStoreDefaults,
} from "@/features/stores/server/store-provisioning";
import {
  isStorePermissionAction,
  normalizeStorePermissionGrants,
} from "@/entities/staff/model/store-permission-policy";

const ACTIVE_STORE_COOKIE = "repairdesk-store-id";
const STORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const INVITE_LINK_REDEEM_WINDOW_MS = 15 * 60 * 1000;
const INVITE_LINK_REDEEM_LIMIT = 10;
const CREATE_STORE_WINDOW_MS = 60 * 60 * 1000;
const CREATE_STORE_LIMIT = 3;
const STORE_PROVISIONING_ERROR = "创建店铺初始化失败，请稍后重试";
const STORE_MEMBERSHIP_ERROR = "创建店铺成员关系失败，请稍后重试";
const STORE_ACTIVATION_ERROR = "创建店铺激活失败，请稍后重试";

export async function getStoreContext(actor: AuditActor): Promise<StoreContext> {
  return {
    activeStore: activeStoreFromActor(actor),
    stores: actor.stores ?? [],
    permissions: await storePermissionsFromActor(actor),
  };
}

export async function switchActiveStore(storeId: string, actor: AuditActor): Promise<StoreContext> {
  const store = await assertStoreMembership(storeId, actor);
  await setActiveStoreCookie(store.id);
  await writeAuditLog({
    actor,
    action: "switch",
    entityType: "store",
    entityId: store.id,
    metadata: { store_name: store.name },
  });
  return nextContext(actor, store);
}

export async function createStore(
  input: StoreCreateInput,
  actor: AuditActor,
): Promise<StoreContext> {
  if (!actor.id || actor.isSystem) {
    throw new ForbiddenError("需要登录员工账号后才能创建店铺");
  }
  assertVerifiedEmail(actor);

  const name = sanitizeStoreName(input.name);
  const supabase = getSupabaseAdmin();
  await enforceCreateStoreRateLimit(supabase, actor);
  const now = new Date().toISOString();
  const slug = await uniqueStoreSlug(supabase, name);
  const storeCode = generateStoreCode(name);

  const { data: storeRow, error: storeError } = await supabase
    .from("stores")
    .insert({
      store_code: storeCode,
      name,
      slug,
      owner_user_id: actor.id,
      status: "suspended",
      plan: "starter",
      timezone: input.timezone || "Europe/Rome",
      currency_code: input.currency_code || "EUR",
      created_at: now,
      updated_at: now,
    })
    .select("id, name, slug, status")
    .single();
  fail(storeError, "创建店铺失败");

  const createdStore = storeFromRow(storeRow as DbRecord, "owner");
  try {
    await provisionStoreDefaults(supabase, {
      storeId: createdStore.id,
      storeName: createdStore.name,
      actorId: actor.id,
      now,
    });
  } catch (error) {
    await rollbackCreatedStore(supabase, createdStore.id, {
      includeProvisioningRows: true,
    });
    throw new Error(STORE_PROVISIONING_ERROR);
  }

  const { error: membershipError } = await supabase.from("store_memberships").insert({
    store_id: createdStore.id,
    user_id: actor.id,
    email: sanitizeEmail(actor.email || `${actor.id}@unknown.local`),
    display_name: actor.displayName,
    role: "owner",
    status: "active",
    created_at: now,
    updated_at: now,
  });
  if (membershipError) {
    await rollbackCreatedStore(supabase, createdStore.id, {
      includeProvisioningRows: true,
    });
    throw new Error(STORE_MEMBERSHIP_ERROR);
  }

  const store = await activateCreatedStore(supabase, createdStore.id, now);

  await setActiveStoreCookie(store.id);
  await writeAuditLog({
    actor: { ...actor, storeId: store.id, storeName: store.name, storeRole: "owner" },
    action: "create",
    entityType: "store",
    entityId: store.id,
    after: { ...store },
  });

  return nextContext(actor, store, true);
}

async function activateCreatedStore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  now: string,
) {
  try {
    const { data, error } = await supabase
      .from("stores")
      .update({ status: "active", updated_at: now })
      .eq("id", storeId)
      .select("id, name, slug, status")
      .single();
    fail(error, "激活店铺失败");
    return storeFromRow(data as DbRecord, "owner");
  } catch (error) {
    await rollbackCreatedStore(supabase, storeId, {
      includeProvisioningRows: true,
    });
    throw new Error(STORE_ACTIVATION_ERROR);
  }
}

async function rollbackCreatedStore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  options: { includeProvisioningRows?: boolean } = {},
) {
  if (options.includeProvisioningRows) {
    await deleteProvisionedStoreDefaults(supabase, storeId);
  }
  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) {
    throw new Error("创建店铺失败，回滚未完成店铺失败，请联系管理员处理");
  }
}

export async function listStoreMembers(actor: AuditActor): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const [membersResult, invitationsResult, inviteLinksResult] = await Promise.all([
    supabase
      .from("store_memberships")
      .select("id, user_id, email, display_name, role, status, created_at, updated_at")
      .eq("store_id", storeId)
      .order("role", { ascending: true })
      .order("email", { ascending: true }),
    supabase
      .from("store_invitations")
      .select(
        "id, email, role, status, invited_by, accepted_at, expires_at, created_at, updated_at",
      )
      .eq("store_id", storeId)
      .eq("status", "invited")
      .order("created_at", { ascending: false }),
    supabase
      .from("store_invite_links")
      .select(
        "id, store_id, label, role, status, expires_at, max_uses, used_count, created_by, revoked_by, revoked_at, created_at, updated_at",
      )
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);
  fail(membersResult.error, "读取店铺成员失败");
  fail(invitationsResult.error, "读取店铺邀请失败");
  const inviteLinksTableMissing = isMissingStoreInviteLinksTableError(inviteLinksResult.error);
  if (!inviteLinksTableMissing) {
    fail(inviteLinksResult.error, "读取店铺邀请码失败");
  }
  const grantsByMembership = groupPermissionGrantsByMembership(
    await listStoreMemberPermissionGrantRows(supabase, storeId),
  );

  return {
    members: ((membersResult.data ?? []) as DbRecord[]).map((row) => {
      const member = memberFromRow(row, grantsByMembership.get(requiredString(row.id)) ?? []);
      return { ...member, management: projectStoreMemberManagement(actor, member) };
    }),
    invitations: ((invitationsResult.data ?? []) as DbRecord[]).map(invitationFromRow),
    invite_links: inviteLinksTableMissing
      ? []
      : ((inviteLinksResult.data ?? []) as DbRecord[]).map(inviteLinkFromRow),
  };
}

export async function inviteStoreMember(
  input: StoreInviteInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const email = sanitizeEmail(input.email);
  const role = sanitizeInviteRole(input.role);
  assertCanGrantStoreRole(actor, role);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existingMembership, error: membershipReadError } = await supabase
    .from("store_memberships")
    .select("id")
    .eq("store_id", storeId)
    .ilike("email", email)
    .eq("status", "active")
    .maybeSingle();
  fail(membershipReadError, "检查店铺成员失败");
  if (existingMembership) throw new Error("该邮箱已经是当前店铺成员");

  const { data: existingInvite, error: inviteReadError } = await supabase
    .from("store_invitations")
    .select("id")
    .eq("store_id", storeId)
    .ilike("email", email)
    .eq("status", "invited")
    .maybeSingle();
  fail(inviteReadError, "检查店铺邀请失败");

  const invitePayload = {
    store_id: storeId,
    email,
    role,
    token_hash: crypto.randomUUID(),
    status: "invited",
    invited_by: actor.id ?? null,
    accepted_at: null,
    expires_at: expiresAt,
    updated_at: now,
  };

  const { data: invitation, error: inviteError } = existingInvite
    ? await supabase
        .from("store_invitations")
        .update(invitePayload)
        .eq("id", requiredString((existingInvite as DbRecord).id))
        .select("*")
        .single()
    : await supabase
        .from("store_invitations")
        .insert({ id: crypto.randomUUID(), ...invitePayload, created_at: now })
        .select("*")
        .single();
  fail(inviteError, "保存店铺邀请失败");

  await writeAuditLog({
    actor,
    action: "invite",
    entityType: "store_invitation",
    entityId: requiredString((invitation as DbRecord).id),
    after: createInvitationAuditSnapshot(invitation as DbRecord),
    metadata: { role, invitation_status: "invited" },
  });

  return listStoreMembers(actor);
}

export async function updateStoreMemberRole(
  input: StoreMemberRoleUpdateInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const role = sanitizeAccessRole(input.role);
  assertCanGrantStoreRole(actor, role);
  const supabase = getSupabaseAdmin();
  const member = await readStoreMemberForManagement(supabase, storeId, input.id);
  assertCanManageStoreMember(actor, member, { nextRole: role });
  if (member.status !== "active") {
    throw new ForbiddenError("停用员工不能修改角色，请先恢复员工");
  }

  if (member.role === role) return listStoreMembers(actor);

  const data = await updateMemberAccessTransaction(supabase, {
    storeId,
    membershipId: member.id,
    actorId: actor.id,
    role,
    context: "更新员工角色失败",
  });

  await writeAuditLog({
    actor,
    action: "update_role",
    entityType: "store_membership",
    entityId: member.id,
    before: createMemberAuditSnapshot(member),
    after: createMemberAuditSnapshot(memberFromRow(data as DbRecord)),
  });

  return listStoreMembers(actor);
}

async function updateMemberAccessTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    storeId: string;
    membershipId: string;
    actorId?: string;
    role?: StoreRole;
    status?: StoreMembershipStatus;
    context: string;
  },
) {
  const { data, error } = await supabase.rpc("repairdesk_update_member_access_rpc", {
    p_store_id: input.storeId,
    p_membership_id: input.membershipId,
    p_role: input.role ?? null,
    p_status: input.status ?? null,
    p_actor_id: input.actorId ?? null,
  });
  fail(error, input.context);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("员工已变更，请刷新后再试");
  return row as DbRecord;
}

export async function updateStoreMemberPermissions(
  input: StoreMemberPermissionUpdateInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  if (actor.storeRole !== "owner") {
    throw new ForbiddenError("只有店主可以分配员工权限");
  }
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const member = await readStoreMemberForManagement(supabase, storeId, input.id);
  if (member.role === "owner") {
    throw new ForbiddenError("店主默认拥有全部店铺权限，不需要额外授权");
  }
  if (member.status !== "active") {
    throw new ForbiddenError("停用员工不能修改额外权限，请先恢复员工");
  }
  const permissions = normalizeStorePermissionGrants(input.permissions, member.role);
  const { data, error } = await supabase.rpc("repairdesk_replace_member_permission_grants_rpc", {
    p_store_id: storeId,
    p_membership_id: member.id,
    p_actions: permissions,
    p_actor_id: actor.id ?? null,
  });
  fail(error, "更新成员权限失败");
  const result = (Array.isArray(data) ? data[0] : data) as DbRecord | null;
  const previousPermissions = Array.isArray(result?.before)
    ? result.before.filter(isStorePermissionAction)
    : [];

  await writeAuditLog({
    actor,
    action: "update_member_permissions",
    entityType: "store_membership",
    entityId: member.id,
    before: { permission_grants: previousPermissions },
    after: { permission_grants: permissions },
    metadata: { target_user_id: member.user_id },
  });

  return listStoreMembers(actor);
}

export async function disableStoreMember(
  input: StoreMemberDecisionInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const member = await readStoreMemberForManagement(supabase, storeId, input.id);
  assertCanManageStoreMember(actor, member, { disable: true });

  if (member.status === "inactive") return listStoreMembers(actor);

  const data = await updateMemberAccessTransaction(supabase, {
    storeId,
    membershipId: member.id,
    actorId: actor.id,
    status: "inactive",
    context: "停用员工失败",
  });

  await writeAuditLog({
    actor,
    action: "disable_member",
    entityType: "store_membership",
    entityId: member.id,
    before: createMemberAuditSnapshot(member),
    after: createMemberAuditSnapshot(memberFromRow(data as DbRecord)),
  });

  return listStoreMembers(actor);
}

export async function restoreStoreMember(
  input: StoreMemberDecisionInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const member = await readStoreMemberForManagement(supabase, storeId, input.id);
  assertCanManageStoreMember(actor, member, { restore: true });
  assertCanGrantStoreRole(actor, member.role);

  if (member.status === "active") return listStoreMembers(actor);

  const data = await updateMemberAccessTransaction(supabase, {
    storeId,
    membershipId: member.id,
    actorId: actor.id,
    status: "active",
    context: "恢复员工失败",
  });

  await writeAuditLog({
    actor,
    action: "restore_member",
    entityType: "store_membership",
    entityId: member.id,
    before: createMemberAuditSnapshot(member),
    after: createMemberAuditSnapshot(memberFromRow(data as DbRecord)),
  });

  return listStoreMembers(actor);
}

export async function acceptStoreInvitation(
  input: StoreInvitationDecisionInput,
  actor: AuditActor,
): Promise<StoreContext> {
  if (!actor.id || actor.isSystem) {
    throw new ForbiddenError("需要登录员工账号后才能接受邀请");
  }
  assertVerifiedEmail(actor);
  const email = sanitizeEmail(actor.email || "");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: invitationRow, error: invitationReadError } = await supabase
    .from("store_invitations")
    .select("*")
    .eq("id", input.id)
    .eq("email", email)
    .eq("status", "invited")
    .maybeSingle();
  fail(invitationReadError, "读取店铺邀请失败");
  if (!invitationRow) throw new Error("邀请不存在或已失效");

  const invitation = invitationRow as DbRecord;
  const role = sanitizeAccessRole(toStoreRole(invitation.role));
  if (new Date(requiredString(invitation.expires_at)).getTime() <= Date.now()) {
    throw new Error("邀请已过期");
  }

  const { data: acceptedInvitation, error: acceptError } = await supabase
    .from("store_invitations")
    .update({
      status: "active",
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", input.id)
    .eq("email", email)
    .eq("status", "invited")
    .gt("expires_at", now)
    .select("*")
    .maybeSingle();
  fail(acceptError, "接受店铺邀请失败");
  if (!acceptedInvitation) throw new Error("邀请不存在或已失效");

  const accepted = acceptedInvitation as DbRecord;
  const storeId = requiredString(accepted.store_id);
  const { error: membershipError } = await supabase.from("store_memberships").upsert(
    {
      store_id: storeId,
      user_id: actor.id,
      email,
      display_name: actor.displayName || displayNameFromEmail(email),
      role,
      status: "active",
      updated_at: now,
    },
    { onConflict: "store_id,user_id" },
  );
  if (membershipError) {
    await markInvitationAcceptFailed(supabase, input.id);
  }
  fail(membershipError, "开通店铺成员关系失败");

  const { data: storeRow, error: storeError } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .eq("id", storeId)
    .single();
  fail(storeError, "读取邀请店铺失败");
  const activeStore = storeFromRow(storeRow as DbRecord, role);
  await setActiveStoreCookie(activeStore.id);

  await writeAuditLog({
    actor: { ...actor, storeId: activeStore.id, storeName: activeStore.name, storeRole: role },
    action: "accept_invitation",
    entityType: "store_invitation",
    entityId: input.id,
    after: createInvitationAuditSnapshot(accepted),
  });

  return nextContext(actor, activeStore);
}

export async function revokeStoreInvitation(
  input: StoreInvitationDecisionInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_invitations")
    .update({
      status: "inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("store_id", storeId)
    .eq("status", "invited")
    .select("*")
    .maybeSingle();
  fail(error, "撤销店铺邀请失败");
  if (!data) throw new Error("邀请不存在或已处理");

  await writeAuditLog({
    actor,
    action: "revoke_invitation",
    entityType: "store_invitation",
    entityId: input.id,
    before: createInvitationAuditSnapshot(data as DbRecord),
  });

  return listStoreMembers(actor);
}

export async function createStoreInviteLink(
  input: StoreInviteLinkCreateInput,
  actor: AuditActor,
): Promise<StoreInviteLinkCreateResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const role = sanitizeInviteRole(input.role);
  assertCanGrantStoreRole(actor, role);
  const label = sanitizeInviteLinkLabel(input.label);
  const expiresInDays = sanitizeInviteLinkExpiry(input.expires_in_days);
  const maxUses = sanitizeInviteLinkMaxUses(input.max_uses);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const code = generateInviteCode();
  const tokenHash = hashInviteCode(code);

  const { data, error } = await supabase
    .from("store_invite_links")
    .insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      label,
      role,
      token_hash: tokenHash,
      status: "active",
      expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      max_uses: maxUses,
      used_count: 0,
      created_by: actor.id ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  fail(error, "创建邀请码失败");

  await writeAuditLog({
    actor,
    action: "create_invite_link",
    entityType: "store_invite_link",
    entityId: requiredString((data as DbRecord).id),
    after: createInviteLinkAuditSnapshot(data as DbRecord),
    metadata: { role, max_uses: maxUses, expires_in_days: expiresInDays },
  });

  return {
    link: { ...inviteLinkFromRow(data as DbRecord), store_id: storeId },
    code,
  };
}

export async function revokeStoreInviteLink(
  input: StoreInviteLinkDecisionInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("store_invite_links")
    .update({
      status: "inactive",
      revoked_by: actor.id ?? null,
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", input.id)
    .eq("store_id", storeId)
    .eq("status", "active")
    .select("*")
    .maybeSingle();
  fail(error, "撤销邀请码失败");
  if (!data) throw new Error("邀请码不存在或已处理");

  await writeAuditLog({
    actor,
    action: "revoke_invite_link",
    entityType: "store_invite_link",
    entityId: input.id,
    before: createInviteLinkAuditSnapshot(data as DbRecord),
  });

  return listStoreMembers(actor);
}

export async function redeemStoreInviteLink(
  input: StoreInviteLinkRedeemInput,
  actor: AuditActor,
): Promise<StoreInvitation> {
  if (!actor.id || actor.isSystem) {
    throw new ForbiddenError("需要登录员工账号后才能兑换邀请码");
  }
  assertVerifiedEmail(actor);
  const email = sanitizeEmail(actor.email || "");
  const code = normalizeInviteCode(input.code);
  const tokenHash = hashInviteCode(code);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  await enforceInviteLinkRedeemRateLimit(supabase, actor, tokenHash);

  const { data: linkRow, error: linkReadError } = await supabase
    .from("store_invite_links")
    .select(
      "id, store_id, label, role, status, expires_at, max_uses, used_count, created_by, created_at, updated_at",
    )
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();
  fail(linkReadError, "读取邀请码失败");
  if (!linkRow) {
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      result: "not_found",
    });
    throw new Error("邀请码不存在或已失效");
  }

  const link = linkRow as DbRecord;
  const storeId = requiredString(link.store_id);
  const role = sanitizeAccessRole(toStoreRole(link.role));
  if (new Date(requiredString(link.expires_at)).getTime() <= Date.now()) {
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      storeId,
      result: "expired",
    });
    throw new Error("邀请码不存在或已失效");
  }
  if (isInviteLinkUseLimitReached(link)) {
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      storeId,
      result: "over_limit",
    });
    throw new Error("邀请码不存在或已失效");
  }

  const { data: existingMembership, error: membershipReadError } = await supabase
    .from("store_memberships")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", actor.id)
    .eq("status", "active")
    .maybeSingle();
  fail(membershipReadError, "检查店铺成员失败");
  if (existingMembership) {
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      storeId,
      result: "already_member",
    });
    throw new Error("你已经是该店铺成员");
  }

  const existingInvite = await readPendingInvitationForEmail(supabase, storeId, email);
  if (existingInvite) {
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      storeId,
      result: "existing_invitation",
    });
    return publicInvitationFromRow(existingInvite);
  }

  const { data: claimedRows, error: claimError } = await supabase.rpc("claim_store_invite_link", {
    p_token_hash: tokenHash,
  });
  fail(claimError, "兑换邀请码失败");
  const claimed = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;
  if (!claimed) {
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      storeId,
      result: "claim_failed",
    });
    throw new Error("邀请码不存在或已失效");
  }

  const invitePayload = {
    id: crypto.randomUUID(),
    store_id: storeId,
    email,
    role,
    token_hash: crypto.randomUUID(),
    status: "invited",
    invited_by: requiredString((claimed as DbRecord).created_by) || null,
    accepted_at: null,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: now,
    updated_at: now,
  };
  const { data: invitation, error: inviteError } = await supabase
    .from("store_invitations")
    .insert(invitePayload)
    .select("*")
    .single();
  if (inviteError) {
    const existingAfterRace = await readPendingInvitationForEmail(supabase, storeId, email);
    if (existingAfterRace) {
      await recordInviteLinkAttempt(supabase, {
        actor,
        codeHash: tokenHash,
        storeId,
        result: "existing_invitation",
      });
      return publicInvitationFromRow(existingAfterRace);
    }
    await recordInviteLinkAttempt(supabase, {
      actor,
      codeHash: tokenHash,
      storeId,
      result: "insert_failed",
    });
  }
  fail(inviteError, "保存兑换邀请失败");

  await recordInviteLinkAttempt(supabase, {
    actor,
    codeHash: tokenHash,
    storeId,
    result: "success",
  });
  await writeAuditLog({
    actor: { ...actor, storeId },
    action: "redeem_invite_link",
    entityType: "store_invite_link",
    entityId: requiredString((claimed as DbRecord).id),
    after: createInvitationAuditSnapshot(invitation as DbRecord),
  });

  return publicInvitationFromRow(invitation as DbRecord);
}

export async function listStoreAccessRequests(actor: AuditActor): Promise<OnboardingRequest[]> {
  assertCanReviewStoreAccessRequests(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("request_type", "join_store")
    .eq("status", "pending")
    .eq("review_scope", "store")
    .eq("target_store_id", storeId)
    .order("created_at", { ascending: true });
  fail(error, "读取店铺加入申请失败");

  return ((data ?? []) as DbRecord[]).map(onboardingRequestFromRow);
}

export async function approveStoreAccessRequest(
  input: OnboardingDecisionInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertCanReviewStoreAccessRequests(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const request = await getPendingStoreAccessRequest(supabase, input.id, storeId);
  const context = await getStoreReviewContext(supabase, storeId, actor);
  assertCanReviewStoreAccessRequest(request, storeId);

  const now = new Date().toISOString();
  const role = sanitizeAccessRole(input.approved_role ?? request.requested_role);
  assertCanGrantStoreRole(actor, role);
  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "approved",
      target_store_id: storeId,
      target_store_name: actor.storeName ?? "RepairDesk",
      reviewed_by: actor.id,
      reviewed_by_membership_id: context.membershipId,
      reviewed_at: now,
      decision_note: sanitizeOptionalNote(input.note),
      approved_role: role,
      resulting_store_id: storeId,
      review_scope: "store",
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("request_type", "join_store")
    .eq("status", "pending")
    .eq("review_scope", "store")
    .eq("target_store_id", storeId)
    .select("*")
    .maybeSingle();
  fail(error, "批准加入申请失败");
  if (!data) throw new Error("加入申请已处理，请刷新后再试");

  try {
    await upsertStaffProfile(supabase, request, role, now);
    await upsertStoreMembership(supabase, request, storeId, role, now);
  } catch {
    await markStoreAccessApprovalFailed(supabase, request.id);
    throw new Error("批准加入申请失败，请稍后重试");
  }

  await writeAuditLog({
    actor,
    action: "approve_access_request",
    entityType: "onboarding_request",
    entityId: request.id,
    before: createOnboardingAuditSnapshot(request),
    after: createOnboardingAuditSnapshot(onboardingRequestFromRow(data as DbRecord)),
  });

  return onboardingRequestFromRow(data as DbRecord);
}

export async function rejectStoreAccessRequest(
  input: OnboardingDecisionInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertCanReviewStoreAccessRequests(actor);
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const request = await getPendingStoreAccessRequest(supabase, input.id, storeId);
  const context = await getStoreReviewContext(supabase, storeId, actor);
  assertCanReviewStoreAccessRequest(request, storeId);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "rejected",
      reviewed_by: actor.id,
      reviewed_by_membership_id: context.membershipId,
      reviewed_at: now,
      decision_note: sanitizeOptionalNote(input.note),
      review_scope: "store",
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("request_type", "join_store")
    .eq("status", "pending")
    .eq("review_scope", "store")
    .eq("target_store_id", storeId)
    .select("*")
    .maybeSingle();
  fail(error, "拒绝加入申请失败");
  if (!data) throw new Error("加入申请已处理，请刷新后再试");

  await writeAuditLog({
    actor,
    action: "reject_access_request",
    entityType: "onboarding_request",
    entityId: request.id,
    before: createOnboardingAuditSnapshot(request),
    after: createOnboardingAuditSnapshot(onboardingRequestFromRow(data as DbRecord)),
  });

  return onboardingRequestFromRow(data as DbRecord);
}

async function getPendingStoreAccessRequest(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  id: string,
  storeId: string,
): Promise<OnboardingRequest> {
  const { data, error } = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("id", id)
    .eq("request_type", "join_store")
    .eq("status", "pending")
    .eq("review_scope", "store")
    .eq("target_store_id", storeId)
    .maybeSingle();
  fail(error, "读取加入申请失败");
  if (!data) throw new Error("加入申请不存在或已处理");
  return onboardingRequestFromRow(data as DbRecord);
}

async function markStoreAccessApprovalFailed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  requestId: string,
) {
  await supabase
    .from("onboarding_requests")
    .update({
      status: "rejected",
      decision_note: "批准失败，请重新提交申请或联系店铺负责人。",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "approved");
}

async function markInvitationAcceptFailed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  invitationId: string,
) {
  await supabase
    .from("store_invitations")
    .update({
      status: "invited",
      accepted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("status", "active");
}

async function readPendingInvitationForEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  email: string,
) {
  const { data, error } = await supabase
    .from("store_invitations")
    .select("*")
    .eq("store_id", storeId)
    .eq("email", email)
    .eq("status", "invited")
    .maybeSingle();
  fail(error, "读取待接受邀请失败");
  return data ? (data as DbRecord) : null;
}

async function enforceInviteLinkRedeemRateLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  actor: AuditActor,
  codeHash: string,
) {
  const windowStart = new Date(Date.now() - INVITE_LINK_REDEEM_WINDOW_MS).toISOString();
  const actorAttempts = actor.id
    ? await countInviteLinkAttempts(supabase, "actor_id", actor.id, windowStart)
    : 0;
  const ipAttempts = actor.requestIpHash
    ? await countInviteLinkAttempts(supabase, "ip_hash", actor.requestIpHash, windowStart)
    : 0;

  if (Math.max(actorAttempts, ipAttempts) < INVITE_LINK_REDEEM_LIMIT) return;

  await recordInviteLinkAttempt(supabase, {
    actor,
    codeHash,
    result: "rate_limited",
  });
  throw new Error("邀请码不存在或已失效");
}

async function countInviteLinkAttempts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  column: "actor_id" | "ip_hash",
  value: string,
  windowStart: string,
) {
  const { count, error } = await supabase
    .from("store_invite_link_attempts")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", windowStart);
  fail(error, "检查邀请码尝试次数失败");
  return count ?? 0;
}

async function recordInviteLinkAttempt(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  {
    actor,
    codeHash,
    result,
    storeId,
  }: {
    actor: AuditActor;
    codeHash: string;
    result:
      | "success"
      | "existing_invitation"
      | "rate_limited"
      | "not_found"
      | "expired"
      | "over_limit"
      | "already_member"
      | "claim_failed"
      | "insert_failed";
    storeId?: string;
  },
) {
  const { error } = await supabase.from("store_invite_link_attempts").insert({
    id: crypto.randomUUID(),
    actor_id: actor.id ?? null,
    ip_hash: actor.requestIpHash ?? null,
    code_hash: codeHash,
    store_id: storeId ?? null,
    result,
  });
  fail(error, "记录邀请码尝试失败");
}

async function getStoreReviewContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  actor: AuditActor,
) {
  if (!actor.id || actor.isSystem) throw new ForbiddenError();
  const { data: membership, error: membershipError } = await supabase
    .from("store_memberships")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", actor.id)
    .eq("status", "active")
    .maybeSingle();
  fail(membershipError, "读取审核人身份失败");
  if (!membership) throw new ForbiddenError("你不是当前店铺成员");
  return {
    membershipId: requiredString((membership as DbRecord).id),
  };
}

async function readStoreMemberForManagement(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  memberId: string,
): Promise<StoreMember> {
  const { data, error } = await supabase
    .from("store_memberships")
    .select("id, user_id, email, display_name, role, status, created_at, updated_at")
    .eq("id", memberId)
    .eq("store_id", storeId)
    .maybeSingle();
  fail(error, "读取员工失败");
  if (!data) throw new Error("员工不存在或不属于当前店铺");
  return memberFromRow(data as DbRecord);
}

function assertCanManageStoreMember(
  actor: AuditActor,
  member: StoreMember,
  options: { nextRole?: StoreRole; disable?: boolean; restore?: boolean } = {},
) {
  if (!actor.id || actor.isSystem) throw new ForbiddenError();
  if (member.role === "owner") {
    throw new ForbiddenError("店主账号不能在员工管理中停用或改角色");
  }
  if (options.nextRole && member.user_id === actor.id) {
    throw new ForbiddenError("不能修改自己的当前店铺角色");
  }
  if (options.disable && member.user_id === actor.id) {
    throw new ForbiddenError("不能停用自己的当前店铺权限");
  }
  if (member.role === "manager" || options.nextRole === "manager") {
    assertPermission(actor, "member:grant_manager");
    return;
  }
  assertPermission(actor, "member:manage_basic");
}

function projectStoreMemberManagement(actor: AuditActor, member: StoreMember) {
  const allowedRoles = (["manager", "technician", "sales", "viewer"] as const).filter((role) =>
    permits(() => {
      if (member.status !== "active") throw new ForbiddenError();
      assertCanGrantStoreRole(actor, role);
      assertCanManageStoreMember(actor, member, { nextRole: role });
    }),
  );
  const canDisable = permits(() => {
    if (member.status !== "active") throw new ForbiddenError();
    assertCanManageStoreMember(actor, member, { disable: true });
  });
  const canRestore = permits(() => {
    if (member.status !== "inactive") throw new ForbiddenError();
    assertCanManageStoreMember(actor, member, { restore: true });
    assertCanGrantStoreRole(actor, member.role);
  });
  const canUpdatePermissions =
    member.status === "active" &&
    member.role !== "owner" &&
    actor.storeRole === "owner" &&
    can(actor, "member:grant_manager");
  return {
    allowed_roles: allowedRoles,
    can_update_role: allowedRoles.length > 0,
    can_update_permissions: canUpdatePermissions,
    can_disable: canDisable,
    can_restore: canRestore,
  };
}

function permits(check: () => void) {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

function createMemberAuditSnapshot(member: StoreMember): Record<string, unknown> {
  return {
    id: member.id,
    user_id: member.user_id,
    role: member.role,
    status: member.status,
    created_at: member.created_at,
    updated_at: member.updated_at,
  };
}

function assertCanReviewStoreAccessRequest(request: OnboardingRequest, storeId: string) {
  if (canStoreReviewAccessRequest(request, storeId)) {
    return;
  }
  throw new ForbiddenError("你没有权限处理这个加入申请");
}

async function upsertStaffProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: OnboardingRequest,
  role: StoreRole,
  now: string,
) {
  const { error } = await supabase.from("staff_profiles").upsert(
    {
      id: request.requester_user_id,
      email: request.email,
      display_name: request.display_name || displayNameFromEmail(request.email),
      role,
      status: "active",
      updated_at: now,
    },
    { onConflict: "id" },
  );
  fail(error, "同步员工档案失败");
}

async function upsertStoreMembership(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: OnboardingRequest,
  storeId: string,
  role: StoreRole,
  now: string,
) {
  const { error } = await supabase.from("store_memberships").upsert(
    {
      store_id: storeId,
      user_id: request.requester_user_id,
      email: request.email,
      display_name: request.display_name || displayNameFromEmail(request.email),
      role,
      status: "active",
      updated_at: now,
    },
    { onConflict: "store_id,user_id" },
  );
  fail(error, "同步店铺成员关系失败");
}

async function assertStoreMembership(
  storeId: string,
  actor: AuditActor,
): Promise<ActorStoreMembership> {
  if (!actor.id || actor.isSystem) throw new ForbiddenError();

  const localStore = actor.stores?.find((store) => store.id === storeId);
  if (localStore?.status === "active") return localStore;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_memberships")
    .select("id, store_id, role, status, store:stores(id, name, slug, status)")
    .eq("user_id", actor.id)
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();
  fail(error, "读取店铺成员关系失败");
  if (!data) throw new ForbiddenError("你没有权限进入这个店铺");

  const row = data as StoreMembershipRow;
  const store = Array.isArray(row.store) ? row.store[0] : row.store;
  if (!store || store.status !== "active") throw new ForbiddenError("店铺不可用");
  return {
    id: requiredString(row.store_id) || requiredString(store.id),
    name: requiredString(store.name),
    slug: requiredString(store.slug),
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
  };
}

function requireActiveStoreId(actor: AuditActor) {
  if (!actor.storeId || actor.isSystem) throw new ForbiddenError();
  return actor.storeId;
}

function assertCanManageStoreMembers(actor: AuditActor) {
  assertPermission(actor, "member:manage_basic");
}

function isMissingStoreInviteLinksTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  if (typeof record.message !== "string") return false;
  return (
    record.code === "PGRST205" &&
    record.message.includes("store_invite_links") &&
    record.message.includes("schema cache")
  );
}

function isMissingStorePermissionGrantsTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  if (typeof record.message !== "string") return false;
  return (
    record.code === "PGRST205" &&
    record.message.includes("store_member_permission_grants") &&
    record.message.includes("schema cache")
  );
}

async function listStoreMemberPermissionGrantRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
) {
  const source = supabase.from("store_member_permission_grants") as unknown;
  if (!source || typeof source !== "object" || !("select" in source)) return [];
  const selected = (source as { select: (columns: string) => unknown }).select(
    "membership_id, action",
  );
  if (!selected || typeof selected !== "object" || !("eq" in selected)) return [];
  const scoped = (selected as { eq: (column: string, value: string) => unknown }).eq(
    "store_id",
    storeId,
  );
  if (!scoped || typeof scoped !== "object" || !("is" in scoped)) return [];
  const result = await (scoped as { is: (column: string, value: null) => Promise<unknown> }).is(
    "revoked_at",
    null,
  );
  if (!result || typeof result !== "object") return [];
  const record = result as { data?: unknown; error?: unknown };
  if (isMissingStorePermissionGrantsTableError(record.error)) return [];
  fail(record.error as { message: string } | null | undefined, "读取成员权限失败");
  return (record.data ?? []) as DbRecord[];
}

function groupPermissionGrantsByMembership(rows: DbRecord[]) {
  const grants = new Map<string, StorePermissionAction[]>();
  for (const row of rows) {
    const membershipId = requiredString(row.membership_id);
    if (!membershipId || !isStorePermissionAction(row.action)) continue;
    const current = grants.get(membershipId) ?? [];
    if (!current.includes(row.action)) current.push(row.action);
    grants.set(membershipId, current);
  }
  for (const [membershipId, actions] of grants.entries()) {
    grants.set(membershipId, normalizeStorePermissionGrants(actions));
  }
  return grants;
}

async function storePermissionsFromActor(
  actor: AuditActor,
  options: { primaryOwnerOverride?: boolean } = {},
) {
  const canManageOrderData =
    isOrderDataExportEnabled() &&
    (options.primaryOwnerOverride === true || (await isPrimaryStoreOwner(actor)));
  const canUpdateStoreSettings = can(actor, "settings:update_store");
  const canManageMembers = can(actor, "member:manage_basic");
  const canInviteMembers = canManageMembers && can(actor, "member:invite");
  return {
    canReadSuppliers: can(actor, "supplier:read"),
    canAssignSuppliers: can(actor, "supplier:assign"),
    canManageSuppliers: can(actor, "supplier:manage"),
    canReadInventory: can(actor, "inventory:read"),
    canManageOrderData,
    canApplyOrderData: canManageOrderData && isOrderDataApplyEnabled(),
    canSearchOrderArchive: can(actor, "order:archive_search"),
    canBrowseOrderArchive: can(actor, "order:archive_browse"),
    canReadOrderFinance: can(actor, "finance:order_read"),
    canReadAggregateFinance: can(actor, "finance:aggregate_read"),
    canReadProfit: can(actor, "finance:profit_read"),
    canExportOrders: can(actor, "order:export"),
    canReadStoreSettings: Boolean(actor.storeId && !actor.isSystem),
    canUpdateStoreSettings,
    canConfigureWorkflow: can(actor, "settings:update_workflow"),
    canReadMessageTemplates: Boolean(actor.storeId && !actor.isSystem),
    canUpdateMessageTemplates: can(actor, "settings:update_message_template"),
    canListMembers: canManageMembers,
    canInviteMembers,
    memberInviteRoles: (canInviteMembers
      ? actor.storeRole === "owner"
        ? ["manager", "technician", "sales", "viewer"]
        : ["technician", "sales", "viewer"]
      : []) as ApprovedStoreRole[],
    canManageMembers,
    canRevokeMembers: canManageMembers && can(actor, "member:revoke"),
    canGrantManager: can(actor, "member:grant_manager"),
    canReviewAccessRequests: actor.storeRole === "owner" && can(actor, "member:grant_manager"),
    canManageKioskDevices: canUpdateStoreSettings,
    canReviewKioskSessions: canUpdateStoreSettings && can(actor, "order:update_intake"),
    canViewAudit: can(actor, "support:view_audit"),
  };
}

function assertCanReviewStoreAccessRequests(actor: AuditActor) {
  if (actor.storeRole !== "owner") {
    throw new ForbiddenError("只有店主可以处理加入申请");
  }
  assertPermission(actor, "member:grant_manager");
}

function assertCanGrantStoreRole(actor: AuditActor, role: StoreRole) {
  if (role === "manager") {
    assertPermission(actor, "member:grant_manager");
    return;
  }
  assertPermission(actor, "member:manage_basic");
}

async function enforceCreateStoreRateLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  actor: AuditActor,
) {
  if (!actor.id) throw new ForbiddenError("需要登录员工账号后才能创建店铺");
  const windowStart = new Date(Date.now() - CREATE_STORE_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", actor.id)
    .gte("created_at", windowStart);
  fail(error, "检查创建店铺频率失败");
  if ((count ?? 0) >= CREATE_STORE_LIMIT) {
    throw new Error("创建店铺过于频繁，请稍后再试");
  }
}

async function uniqueStoreSlug(supabase: ReturnType<typeof getSupabaseAdmin>, name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64).replace(/-+$/g, "");
    const { data, error } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    fail(error, "检查店铺标识失败");
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64).replace(/-+$/g, "");
}

async function setActiveStoreCookie(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STORE_COOKIE_MAX_AGE,
  });
}

async function nextContext(
  actor: AuditActor,
  activeStore: ActorStoreMembership,
  primaryOwnerOverride = false,
): Promise<StoreContext> {
  const stores = actor.stores?.filter((store) => store.id !== activeStore.id) ?? [];
  const nextActor = {
    ...actor,
    storeId: activeStore.id,
    storeName: activeStore.name,
    storeRole: activeStore.role,
    activeStoreExplicit: true,
  };
  return {
    activeStore,
    stores: [activeStore, ...stores],
    permissions: await storePermissionsFromActor(nextActor, { primaryOwnerOverride }),
  };
}

function activeStoreFromActor(actor: AuditActor): ActorStoreMembership | undefined {
  if (!actor.storeId) return undefined;
  return (
    actor.stores?.find((store) => store.id === actor.storeId) ?? {
      id: actor.storeId,
      name: actor.storeName || "RepairDesk",
      slug: "store",
      role: actor.storeRole ?? actor.role ?? "viewer",
      status: "active",
    }
  );
}

function storeFromRow(row: DbRecord, role: StoreRole): ActorStoreMembership {
  return {
    id: requiredString(row.id),
    name: requiredString(row.name),
    slug: requiredString(row.slug),
    role,
    status: toMembershipStatus(row.status),
  };
}

function memberFromRow(row: DbRecord, permissionGrants: StorePermissionAction[] = []): StoreMember {
  const role = toStoreRole(row.role);
  return {
    id: requiredString(row.id),
    user_id: requiredString(row.user_id),
    email: requiredString(row.email),
    display_name: requiredString(row.display_name) || undefined,
    role,
    status: toMembershipStatus(row.status),
    permission_grants: normalizeStorePermissionGrants(permissionGrants, role),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function invitationFromRow(row: DbRecord): StoreInvitation {
  const store = Array.isArray(row.store) ? row.store[0] : (row.store as DbRecord | undefined);
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id) || undefined,
    store_name: store ? requiredString(store.name) || undefined : undefined,
    email: requiredString(row.email),
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    invited_by: requiredString(row.invited_by) || undefined,
    accepted_at: requiredString(row.accepted_at) || undefined,
    expires_at: requiredString(row.expires_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function publicInvitationFromRow(row: DbRecord): StoreInvitation {
  const invitation = invitationFromRow(row);
  return {
    id: invitation.id,
    store_name: invitation.store_name,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
    updated_at: invitation.updated_at,
  };
}

function inviteLinkFromRow(row: DbRecord): StoreInviteLink {
  const store = Array.isArray(row.store) ? row.store[0] : (row.store as DbRecord | undefined);
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id) || undefined,
    store_name: store ? requiredString(store.name) || undefined : undefined,
    label: requiredString(row.label) || undefined,
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    expires_at: requiredString(row.expires_at),
    max_uses: optionalPositiveInteger(row.max_uses),
    used_count: optionalPositiveInteger(row.used_count) ?? 0,
    created_by: requiredString(row.created_by) || undefined,
    revoked_by: requiredString(row.revoked_by) || undefined,
    revoked_at: requiredString(row.revoked_at) || undefined,
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function createInvitationAuditSnapshot(row: DbRecord): Record<string, unknown> {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id) || undefined,
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    invited_by: requiredString(row.invited_by) || undefined,
    accepted_at: requiredString(row.accepted_at) || undefined,
    expires_at: requiredString(row.expires_at) || undefined,
  };
}

function createInviteLinkAuditSnapshot(row: DbRecord): Record<string, unknown> {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id) || undefined,
    label: requiredString(row.label) || undefined,
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    expires_at: requiredString(row.expires_at) || undefined,
    max_uses: optionalPositiveInteger(row.max_uses),
    used_count: optionalPositiveInteger(row.used_count) ?? 0,
    created_by: requiredString(row.created_by) || undefined,
    revoked_by: requiredString(row.revoked_by) || undefined,
    revoked_at: requiredString(row.revoked_at) || undefined,
  };
}

function onboardingRequestFromRow(row: DbRecord): OnboardingRequest {
  return {
    id: requiredString(row.id),
    requester_user_id: requiredString(row.requester_user_id),
    email: requiredString(row.email),
    display_name: requiredString(row.display_name) || undefined,
    request_type: row.request_type === "join_store" ? "join_store" : "create_store",
    desired_store_name: requiredString(row.desired_store_name) || undefined,
    target_store_id: requiredString(row.target_store_id) || undefined,
    target_store_name: requiredString(row.target_store_name) || undefined,
    target_owner_email: requiredString(row.target_owner_email) || undefined,
    request_note: requiredString(row.request_note) || undefined,
    review_scope: toReviewScope(row.review_scope),
    requested_role: toStoreRole(row.requested_role),
    approved_role: toApprovedRole(row.approved_role),
    status: toRequestStatus(row.status),
    reviewed_by: requiredString(row.reviewed_by) || undefined,
    reviewed_by_membership_id: requiredString(row.reviewed_by_membership_id) || undefined,
    reviewed_at: requiredString(row.reviewed_at) || undefined,
    decision_note: requiredString(row.decision_note) || undefined,
    resulting_store_id: requiredString(row.resulting_store_id) || undefined,
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function sanitizeStoreName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("店铺名称至少需要 2 个字符");
  if (name.length > 80) throw new Error("店铺名称不能超过 80 个字符");
  return name;
}

function sanitizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  return email;
}

function sanitizeInviteRole(value: StoreInviteInput["role"]): StoreInviteInput["role"] {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  throw new Error("邀请角色不正确");
}

function sanitizeInviteLinkLabel(value?: string) {
  const label = value?.trim().replace(/\s+/g, " ");
  if (!label) return null;
  if (label.length > 40) throw new Error("邀请码备注不能超过 40 个字符");
  return label;
}

function sanitizeInviteLinkExpiry(value?: number) {
  if (value === undefined) return 7;
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    throw new Error("邀请码有效期必须为 1-30 天");
  }
  return value;
}

function sanitizeInviteLinkMaxUses(value?: number) {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error("邀请码次数必须为 1-50 次");
  }
  return value;
}

function normalizeInviteCode(value: string) {
  const code = value.trim();
  if (code.length < 12 || code.length > 120) throw new Error("邀请码不正确");
  return code;
}

function generateInviteCode() {
  return `rd_${randomBytes(18).toString("base64url")}`;
}

function hashInviteCode(value: string) {
  return createHash("sha256").update(normalizeInviteCode(value)).digest("hex");
}

function optionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  return Math.trunc(number);
}

function isInviteLinkUseLimitReached(row: DbRecord) {
  const maxUses = optionalPositiveInteger(row.max_uses);
  if (!maxUses) return false;
  return (optionalPositiveInteger(row.used_count) ?? 0) >= maxUses;
}

function sanitizeAccessRole(value: StoreRole): Exclude<StoreRole, "owner"> {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  throw new Error("不能批准 owner 角色");
}

function toApprovedRole(value: unknown): OnboardingRequest["approved_role"] {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  return undefined;
}

function sanitizeOptionalNote(value?: string) {
  const note = value?.trim().replace(/\s+/g, " ");
  if (!note) return null;
  if (note.length > 500) throw new Error("审核备注不能超过 500 个字符");
  return note;
}

function displayNameFromEmail(email?: string) {
  return (
    email
      ?.split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "员工"
  );
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length >= 3 ? slug : `store-${crypto.randomUUID().slice(0, 6)}`;
}

function generateStoreCode(name: string) {
  const base = slugify(name).replace(/-/g, "").slice(0, 6).toUpperCase();
  const prefix = base.length >= 3 ? base : "STORE";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`.slice(0, 32);
}

function toStoreRole(value: unknown): StoreRole {
  if (
    value === "owner" ||
    value === "manager" ||
    value === "technician" ||
    value === "sales" ||
    value === "viewer"
  ) {
    return value;
  }
  return "viewer";
}

function toMembershipStatus(value: unknown): StoreMembershipStatus {
  if (value === "active" || value === "invited" || value === "inactive") return value;
  return "inactive";
}

function toRequestStatus(value: unknown): OnboardingRequest["status"] {
  if (value === "approved" || value === "rejected" || value === "cancelled") return value;
  return "pending";
}

function toReviewScope(value: unknown): OnboardingRequest["review_scope"] {
  return value === "store" ? "store" : "platform";
}

interface StoreMembershipRow {
  store_id?: string;
  role?: unknown;
  status?: unknown;
  store?: StoreRow | StoreRow[];
}

interface StoreRow {
  id?: string;
  name?: string;
  slug?: string;
  status?: unknown;
}
