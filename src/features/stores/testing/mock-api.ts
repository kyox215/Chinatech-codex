import type {
  AuditActor,
  OnboardingDecisionInput,
  OnboardingRequest,
  StoreContext,
  StoreCreateInput,
  StoreInvitationDecisionInput,
  StoreInviteLinkCreateInput,
  StoreInviteLinkCreateResult,
  StoreInviteLinkDecisionInput,
  StoreInviteLinkRedeemInput,
  StoreInvitation,
  StoreInviteInput,
  StoreMember,
  StoreMembersResult,
} from "@/lib/repairdesk/types";

const mockStores = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "ChinaTech",
    slug: "chinatech",
    role: "owner",
    status: "active",
  },
] satisfies StoreContext["stores"];

let activeStoreId = mockStores[0].id;
const mockMembers: StoreMember[] = [
  {
    id: "mock_member_owner",
    user_id: "mock_user_owner",
    email: "owner@repairdesk.local",
    display_name: "店铺管理员",
    role: "owner",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
const mockInvitations: StoreMembersResult["invitations"] = [];
const mockInviteLinks: NonNullable<StoreMembersResult["invite_links"]> = [];
const mockInviteLinkHashes = new Map<string, string>();

export async function getStoreContext(_actor?: AuditActor): Promise<StoreContext> {
  return context();
}

export async function switchActiveStore(
  storeId: string,
  _actor?: AuditActor,
): Promise<StoreContext> {
  if (!mockStores.some((store) => store.id === storeId)) throw new Error("店铺不存在");
  activeStoreId = storeId;
  return context();
}

export async function createStore(
  input: StoreCreateInput,
  actor?: AuditActor,
): Promise<StoreContext> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("店铺名称至少需要 2 个字符");
  const id = crypto.randomUUID();
  mockStores.unshift({
    id,
    name,
    slug: mockStoreSlug(name),
    role: "owner",
    status: "active",
  });
  mockMembers.unshift({
    id: `mock_member_${id}`,
    user_id: actor?.id ?? "mock_user_owner",
    email: actor?.email ?? "owner@repairdesk.local",
    display_name: actor?.displayName ?? "店铺管理员",
    role: "owner",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  activeStoreId = id;
  return context();
}

export async function listStoreMembers(_actor?: AuditActor): Promise<StoreMembersResult> {
  return members();
}

export async function listStoreAccessRequests(_actor?: AuditActor): Promise<OnboardingRequest[]> {
  return [];
}

export async function approveStoreAccessRequest(
  _input: OnboardingDecisionInput,
  _actor?: AuditActor,
): Promise<OnboardingRequest> {
  throw new Error("Mock 模式暂不支持加入申请审批");
}

export async function rejectStoreAccessRequest(
  _input: OnboardingDecisionInput,
  _actor?: AuditActor,
): Promise<OnboardingRequest> {
  throw new Error("Mock 模式暂不支持加入申请审批");
}

export async function inviteStoreMember(
  input: StoreInviteInput,
  _actor?: AuditActor,
): Promise<StoreMembersResult> {
  const email = input.email.trim().toLowerCase();
  const role = sanitizeInviteRole(input.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  if (mockMembers.some((member) => member.email.toLowerCase() === email)) {
    throw new Error("该邮箱已经是当前店铺成员");
  }
  const now = new Date().toISOString();
  const existingInvite = mockInvitations.find(
    (item) =>
      item.store_id === activeStoreId &&
      item.email.toLowerCase() === email &&
      item.status === "invited",
  );
  const nextInvite = {
    ...(existingInvite ?? {
      id: crypto.randomUUID(),
      store_id: activeStoreId,
      store_name: mockStores.find((store) => store.id === activeStoreId)?.name,
      email,
      created_at: now,
    }),
    role,
    status: "invited" as const,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: now,
  };
  if (existingInvite) {
    Object.assign(existingInvite, nextInvite);
  } else {
    mockInvitations.unshift(nextInvite);
  }
  return members();
}

export async function acceptStoreInvitation(
  input: StoreInvitationDecisionInput,
  actor?: AuditActor,
): Promise<StoreContext> {
  const email = actor?.email?.trim().toLowerCase();
  const invitation = mockInvitations.find(
    (item) =>
      item.id === input.id && item.email.toLowerCase() === email && item.status === "invited",
  );
  if (!invitation) throw new Error("邀请不存在或已失效");
  if (new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error("邀请已过期");
  const storeId = invitation.store_id ?? activeStoreId;
  const store = mockStores.find((item) => item.id === storeId) ?? mockStores[0];
  invitation.status = "active";
  invitation.accepted_at = new Date().toISOString();
  invitation.updated_at = invitation.accepted_at;
  mockMembers.unshift({
    id: `mock_member_${input.id}`,
    user_id: actor?.id ?? "mock_user_invited",
    email: invitation.email,
    display_name: actor?.displayName ?? invitation.email,
    role: invitation.role,
    status: "active",
    created_at: invitation.accepted_at,
    updated_at: invitation.accepted_at,
  });
  activeStoreId = store.id;
  return context();
}

export async function createStoreInviteLink(
  input: StoreInviteLinkCreateInput,
  _actor?: AuditActor,
): Promise<StoreInviteLinkCreateResult> {
  const now = new Date().toISOString();
  const role = sanitizeInviteRole(input.role);
  const code = `rd_${crypto.randomUUID().replace(/-/g, "")}`;
  const link = {
    id: crypto.randomUUID(),
    store_id: activeStoreId,
    store_name: mockStores.find((store) => store.id === activeStoreId)?.name,
    label: input.label?.trim() || undefined,
    role,
    status: "active" as const,
    expires_at: new Date(
      Date.now() + (input.expires_in_days ?? 7) * 24 * 60 * 60 * 1000,
    ).toISOString(),
    max_uses: input.max_uses,
    used_count: 0,
    created_by: _actor?.id,
    created_at: now,
    updated_at: now,
  };
  mockInviteLinks.unshift(link);
  mockInviteLinkHashes.set(link.id, mockHashInviteCode(code));
  return { link, code };
}

export async function revokeStoreInviteLink(
  input: StoreInviteLinkDecisionInput,
  _actor?: AuditActor,
): Promise<StoreMembersResult> {
  const link = mockInviteLinks.find((item) => item.id === input.id && item.status === "active");
  if (!link) throw new Error("邀请码不存在或已处理");
  link.status = "inactive";
  link.revoked_by = _actor?.id;
  link.revoked_at = new Date().toISOString();
  link.updated_at = link.revoked_at;
  return members();
}

export async function redeemStoreInviteLink(input: StoreInviteLinkRedeemInput, actor?: AuditActor) {
  const email = actor?.email?.trim().toLowerCase();
  if (!email) throw new Error("需要登录员工账号后才能兑换邀请码");
  const codeHash = mockHashInviteCode(input.code.trim());
  const link = mockInviteLinks.find(
    (item) => mockInviteLinkHashes.get(item.id) === codeHash && item.status === "active",
  );
  if (!link) throw new Error("邀请码不存在或已失效");
  if (new Date(link.expires_at).getTime() <= Date.now()) throw new Error("邀请码不存在或已失效");
  if (link.max_uses !== undefined && link.used_count >= link.max_uses) {
    throw new Error("邀请码不存在或已失效");
  }
  if (mockMembers.some((member) => member.email.toLowerCase() === email)) {
    throw new Error("你已经是该店铺成员");
  }
  const existingInvite = mockInvitations.find(
    (item) => item.store_id === link.store_id && item.email === email && item.status === "invited",
  );
  if (existingInvite) return mockPublicInvitation(existingInvite);

  link.used_count += 1;
  link.updated_at = new Date().toISOString();
  const invitation = {
    id: crypto.randomUUID(),
    store_id: link.store_id,
    store_name: link.store_name,
    email,
    role: link.role,
    status: "invited" as const,
    invited_by: link.created_by,
    accepted_at: undefined,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: link.updated_at,
    updated_at: link.updated_at,
  };
  mockInvitations.unshift(invitation);
  return mockPublicInvitation(invitation);
}

export async function revokeStoreInvitation(
  input: StoreInvitationDecisionInput,
  _actor?: AuditActor,
): Promise<StoreMembersResult> {
  const invitation = mockInvitations.find(
    (item) => item.id === input.id && item.status === "invited",
  );
  if (!invitation) throw new Error("邀请不存在或已处理");
  invitation.status = "inactive";
  invitation.updated_at = new Date().toISOString();
  return members();
}

function context(): StoreContext {
  return {
    activeStore: mockStores.find((store) => store.id === activeStoreId) ?? mockStores[0],
    stores: [...mockStores],
    permissions: {
      canReadSuppliers: true,
      canAssignSuppliers: true,
      canManageSuppliers: true,
    },
  };
}

function members(): StoreMembersResult {
  return {
    members: [...mockMembers],
    invitations: mockInvitations.filter((invitation) => invitation.status === "invited"),
    invite_links: mockInviteLinks.filter((link) => link.status === "active"),
  };
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "store"
  );
}

function mockStoreSlug(value: string) {
  return `${slugify(value)}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64).replace(/-+$/g, "");
}

function sanitizeInviteRole(role: StoreInviteInput["role"]) {
  if (!["manager", "technician", "sales", "viewer"].includes(role)) {
    throw new Error("不能邀请 owner 角色");
  }
  return role;
}

function mockHashInviteCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function mockPublicInvitation(invitation: StoreInvitation): StoreInvitation {
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
