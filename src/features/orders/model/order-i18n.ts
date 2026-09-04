import type { OrderQueueGroup, OrderResultGroup, OrderWorkflow } from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { AccessoryNoteOption } from "@/features/orders/model/order-accessory-notes";
import type { QuoteReadinessCode } from "@/features/orders/model/order-diagnosis-quote";
import type { OrderTransitionReasonConfig } from "@/features/orders/model/order-transition-reasons";
import type { SimpleOrderFlowStage } from "@/features/orders/model/order-simple-flow";
import type { OrderTaskGuidanceCode } from "@/features/orders/model/order-task-flow";
import type { AppLocale } from "@/shared/i18n/locales";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const repairServiceGroupKeys = new Set([
  "display",
  "battery",
  "charging",
  "camera",
  "liquid",
  "mainboard",
  "system",
  "back-cover",
  "face",
  "speaker",
  "microphone",
  "button",
]);

const repairServiceGroupEnglishLabels: Record<string, string> = {
  display: "Display",
  battery: "Battery",
  charging: "Charging port",
  camera: "Camera",
  liquid: "Liquid damage",
  mainboard: "Mainboard",
  system: "System",
  "back-cover": "Back cover",
  face: "Face ID / fingerprint",
  speaker: "Speaker",
  microphone: "Microphone",
  button: "Buttons",
};

const repairServiceGroupCompactLabels: Record<
  Exclude<AppLocale, "zh-CN">,
  Record<string, string>
> = {
  "it-IT": {
    display: "Schermo",
    battery: "Batteria",
    charging: "Ricarica",
    camera: "Fotocamera",
    liquid: "Liquidi",
    mainboard: "Scheda",
    system: "Sistema",
    "back-cover": "Cover",
    face: "Biometria",
    speaker: "Audio",
    microphone: "Microfono",
    button: "Tasti",
  },
  en: {
    display: "Display",
    battery: "Battery",
    charging: "Charging",
    camera: "Camera",
    liquid: "Liquid",
    mainboard: "Mainboard",
    system: "System",
    "back-cover": "Cover",
    face: "Biometrics",
    speaker: "Speaker",
    microphone: "Mic",
    button: "Buttons",
  },
};

const repairServiceOptionEnglishLabels: Record<string, string> = {
  "display:original": "Original part",
  "display:assembled": "Compatible part",
  "display:tft": "TFT",
  "display:incell": "Incell",
  "display:glass": "Broken outer glass",
  "display:lcd": "Damaged LCD",
  "display:touch": "Touch not working",
  "display:no-display": "Black screen",
  "display:lines": "Display artifacts / vertical lines",
  "display:backlight": "Backlight fault",
  "display:protector": "Screen protector application",
  "battery:original": "Original battery",
  "battery:assembled": "Compatible battery",
  "battery:high-capacity": "High-capacity battery",
  "battery:health": "Low battery health",
  "battery:drain": "Fast battery drain",
  "battery:swollen": "Swollen battery",
  "battery:shutdown": "Unexpected shutdown",
  "battery:not-detected": "Battery not detected",
  "battery:charging-slow": "Slow charging",
  "battery:calibration": "Battery calibration",
  "charging:original": "Original charging port",
  "charging:assembled": "Compatible charging port",
  "charging:loose": "Loose port",
  "charging:no-charge": "Not charging",
  "charging:clean": "Clean charging port",
  "charging:intermittent": "Intermittent connection",
  "charging:fast-charge": "Fast charging fault",
  "charging:data-port": "Computer connection not working",
  "charging:wireless-charge": "Wireless charging fault",
  "camera:front": "Front camera fault",
  "camera:rear": "Rear camera fault",
  "camera:lens": "Damaged lens",
  "camera:focus": "Autofocus not working",
  "camera:shake": "Camera vibration / noise",
  "camera:flash": "Flash not working",
  "camera:camera-app": "Camera app does not open",
  "liquid:cleaning": "Cleaning and diagnosis",
  "liquid:corrosion": "Board corrosion",
  "liquid:no-power": "No power after liquid damage",
  "liquid:screen": "Liquid-damaged display",
  "liquid:data-rescue": "Data recovery",
  "liquid:inspection": "Liquid damage report",
  "mainboard:no-power": "No power",
  "mainboard:baseband": "No service",
  "mainboard:short": "Short circuit",
  "mainboard:charging-ic": "Charging IC",
  "mainboard:power-ic": "Power IC",
  "mainboard:wifi-bt": "Wi-Fi / Bluetooth fault",
  "mainboard:storage": "Internal storage fault",
  "mainboard:board-repair": "Mainboard repair",
  "system:restore": "Software restore",
  "system:data": "Data transfer",
  "system:account": "Account issue",
  "system:screen-lock": "Screen lock removal",
  "system:pin-lock": "PIN / pattern unlock",
  "system:update": "System update",
  "system:backup": "Data backup",
  "system:activation-check": "Activation lock check",
  "system:app-error": "App / software issue",
  "back-cover:glass": "Broken rear glass",
  "back-cover:frame": "Bent frame",
  "back-cover:camera-glass": "Camera lens glass",
  "back-cover:wireless-coil": "Wireless charging coil",
  "back-cover:housing": "Complete rear housing",
  "back-cover:adhesive": "Replace waterproof seal",
  "face:face-id": "Face ID fault",
  "face:fingerprint": "Fingerprint fault",
  "face:proximity": "Proximity sensor fault",
  "face:ambient": "Ambient light sensor fault",
  "face:home-touch": "Home fingerprint button",
  "face:earpiece-flex": "Earpiece flex cable",
  "speaker:low": "Low volume",
  "speaker:noise": "Noise / distortion",
  "speaker:no-sound": "No loudspeaker sound",
  "speaker:earpiece": "No earpiece sound",
  "speaker:mesh-clean": "Clean earpiece mesh",
  "speaker:speaker-replace": "Speaker replacement",
  "microphone:no-sound": "No sound",
  "microphone:noise": "Call noise",
  "microphone:caller-cannot-hear": "Caller cannot hear",
  "microphone:recording": "Recording fault",
  "microphone:bottom-mic": "Bottom microphone",
  "microphone:top-mic": "Top microphone",
  "microphone:mic-clean": "Microphone cleaning",
  "button:power": "Power button",
  "button:volume": "Volume buttons",
  "button:silent": "Silent switch",
  "button:home": "Home button",
  "button:action": "Action button",
  "button:camera-control": "Camera Control button",
  "button:vibration": "Vibration motor",
  "button:button-flex": "Button flex cable",
};

