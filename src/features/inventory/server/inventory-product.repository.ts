import { createHash } from "node:crypto";

import type {
  AuditActor,
  CreateInventoryProductInput,
  CreateInventoryProductResult,
  InventoryItemStatus,
  InventoryListItem,
  InventoryProductCategory,
  InventoryProductDetail,
  InventoryProductEditData,
  InventoryProductDisplayStatus,
  InventoryProductListFilters,
  InventoryProductListItem,
  InventoryProductListResult,
  UpdateInventoryProductInput,
  UpdateInventoryProductResult,
} from "@/lib/repairdesk/types";
import { fail, money, requireStoreIdFromActor, requiredString } from "@/server/repairdesk-shared";
import { writeAuditLog } from "@/server/audit";
import { can } from "@/server/permissions";
import { getSupabaseAdmin } from "@/server/supabase";

import { inventoryV2DependencyError, runInventoryV2Dependency } from "./inventory-v2-errors";

const CATEGORIES = new Set<InventoryProductCategory>([
  "phone",
  "tablet",
  "computer",
  "game_console",
  "other",
]);

const errorMessages: Record<string, string> = {
  actor_forbidden: "当前员工没有创建商品的权限",
  duplicate_identifier: "这个 IMEI 或序列号已用于其他在库商品",
  idempotency_conflict: "本次保存标识已用于不同内容，请刷新后重试",
  invalid_amount: "商品金额无效",
  invalid_category: "请选择有效的商品类别",
  invalid_created_at: "商品录入时间无效",
  invalid_idempotency_key: "商品保存标识无效",
  invalid_identifier: "商品标识无效",
  invalid_identifiers: "请检查 IMEI、序列号或 EID",
  invalid_imei: "IMEI 格式或校验位不正确",
  invalid_model: "请填写品牌和型号/名称",
  invalid_warranty: "保修月数无效",
  not_found: "商品不存在或不属于当前门店",
  projection_conflict: "商品资料状态不一致，请刷新后重试",
  primary_identifier_required: "请选择一个主要设备标识",
  terminal_state: "已售出或已移除的商品不能再编辑",
  version_conflict: "商品已被其他设备更新，请刷新后重试",
};

type ProductCreateRpcResponse = {
  ok?: boolean;
  code?: string;
  id?: string;
  sku?: string;
  created_at?: string;
};

type ProductProjectionSource = Pick<
  InventoryListItem,
  | "id"
  | "public_no"
  | "status"
  | "source_type"
  | "category"
  | "brand"
  | "model"
  | "color"
  | "storage_capacity"
  | "serial_or_imei"
  | "buyback_price"
  | "list_price"
  | "currency_code"
  | "warranty_months"
  | "notes"
  | "legacy_payload"
  | "created_at"
  | "updated_at"
>;

const PRODUCT_SELECT = [
  "id",
  "public_no",
  "status",
  "source_type",
  "category",
  "brand",
  "model",
  "color",
  "storage_capacity",
  "serial_or_imei",
  "buyback_price",
  "list_price",
  "currency_code",
  "warranty_months",
  "notes",
  "legacy_payload",
  "created_at",
  "updated_at",
].join(",");

const PRODUCT_THUMBNAIL_BUCKET = "repairdesk-inventory-attachments";
const PRODUCT_THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const PRODUCT_THUMBNAIL_QUERY_BATCH_SIZE = 100;
const PRODUCT_THUMBNAIL_MAX_BYTES = 2_400_000;

type ProductThumbnailCandidate = {
  attachmentId: string;
  itemId: string;
  storagePath: string;
  mimeType: (typeof PRODUCT_THUMBNAIL_MIME_TYPES)[number];
  createdAt: string;
};

export type InventoryProductThumbnailPayload = {
  bytes: Uint8Array;
  contentType: (typeof PRODUCT_THUMBNAIL_MIME_TYPES)[number];
};

