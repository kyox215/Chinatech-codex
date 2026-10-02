export function isSupabaseMode(): boolean {
  return process.env.BACKEND_MODE === "supabase";
}

export function getSupabaseConfig(): { url: string; publishableKey: string } {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !publishableKey) throw new Error("认证服务尚未配置。");
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) throw new Error("认证服务地址无效。");
  let publicKey = publishableKey.startsWith("sb_publishable_");
  if (!publicKey && publishableKey.split(".").length === 3) {
    try { publicKey = JSON.parse(Buffer.from(publishableKey.split(".")[1], "base64url").toString("utf8")).role === "anon"; } catch { publicKey = false; }
  }
  if (!publicKey) throw new Error("认证客户端必须使用公开发布密钥。");
  return { url: parsed.toString().replace(/\/$/, ""), publishableKey };
}