export function localizeRepairServiceGroupLabel(
  group: { key: string; label: string; italian: string },
  locale: AppLocale,
) {
  if (locale === "zh-CN" || !repairServiceGroupKeys.has(group.key)) return group.label;
  return locale === "it-IT"
    ? group.italian
    : (repairServiceGroupEnglishLabels[group.key] ?? group.label);
}

export function localizeRepairServiceGroupCompactLabel(
  group: { key: string; label: string; italian: string },
  locale: AppLocale,
) {
  if (locale === "zh-CN") {
    return (
      {
        camera: "摄像",
        face: "面容",
        speaker: "扬声",
        microphone: "麦克",
      }[group.key] ?? group.label
    );
  }
  if (!repairServiceGroupKeys.has(group.key)) return group.label;
  return (
    repairServiceGroupCompactLabels[locale][group.key] ??
    localizeRepairServiceGroupLabel(group, locale)
  );
}

export function localizeRepairServiceOptionLabel(
  groupKey: string,
  option: { key: string; label: string; italian: string },
  locale: AppLocale,
) {
  const catalogKey = `${groupKey}:${option.key}`;
  if (
    locale === "zh-CN" ||
    !Object.prototype.hasOwnProperty.call(repairServiceOptionEnglishLabels, catalogKey)
  ) {
    return option.label;
  }
  return locale === "it-IT"
    ? option.italian
    : (repairServiceOptionEnglishLabels[catalogKey] ?? option.label);
}

const transitionConfigKeys: Partial<
  Record<RepairOrderStatus, { title: MessageKey; description: MessageKey }>
> = {
  mail_in_progress: {
    title: "orders2b1.transition.mail.title",
    description: "orders2b1.transition.mail.description",
  },
  unfixed_pickup: {
    title: "orders2b1.transition.unfixed.title",
    description: "orders2b1.transition.unfixed.description",
  },
  cancelled: {
    title: "orders2b1.transition.cancelled.title",
    description: "orders2b1.transition.cancelled.description",
  },
  rework: {
    title: "orders2b1.transition.rework.title",
    description: "orders2b1.transition.rework.description",
  },
};

const transitionPresetKeys: Record<string, { label: MessageKey; description: MessageKey }> =
  Object.fromEntries(
    [
      "board-repair",
      "in-house-failed",
      "supplier-diagnosis",
      "data-risk",
      "repair-risk",
      "quote-too-high",
      "board-damage",
      "parts-unavailable",
      "data-account-risk",
      "customer-cancelled",
      "quote-rejected",
      "not-arrived",
      "duplicate-order",
      "shop-unable",
      "same-issue",
      "new-symptom",
    ].map((id) => [
      id,
      {
        label: `orders2b1.transition.preset.${id}` as MessageKey,
        description: `orders2b1.transition.preset.${id}.help` as MessageKey,
      },
    ]),
  );