export async function listInventoryProducts(
  filters: InventoryProductListFilters,
  actor: AuditActor,
): Promise<InventoryProductListResult> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select(PRODUCT_SELECT)
      .eq("store_id", storeId)
      .neq("source_type", "buyback")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    fail(error, "读取商品库存失败");
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  const sources = rows.map(productSourceFromRow);
  const products = sources.map(projectInventoryProductListItem);
  const search = filters.search?.trim().toLocaleLowerCase();
  const normalizedSearch = normalizeIdentifierSearch(search);
  const identifierItemIds = new Set<string>();
  if (normalizedSearch && normalizedSearch.length >= 3) {
    const { data: identifierRows, error: identifierError } = await supabase
      .from("inventory_stock_unit_identifiers")
      .select("stock_unit_id")
      .eq("store_id", storeId)
      .eq("normalized_value", normalizedSearch.toLocaleUpperCase())
      .in("kind", ["imei1", "imei2", "serial", "eid"])
      .is("retired_at", null)
      .limit(2);
    fail(identifierError, "搜索商品标识失败");
    const unitIds = (identifierRows ?? []).map((row) => requiredString(row.stock_unit_id));
    if (unitIds.length) {
      const { data: unitRows, error: unitError } = await supabase
        .from("inventory_stock_units")
        .select("legacy_inventory_item_id")
        .eq("store_id", storeId)
        .in("id", unitIds)
        .limit(2);
      fail(unitError, "搜索商品标识失败");
      for (const row of unitRows ?? [])
        identifierItemIds.add(requiredString(row.legacy_inventory_item_id));
    }
  }
  const visible = products.filter((item, index) => {
    if (search) {
      const haystack = [item.sku, item.brand, item.model, item.specification, item.location]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      if (!haystack.includes(search) && !identifierItemIds.has(sources[index].id)) return false;
    }
    if (filters.statuses?.length && !filters.statuses.includes(item.status)) return false;
    if (filters.categories?.length && !filters.categories.includes(item.category)) return false;
    if (filters.brands?.length && !filters.brands.includes(item.brand)) return false;
    if (
      filters.locations?.length &&
      (!item.location || !filters.locations.includes(item.location))
    ) {
      return false;
    }
    return true;
  });

  const items = await attachProductThumbnails(visible, actor, storeId);

  return {
    items,
    total: visible.length,
    facets: {
      brands: uniqueSorted(products.map((item) => item.brand)),
      locations: uniqueSorted(products.map((item) => item.location).filter(isString)),
    },
  };
}

async function attachProductThumbnails(
  items: InventoryProductListItem[],
  actor: AuditActor,
  storeId: string,
): Promise<InventoryProductListItem[]> {
  if (!items.length || !can(actor, "attachment:read")) return items;

  const supabase = getSupabaseAdmin();
  const itemIds = items.map((item) => item.id);
  const rows: Record<string, unknown>[] = [];

  try {
    for (let offset = 0; offset < itemIds.length; offset += PRODUCT_THUMBNAIL_QUERY_BATCH_SIZE) {
      const batch = itemIds.slice(offset, offset + PRODUCT_THUMBNAIL_QUERY_BATCH_SIZE);
      const { data, error } = await supabase
        .from("inventory_attachments")
        .select(
          "id,item_id,kind,sensitivity,evidence_status,storage_bucket,storage_path,mime_type,created_at",
        )
        .eq("store_id", storeId)
        .in("item_id", batch)
        .eq("kind", "device_photo")
        .eq("sensitivity", "internal")
        .eq("evidence_status", "bound")
        .in("mime_type", [...PRODUCT_THUMBNAIL_MIME_TYPES])
        .order("created_at", { ascending: false });
      if (error) return items;
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    }

    const candidates = selectProductThumbnailCandidates(rows, storeId, itemIds);
    if (!candidates.length) return items;

    const thumbnailByItemId = new Map(
      candidates.map(
        (candidate) =>
          [
            candidate.itemId,
            `/api/repairdesk/inventory/product-thumbnails/${encodeURIComponent(candidate.attachmentId)}`,
          ] as const,
      ),
    );

    return items.map((item) => {
      const thumbnailUrl = thumbnailByItemId.get(item.id);
      return thumbnailUrl ? { ...item, thumbnail_url: thumbnailUrl } : item;
    });
  } catch {
    // Photos are an optional enhancement. Metadata failures must degrade to
    // the category illustration without failing the product list.
    return items;
  }
}

