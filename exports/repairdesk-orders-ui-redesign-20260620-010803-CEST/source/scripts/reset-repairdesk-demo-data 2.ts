import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_BATCH = "AI_TEST_BATCH_20260613";
const CURRENCY_CODE = "EUR";

type RepairOrderStatus =
  | "new"
  | "rework"
  | "mail_in_progress"
  | "diagnosing"
  | "quoted"
  | "waiting_approval"
  | "parts_ordered"
  | "parts_arrived"
  | "repairing"
  | "repaired"
  | "notified"
  | "unfixed_pickup"
  | "waiting_pickup"
  | "completed"
  | "cancelled";

type Scenario = {
  status: RepairOrderStatus;
  label: string;
  issue: string;
  diagnosis: string;
  faults: { name: string; price: number; note?: string }[];
  deposit: number;
  paid?: number;
  orderType?: "quick_repair" | "dropoff_repair";
  accessory?: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function workflowStatusFromLegacyStatus(status: RepairOrderStatus) {
  if (["new", "rework", "mail_in_progress"].includes(status)) return "intake";
  if (status === "diagnosing") return "diagnosis";
  if (["quoted", "waiting_approval"].includes(status)) return "quote";
  if (["parts_ordered", "parts_arrived"].includes(status)) return "parts";
  if (status === "repairing") return "repair";
  if (["repaired", "notified", "unfixed_pickup", "waiting_pickup"].includes(status)) {
    return "pickup";
  }
  return "closed";
}

function exceptionStatusFromLegacyStatus(status: RepairOrderStatus) {
  if (status === "cancelled") return "cancelled";
  if (status === "rework") return "rework";
  if (status === "unfixed_pickup") return "returned_unfixed";
  return null;
}

function partsStatusFromLegacyStatus(status: RepairOrderStatus) {
  if (status === "parts_ordered") return "ordered";
  if (status === "parts_arrived") return "arrived";
  return "not_required";
}

function notifyStatusFromLegacyStatus(status: RepairOrderStatus) {
  if (["notified", "waiting_pickup", "completed"].includes(status)) return "sent";
  return "not_sent";
}

function approvalStatusFromLegacyStatus(status: RepairOrderStatus) {
  if (status === "waiting_approval") return "pending";
  if (["quoted", "new", "mail_in_progress", "diagnosing"].includes(status)) return "pending";
  if (status === "cancelled") return "rejected";
  return "approved";
}

function approvalFlowStatusFromLegacyStatus(status: RepairOrderStatus) {
  if (status === "waiting_approval") return "waiting_customer";
  if (
    [
      "parts_ordered",
      "parts_arrived",
      "repairing",
      "repaired",
      "notified",
      "waiting_pickup",
      "completed",
    ].includes(status)
  ) {
    return "approved";
  }
  if (status === "cancelled") return "rejected";
  return "not_required";
}

function paymentStatusFromMoney(input: { balance: number; deposit: number }) {
  if (input.balance <= 0) return "paid";
  if (input.deposit > 0) return "partial";
  return "unpaid";
}

async function deleteStoreRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  storeId: string,
  opts: { optional?: boolean } = {},
) {
  const { count, error } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("store_id", storeId);
  if (error) {
    const message = JSON.stringify(error);
    if (opts.optional) {
      console.warn(`Skipped optional delete for ${table}: ${message}`);
      return;
    }
    throw new Error(`Delete ${table} failed: ${message}`);
  }
  console.log(`Deleted ${count ?? "?"} rows from ${table}`);
}

async function upsertRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: unknown[],
  opts: { optional?: boolean } = {},
) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    const message = JSON.stringify(error);
    if (opts.optional) {
      console.warn(`Skipped optional seed for ${table}: ${message}`);
      return;
    }
    throw new Error(`Seed ${table} failed: ${message}`);
  }
  console.log(`Seeded ${rows.length} rows into ${table}`);
}

