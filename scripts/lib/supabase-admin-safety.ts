export type CliArgs = Map<string, string | boolean>;

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = new Map();
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const [key, inlineValue] = item.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

export function stringArg(args: CliArgs, key: string) {
  const value = args.get(key);
  return typeof value === "string" ? value.trim() : undefined;
}

export function projectRefFromSupabaseUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Supabase URL is invalid.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "local";
  }
  if (!hostname.endsWith(".supabase.co")) {
    throw new Error("Cannot derive a Supabase project ref from this URL.");
  }

  const projectRef = hostname.slice(0, -".supabase.co".length);
  if (!/^[a-z0-9]{10,40}$/.test(projectRef)) {
    throw new Error("Supabase project ref has an unexpected format.");
  }
  return projectRef;
}

export function mutationConfirmation(projectRef: string, storeId: string) {
  return `MUTATE_REPAIRDESK:${projectRef}:${storeId}`;
}

export function assertSupabaseAdminReadTarget(input: {
  supabaseUrl: string;
  projectRef?: string;
  storeId?: string;
}) {
  const actualProjectRef = projectRefFromSupabaseUrl(input.supabaseUrl);
  if (!input.projectRef || input.projectRef !== actualProjectRef) {
    throw new Error("--project-ref must exactly match the Supabase URL target.");
  }
  if (!input.storeId || !isUuid(input.storeId)) {
    throw new Error("--store-id must be an explicit UUID.");
  }
  return { projectRef: actualProjectRef, storeId: input.storeId };
}

export function assertSupabaseAdminMutationTarget(input: {
  apply: boolean;
  supabaseUrl: string;
  projectRef?: string;
  storeId?: string;
  confirmation?: string;
  localOnly?: boolean;
  backupDir?: string;
  requireBackupDir?: boolean;
}) {
  if (!input.apply) throw new Error("Mutation mode requires --apply.");
  const actualProjectRef = projectRefFromSupabaseUrl(input.supabaseUrl);
  if (!input.projectRef || input.projectRef !== actualProjectRef) {
    throw new Error("--project-ref must exactly match the Supabase URL target.");
  }
  if (input.localOnly && actualProjectRef !== "local") {
    throw new Error("This destructive script is restricted to local Supabase.");
  }
  if (!input.storeId || !isUuid(input.storeId)) {
    throw new Error("--store-id must be an explicit UUID.");
  }
  const expectedConfirmation = mutationConfirmation(actualProjectRef, input.storeId);
  if (input.confirmation !== expectedConfirmation) {
    throw new Error(`--confirm must exactly equal ${expectedConfirmation}`);
  }
  if (input.requireBackupDir && !input.backupDir) {
    throw new Error("--backup-dir is required for destructive apply mode.");
  }
  return {
    projectRef: actualProjectRef,
    storeId: input.storeId,
    backupDir: input.backupDir,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