export function selectProductThumbnailCandidates(
  rows: Record<string, unknown>[],
  storeId: string,
  visibleItemIds: string[],
): ProductThumbnailCandidate[] {
  const visibleIds = new Set(visibleItemIds);
  const latestByItemId = new Map<string, ProductThumbnailCandidate>();

  for (const row of [...rows].sort((left, right) =>
    String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
  )) {
    const attachmentId = text(row.id);
    const itemId = text(row.item_id);
    const storageBucket = text(row.storage_bucket);
    const storagePath = text(row.storage_path);
    const mimeType = text(row.mime_type);
    const createdAt = text(row.created_at);
    const expectedExtension =
      mimeType === "image/jpeg"
        ? "jpg"
        : mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : undefined;
    if (
      !attachmentId ||
      !itemId ||
      !visibleIds.has(itemId) ||
      latestByItemId.has(itemId) ||
      row.kind !== "device_photo" ||
      row.sensitivity !== "internal" ||
      row.evidence_status !== "bound" ||
      storageBucket !== PRODUCT_THUMBNAIL_BUCKET ||
      !expectedExtension ||
      storagePath !== `${storeId}/${itemId}/device_photo/${attachmentId}.${expectedExtension}` ||
      !mimeType ||
      !(PRODUCT_THUMBNAIL_MIME_TYPES as readonly string[]).includes(mimeType) ||
      !createdAt
    ) {
      continue;
    }
    latestByItemId.set(itemId, {
      attachmentId,
      itemId,
      storagePath,
      mimeType: mimeType as ProductThumbnailCandidate["mimeType"],
      createdAt,
    });
  }

  return [...latestByItemId.values()];
}

export async function readInventoryProductThumbnail(
  attachmentId: string,
  actor: AuditActor,
): Promise<InventoryProductThumbnailPayload> {
  if (!can(actor, "inventory:read") || !can(actor, "attachment:read")) {
    throw inventoryProductHttpError(
      "INVENTORY_PRODUCT_THUMBNAIL_FORBIDDEN",
      "当前员工没有查看商品图片的权限",
      403,
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachmentId)
  ) {
    throw inventoryProductHttpError("INVENTORY_PRODUCT_THUMBNAIL_NOT_FOUND", "商品图片不存在", 404);
  }

  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inventory_attachments")
    .select(
      "id,item_id,kind,sensitivity,evidence_status,storage_bucket,storage_path,mime_type,file_size,created_at",
    )
    .eq("store_id", storeId)
    .eq("id", attachmentId)
    .eq("kind", "device_photo")
    .eq("sensitivity", "internal")
    .eq("evidence_status", "bound")
    .in("mime_type", [...PRODUCT_THUMBNAIL_MIME_TYPES])
    .maybeSingle();
  if (error)
    throw inventoryProductHttpError(
      "INVENTORY_PRODUCT_THUMBNAIL_UNAVAILABLE",
      "商品图片暂不可用",
      503,
    );
  if (!data) {
    throw inventoryProductHttpError("INVENTORY_PRODUCT_THUMBNAIL_NOT_FOUND", "商品图片不存在", 404);
  }

  const row = data as unknown as Record<string, unknown>;
  const itemId = text(row.item_id);
  const candidate = itemId
    ? selectProductThumbnailCandidates([row], storeId, [itemId])[0]
    : undefined;
  const recordedBytes = Number(row.file_size ?? 0);
  if (
    !candidate ||
    candidate.attachmentId !== attachmentId ||
    !Number.isSafeInteger(recordedBytes) ||
    recordedBytes <= 0 ||
    recordedBytes > PRODUCT_THUMBNAIL_MAX_BYTES
  ) {
    throw inventoryProductHttpError("INVENTORY_PRODUCT_THUMBNAIL_NOT_FOUND", "商品图片不存在", 404);
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(PRODUCT_THUMBNAIL_BUCKET)
    .download(candidate.storagePath);
  if (downloadError || !blob) {
    throw inventoryProductHttpError(
      "INVENTORY_PRODUCT_THUMBNAIL_UNAVAILABLE",
      "商品图片暂不可用",
      503,
    );
  }
  if (blob.size <= 0 || blob.size > PRODUCT_THUMBNAIL_MAX_BYTES) {
    throw inventoryProductHttpError("INVENTORY_PRODUCT_THUMBNAIL_INVALID", "商品图片不可用", 422);
  }

  await writeAuditLog({
    actor,
    action: "read_inventory_product_thumbnail",
    entityType: "inventory_attachment",
    entityId: candidate.attachmentId,
    metadata: { item_id: candidate.itemId, mime_type: candidate.mimeType },
  });

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType: candidate.mimeType,
  };
}

