import type { StoreSettings } from "@/lib/repairdesk/types";

export interface StoreOutputIdentity {
  storeName: string;
  storeAddress: string;
  contactLine: string;
  messageSignature: string;
  printFooter: string;
  canOutput: boolean;
  blockReason?: string;
  warnings: string[];
}

export interface ResolveStoreOutputIdentityInput {
  activeStore?: { id?: string; name?: string } | null;
  settings?: Partial<StoreSettings> | null;
  settingsState?: "loading" | "error" | "ready";
}

const LEGACY_DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";

export function resolveStoreOutputIdentity({
  activeStore,
  settings,
  settingsState = "ready",
}: ResolveStoreOutputIdentityInput): StoreOutputIdentity {
  if (settingsState === "loading") return blocked("正在读取当前店铺资料");
  if (settingsState === "error") return blocked("无法读取当前店铺资料");

  const activeStoreId = cleanText(activeStore?.id);
  const settingsStoreId = cleanText(settings?.store_id);
  if (activeStoreId && settingsStoreId && activeStoreId !== settingsStoreId) {
    return blocked("当前店铺资料与设置所属店铺不一致");
  }

  if (
    isLegacyTenantIdentityContamination({
      storeId: activeStoreId || settingsStoreId,
      storeName: settings?.store_name,
      storeAddress: settings?.store_address,
      messageSignature: settings?.message_signature,
      printFooter: settings?.print_footer,
    })
  ) {
    return blocked("检测到需要重新确认的旧店铺身份资料，请先更新店铺资料");
  }

  const storeName = cleanText(settings?.store_name) || cleanText(activeStore?.name);
  if (!storeName) return blocked("请先在设置中填写当前店铺名称");

  const storeAddress = cleanText(settings?.store_address);
  const contactLine = [
    formatContact("Tel", settings?.store_phone),
    formatContact("WhatsApp", settings?.store_whatsapp),
    cleanText(settings?.store_email),
  ]
    .filter(Boolean)
    .join(" · ");
  const messageSignature = cleanText(settings?.message_signature);
  const printFooter = cleanText(settings?.print_footer);
  const missing: string[] = [];
  if (!storeAddress) missing.push("门店地址");
  if (!contactLine) missing.push("客户联系方式");
  if (!messageSignature) missing.push("消息签名");
  if (!printFooter) missing.push("打印页脚");
  if (missing.length) {
    return blocked(`请先补齐当前店铺资料：${missing.join("、")}`);
  }

  return {
    storeName,
    storeAddress,
    contactLine,
    messageSignature,
    printFooter,
    canOutput: true,
    warnings: [],
  };
}

export function isLegacyTenantIdentityContamination({
  storeId,
  storeName,
  storeAddress,
  messageSignature,
  printFooter,
}: {
  storeId?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  messageSignature?: string | null;
  printFooter?: string | null;
}) {
  const resolvedStoreId = cleanText(storeId);
  if (!resolvedStoreId || resolvedStoreId === LEGACY_DEFAULT_STORE_ID) return false;

  const name = normalizedIdentityText(storeName);
  const address = normalizedIdentityText(storeAddress);
  const signature = normalizedIdentityText(messageSignature);
  const footer = normalizedIdentityText(printFooter);
  return (
    name === "chinatech" ||
    (address.includes("viale vittorio veneto") && address.includes("floridia")) ||
    footer === "grazie per aver scelto chinatech." ||
    (signature.includes("chinatech") && signature.includes("floridia"))
  );
}

function blocked(blockReason: string): StoreOutputIdentity {
  return {
    storeName: "",
    storeAddress: "",
    contactLine: "",
    messageSignature: "",
    printFooter: "",
    canOutput: false,
    blockReason,
    warnings: [],
  };
}

function formatContact(label: string, value?: string | null) {
  const normalized = cleanText(value);
  return normalized ? `${label}: ${normalized}` : "";
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizedIdentityText(value?: string | null) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase("it-IT");
}
