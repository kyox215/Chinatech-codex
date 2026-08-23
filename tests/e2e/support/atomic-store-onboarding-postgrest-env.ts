import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOOPBACK_ORIGIN = "http://127.0.0.1:3123";
export const WEBSERVER_COMMAND = "npm run preview -- -H 127.0.0.1 -p 3123";
export const REPOSITORY_ROOT = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));

const productionProjectRef = "xluzcoduqsdvjoouqhkc";
const productionDeploymentHost = "chinatech-codex.vercel.app";

export type AtomicStoreOnboardingEnvironment = {
  baseURL: typeof LOOPBACK_ORIGIN;
  repositoryRoot: string;
  storageState: string;
  webServerCommand: typeof WEBSERVER_COMMAND;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProductionHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "chinatech.in" ||
    host === "www.chinatech.in" ||
    host.endsWith(".chinatech.in") ||
    host === productionDeploymentHost ||
    host.endsWith(".vercel.app")
  );
}

function csv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function assertNoSymlinkPath(value: string) {
  const absolutePath = path.resolve(value);
  const root = path.parse(absolutePath).root;
  const segments = path.relative(root, absolutePath).split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error("Real store-create E2E paths must not contain symbolic links.");
    }
  }
}

function assertNoGitAncestor(value: string) {
  const root = path.parse(value).root;
  let current = path.dirname(value);
  while (true) {
    if (existsSync(path.join(current, ".git"))) {
      throw new Error("Real store-create E2E state paths must not have a .git ancestor.");
    }
    if (current === root) break;
    current = path.dirname(current);
  }
}

function assertOutsideRepository(value: string) {
  const relative = path.relative(REPOSITORY_ROOT, value);
  if (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  ) {
    throw new Error("storageState must resolve outside the repository worktree.");
  }
}

function assertOwned(value: string, kind: "file" | "directory") {
  const owner = process.getuid?.();
  if (typeof owner !== "number") {
    throw new Error(`Real store-create E2E ${kind} ownership cannot be verified.`);
  }
  if (lstatSync(value).uid !== owner) {
    throw new Error(`Real store-create E2E ${kind} must be owned by the current user.`);
  }
}

function normalizeSupabaseUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Supabase URLs must use HTTPS without embedded credentials.");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function assertStorageState(storageStateValue: string) {
  if (!path.isAbsolute(storageStateValue)) {
    throw new Error("Real store-create E2E requires an absolute external storageState path.");
  }
  assertNoSymlinkPath(storageStateValue);
  const originalStat = lstatSync(storageStateValue);
  if (originalStat.isSymbolicLink()) {
    throw new Error("storageState must be a regular external file, not a symbolic link.");
  }
  const storageState = realpathSync(storageStateValue);
  const stateStat = lstatSync(storageState);
  if (!stateStat.isFile() || stateStat.isSymbolicLink()) {
    throw new Error("storageState must be a regular external file.");
  }
  if ((stateStat.mode & 0o777) !== 0o600) {
    throw new Error("storageState must have file mode 0600.");
  }
  assertOwned(storageState, "file");
  assertOutsideRepository(storageState);
  assertNoGitAncestor(storageState);

  const storageRootValue = process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_STORAGE_ROOT;
  if (storageRootValue) {
    if (!path.isAbsolute(storageRootValue)) {
      throw new Error("The external storage root must be an absolute path.");
    }
    assertNoSymlinkPath(storageRootValue);
    const rootStat = lstatSync(storageRootValue);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      throw new Error("The external storage root must be a regular directory.");
    }
    const storageRoot = realpathSync(storageRootValue);
    if ((lstatSync(storageRoot).mode & 0o777) !== 0o700) {
      throw new Error("The external storage root must have directory mode 0700.");
    }
    assertOwned(storageRoot, "directory");
    assertOutsideRepository(storageRoot);
    assertNoGitAncestor(storageRoot);
    const relative = path.relative(storageRoot, storageState);
    if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("storageState must be inside the configured external storage root.");
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(storageState, "utf8")) as unknown;
  } catch {
    throw new Error("storageState must contain valid JSON.");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.cookies) || parsed.cookies.length === 0) {
    throw new Error("storageState must contain at least one cookie.");
  }
  for (const cookie of parsed.cookies) {
    if (!isRecord(cookie) || typeof cookie.domain !== "string") {
      throw new Error("storageState cookies must have a domain.");
    }
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    if (domain !== "127.0.0.1") {
      throw new Error("storageState cookies must be scoped only to 127.0.0.1.");
    }
  }
  if (parsed.origins !== undefined) {
    if (!Array.isArray(parsed.origins)) {
      throw new Error("storageState origins must be an array when present.");
    }
    for (const origin of parsed.origins) {
      if (!isRecord(origin) || origin.origin !== LOOPBACK_ORIGIN) {
        throw new Error("storageState origins must match the exact loopback origin.");
      }
    }
  }

  return storageState;
}

