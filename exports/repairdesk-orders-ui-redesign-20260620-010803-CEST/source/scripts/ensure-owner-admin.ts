import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_STORE_NAME = "ChinaTech";
export const DEFAULT_STORE_SLUG = "chinatech-default";
export const DEFAULT_ADMIN_EMAIL = "kyox120@gmail.com";
export const DEFAULT_DISPLAY_NAME = "最高管理员";

export interface OwnerAdminConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  email: string;
  password: string;
  displayName: string;
  storeId: string;
}

export interface OwnerAdminResult {
  userId: string;
  email: string;
  displayName: string;
  storeId: string;
  authUserCreated: boolean;
  platformAdminSynced: boolean;
}

type MutableEnv = Record<string, string | undefined>;

export function loadEnvFile(filePath: string, env: MutableEnv = process.env) {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (env[key]) continue;
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

export function resolveBootstrapConfig(env: MutableEnv = process.env): OwnerAdminConfig {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const password = env.ADMIN_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running db:ensure-owner-admin.",
    );
  }

  if (!password) {
    throw new Error("Set ADMIN_PASSWORD before running db:ensure-owner-admin.");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    email: normalizeEmail(env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL),
    password,
    displayName: (env.ADMIN_DISPLAY_NAME ?? DEFAULT_DISPLAY_NAME).trim() || DEFAULT_DISPLAY_NAME,
    storeId: env.ADMIN_STORE_ID ?? DEFAULT_STORE_ID,
  };
}

export async function ensureOwnerAdmin(
  supabase: SupabaseClient,
  config: OwnerAdminConfig,
): Promise<OwnerAdminResult> {
  const effectiveConfig = {
    ...config,
    storeId: await resolveTargetStoreId(supabase, config),
  };
  const existingUser = await findAuthUserByEmail(supabase, config.email);
  const user = existingUser
    ? await updateAuthOwnerUser(supabase, existingUser, effectiveConfig)
    : await createAuthOwnerUser(supabase, effectiveConfig);

  await ensureDefaultStore(supabase, effectiveConfig, user.id);
  await upsertStaffProfile(supabase, effectiveConfig, user.id);
  await upsertStoreMembership(supabase, effectiveConfig, user.id);
  await upsertPlatformAdmin(supabase, effectiveConfig, user.id);
  await writeBootstrapAuditLog(supabase, effectiveConfig, user.id, !existingUser);

  return {
    userId: user.id,
    email: effectiveConfig.email,
    displayName: effectiveConfig.displayName,
    storeId: effectiveConfig.storeId,
    authUserCreated: !existingUser,
    platformAdminSynced: true,
  };
}

async function resolveTargetStoreId(supabase: SupabaseClient, config: OwnerAdminConfig) {
  const { data: configuredStore, error: configuredStoreError } = await supabase
    .from("stores")
    .select("id")
    .eq("id", config.storeId)
    .maybeSingle();
  if (configuredStoreError) throw new Error(`读取默认店铺失败：${configuredStoreError.message}`);
  if (configuredStore?.id) return String(configuredStore.id);
  if (config.storeId !== DEFAULT_STORE_ID) return config.storeId;

  const { data: slugStore, error: slugStoreError } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", DEFAULT_STORE_SLUG)
    .maybeSingle();
  if (slugStoreError) throw new Error(`读取 ChinaTech 店铺失败：${slugStoreError.message}`);
  if (slugStore?.id) return String(slugStore.id);

  const { data: namedStores, error: namedStoresError } = await supabase
    .from("stores")
    .select("id")
    .ilike("name", DEFAULT_STORE_NAME);
  if (namedStoresError) throw new Error(`读取 ChinaTech 店铺失败：${namedStoresError.message}`);
  if ((namedStores ?? []).length === 1 && namedStores?.[0]?.id) {
    return String(namedStores[0].id);
  }

  return config.storeId;
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string): Promise<User | null> {
  const targetEmail = normalizeEmail(email);
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`读取 Supabase Auth 用户失败：${error.message}`);

    const found = data.users.find((user) => normalizeEmail(user.email ?? "") === targetEmail);
    if (found) return found;

    const nextPage = "nextPage" in data ? data.nextPage : null;
    if (!nextPage || nextPage <= page) return null;
    page = nextPage;
  }
}

async function createAuthOwnerUser(supabase: SupabaseClient, config: OwnerAdminConfig) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: buildUserMetadata(config),
    app_metadata: buildAppMetadata(config),
  });

  if (error) throw new Error(`创建 Supabase Auth 用户失败：${error.message}`);
  if (!data.user) throw new Error("创建 Supabase Auth 用户失败：Admin API 未返回用户。");
  return data.user;
}

