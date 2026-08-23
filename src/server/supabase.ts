import { createClient } from "@supabase/supabase-js";

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseServerKey() {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (secretKey) return secretKey;
  const legacyKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return legacyKey || undefined;
}

export function getSupabaseAdmin() {
  const supabaseUrl = getSupabaseUrl();
  const serverKey = getSupabaseServerKey();

  if (!supabaseUrl || !serverKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