export async function getInventoryProduct(
  id: string,
  actor: AuditActor,
): Promise<InventoryProductDetail> {
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin()
    .from("inventory_items")
    .select(PRODUCT_SELECT)
    .eq("store_id", storeId)
    .eq("id", id)
    .neq("source_type", "buyback")
    .maybeSingle();
  fail(error, "读取商品详情失败");
  if (!data) {
    throw new Error("商品不存在或不属于当前门店");
  }
  const projected = projectInventoryProductDetail(
    productSourceFromRow(data as unknown as Record<string, unknown>),
    actor,
  );
  const device = await readProductDeviceData(storeId, id, false);
  return { ...projected, ...device } as unknown as InventoryProductDetail;
}

export async function getInventoryProductEditData(
  id: string,
  actor: AuditActor,
): Promise<InventoryProductEditData> {
  if (!can(actor, "inventory:update")) throw new Error("当前员工没有编辑商品的权限");
  const storeId = requireStoreIdFromActor(actor);
  await consumeSensitiveIdentifierRead(actor, storeId);
  const detail = await getInventoryProduct(id, actor);
  const device = await readProductDeviceData(storeId, id, true);
  await writeAuditLog({
    actor,
    action: "read_sensitive",
    entityType: "inventory_product_identifiers",
    entityId: id,
    after: { identifier_count: device.identifiers.length },
  });
  return { ...detail, ...device } as unknown as InventoryProductEditData;
}

async function consumeSensitiveIdentifierRead(actor: AuditActor, storeId: string) {
  const membershipId = actor.activeMembershipId;
  if (!membershipId) {
    throw inventoryProductHttpError("INVENTORY_IDENTIFIER_READ_FORBIDDEN", "当前员工身份无效", 403);
  }
  const scopeHash = createHash("sha256")
    .update(`inventory-identifiers:${storeId}:${membershipId}`)
    .digest("hex");
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_consume_authenticated_rate_limit_rpc",
    { p_scope_hash: scopeHash, p_bucket: "read" },
  );
  if (error) {
    throw inventoryProductHttpError(
      "INVENTORY_IDENTIFIER_RATE_LIMIT_UNAVAILABLE",
      "设备标识暂时不可读取，请稍后重试",
      503,
    );
  }
  const result = data as { allowed?: boolean } | null;
  if (!result?.allowed) {
    throw inventoryProductHttpError(
      "INVENTORY_IDENTIFIER_RATE_LIMITED",
      "读取设备标识过于频繁，请稍后重试",
      429,
    );
  }
}

function inventoryProductHttpError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

export async function createInventoryProduct(
  input: CreateInventoryProductInput,
  actor: AuditActor,
): Promise<CreateInventoryProductResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id) throw new Error("当前员工身份无效，请重新登录");
  if (input.cost_amount !== undefined && !can(actor, "inventory:cost_allocate")) {
    throw new Error("当前员工没有录入商品成本的权限");
  }

  const identifiers = normalizeProductIdentifiers(input);
  const { data, error } = await runInventoryV2Dependency(
    () =>
      getSupabaseAdmin().rpc("repairdesk_create_inventory_product_v2", {
        p_store_id: storeId,
        p_actor_id: actor.id,
        p_payload: { ...input, identifiers, identifier_kind: undefined, serial_or_imei: undefined },
      }),
    "商品快速录入服务暂时不可用",
  );
  if (error) throw inventoryV2DependencyError("商品快速录入服务暂时不可用");
  const result = recordOrEmpty(data) as ProductCreateRpcResponse;
  if (result.ok !== true) {
    throw new Error(errorMessages[result.code ?? ""] ?? "创建商品失败");
  }
  if (
    !["created", "idempotent_replay"].includes(result.code ?? "") ||
    !result.id ||
    !result.sku ||
    !result.created_at
  ) {
    throw new Error("商品录入结果不完整，请使用原保存标识重试");
  }
  return {
    ok: true,
    code: result.code as CreateInventoryProductResult["code"],
    id: result.id,
    sku: result.sku,
    created_at: result.created_at,
  };
}