const accessoryKeys: Record<AccessoryNoteOption, MessageKey> = {
  无: "orders2b1.accessory.none",
  SIM卡: "orders2b1.accessory.sim",
  SIM卡托: "orders2b1.accessory.simTray",
  手机壳: "orders2b1.accessory.case",
  保护膜: "orders2b1.accessory.protector",
  充电器: "orders2b1.accessory.charger",
  数据线: "orders2b1.accessory.cable",
  盒子: "orders2b1.accessory.box",
  其他: "orders2b1.accessory.other",
};

const quoteReadinessKeys: Record<QuoteReadinessCode, MessageKey> = {
  diagnosis: "orders2b1.quote.missing.diagnosis",
  items: "orders2b1.quote.missing.items",
  price_exception: "orders2b1.quote.missing.priceException",
  deposit: "orders2b1.quote.missing.deposit",
  permission: "orders2b1.quote.missing.permission",
  phone: "orders2b1.quote.missing.phone",
  published_quote: "orders2b1.quote.missing.publishedQuote",
};

export function localizeOrderTransitionReasonConfig(
  config: OrderTransitionReasonConfig | undefined,
  target: RepairOrderStatus,
  t: Translate,
) {
  if (!config) return undefined;
  const configKeys = transitionConfigKeys[target];
  return {
    ...config,
    title: configKeys ? t(configKeys.title) : config.title,
    description: configKeys ? t(configKeys.description) : config.description,
    presets: config.presets.map((preset) => {
      const keys = transitionPresetKeys[preset.id];
      return keys ? { ...preset, label: t(keys.label), description: t(keys.description) } : preset;
    }),
  };
}

export function localizeAccessoryNoteOption(option: AccessoryNoteOption, t: Translate) {
  return t(accessoryKeys[option]);
}

export function localizeQuoteReadinessLabel(code: QuoteReadinessCode, t: Translate) {
  return t(quoteReadinessKeys[code]);
}

const orderQueueHintKeys: Record<OrderQueueGroup, MessageKey> = {
  processing: "orders.processingHint",
  ordered: "orders.orderedHint",
  arrived: "orders.arrivedHint",
  arrived_notified: "orders.arrivedNotifiedHint",
  repaired: "orders.repairedHint",
  repaired_notified: "orders.repairedNotifiedHint",
};

const orderQueueMessageKeys: Record<
  OrderQueueGroup,
  { label: MessageKey; shortLabel: MessageKey }
> = {
  processing: { label: "orders.processing", shortLabel: "orders.processingShort" },
  ordered: { label: "orders.ordered", shortLabel: "orders.orderedShort" },
  arrived: { label: "orders.arrived", shortLabel: "orders.arrivedShort" },
  arrived_notified: {
    label: "orders.arrivedNotified",
    shortLabel: "orders.arrivedNotifiedShort",
  },
  repaired: { label: "orders.repaired", shortLabel: "orders.repairedShort" },
  repaired_notified: {
    label: "orders.repairedNotified",
    shortLabel: "orders.repairedNotifiedShort",
  },
};

const orderQueueStageMessageKeys: Record<
  OrderQueueGroup,
  { label: MessageKey; shortLabel: MessageKey; hint: MessageKey }
> = {
  processing: {
    label: "orders.queueStageProcessing",
    shortLabel: "orders.queueStageProcessingShort",
    hint: "orders.processingHint",
  },
  ordered: {
    label: "orders.queueStageOrdered",
    shortLabel: "orders.queueStageOrderedShort",
    hint: "orders.orderedHint",
  },
  arrived: {
    label: "orders.queueStageArrived",
    shortLabel: "orders.queueStageArrivedShort",
    hint: "orders.arrivedHint",
  },
  arrived_notified: {
    label: "orders.queueStageArrivedNotified",
    shortLabel: "orders.queueStageArrivedNotifiedShort",
    hint: "orders.arrivedNotifiedHint",
  },
  repaired: {
    label: "orders.queueStageRepaired",
    shortLabel: "orders.queueStageRepairedShort",
    hint: "orders.repairedHint",
  },
  repaired_notified: {
    label: "orders.queueStageRepairedNotified",
    shortLabel: "orders.queueStageRepairedNotifiedShort",
    hint: "orders.repairedNotifiedHint",
  },
};

