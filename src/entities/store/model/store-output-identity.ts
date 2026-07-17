import type { StoreSettings } from "@/lib/repairdesk/types";

export type StoreOutputIdentityBlockCode =
  | "settings_loading"
  | "settings_load_failed"
  | "store_context_mismatch"
  | "legacy_identity"
  | "missing_store_name"
  | "missing_required_fields";

export type StoreOutputIdentityMissingField =
  | "store_name"
  | "store_address"
  | "contact"
  | "public_base_url"
  | "message_signature"
  | "print_footer";

export type StoreOutputIdentityRecoveryTarget =
  | "wait"
  | "retry_settings"
  | "reload_store_context"
  | "store"
  | "notifications";

export interface StoreOutputIdentity {
  storeName: string;
  storeAddress: string;
  contactLine: string;
  messageSignature: string;
  printFooter: string;
  publicBaseUrl: string;
  canOutput: boolean;
  blockCode?: StoreOutputIdentityBlockCode;
  blockReason?: string;
  missingFields: StoreOutputIdentityMissingField[];
  recoveryTarget?: StoreOutputIdentityRecoveryTarget;
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
  if (settingsState === "loading") {
    return blocked({
      blockCode: "settings_loading",
      blockReason: "正在读取当前店铺资料",
      recoveryTarget: "wait",
    });
  }
  if (settingsState === "error") {
    return blocked({
      blockCode: "settings_load_failed",
      blockReason: "无法读取当前店铺资料",
      recoveryTarget: "retry_settings",
    });
  }

  const activeStoreId = cleanText(activeStore?.id);
  const settingsStoreId = cleanText(settings?.store_id);
  if (activeStoreId && !settingsStoreId) {
    return blocked({
      blockCode: "store_context_mismatch",
      blockReason: "当前店铺资料缺少所属店铺标识",
      recoveryTarget: "reload_store_context",
    });
  }
  if (activeStoreId && settingsStoreId && activeStoreId !== settingsStoreId) {
    return blocked({
      blockCode: "store_context_mismatch",
      blockReason: "当前店铺资料与设置所属店铺不一致",
      recoveryTarget: "reload_store_context",
    });
  }

  const legacyIdentityFields = getLegacyTenantIdentityContaminatedFields({
    storeId: activeStoreId || settingsStoreId,
    storeName: settings?.store_name,
    storeAddress: settings?.store_address,
    messageSignature: settings?.message_signature,
    printFooter: settings?.print_footer,
    publicBaseUrl: settings?.public_base_url,
  });
  if (legacyIdentityFields.length) {
    return blocked({
      blockCode: "legacy_identity",
      blockReason: "检测到需要重新确认的旧店铺身份资料，请先更新店铺资料",
      recoveryTarget: getSettingsRecoveryTarget(legacyIdentityFields),
    });
  }

  const storeName = cleanText(settings?.store_name) || cleanText(activeStore?.name);
  if (!storeName) {
    return blocked({
      blockCode: "missing_store_name",
      blockReason: "请先在设置中填写当前店铺名称",
      missingFields: ["store_name"],
      recoveryTarget: "store",
    });
  }

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
  const publicBaseUrl = normalizePublicBaseUrl(settings?.public_base_url);
  const hasInvalidPublicBaseUrl = Boolean(cleanText(settings?.public_base_url)) && !publicBaseUrl;
  const missingFields: StoreOutputIdentityMissingField[] = [];
  if (!storeAddress) missingFields.push("store_address");
  if (!contactLine) missingFields.push("contact");
  if (!messageSignature) missingFields.push("message_signature");
  if (!printFooter) missingFields.push("print_footer");
  if (missingFields.length) {
    return blocked({
      blockCode: "missing_required_fields",
      blockReason: `请先补齐当前店铺资料：${missingFields.map(getMissingFieldLabel).join("、")}`,
      missingFields,
      recoveryTarget: getSettingsRecoveryTarget(missingFields),
    });
  }

  return {
    storeName,
    storeAddress,
    contactLine,
    messageSignature,
    printFooter,
    publicBaseUrl,
    canOutput: true,
    missingFields: [],
    warnings: hasInvalidPublicBaseUrl ? ["客户门户域名无效，客户消息将不会包含外部链接"] : [],
  };
}