export async function updateInventoryProduct(
  id: string,
  input: UpdateInventoryProductInput,
  actor: AuditActor,
): Promise<UpdateInventoryProductResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id || !can(actor, "inventory:update")) {
    throw new Error("当前员工没有编辑商品的权限");
  }
  if (input.cost_amount !== undefined && !can(actor, "inventory:cost_allocate")) {
    throw new Error("当前员工没有录入商品成本的权限");
  }
  const { data, error } = await runInventoryV2Dependency(
    () =>
      getSupabaseAdmin().rpc("repairdesk_update_inventory_product_v1", {
        p_store_id: storeId,
        p_actor_id: actor.id,
        p_payload: { product_id: id, ...input },
      }),
    "商品编辑服务暂时不可用",
  );
  if (error) throw inventoryV2DependencyError("商品编辑服务暂时不可用");
  const result = recordOrEmpty(data);
  if (result.ok !== true) {
    const code = text(result.code) ?? "update_failed";
    const message = errorMessages[code] ?? "更新商品失败";
    if (["version_conflict", "idempotency_conflict"].includes(code)) {
      const conflict = new Error(message) as Error & { status: number; code: string };
      conflict.status = 409;
      conflict.code = code;
      throw conflict;
    }
    throw new Error(message);
  }
  if (!text(result.id) || typeof result.version !== "number" || !text(result.updated_at)) {
    throw new Error("商品更新结果不完整，请刷新后确认");
  }
  return {
    ok: true,
    code: result.code as UpdateInventoryProductResult["code"],
    id: requiredString(result.id),
    version: result.version,
    updated_at: requiredString(result.updated_at),
  };
}

export function isProductInventoryItem(item: Pick<InventoryListItem, "source_type">) {
  return item.source_type !== "buyback";
}

export function projectInventoryProductListItem(
  item: ProductProjectionSource,
): InventoryProductListItem {
  const payload = recordOrEmpty(item.legacy_payload);
  const location = text(payload.location);
  const listPriceProvided =
    payload.list_price_provided === true ||
    (payload.inventory_product_quick_create !== true && item.list_price > 0);
  return {
    id: item.id,
    sku: text(payload.internal_sku) ?? item.public_no,
    category: normalizeCategory(item.category),
    brand: item.brand,
    model: item.model,
    specification: [item.storage_capacity, item.color].filter(Boolean).join(" · ") || undefined,
    masked_identifier: maskIdentifier(item.serial_or_imei),
    status: mapProductStatus(item.status),
    location,
    ...(listPriceProvided ? { list_price: item.list_price } : {}),
    currency_code: item.currency_code,
    updated_at: item.updated_at,
  };
}

export function projectInventoryProductDetail(
  item: ProductProjectionSource,
  actor: AuditActor,
): InventoryProductDetail {
  const projected = projectInventoryProductListItem(item);
  const payload = recordOrEmpty(item.legacy_payload);
  const canReadCost = can(actor, "finance:profit_read") || can(actor, "inventory:cost_allocate");
  const costProvided =
    payload.cost_provided === true ||
    (payload.inventory_product_quick_create !== true && item.buyback_price > 0);
  return {
    ...projected,
    color: item.color,
    ram_capacity: text(payload.ram_capacity),
    storage_capacity: item.storage_capacity,
    gtin: text(payload.gtin),
    condition: text(payload.condition),
    specifications: {},
    identifiers: item.serial_or_imei
      ? [{ kind: "serial", masked_value: maskIdentifier(item.serial_or_imei)!, primary: true }]
      : [],
    serial_or_imei: maskIdentifier(item.serial_or_imei),
    ...(canReadCost && costProvided ? { cost_amount: item.buyback_price } : {}),
    warranty_months: payload.warranty_provided === false ? undefined : item.warranty_months,
    notes: item.notes,
    created_at: item.created_at,
    version: 1,
    finance_redacted: canReadCost ? undefined : true,
  };
}

