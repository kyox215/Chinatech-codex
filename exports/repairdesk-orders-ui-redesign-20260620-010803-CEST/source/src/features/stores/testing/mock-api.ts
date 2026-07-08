import type {
  AuditActor,
  StoreContext,
  StoreCreateInput,
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
  _actor?: AuditActor,
): Promise<StoreContext> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("店铺名称至少需要 2 个字符");
  const id = crypto.randomUUID();
  mockStores.unshift({
    id,
    name,
    slug: slugify(name),
    role: "owner",
    status: "active",
  });
  activeStoreId = id;
  return context();
}

export async function listStoreMembers(_actor?: AuditActor): Promise<StoreMembersResult> {
  return members();
}

export async function inviteStoreMember(
  input: StoreInviteInput,
  _actor?: AuditActor,
): Promise<StoreMembersResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  if (mockMembers.some((member) => member.email.toLowerCase() === email)) {
    throw new Error("该邮箱已经是当前店铺成员");
  }
  const now = new Date().toISOString();
  mockInvitations.unshift({
    id: crypto.randomUUID(),
    email,
    role: input.role,
    status: "invited",
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: now,
    updated_at: now,
  });
  return members();
}

function context(): StoreContext {
  return {
    activeStore: mockStores.find((store) => store.id === activeStoreId) ?? mockStores[0],
    stores: [...mockStores],
  };
}

function members(): StoreMembersResult {
  return {
    members: [...mockMembers],
    invitations: [...mockInvitations],
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
