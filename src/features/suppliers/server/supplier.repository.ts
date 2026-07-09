import type { Supplier, SupplierInput } from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { type DbRecord, fail, supplierFromRow } from "@/server/repairdesk-shared";

export async function listSupplierRows(
  storeId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Supplier[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("suppliers").select("*").eq("store_id", storeId);
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("name", { ascending: true });
  fail(error, "读取供应商失败");
  return ((data ?? []) as DbRecord[])
    .map(supplierFromRow)
    .filter((supplier): supplier is Supplier => Boolean(supplier));
}

export async function getSupplierRow(id: string, storeId: string): Promise<Supplier | undefined> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("store_id", storeId)
    .eq("id", id)
    .maybeSingle();
  fail(error, "读取供应商失败");
  return supplierFromRow(data);
}

export async function createSupplierRow(input: SupplierInput, storeId: string): Promise<Supplier> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const payload = sanitizeSupplierInput(input);
  await assertActiveSupplierNameAvailable(payload.name, storeId);
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      ...payload,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  fail(error, "创建供应商失败");
  const supplier = supplierFromRow(data);
  if (!supplier) throw new Error("创建供应商失败");
  return supplier;
}

export async function updateSupplierRow(
  id: string,
  input: SupplierInput,
  storeId: string,
): Promise<Supplier> {
  const before = await getSupplierRow(id, storeId);
  if (!before) throw new Error("供应商不存在或不属于当前店铺");
  if (before.archived_at) throw new Error("已归档供应商不能编辑，请先新建供应商");

  const supabase = getSupabaseAdmin();
  const payload = sanitizeSupplierInput(input);
  await assertActiveSupplierNameAvailable(payload.name, storeId, id);
  const { data, error } = await supabase
    .from("suppliers")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("store_id", storeId)
    .eq("id", id)
    .is("archived_at", null)
    .select("*")
    .single();
  fail(error, "保存供应商失败");
  const supplier = supplierFromRow(data);
  if (!supplier) throw new Error("保存供应商失败");
  return supplier;
}

export async function archiveSupplierRow(id: string, storeId: string): Promise<Supplier> {
  const before = await getSupplierRow(id, storeId);
  if (!before) throw new Error("供应商不存在或不属于当前店铺");
  if (before.archived_at) return before;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("suppliers")
    .update({ archived_at: now, updated_at: now })
    .eq("store_id", storeId)
    .eq("id", id)
    .is("archived_at", null)
    .select("*")
    .single();
  fail(error, "归档供应商失败");
  const supplier = supplierFromRow(data);
  if (!supplier) throw new Error("归档供应商失败");
  return supplier;
}

async function assertActiveSupplierNameAvailable(
  name: string,
  storeId: string,
  currentId?: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("store_id", storeId)
    .is("archived_at", null)
    .ilike("name", name)
    .maybeSingle();
  fail(error, "校验供应商名称失败");
  const existingId =
    data && typeof data === "object" ? String((data as Record<string, unknown>).id ?? "") : "";
  if (existingId && existingId !== currentId) {
    throw new Error("当前店铺已存在同名供应商");
  }
}

export function sanitizeSupplierInput(input: SupplierInput) {
  const name = cleanText(input.name);
  if (!name) throw new Error("供应商名称不能为空");
  const shortName = cleanText(input.short_name) || name.slice(0, 16);
  const color = normalizeSupplierColor(input.color);
  return {
    name,
    short_name: shortName.slice(0, 32),
    color,
    contact_name: cleanOptionalText(input.contact_name),
    phone: cleanOptionalText(input.phone),
    email: cleanOptionalText(input.email),
    website: cleanOptionalText(input.website),
    notes: cleanOptionalText(input.notes),
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanOptionalText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function normalizeSupplierColor(value: unknown) {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#64748b";
}