async function readProductDeviceData(
  storeId: string,
  itemId: string,
  reveal: boolean,
): Promise<{
  ram_capacity?: string;
  gtin?: string;
  specifications: Record<string, unknown>;
  version: number;
  identifiers: Array<Record<string, unknown>>;
}> {
  const supabase = getSupabaseAdmin();
  const { data: unit, error: unitError } = await supabase
    .from("inventory_stock_units")
    .select("id,variant_id,version")
    .eq("store_id", storeId)
    .eq("legacy_inventory_item_id", itemId)
    .maybeSingle();
  fail(unitError, "读取商品设备资料失败");
  if (!unit) return { identifiers: [], specifications: {}, version: 1 };
  const [{ data: variant, error: variantError }, { data: identifiers, error: identifierError }] =
    await Promise.all([
      supabase
        .from("inventory_product_variants")
        .select("ram_capacity,gtin,specifications")
        .eq("store_id", storeId)
        .eq("id", requiredString(unit.variant_id))
        .maybeSingle(),
      supabase
        .from("inventory_stock_unit_identifiers")
        .select("kind,display_value,source,is_primary")
        .eq("store_id", storeId)
        .eq("stock_unit_id", requiredString(unit.id))
        .neq("kind", "sku")
        .is("retired_at", null)
        .order("kind", { ascending: true }),
    ]);
  fail(variantError, "读取商品规格失败");
  fail(identifierError, "读取商品标识失败");
  return {
    ram_capacity: text(variant?.ram_capacity),
    gtin: text(variant?.gtin),
    specifications: recordOrEmpty(variant?.specifications),
    version: Number(unit.version ?? 1),
    identifiers: (identifiers ?? []).map((identifier) => ({
      kind: identifier.kind,
      ...(reveal
        ? { value: requiredString(identifier.display_value), source: identifier.source }
        : { masked_value: maskIdentifier(requiredString(identifier.display_value))! }),
      primary: identifier.is_primary === true,
    })),
  };
}

function normalizeProductIdentifiers(input: CreateInventoryProductInput) {
  if (input.identifiers) {
    const hasPrimary = input.identifiers.some((identifier) => identifier.primary);
    return input.identifiers.map((identifier, index) => ({
      ...identifier,
      primary: hasPrimary ? identifier.primary === true : index === 0,
    }));
  }
  if (input.identifier_kind && input.serial_or_imei) {
    return [
      {
        kind: input.identifier_kind,
        value: input.serial_or_imei,
        source: "manual" as const,
        primary: true,
      },
    ];
  }
  return [];
}

export function mapProductStatus(status: InventoryItemStatus): InventoryProductDisplayStatus {
  if (status === "reserved") return "reserved";
  if (status === "sold") return "sold";
  if (status === "returned") return "returned";
  if (status === "cancelled" || status === "recycled") return "removed";
  return "in_stock";
}

function normalizeCategory(value: string): InventoryProductCategory {
  const normalized = value.trim().toLocaleLowerCase();
  if (CATEGORIES.has(normalized as InventoryProductCategory)) {
    return normalized as InventoryProductCategory;
  }
  if (["手机", "智能手机", "smartphone", "telephone"].includes(normalized)) return "phone";
  if (["平板", "平板电脑", "ipad"].includes(normalized)) return "tablet";
  if (["电脑", "笔记本", "台式机", "laptop", "desktop", "pc"].includes(normalized))
    return "computer";
  if (["游戏机", "主机", "console", "game console"].includes(normalized)) return "game_console";
  return "other";
}

function normalizeIdentifierSearch(value?: string) {
  if (!value) return undefined;
  return value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase();
}

function productSourceFromRow(row: Record<string, unknown>): ProductProjectionSource {
  return {
    id: requiredString(row.id),
    public_no: requiredString(row.public_no),
    status: row.status as InventoryItemStatus,
    source_type: requiredString(row.source_type),
    category: requiredString(row.category),
    brand: requiredString(row.brand),
    model: requiredString(row.model),
    color: text(row.color),
    storage_capacity: text(row.storage_capacity),
    serial_or_imei: text(row.serial_or_imei),
    buyback_price: money(row.buyback_price),
    list_price: money(row.list_price),
    currency_code: "EUR",
    warranty_months: Number(row.warranty_months ?? 0),
    notes: text(row.notes),
    legacy_payload: recordOrEmpty(row.legacy_payload),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function maskIdentifier(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.length <= 4 ? `••••${normalized}` : `•••• ${normalized.slice(-4)}`;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
