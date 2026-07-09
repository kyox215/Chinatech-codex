import type { AuditActor, Supplier, SupplierInput } from "@/lib/repairdesk/types";

const mockSuppliers: Supplier[] = [];

export function listMockSuppliers() {
  return mockSuppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function getMockSupplier(id?: string, options: { includeArchived?: boolean } = {}) {
  if (!id) return undefined;
  return mockSuppliers.find(
    (supplier) => supplier.id === id && (options.includeArchived || !supplier.archived_at),
  );
}

export function createMockSupplier(input: SupplierInput, _actor?: AuditActor) {
  const now = new Date().toISOString();
  const supplier: Supplier = {
    id: crypto.randomUUID(),
    ...sanitizeMockSupplierInput(input),
    created_at: now,
    updated_at: now,
  };
  mockSuppliers.push(supplier);
  return supplier;
}

export function updateMockSupplier(id: string, input: SupplierInput, _actor?: AuditActor) {
  const index = mockSuppliers.findIndex((supplier) => supplier.id === id);
  if (index < 0 || mockSuppliers[index]?.archived_at) {
    throw new Error("供应商不存在或不属于当前店铺");
  }
  const supplier: Supplier = {
    ...mockSuppliers[index],
    ...sanitizeMockSupplierInput(input),
    updated_at: new Date().toISOString(),
  };
  mockSuppliers[index] = supplier;
  return supplier;
}

export function archiveMockSupplier(id: string, _actor?: AuditActor) {
  const supplier = mockSuppliers.find((item) => item.id === id);
  if (!supplier) throw new Error("供应商不存在或不属于当前店铺");
  if (!supplier.archived_at) {
    supplier.archived_at = new Date().toISOString();
    supplier.updated_at = supplier.archived_at;
  }
  return supplier;
}

export function resetMockSuppliers() {
  mockSuppliers.splice(0, mockSuppliers.length);
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