export function buildStoreCustomerOutputUrl(
  identity: Pick<StoreOutputIdentity, "canOutput" | "publicBaseUrl">,
  path: string,
) {
  if (!identity.canOutput || !identity.publicBaseUrl) return "";
  const rawPath = cleanText(path);
  if (!rawPath) return identity.publicBaseUrl;
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath) || rawPath.startsWith("//")) return "";
  const normalizedPath = rawPath.replace(/^\/+/, "");
  if (!normalizedPath) return identity.publicBaseUrl;
  if (hasUnsafeRelativePathSegment(normalizedPath)) return "";
  const base = identity.publicBaseUrl.endsWith("/")
    ? identity.publicBaseUrl
    : `${identity.publicBaseUrl}/`;
  const baseUrl = new URL(base);
  const outputUrl = new URL(normalizedPath, baseUrl);
  if (outputUrl.origin !== baseUrl.origin) return "";
  const basePath = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;
  const basePathWithoutTrailingSlash = basePath.replace(/\/$/, "") || "/";
  if (
    basePath !== "/" &&
    outputUrl.pathname !== basePathWithoutTrailingSlash &&
    !outputUrl.pathname.startsWith(basePath)
  ) {
    return "";
  }
  return outputUrl.toString();
}

export function normalizePublicBaseUrl(value?: string | null) {
  const normalized = cleanText(value).replace(/\/+$/, "");
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const isHttps = url.protocol === "https:";
    const isLocalDev =
      url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (!isHttps && !isLocalDev) return "";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function isLegacyTenantIdentityContamination({
  storeId,
  storeName,
  storeAddress,
  messageSignature,
  printFooter,
  publicBaseUrl,
}: {
  storeId?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  messageSignature?: string | null;
  printFooter?: string | null;
  publicBaseUrl?: string | null;
}) {
  return (
    getLegacyTenantIdentityContaminatedFields({
      storeId,
      storeName,
      storeAddress,
      messageSignature,
      printFooter,
      publicBaseUrl,
    }).length > 0
  );
}

function getLegacyTenantIdentityContaminatedFields({
  storeId,
  storeName,
  storeAddress,
  messageSignature,
  printFooter,
  publicBaseUrl,
}: {
  storeId?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  messageSignature?: string | null;
  printFooter?: string | null;
  publicBaseUrl?: string | null;
}): StoreOutputIdentityMissingField[] {
  const resolvedStoreId = cleanText(storeId);
  if (!resolvedStoreId || resolvedStoreId === LEGACY_DEFAULT_STORE_ID) return [];

  const name = normalizedIdentityText(storeName);
  const address = normalizedIdentityText(storeAddress);
  const signature = normalizedIdentityText(messageSignature);
  const footer = normalizedIdentityText(printFooter);
  const baseUrl = normalizedIdentityText(publicBaseUrl);
  const fields: StoreOutputIdentityMissingField[] = [];
  if (name === "chinatech") fields.push("store_name");
  if (address.includes("viale vittorio veneto") && address.includes("floridia")) {
    fields.push("store_address");
  }
  if (signature.includes("chinatech") && signature.includes("floridia")) {
    fields.push("message_signature");
  }
  if (footer === "grazie per aver scelto chinatech.") fields.push("print_footer");
  if (
    baseUrl.includes("chinatech") ||
    baseUrl.includes("floridia") ||
    baseUrl.includes("viale vittorio veneto")
  ) {
    fields.push("public_base_url");
  }
  return fields;
}

function blocked({
  blockCode,
  blockReason,
  missingFields = [],
  recoveryTarget,
}: {
  blockCode: StoreOutputIdentityBlockCode;
  blockReason: string;
  missingFields?: StoreOutputIdentityMissingField[];
  recoveryTarget: StoreOutputIdentityRecoveryTarget;
}): StoreOutputIdentity {
  return {
    storeName: "",
    storeAddress: "",
    contactLine: "",
    messageSignature: "",
    printFooter: "",
    publicBaseUrl: "",
    canOutput: false,
    blockCode,
    blockReason,
    missingFields,
    recoveryTarget,
    warnings: [],
  };
}

function getSettingsRecoveryTarget(
  fields: StoreOutputIdentityMissingField[],
): Extract<StoreOutputIdentityRecoveryTarget, "store" | "notifications"> {
  return fields.some((field) =>
    (
      [
        "store_name",
        "store_address",
        "contact",
        "public_base_url",
      ] as StoreOutputIdentityMissingField[]
    ).includes(field),
  )
    ? "store"
    : "notifications";
}

function getMissingFieldLabel(field: StoreOutputIdentityMissingField) {
  switch (field) {
    case "store_name":
      return "店铺名称";
    case "store_address":
      return "门店地址";
    case "contact":
      return "客户联系方式";
    case "public_base_url":
      return "客户门户域名";
    case "message_signature":
      return "消息签名";
    case "print_footer":
      return "打印页脚";
  }
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

function hasUnsafeRelativePathSegment(path: string) {
  return path.split("/").some((segment) => {
    if (segment === "." || segment === "..") return true;
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\");
    } catch {
      return true;
    }
  });
}