export function assertAtomicStoreOnboardingPostgrestEnvironment(): AtomicStoreOnboardingEnvironment {
  if (process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_POSTGREST !== "1") {
    throw new Error(
      "Dedicated store-signup PostgREST E2E requires REPAIRDESK_E2E_ATOMIC_ONBOARDING_POSTGREST=1.",
    );
  }
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error("Real store-create E2E requires Node.js major version 24.");
  }
  if (process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_ENV !== "staging") {
    throw new Error("Real store-create E2E requires REPAIRDESK_E2E_ATOMIC_ONBOARDING_ENV=staging.");
  }
  if (process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== "0") {
    throw new Error("Real store-create E2E requires PLAYWRIGHT_REUSE_EXISTING_SERVER=0.");
  }
  if (process.env.PLAYWRIGHT_BASE_URL !== LOOPBACK_ORIGIN) {
    throw new Error(`Real store-create E2E requires PLAYWRIGHT_BASE_URL=${LOOPBACK_ORIGIN}.`);
  }
  if (process.env.PLAYWRIGHT_WEBSERVER_COMMAND !== WEBSERVER_COMMAND) {
    throw new Error(
      `Real store-create E2E requires PLAYWRIGHT_WEBSERVER_COMMAND=${WEBSERVER_COMMAND}.`,
    );
  }
  const baseURL = new URL(LOOPBACK_ORIGIN);
  if (baseURL.protocol !== "http:" || baseURL.hostname !== "127.0.0.1" || baseURL.port !== "3123") {
    throw new Error("Real store-create E2E permits only the exact loopback release server.");
  }
  if (isProductionHost(baseURL.hostname)) {
    throw new Error("Real store-create E2E refuses production or Vercel hosts.");
  }

  const supabaseUrlValue = process.env.SUPABASE_URL?.trim();
  const publicSupabaseUrlValue = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrlValue || !publicSupabaseUrlValue) {
    throw new Error("Real store-create E2E requires both Supabase URL environment variables.");
  }
  if (normalizeSupabaseUrl(supabaseUrlValue) !== normalizeSupabaseUrl(publicSupabaseUrlValue)) {
    throw new Error("SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must normalize identically.");
  }
  const supabaseUrl = new URL(supabaseUrlValue);
  if (!supabaseUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("Real store-create E2E requires a Supabase project URL.");
  }
  const projectRef = supabaseUrl.hostname.split(".")[0]?.toLowerCase();
  const allowedProjectRefs = csv(
    process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_NONPROD_PROJECT_REFS,
  ).map((ref) => ref.toLowerCase());
  if (
    !projectRef ||
    projectRef === productionProjectRef ||
    !allowedProjectRefs.includes(projectRef)
  ) {
    throw new Error(
      "Real store-create E2E refuses the production Supabase project or an unallowlisted ref.",
    );
  }
  const branchRef = process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_BRANCH_REF?.trim().toLowerCase();
  if (!branchRef || branchRef !== projectRef) {
    throw new Error(
      "The loopback release server and Supabase client must use the same branch ref.",
    );
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error("Real store-create E2E requires a publishable browser key.");
  }

  const keyMode = process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_KEY_MODE;
  if (keyMode !== "secret" && keyMode !== "legacy") {
    throw new Error("Real store-create E2E requires key mode secret or legacy.");
  }
  const hasSecretKey = Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  const hasLegacyKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (hasSecretKey === hasLegacyKey) {
    throw new Error("Real store-create E2E requires exactly one non-empty server key.");
  }
  if (keyMode === "secret" && !hasSecretKey) {
    throw new Error("Secret key mode requires a non-empty SUPABASE_SECRET_KEY.");
  }
  if (keyMode === "legacy" && !hasLegacyKey) {
    throw new Error("Legacy key mode requires a non-empty SUPABASE_SERVICE_ROLE_KEY.");
  }

  const storageStateValue = process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_STORAGE_STATE;
  if (!storageStateValue) {
    throw new Error("Real store-create E2E requires an external storageState path.");
  }
  return {
    baseURL: LOOPBACK_ORIGIN,
    repositoryRoot: REPOSITORY_ROOT,
    storageState: assertStorageState(storageStateValue),
    webServerCommand: WEBSERVER_COMMAND,
  };
}