async function updateAuthOwnerUser(supabase: SupabaseClient, user: User, config: OwnerAdminConfig) {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: {
      ...(isRecord(user.user_metadata) ? user.user_metadata : {}),
      ...buildUserMetadata(config),
    },
    app_metadata: {
      ...(isRecord(user.app_metadata) ? user.app_metadata : {}),
      ...buildAppMetadata(config),
    },
  });

  if (error) throw new Error(`更新 Supabase Auth 用户失败：${error.message}`);
  if (!data.user) throw new Error("更新 Supabase Auth 用户失败：Admin API 未返回用户。");
  return data.user;
}

async function ensureDefaultStore(
  supabase: SupabaseClient,
  config: OwnerAdminConfig,
  userId: string,
) {
  const now = new Date().toISOString();
  const { data: existingStore, error: readError } = await supabase
    .from("stores")
    .select("id")
    .eq("id", config.storeId)
    .maybeSingle();

  if (readError) throw new Error(`读取默认店铺失败：${readError.message}`);

  if (!existingStore) {
    const { error: insertError } = await supabase.from("stores").insert({
      id: config.storeId,
      name: DEFAULT_STORE_NAME,
      slug: DEFAULT_STORE_SLUG,
      owner_user_id: userId,
      status: "active",
      plan: "starter",
      timezone: "Europe/Rome",
      currency_code: "EUR",
      created_at: now,
      updated_at: now,
    });
    if (insertError) throw new Error(`创建默认店铺失败：${insertError.message}`);
    return;
  }

  const { error: updateError } = await supabase
    .from("stores")
    .update({ owner_user_id: userId, updated_at: now })
    .eq("id", config.storeId);
  if (updateError) throw new Error(`更新默认店铺 owner 失败：${updateError.message}`);
}

async function upsertStaffProfile(
  supabase: SupabaseClient,
  config: OwnerAdminConfig,
  userId: string,
) {
  const { error } = await supabase.from("staff_profiles").upsert(
    {
      id: userId,
      email: config.email,
      display_name: config.displayName,
      role: "owner",
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(`同步员工档案失败：${error.message}`);
}

async function upsertStoreMembership(
  supabase: SupabaseClient,
  config: OwnerAdminConfig,
  userId: string,
) {
  const { error } = await supabase.from("store_memberships").upsert(
    {
      store_id: config.storeId,
      user_id: userId,
      email: config.email,
      display_name: config.displayName,
      role: "owner",
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id,user_id" },
  );

  if (error) throw new Error(`同步店铺成员权限失败：${error.message}`);
}

async function upsertPlatformAdmin(
  supabase: SupabaseClient,
  config: OwnerAdminConfig,
  userId: string,
) {
  const { error } = await supabase.from("platform_admins").upsert(
    {
      user_id: userId,
      email: config.email,
      display_name: config.displayName,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(`同步平台管理员权限失败：${error.message}`);
}

async function writeBootstrapAuditLog(
  supabase: SupabaseClient,
  config: OwnerAdminConfig,
  userId: string,
  authUserCreated: boolean,
) {
  const { error } = await supabase.from("audit_logs").insert({
    id: randomUUID(),
    actor_id: null,
    actor_email: null,
    actor_name: "系统",
    store_id: config.storeId,
    action: "bootstrap_admin",
    entity_type: "staff_profile",
    entity_id: userId,
    before_data: null,
    after_data: {
      email: config.email,
      display_name: config.displayName,
      role: "owner",
      status: "active",
      store_id: config.storeId,
    },
    metadata: {
      source: "scripts/ensure-owner-admin",
      auth_user_created: authUserCreated,
    },
  });

  if (error) throw new Error(`写入管理员初始化审计日志失败：${error.message}`);
}

function buildUserMetadata(config: OwnerAdminConfig) {
  return {
    display_name: config.displayName,
    repairdesk_default_store_id: config.storeId,
  };
}

function buildAppMetadata(config: OwnerAdminConfig) {
  return {
    repairdesk_role: "owner",
    repairdesk_default_store_id: config.storeId,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const config = resolveBootstrapConfig();
  if (process.argv.includes("--dry-run")) {
    console.log(
      [
        "RepairDesk owner admin bootstrap dry-run.",
        `Email: ${config.email}`,
        `Display name: ${config.displayName}`,
        `Store: ${config.storeId}`,
        "Password: configured",
      ].join("\n"),
    );
    return;
  }

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await ensureOwnerAdmin(supabase, config);
  console.log(
    [
      "RepairDesk owner admin bootstrap complete.",
      `Email: ${result.email}`,
      `Display name: ${result.displayName}`,
      `Store: ${result.storeId}`,
      `Auth user: ${result.userId}`,
      `Created auth user: ${result.authUserCreated ? "yes" : "no"}`,
      `Platform admin synced: ${result.platformAdminSynced ? "yes" : "no"}`,
    ].join("\n"),
  );
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