const exceptionKeys: Record<string, [MessageKey, MessageKey]> = {
  cancelled: ["orders.exceptionCancelled", "orders.exceptionCancelledShort"],
  unrepairable: ["orders.exceptionUnrepairable", "orders.exceptionUnrepairableShort"],
  returned_unfixed: ["orders.returnedUnfixed", "orders.returnedUnfixedShort"],
  rework: ["orders.exceptionRework", "orders.exceptionReworkShort"],
  waiting_customer: ["orders.exceptionWaitingCustomer", "orders.exceptionWaitingCustomerShort"],
  paused: ["orders.exceptionPaused", "orders.exceptionPausedShort"],
};

const workflowLabelKeys: Partial<Record<RepairOrderStatus, MessageKey>> = {
  new: "orders.workflowIntake",
  diagnosing: "orders.workflowDiagnosis",
  quoted: "orders.workflowQuote",
  waiting_approval: "orders.workflowQuote",
  parts_ordered: "orders.workflowParts",
  parts_arrived: "orders.workflowParts",
  mail_in_progress: "orders.workflowRepair",
  repairing: "orders.workflowRepair",
  repaired: "orders.repaired",
  notified: "orders.workflowPickup",
  waiting_pickup: "orders.workflowPickup",
  unfixed_pickup: "orders.workflowPickup",
  completed: "orders.workflowClosed",
  cancelled: "orders.cancelled",
};

export function localizeWorkflowStatusLabel(
  workflow: OrderWorkflow | undefined,
  code: RepairOrderStatus,
  t: Translate,
) {
  const configured = workflow?.statuses.find((status) => status.code === code);
  if (configured && !configured.is_system) return configured.label;
  const key = workflowLabelKeys[code];
  return key ? t(key) : (configured?.label ?? code);
}

export function localizeOrderWorkflowStatusLabel(
  status: { code: RepairOrderStatus; label: string; is_system: boolean },
  t: Translate,
) {
  if (!status.is_system) return status.label;
  const key = workflowLabelKeys[status.code];
  return key ? t(key) : status.label;
}

export function localizeBulkTransitionFeedback(
  { count, failures, to }: { count: number; failures: number; to: RepairOrderStatus },
  workflow: OrderWorkflow | undefined,
  t: Translate,
) {
  return t(failures ? "orders.bulkTransitionPartial" : "orders.bulkTransitionComplete", {
    count,
    label: localizeWorkflowStatusLabel(workflow, to, t),
    failures,
  });
}

export function localizeOrderQueueGroup(group: OrderQueueGroup, t: Translate) {
  const keys = orderQueueMessageKeys[group];
  return {
    label: t(keys.label),
    shortLabel: t(keys.shortLabel),
    hint: t(orderQueueHintKeys[group]),
  };
}

export function localizeOrderQueueStage(group: OrderQueueGroup, t: Translate) {
  const keys = orderQueueStageMessageKeys[group];
  return { label: t(keys.label), shortLabel: t(keys.shortLabel), hint: t(keys.hint) };
}

export function localizeOrderResultGroup(group: OrderResultGroup, t: Translate) {
  if (group === "completed")
    return { label: t("orders.completed"), hint: t("orders.completedHint") };
  if (group === "cancelled")
    return { label: t("orders.cancelled"), hint: t("orders.cancelledHint") };
  return localizeOrderQueueGroup(group, t);
}

export function localizeOrderFinancialLabel(
  state: { settlement: string; label: string },
  t: Translate,
) {
  const keyByLabel: Record<string, MessageKey | undefined> = {
    金额受限: "orders.amountRestricted",
    已退款: "orders.refunded",
    已取消: "orders.financialCancelled",
    金额待核对: "orders.amountReview",
    待报价: "orders.quotePending",
    待审批: "orders.awaitingApproval",
    报价已拒绝: "orders.quoteRejected",
    待确认报价: "orders.quoteAwaitingConfirmation",
    免收费: "orders.zeroCharge",
    "报价已拒绝 · 款项待核对": "orders.quoteRejectedBalanceReview",
    已结清: "orders.paid",
    已付押金: "orders.depositPaid",
    待收款: "orders.financialDue",
  };
  const key = keyByLabel[state.label];
  return key ? t(key) : state.label;
}

export function localizeOrderException(status: string, t: Translate) {
  const keys = exceptionKeys[status];
  return keys
    ? { label: t(keys[0]), shortLabel: t(keys[1]) }
    : { label: status, shortLabel: status };
}

const orderTypeKeys: Record<string, MessageKey> = {
  quick_repair: "orders.quickRepair",
  dropoff_repair: "orders.dropoffRepair",
};

export function localizeOrderType(type: string, t: Translate) {
  const key = orderTypeKeys[type];
  return key ? t(key) : type;
}