async function insertRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: unknown[],
  opts: { optional?: boolean } = {},
) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) {
    const message = JSON.stringify(error);
    if (opts.optional) {
      console.warn(`Skipped optional insert for ${table}: ${message}`);
      return;
    }
    throw new Error(`Insert ${table} failed: ${message}`);
  }
  console.log(`Inserted ${rows.length} rows into ${table}`);
}

async function fetchTableColumns(supabaseUrl: string, serviceRoleKey: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Read Supabase REST schema failed: ${response.status} ${await response.text()}`,
    );
  }
  const spec = (await response.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
    components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
  };
  const definitions = spec.definitions ?? spec.components?.schemas ?? {};
  return new Map(
    Object.entries(definitions).map(([table, schema]) => [
      table,
      new Set(Object.keys(schema.properties ?? {})),
    ]),
  );
}

function filterRowsForTable(
  tableColumns: Map<string, Set<string>>,
  table: string,
  rows: unknown[],
) {
  const columns = tableColumns.get(table);
  if (!columns) return rows;
  return rows.map((item) =>
    Object.fromEntries(
      Object.entries(item as Record<string, unknown>).filter(([key]) => columns.has(key)),
    ),
  );
}

async function countRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  storeId: string,
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);
  if (error) {
    console.warn(`Skipped optional count for ${table}: ${JSON.stringify(error)}`);
    return 0;
  }
  return count ?? 0;
}

async function printStoreDistribution(supabase: ReturnType<typeof createClient>, table: string) {
  const { data, error } = await supabase.from(table).select("store_id").range(0, 9999);
  if (error) throw new Error(`Read ${table} store distribution failed: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = String((row as { store_id?: string }).store_id ?? "null");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) {
    console.log(`${table} store distribution: no rows`);
    return;
  }
  console.log(`${table} store distribution:`);
  for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${count}`);
  }
}

function makeDemoData(storeId: string, batch: string) {
  const now = new Date().toISOString();
  const names = [
    "Marco Rossi",
    "Giulia Bianchi",
    "Luca Romano",
    "Sofia Ricci",
    "Chen Wei",
    "Mario Esposito",
    "Anna Ferrari",
    "Alessandro Russo",
    "Li Na",
    "Francesca Conti",
    "Paolo Greco",
    "Sara Costa",
    "Wang Hao",
    "Matteo Marino",
    "Elena Gallo",
    "Davide Bruno",
    "Zhang Min",
    "Chiara Moretti",
    "Simone Lombardi",
    "Laura Rizzo",
  ];
  const phones = [
    "3201002001",
    "3201002002",
    "3201002003",
    "3201002004",
    "3201002005",
    "3201002006",
    "3201002007",
    "3201002008",
    "3201002009",
    "3201002010",
    "3201002011",
    "3201002012",
    "3201002013",
    "3201002014",
    "3201002015",
    "3201002016",
    "3201002017",
    "3201002018",
    "3201002019",
    "3201002020",
  ];
  const devices = [
    ["APPLE", "iPhone 13"],
    ["APPLE", "iPhone 14 Pro"],
    ["SAMSUNG", "A53"],
    ["SAMSUNG", "S23"],
    ["XIAOMI", "Redmi Note 12"],
    ["OPPO", "A98"],
    ["HUAWEI", "P30 Pro"],
    ["APPLE", "iPhone 12"],
    ["MOTOROLA", "Moto G05"],
    ["SAMSUNG", "A54 5G"],
    ["APPLE", "iPhone 11"],
    ["XIAOMI", "Mi 11"],
    ["ONEPLUS", "Nord 3"],
    ["APPLE", "iPhone 15"],
    ["SAMSUNG", "S21"],
    ["HONOR", "90 Lite"],
    ["GOOGLE", "Pixel 7"],
    ["APPLE", "iPad 9"],
    ["REALME", "C55"],
    ["SAMSUNG", "A13"],
  ] as const;
  const scenarios: Scenario[] = [
    {
      status: "new",
      label: "新建收机",
      issue: "屏幕破裂，触摸正常",
      diagnosis: "待检测",
      faults: [{ name: "屏幕 - 外屏碎裂", price: 95, note: "Vetro esterno rotto" }],
      deposit: 0,
    },
    {
      status: "mail_in_progress",
      label: "邮寄中",
      issue: "客户已寄出，等待到店检测",
      diagnosis: "待收件",
      faults: [{ name: "检测服务", price: 0, note: "Diagnosi" }],
      deposit: 0,
      orderType: "dropoff_repair",
      accessory: "客户备注：邮寄包装内含 SIM 卡针",
    },
    {
      status: "diagnosing",
      label: "检测中",
      issue: "无法开机，充电无反应",
      diagnosis: "初步怀疑尾插或主板供电",
      faults: [{ name: "尾插 - 无法充电", price: 65, note: "Non carica" }],
      deposit: 10,
    },
    {
      status: "quoted",
      label: "已报价",
      issue: "后摄像头模糊",
      diagnosis: "建议更换后摄组件",
      faults: [{ name: "摄像头 - 后摄异常", price: 89, note: "Fotocamera posteriore" }],
      deposit: 0,
    },
    {
      status: "waiting_approval",
      label: "待审批",
      issue: "电池健康度低，耗电快",
      diagnosis: "报价已发送，等待客户确认",
      faults: [{ name: "电池 - 健康度低", price: 59, note: "Salute batteria bassa" }],
      deposit: 0,
    },
    {
      status: "parts_ordered",
      label: "配件已订",
      issue: "内屏漏液",
      diagnosis: "已订屏幕总成",
      faults: [{ name: "屏幕 - 内屏漏液", price: 128, note: "LCD danneggiato" }],
      deposit: 30,
    },
    {
      status: "parts_arrived",
      label: "配件已到",
      issue: "后盖玻璃破裂",
      diagnosis: "后盖已到货，等待维修",
      faults: [{ name: "后盖 - 玻璃破裂", price: 70, note: "Vetro posteriore rotto" }],
      deposit: 20,
    },
    {
      status: "repairing",
      label: "维修中",
      issue: "进水不开机",
      diagnosis: "清洁后仍需主板维修",
      faults: [
        { name: "进水 - 清洁检测", price: 45, note: "Pulizia e diagnosi" },
        { name: "主板 - 不开机", price: 120, note: "Non si accende" },
      ],
      deposit: 50,
    },
    {
      status: "repaired",
      label: "已修复",
      issue: "扬声器声音小",
      diagnosis: "扬声器更换完成",
      faults: [{ name: "扬声器 - 声音小", price: 49, note: "Volume basso" }],
      deposit: 0,
    },
    {
      status: "notified",
      label: "已通知",
      issue: "电源键失灵",
      diagnosis: "已修复并通知客户取机",
      faults: [{ name: "按键 - 电源键", price: 55, note: "Tasto accensione" }],
      deposit: 10,
    },
    {
      status: "waiting_pickup",
      label: "待取机",
      issue: "系统卡顿，需要刷机",
      diagnosis: "刷机完成，等待取机",
      faults: [{ name: "系统 - 刷机恢复", price: 35, note: "Ripristino software" }],
      deposit: 0,
    },
    {
      status: "completed",
      label: "已完成",
      issue: "资料迁移",
      diagnosis: "迁移完成并已取机",
      faults: [{ name: "系统 - 资料迁移", price: 29, note: "Trasferimento dati" }],
      deposit: 0,
      paid: 29,
    },
    {
      status: "cancelled",
      label: "已取消",
      issue: "客户取消维修",
      diagnosis: "客户暂不维修",
      faults: [{ name: "检测服务", price: 0, note: "Diagnosi" }],
      deposit: 0,
    },
    {
      status: "rework",
      label: "返修",
      issue: "维修后触摸偶发失灵",
      diagnosis: "返修复检中",
      faults: [{ name: "屏幕 - 触摸失灵", price: 0, note: "Touch non funzionante" }],
      deposit: 0,
    },
    {
      status: "unfixed_pickup",
      label: "未修取机",
      issue: "主板严重腐蚀",
      diagnosis: "维修风险过高，客户取回",
      faults: [{ name: "进水 - 主板腐蚀", price: 25, note: "Ossidazione scheda" }],
      deposit: 0,
    },
    {
      status: "diagnosing",
      label: "检测中",
      issue: "Face ID 无法识别",
      diagnosis: "待检测排线与原深感",
      faults: [{ name: "面容/指纹 - 面容异常", price: 0, note: "Face ID non funzionante" }],
      deposit: 0,
    },
    {
      status: "quoted",
      label: "已报价",
      issue: "麦克风无声",
      diagnosis: "建议更换尾插排线",
      faults: [{ name: "麦克风 - 无声", price: 58, note: "Audio assente" }],
      deposit: 0,
    },
    {
      status: "repairing",
      label: "维修中",
      issue: "边框变形，屏幕翘起",
      diagnosis: "中框校正中",
      faults: [{ name: "后盖 - 中框变形", price: 80, note: "Telaio deformato" }],
      deposit: 20,
    },
    {
      status: "waiting_approval",
      label: "待审批",
      issue: "账户锁问题",
      diagnosis: "需客户确认资料处理风险",
      faults: [{ name: "系统 - 账户问题", price: 40, note: "Problema account" }],
      deposit: 0,
    },
    {
      status: "completed",
      label: "已完成",
      issue: "充电口松动",
      diagnosis: "尾插更换完成",
      faults: [{ name: "尾插 - 接口松动", price: 60, note: "Porta allentata" }],
      deposit: 0,
      paid: 60,
    },
  ];

  const customers = names.map((name, index) => {
    const id = crypto.randomUUID();
    const raw = phones[index];
    return {
      id,
      store_id: storeId,
      name,
      phone_e164: `+39${raw}`,
      phone_raw: raw,
      contact_phones: [raw, `329900${String(index + 1).padStart(4, "0")}`],
      consent_marketing: index % 4 === 0,
      consent_sms: true,
      email: `test${String(index + 1).padStart(2, "0")}@repairdesk.local`,
      preferred_channel: "whatsapp",
      language: index % 5 === 0 ? "zh" : "it",
      notes: `${batch} 可删除测试客户`,
      marketing_notes: `测试批次：${batch}`,
      last_contacted_at: isoHoursAgo(index * 8 + 2),
    };
  });

  const deviceRows = devices.map(([brand, model], index) => ({
    id: crypto.randomUUID(),
    store_id: storeId,
    customer_id: customers[index].id,
    brand,
    model,
    serial_or_imei: `3567${String(890000000000 + index).padStart(12, "0")}`,
    device_notes: `${batch} 测试设备`,
  }));

  const orders = scenarios.map((scenario, index) => {
    const id = crypto.randomUUID();
    const quotation = money(scenario.faults.reduce((sum, item) => sum + item.price, 0));
    const paid = scenario.paid ?? 0;
    const deposit = scenario.deposit;
    const balance = money(Math.max(0, quotation - deposit - paid));
    const createdAt = isoHoursAgo(20 * 24 - index * 8);
    const updatedAt = isoHoursAgo(Math.max(1, 80 - index * 3));
    const approvalStatus = approvalStatusFromLegacyStatus(scenario.status);
    const device = deviceRows[index];
    return {
      id,
      store_id: storeId,
      public_no: `TEST-${String(index + 1).padStart(4, "0")}`,
      order_type: scenario.orderType ?? (index % 3 === 0 ? "dropoff_repair" : "quick_repair"),
      status: scenario.status,
      legacy_status: scenario.status,
      workflow_status: workflowStatusFromLegacyStatus(scenario.status),
      exception_status: exceptionStatusFromLegacyStatus(scenario.status),
      payment_status: paymentStatusFromMoney({ balance, deposit }),
      approval_flow_status: approvalFlowStatusFromLegacyStatus(scenario.status),
      parts_status: partsStatusFromLegacyStatus(scenario.status),
      notify_status:
        scenario.status === "completed" ? "sent" : notifyStatusFromLegacyStatus(scenario.status),
      customer_id: customers[index].id,
      device_id: device.id,
      issue_description: scenario.issue,
      diagnosis_result: scenario.diagnosis,
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: balance,
      currency_code: CURRENCY_CODE,
      is_paid: balance <= 0,
      approval_status: approvalStatus,
      approval_sent_at: scenario.status === "waiting_approval" ? isoHoursAgo(36 + index) : null,
      approval_confirmed_at: approvalStatus === "approved" ? isoHoursAgo(20 + index) : null,
      technician_name: index % 2 === 0 ? "ALESSIO" : "MARCO",
      internal_tag: `${batch} · ${scenario.label}`,
      accessory_notes: scenario.accessory ?? (index % 2 === 0 ? "SIM卡、手机壳" : "无留存配件"),
      warranty_text: "6 MESI",
      warranty_months: 6,
      completed_at: ["completed", "cancelled"].includes(scenario.status) ? updatedAt : null,
      delivered_at: scenario.status === "completed" ? updatedAt : null,
      cancel_reason: scenario.status === "cancelled" ? "AI测试数据：客户取消" : null,
      contact_phones: customers[index].contact_phones,
      fault_prices: scenario.faults.map((item) => ({ ...item, currency_code: CURRENCY_CODE })),
      device_snapshot: {
        brand: device.brand,
        model: device.model,
        serial_or_imei: device.serial_or_imei,
        device_notes: device.device_notes,
      },
      created_at: createdAt,
      updated_at: updatedAt,
    };
  });

  const orderEvents = orders.flatMap((order, index) => [
    {
      id: crypto.randomUUID(),
      store_id: storeId,
      order_id: order.id,
      event_type: "created",
      payload: { batch, public_no: order.public_no },
      operator_name: order.technician_name,
      created_at: order.created_at,
    },
    {
      id: crypto.randomUUID(),
      store_id: storeId,
      order_id: order.id,
      event_type: "note",
      payload: { batch, note: "AI测试数据，可按批次删除" },
      operator_name: "系统",
      created_at: order.updated_at,
    },
  ]);

  const messageLogs = orders
    .filter((order) =>
      ["waiting_approval", "notified", "waiting_pickup", "completed"].includes(order.status),
    )
    .map((order, index) => ({
      id: crypto.randomUUID(),
      store_id: storeId,
      order_id: order.id,
      channel: "whatsapp",
      message_body: `[${batch}] ${order.public_no} 测试通知：当前状态 ${order.status}，金额 €${order.quotation_amount}.`,
      status: "sent",
      sent_at: order.updated_at,
    }));

  const testTag = {
    id: "tag_ai_test_batch",
    store_id: storeId,
    name: "AI测试批次",
    color: "#2563eb",
    description: `${batch} 可删除测试客户标签`,
    updated_at: now,
  };

  const tagAssignments = customers.map((customer) => ({
    store_id: storeId,
    customer_id: customer.id,
    tag_id: testTag.id,
  }));

  const interactions = customers.slice(0, 10).map((customer, index) => ({
    id: crypto.randomUUID(),
    store_id: storeId,
    customer_id: customer.id,
    order_id: orders[index].id,
    channel: "whatsapp",
    direction: index % 3 === 0 ? "inbound" : "outbound",
    message_body: `[${batch}] 测试客户沟通记录 ${index + 1}`,
    status: "sent",
    operator_name: index % 2 === 0 ? "ALESSIO" : "MARCO",
    created_at: isoHoursAgo(48 - index * 2),
  }));

  const followups = customers.slice(0, 6).map((customer, index) => ({
    id: crypto.randomUUID(),
    store_id: storeId,
    customer_id: customer.id,
    order_id: orders[index].id,
    title: `${batch} 回访测试 ${index + 1}`,
    note: "AI测试数据，可删除",
    due_at: isoHoursAgo(-24 * (index + 1)),
    owner_name: index % 2 === 0 ? "ALESSIO" : "MARCO",
    status: "open",
    created_at: now,
    updated_at: now,
  }));

  return {
    customers,
    devices: deviceRows,
    orders,
    orderEvents,
    messageLogs,
    testTag,
    tagAssignments,
    interactions,
    followups,
  };
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const confirm = process.argv.includes("--confirm");
const storeId = process.env.REPAIRDESK_TEST_STORE_ID ?? DEFAULT_STORE_ID;
const batch = process.env.REPAIRDESK_TEST_BATCH ?? DEFAULT_BATCH;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tableColumns = await fetchTableColumns(supabaseUrl, serviceRoleKey);

console.log(`RepairDesk demo reset target store: ${storeId}`);
console.log(`RepairDesk demo reset batch marker: ${batch}`);
console.log(
  "Scope: customers, devices, repair orders, order events, message logs, customer CRM records.",
);

if (!confirm) {
  const tables = [
    "repair_orders",
    "customers",
    "devices",
    "order_events",
    "message_logs",
    "customer_tag_assignments",
    "customer_interactions",
    "customer_followups",
  ];
  for (const table of tables) {
    console.log(`${table}: ${await countRows(supabase, table, storeId)} existing rows`);
  }
  await printStoreDistribution(supabase, "repair_orders");
  await printStoreDistribution(supabase, "customers");
  console.log("Dry run only. Re-run with --confirm to delete and seed demo data.");
  process.exit(0);
}

for (const table of [
  "customer_followups",
  "customer_interactions",
  "customer_tag_assignments",
  "message_logs",
  "order_events",
  "repair_orders",
  "devices",
  "customers",
]) {
  await deleteStoreRows(supabase, table, storeId, {
    optional: table.startsWith("customer_"),
  });
}

const demo = makeDemoData(storeId, batch);
await upsertRows(
  supabase,
  "customer_tags",
  filterRowsForTable(tableColumns, "customer_tags", [demo.testTag]),
  {
    optional: true,
  },
);
await insertRows(
  supabase,
  "customers",
  filterRowsForTable(tableColumns, "customers", demo.customers),
);
await insertRows(supabase, "devices", filterRowsForTable(tableColumns, "devices", demo.devices));
await insertRows(
  supabase,
  "repair_orders",
  filterRowsForTable(tableColumns, "repair_orders", demo.orders),
);
await insertRows(
  supabase,
  "order_events",
  filterRowsForTable(tableColumns, "order_events", demo.orderEvents),
);
await insertRows(
  supabase,
  "message_logs",
  filterRowsForTable(tableColumns, "message_logs", demo.messageLogs),
);
await insertRows(
  supabase,
  "customer_tag_assignments",
  filterRowsForTable(tableColumns, "customer_tag_assignments", demo.tagAssignments),
  { optional: true },
);
await insertRows(
  supabase,
  "customer_interactions",
  filterRowsForTable(tableColumns, "customer_interactions", demo.interactions),
  { optional: true },
);
await insertRows(
  supabase,
  "customer_followups",
  filterRowsForTable(tableColumns, "customer_followups", demo.followups),
  { optional: true },
);

console.log("RepairDesk demo reset complete.");
console.log(`Seeded ${demo.customers.length} customers and ${demo.orders.length} orders.`);
