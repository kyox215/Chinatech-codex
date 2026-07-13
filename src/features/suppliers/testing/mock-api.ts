import type { AuditActor, Supplier, SupplierInput } from "@/lib/repairdesk/types";

const DEFAULT_MOCK_STORE_ID = "mock-default-store";
const mockSuppliersByStore = new Map<string, Supplier[]>();

export function listMockSuppliers(actor?: AuditActor) {
  return storeSuppliers(actor)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function getMockSupplier(
  id?: string,
  options: { includeArchived?: boolean } = {},
  actor?: AuditActor,
) {
  if (!id) return undefined;
  return storeSuppliers(actor).find(
    (supplier) => supplier.id === id && (options.includeArchived || !supplier.archived_at),
  );
}

export function createMockSupplier(input: SupplierInput, actor?: AuditActor) {
  const now = new Date().toISOString();
  const supplier: Supplier = {
    id: crypto.randomUUID(),
    ...sanitizeMockSupplierInput(input),
    created_at: now,
    updated_at: now,
  };
  storeSuppliers(actor).push(supplier);
  return supplier;
}

export function updateMockSupplier(id: string, input: SupplierInput, actor?: AuditActor) {
  const suppliers = storeSuppliers(actor);
  const index = suppliers.findIndex((supplier) => supplier.id === id);
  if (index < 0 || suppliers[index]?.archived_at) {
    throw new Error("供应商不存在或不属于当前店铺");
  }
  const supplier: Supplier = {
    ...suppliers[index],
    ...sanitizeMockSupplierInput(input),
    updated_at: new Date().toISOString(),
  };
  suppliers[index] = supplier;
  return supplier;
}

export function archiveMockSupplier(id: string, actor?: AuditActor) {
  const supplier = storeSuppliers(actor).find((item) => item.id === id);
  if (!supplier) throw new Error("供应商不存在或不属于当前店铺");
  if (!supplier.archived_at) {
    supplier.archived_at = new Date().toISOString();
    supplier.updated_at = supplier.archived_at;
  }
  return supplier;
}

export function resetMockSuppliers() {
  mockSuppliersByStore.clear();
}

function storeSuppliers(actor?: AuditActor) {
  const storeId = actor?.storeId ?? DEFAULT_MOCK_STORE_ID;
  const existing = mockSuppliersByStore.get(storeId);
  if (existing) return existing;
  const created: Supplier[] = [];
  mockSuppliersByStore.set(storeId, created);
  return created;
}

function sanitizeMockSupplierInput(input: SupplierInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("供应商名称不能为空");
  return {
    name,
    short_name: (input.short_name?.trim() || name).slice(0, 32),
    color: /^#[0-9a-fA-F]{6}$/.test(input.color ?? "") ? input.color! : "#64748b",
    contact_name: cleanOptional(input.contact_name),
    phone: cleanOptional(input.phone),
    email: cleanOptional(input.email),
    website: cleanOptional(input.website),
    notes: cleanOptional(input.notes),
  };
}

function cleanOptional(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}