export function localizeDeviceCustody(
  status: string | null | undefined,
  deliveredAt: string | null | undefined,
  t: Translate,
) {
  if (status === "with_customer" && deliveredAt) return t("orders.custodyReturned");
  if (status === "with_customer") return t("orders.custodyCustomer");
  if (status === "with_shop") return t("orders.custodyShop");
  if (status === "returned") return t("orders.custodyReturned");
  return status ? status : t("orders.custodyUnknown");
}

export function localizeDeviceUnlockMethod(method: string | null | undefined, t: Translate) {
  if (method === "pin") return t("orders.unlockPin");
  if (method === "pattern") return t("orders.unlockPattern");
  if (method === "text") return t("orders.unlockText");
  return method ? method : t("orders.unlockNone");
}

const simpleStageKeys: Record<string, [MessageKey, MessageKey, MessageKey, MessageKey]> = {
  intake: [
    "dashboard.flowIntakeLabel",
    "dashboard.flowIntakeShortLabel",
    "dashboard.flowIntakeTask",
    "dashboard.flowIntakeNextAction",
  ],
  quote: [
    "dashboard.flowQuoteLabel",
    "dashboard.flowQuoteShortLabel",
    "dashboard.flowQuoteTask",
    "dashboard.flowQuoteNextAction",
  ],
  repair: [
    "dashboard.flowRepairLabel",
    "dashboard.flowRepairShortLabel",
    "dashboard.flowRepairTask",
    "dashboard.flowRepairNextAction",
  ],
  pickup: [
    "dashboard.flowPickupLabel",
    "dashboard.flowPickupShortLabel",
    "dashboard.flowPickupTask",
    "dashboard.flowPickupNextAction",
  ],
  closed: [
    "dashboard.flowClosedLabel",
    "dashboard.flowClosedShortLabel",
    "dashboard.flowClosedTask",
    "dashboard.flowClosedNextAction",
  ],
};

export function localizeOrderFlowStage(
  stage: { key: string; label: string; shortLabel: string; task: string; nextAction: string },
  t: Translate,
) {
  const keys = simpleStageKeys[stage.key];
  return keys
    ? {
        ...stage,
        label: t(keys[0]),
        shortLabel: t(keys[1]),
        task: t(keys[2]),
        nextAction: t(keys[3]),
      }
    : stage;
}

export function localizeOrderTaskGuidance<
  T extends {
    guidanceCode: OrderTaskGuidanceCode | (string & {});
    stage: SimpleOrderFlowStage;
    label: string;
    task: string;
    nextAction: string;
    workflowStatus: string;
    tone: string;
  },
>(guidance: T, t: Translate) {
  const specialKeys: Partial<Record<OrderTaskGuidanceCode, [MessageKey, MessageKey, MessageKey]>> =
    {
      cancelled: [
        "dashboard.guidanceCancelledLabel",
        "dashboard.cancelledTask",
        "dashboard.cancelledNextAction",
      ],
      approval_overdue: [
        "orders.approvalOverdue",
        "dashboard.approvalOverdueTask",
        "dashboard.contactCustomer",
      ],
      device_with_customer: [
        "dashboard.customerCustodyLabel",
        "dashboard.customerCustodyTask",
        "dashboard.confirmIntake",
      ],
      pickup_overdue: [
        "orders.pickupOverdue",
        "dashboard.pickupOverdueTask",
        "dashboard.pickupOverdueNextAction",
      ],
      mail_in_progress: [
        "dashboard.mailInLabel",
        "dashboard.mailInTask",
        "dashboard.mailInNextAction",
      ],
      repaired: [
        "dashboard.repairedLabel",
        "dashboard.repairedTask",
        "dashboard.flowPickupNextAction",
      ],
    };
  const stage =
    guidance.guidanceCode === "cancelled"
      ? {
          ...guidance.stage,
          label: t("dashboard.cancelledLabel"),
          shortLabel: t("orders.cancelled"),
          task: t("dashboard.cancelledTask"),
          nextAction: t("dashboard.cancelledNextAction"),
        }
      : localizeOrderFlowStage(guidance.stage, t);
  if (guidance.guidanceCode === "stage") {
    return {
      ...guidance,
      stage,
      label: stage.label,
      task: stage.task,
      nextAction: stage.nextAction,
    };
  }
  const keys = specialKeys[guidance.guidanceCode as keyof typeof specialKeys];
  if (!keys) return guidance;
  return {
    ...guidance,
    stage,
    label: t(keys[0]),
    task: t(keys[1]),
    nextAction: t(keys[2]),
  };
}
