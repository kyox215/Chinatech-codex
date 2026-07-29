import type {
  AuditActor,
  CreateInventoryProductInput,
  CreateInventoryProductResult,
  InventoryItemStatus,
  InventoryListItem,
  InventoryProductCategory,
  InventoryProductDetail,
  InventoryProductDisplayStatus,
  InventoryProductListFilters,
  InventoryProductListItem,
  InventoryProductListResult,
} from "@/lib/repairdesk/types";
import { fail, money, requireStoreIdFromActor, requiredString } from "@/server/repairdesk-shared";
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
  invalid_imei: "IMEI 格式或校验位不正确",
  invalid_model: "请填写品牌和型号/名称",
  invalid_warranty: "保修月数无效",
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
  const visible = products.filter((item, index) => {
    if (search) {
      const haystack = [
        item.sku,
        item.brand,
        item.model,
        item.specification,
        item.location,
        sources[index].serial_or_imei,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      const normalizedHaystack = normalizeIdentifierSearch(haystack);
      if (
        !haystack.includes(search) &&
        (!normalizedSearch || !normalizedHaystack?.includes(normalizedSearch))
      )
        return false;
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

  return {
    items: visible,
    total: visible.length,
    facets: {
      brands: uniqueSorted(products.map((item) => item.brand)),
      locations: uniqueSorted(products.map((item) => item.location).filter(isString)),
    },
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
  return projectInventoryProductDetail(
    productSourceFromRow(data as unknown as Record<string, unknown>),
    actor,
  );
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

  const { data, error } = await runInventoryV2Dependency(
    () =>
      getSupabaseAdmin().rpc("repairdesk_create_inventory_product", {
        p_store_id: storeId,
        p_actor_id: actor.id,
        p_idempotency_key: input.idempotency_key,
        p_category: input.category,
        p_brand: input.brand,
        p_model: input.model,
        p_color: input.color ?? null,
        p_storage_capacity: input.storage_capacity ?? null,
        p_identifier_kind: input.identifier_kind ?? null,
        p_serial_or_imei: input.serial_or_imei ?? null,
        p_list_price: input.list_price ?? null,
        p_cost_amount: input.cost_amount ?? null,
        p_location: input.location ?? null,
        p_warranty_months: input.warranty_months ?? null,
        p_notes: input.notes ?? null,
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
    storage_capacity: item.storage_capacity,
    serial_or_imei: maskIdentifier(item.serial_or_imei),
    ...(canReadCost && costProvided ? { cost_amount: item.buyback_price } : {}),
    warranty_months: payload.warranty_provided === false ? undefined : item.warranty_months,
    notes: item.notes,
    created_at: item.created_at,
    finance_redacted: canReadCost ? undefined : true,
  };
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
