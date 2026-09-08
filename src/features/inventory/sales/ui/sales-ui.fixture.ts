import type {
  InventorySalesDetail,
  InventorySalesReceipt,
  InventorySalesSummary,
} from "../model/contracts";
export const syntheticSalesStore = "10000000-0000-4000-8000-000000000001";
export function syntheticSalesSummary(): InventorySalesSummary {
  return {
    inventory_item_id: "30000000-0000-4000-8000-000000000001",
    stock_unit_id: "40000000-0000-4000-8000-000000000001",
    item_updated_at: "2026-09-01T10:00:00Z",
    unit_version: 1,
    item_status: "ready_for_sale",
    inspection_missing: [],
    inspection_href: "/inventory/30000000-0000-4000-8000-000000000001/edit",
    inspection: {
      imei_check_status: "pass",
      activation_lock_status: "pass",
      data_wipe_status: "pass",
      functional_grade: "passed",
      cosmetic_grade: "good",
      list_price_cents: 10000,
    },
    capabilities: {
      ui_enabled: true,
      commands_enabled: true,
      can_reserve: true,
      can_collect: true,
      can_collect_and_deliver: true,
      can_deliver: true,
      can_inspect: true,
      can_prepare_for_sale: true,
      inspection_block_reason: null,
      prepare_block_reason: null,
      inspection_command_path: "inventory/v2/workflow/apply",
      print_kinds: [],
    },
    allowed_actions: ["sale.create"],
    order: null,
  };
}
export function syntheticSalesDetail(): InventorySalesDetail {
  const summary = syntheticSalesSummary();
  return {
    ...summary,
    allowed_actions: ["payment.append"],
    capabilities: {
      ...summary.capabilities,
      can_inspect: false,
      can_prepare_for_sale: false,
      print_kinds: ["sale", "payment"],
    },
    order: {
      id: "50000000-0000-4000-8000-000000000001",
      sale_number: "S-SYNTHETIC-001",
      inventory_item_id: summary.inventory_item_id,
      stock_unit_id: summary.stock_unit_id!,
      customer_id: "60000000-0000-4000-8000-000000000001",
      price_cents: 10000,
      paid_cents: 3000,
      balance_cents: 7000,
      status: "awaiting_payment",
      version: 1,
      agreed_at: "2026-09-01T10:00:00Z",
      recorded_at: "2026-09-01T10:00:00Z",
      delivered_at: null,
      warranty_months: 24,
      used_device: true,
      shortening_agreed: false,
      shortening_agreed_at: null,
      terms_version: "inventory-sales-2026-09-v1",
    },
    customer: { name: "Synthetic Customer", phone: "+390000000001" },
    payments: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        sequence: 1,
        receipt_number: "P-SYNTHETIC-001",
        amount_cents: 3000,
        paid_after_cents: 3000,
        balance_after_cents: 7000,
        occurred_at: "2026-09-01T10:00:00Z",
        recorded_at: "2026-09-01T10:00:00Z",
        method: "cash",
      },
    ],
    warranty: null,
  };
}
export function syntheticSalesReceipt(): InventorySalesReceipt {
  const detail = syntheticSalesDetail();
  return {
    store_id: syntheticSalesStore,
    kind: "payment",
    language: "it",
    output_identity: {
      storeName: "CURRENT Synthetic Lab",
      storeAddress: "Current address",
      contactLine: "Current contact",
      messageSignature: "Signature",
      printFooter: "Footer",
      publicBaseUrl: "",
      canOutput: true,
      missingFields: [],
      warnings: [],
    },
    document: {
      kind: "payment",
      language: "it",
      payment_id: detail.payments[0].id,
      order: detail.order!,
      payments: detail.payments,
      warranty: null,
      customer: detail.customer!,
      product: {
        name: "Synthetic Phone",
        sku: "I-SYNTHETIC",
        identifier: "356938035643809",
        identifier_label: "IMEI",
        category: "phone",
        storage: "256 GB",
        ram: "8 GB",
        color: "Silver",
      },
      store: {
        name: "HISTORICAL Synthetic Lab",
        address: "Via Sintetica 1",
        phone: "+390000000000",
        email: "test@example.invalid",
        footer: "Synthetic receipt",
      },
    },
  };
}
