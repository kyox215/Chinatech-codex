import type { AuditActor, SupplierInput } from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";
import { assertStaffRole } from "@/server/auth-context";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import {
  archiveSupplierRow,
  createSupplierRow,
  getSupplierRow,
  listSupplierRows,
  updateSupplierRow,
} from "./supplier.repository";

export async function listSuppliers(actor?: AuditActor) {
  const storeId = requireStoreIdFromActor(actor, "读取供应商");
  return listSupplierRows(storeId, { includeArchived: true });
}

export async function createSupplier(input: SupplierInput, actor: AuditActor) {
  assertStaffRole(actor, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor, "创建供应商");
  const supplier = await createSupplierRow(input, storeId);
  await writeAuditLog({
    actor,
    action: "create",
    entityType: "supplier",
    entityId: supplier.id,
    after: { ...supplier },
    metadata: { changedFields: Object.keys(input) },
  });
  return supplier;
}

export async function updateSupplier(id: string, input: SupplierInput, actor: AuditActor) {
  assertStaffRole(actor, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor, "保存供应商");
  const before = await getSupplierRow(id, storeId);
  if (!before) throw new Error("供应商不存在或不属于当前店铺");
  const supplier = await updateSupplierRow(id, input, storeId);
  await writeAuditLog({
    actor,
    action: "update",
    entityType: "supplier",
    entityId: supplier.id,
    before: { ...before },
    after: { ...supplier },
    metadata: { changedFields: Object.keys(input) },
  });
  return supplier;
}

export async function archiveSupplier(id: string, actor: AuditActor) {
  assertStaffRole(actor, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor, "归档供应商");
  const before = await getSupplierRow(id, storeId);
  if (!before) throw new Error("供应商不存在或不属于当前店铺");
  const supplier = await archiveSupplierRow(id, storeId);
  await writeAuditLog({
    actor,
    action: "archive",
    entityType: "supplier",
    entityId: supplier.id,
    before: { ...before },
    after: { ...supplier },
    metadata: { archived: true },
  });
  return supplier;
}
