export const MAIN_REPAIR_SERVICE_OPTION_KEY = "main";

export interface RepairServiceCatalogOption {
  key: string;
  label: string;
  italian: string;
}

export interface RepairServiceCatalogGroup {
  key: string;
  label: string;
  italian: string;
  repairOptions?: readonly RepairServiceCatalogOption[];
  options: readonly RepairServiceCatalogOption[];
}

export interface RepairServiceCatalogItem {
  catalogKey: string;
  groupKey: string;
  optionKey: string;
  groupLabel: string;
  label: string;
  italian: string;
  name: string;
  isMain: boolean;
}

export const repairServiceCatalogGroups = [
  {
    key: "display",
    label: "屏幕",
    italian: "Display",
    repairOptions: [
      { key: "original", label: "原装", italian: "Ricambio originale" },
      { key: "assembled", label: "组装", italian: "Ricambio compatibile" },
      { key: "tft", label: "TFT", italian: "Display TFT" },
      { key: "incell", label: "Incell", italian: "Display Incell" },
    ],
    options: [
      { key: "glass", label: "外屏碎裂", italian: "Vetro esterno rotto" },
      { key: "lcd", label: "内屏漏液", italian: "LCD danneggiato" },
      { key: "touch", label: "触摸失灵", italian: "Touch non funzionante" },
      { key: "no-display", label: "黑屏无显示", italian: "Schermo nero" },
      { key: "lines", label: "花屏/竖线", italian: "Linee sul display" },
      { key: "backlight", label: "背光异常", italian: "Retroilluminazione difettosa" },
      { key: "protector", label: "贴膜服务", italian: "Applicazione pellicola" },
    ],
  },
  {
    key: "battery",
    label: "电池",
    italian: "Batteria",
    repairOptions: [
      { key: "original", label: "原装", italian: "Batteria originale" },
      { key: "assembled", label: "组装", italian: "Batteria compatibile" },
      { key: "high-capacity", label: "扩容版", italian: "Batteria maggiorata" },
    ],
    options: [
      { key: "health", label: "健康度低", italian: "Salute batteria bassa" },
      { key: "drain", label: "耗电快", italian: "Consumo rapido" },
      { key: "swollen", label: "鼓包", italian: "Batteria gonfia" },
      { key: "shutdown", label: "自动关机", italian: "Spegnimento improvviso" },
      { key: "not-detected", label: "电池不识别", italian: "Batteria non riconosciuta" },
      { key: "charging-slow", label: "充电慢", italian: "Ricarica lenta" },
      { key: "calibration", label: "电池校准", italian: "Calibrazione batteria" },
    ],
  },
  {
    key: "charging",
    label: "尾插",
    italian: "Connettore di ricarica",
    repairOptions: [
      { key: "original", label: "原装", italian: "Connettore originale" },
      { key: "assembled", label: "组装", italian: "Connettore compatibile" },
    ],
    options: [
      { key: "loose", label: "接口松动", italian: "Porta allentata" },
      { key: "no-charge", label: "无法充电", italian: "Non carica" },
      { key: "clean", label: "清洁尾插", italian: "Pulizia connettore" },
      { key: "intermittent", label: "接触不良", italian: "Contatto intermittente" },
      { key: "fast-charge", label: "快充异常", italian: "Ricarica rapida difettosa" },
      { key: "data-port", label: "无法连接电脑", italian: "Connessione dati non funziona" },
      {
        key: "wireless-charge",
        label: "无线充异常",
        italian: "Ricarica wireless difettosa",
      },
    ],
  },
  {
    key: "camera",
    label: "摄像头",
    italian: "Fotocamera",
    options: [
      { key: "front", label: "前摄异常", italian: "Fotocamera frontale" },
      { key: "rear", label: "后摄异常", italian: "Fotocamera posteriore" },
      { key: "lens", label: "镜头破损", italian: "Lente danneggiata" },
      { key: "focus", label: "无法对焦", italian: "Messa a fuoco non funziona" },
      { key: "shake", label: "抖动异响", italian: "Vibrazione della fotocamera" },
      { key: "flash", label: "闪光灯异常", italian: "Flash non funzionante" },
      { key: "camera-app", label: "相机打不开", italian: "App fotocamera non si apre" },
    ],
  },
  {
    key: "liquid",
    label: "进水",
    italian: "Danni da liquido",
    options: [
      { key: "cleaning", label: "清洁检测", italian: "Pulizia e diagnosi" },
      { key: "corrosion", label: "主板腐蚀", italian: "Ossidazione scheda" },
      { key: "no-power", label: "进水不开机", italian: "Non si accende dopo liquido" },
      { key: "screen", label: "进水屏幕异常", italian: "Display danneggiato da liquido" },
      { key: "data-rescue", label: "资料抢救", italian: "Recupero dati" },
      { key: "inspection", label: "进水检测报告", italian: "Report diagnosi liquido" },
    ],
  },
  {
    key: "mainboard",
    label: "主板",
    italian: "Scheda madre",
    options: [
      { key: "no-power", label: "不开机", italian: "Non si accende" },
      { key: "baseband", label: "无服务", italian: "Nessun servizio" },
      { key: "short", label: "短路", italian: "Corto circuito" },
      { key: "charging-ic", label: "充电IC", italian: "IC ricarica" },
      { key: "power-ic", label: "电源IC", italian: "IC alimentazione" },
      { key: "wifi-bt", label: "Wi-Fi/蓝牙异常", italian: "Wi-Fi/Bluetooth difettoso" },
      { key: "storage", label: "硬盘/存储故障", italian: "Memoria interna difettosa" },
      { key: "board-repair", label: "主板维修", italian: "Riparazione scheda madre" },
    ],
  },
  {
    key: "system",
    label: "系统",
    italian: "Sistema",
    options: [
      { key: "restore", label: "刷机恢复", italian: "Ripristino software" },
      { key: "data", label: "资料迁移", italian: "Trasferimento dati" },
      { key: "account", label: "账户问题", italian: "Problema account" },
      { key: "screen-lock", label: "屏幕锁解锁", italian: "Sblocco codice schermo" },
      { key: "pin-lock", label: "PIN/图案解锁", italian: "Sblocco PIN o sequenza" },
      { key: "update", label: "系统升级", italian: "Aggiornamento sistema" },
      { key: "backup", label: "资料备份", italian: "Backup dati" },
      {
        key: "activation-check",
        label: "激活锁核验咨询",
        italian: "Verifica blocco attivazione",
      },
      { key: "app-error", label: "软件/应用异常", italian: "Problema app o software" },
    ],
  },
  {
    key: "back-cover",
    label: "后盖",
    italian: "Cover posteriore",
    options: [
      { key: "glass", label: "玻璃破裂", italian: "Vetro posteriore rotto" },
      { key: "frame", label: "中框变形", italian: "Telaio deformato" },
      { key: "camera-glass", label: "摄像头玻璃", italian: "Vetro fotocamera" },
      { key: "wireless-coil", label: "无线充线圈", italian: "Bobina ricarica wireless" },
      { key: "housing", label: "后壳总成", italian: "Scocca posteriore completa" },
      { key: "adhesive", label: "防水胶重贴", italian: "Nuova guarnizione adesiva" },
    ],
  },
  {
    key: "face",
    label: "面容/指纹",
    italian: "Face ID / Impronta",
    options: [
      { key: "face-id", label: "面容异常", italian: "Face ID non funzionante" },
      { key: "fingerprint", label: "指纹异常", italian: "Impronta non funzionante" },
      { key: "proximity", label: "距离感应异常", italian: "Sensore prossimita difettoso" },
      { key: "ambient", label: "自动亮度异常", italian: "Sensore luminosita difettoso" },
      { key: "home-touch", label: "Home 指纹键", italian: "Tasto Home con impronta" },
      {
        key: "earpiece-flex",
        label: "听筒排线",
        italian: "Flat altoparlante auricolare",
      },
    ],
  },
  {
    key: "speaker",
    label: "扬声器",
    italian: "Altoparlante",
    options: [
      { key: "low", label: "声音小", italian: "Volume basso" },
      { key: "noise", label: "杂音", italian: "Rumore" },
      { key: "no-sound", label: "外放无声", italian: "Altoparlante senza audio" },
      { key: "earpiece", label: "听筒无声", italian: "Auricolare senza audio" },
      { key: "mesh-clean", label: "听筒网清洁", italian: "Pulizia griglia auricolare" },
      { key: "speaker-replace", label: "扬声器更换", italian: "Sostituzione altoparlante" },
    ],
  },
  {
    key: "microphone",
    label: "麦克风",
    italian: "Microfono",
    options: [
      { key: "no-sound", label: "无声", italian: "Audio assente" },
      { key: "noise", label: "通话杂音", italian: "Rumore in chiamata" },
      { key: "caller-cannot-hear", label: "对方听不到", italian: "Interlocutore non sente" },
      { key: "recording", label: "录音异常", italian: "Registrazione difettosa" },
      { key: "bottom-mic", label: "底部麦克风", italian: "Microfono inferiore" },
      { key: "top-mic", label: "顶部麦克风", italian: "Microfono superiore" },
      { key: "mic-clean", label: "麦克风清洁", italian: "Pulizia microfono" },
    ],
  },
  {
    key: "button",
    label: "按键",
    italian: "Tasti",
    options: [
      { key: "power", label: "电源键", italian: "Tasto accensione" },
      { key: "volume", label: "音量键", italian: "Tasti volume" },
      { key: "silent", label: "静音键", italian: "Tasto silenzioso" },
      { key: "home", label: "Home 键", italian: "Tasto Home" },
      { key: "action", label: "Action 按键", italian: "Tasto Azione" },
      { key: "camera-control", label: "相机控制键", italian: "Tasto controllo fotocamera" },
      { key: "vibration", label: "震动马达", italian: "Motore vibrazione" },
      { key: "button-flex", label: "按键排线", italian: "Flat tasti" },
    ],
  },
] as const satisfies readonly RepairServiceCatalogGroup[];

export function repairServiceCatalogKey(groupKey: string, optionKey: string) {
  return `${groupKey}:${optionKey}`;
}

export function repairServiceCatalogItemsForGroup(
  group: RepairServiceCatalogGroup,
): RepairServiceCatalogItem[] {
  const detailOptions = [...(group.repairOptions ?? []), ...group.options];
  return [
    {
      catalogKey: repairServiceCatalogKey(group.key, MAIN_REPAIR_SERVICE_OPTION_KEY),
      groupKey: group.key,
      optionKey: MAIN_REPAIR_SERVICE_OPTION_KEY,
      groupLabel: group.label,
      label: group.label,
      italian: group.italian,
      name: group.label,
      isMain: true,
    },
    ...detailOptions.map((option) => ({
      catalogKey: repairServiceCatalogKey(group.key, option.key),
      groupKey: group.key,
      optionKey: option.key,
      groupLabel: group.label,
      label: option.label,
      italian: option.italian,
      name: `${group.label} - ${option.label}`,
      isMain: false,
    })),
  ];
}

export const repairServiceCatalogItems = repairServiceCatalogGroups.flatMap((group) =>
  repairServiceCatalogItemsForGroup(group),
);

const repairServiceCatalogByKey = new Map(
  repairServiceCatalogItems.map((item) => [item.catalogKey, item]),
);
const repairServiceCatalogByName = new Map(
  repairServiceCatalogItems.map((item) => [item.name, item]),
);

export function getRepairServiceCatalogItem(catalogKey?: string | null) {
  return catalogKey ? repairServiceCatalogByKey.get(catalogKey) : undefined;
}

export function findRepairServiceCatalogItemByName(name?: string | null) {
  return name ? repairServiceCatalogByName.get(name.trim()) : undefined;
}

export function resolveRepairServiceCatalogItem(input: {
  catalogKey?: string | null;
  name?: string | null;
}) {
  const byKey = getRepairServiceCatalogItem(input.catalogKey);
  if (byKey && byKey.name === input.name?.trim()) return byKey;
  return findRepairServiceCatalogItemByName(input.name);
}

export function isRepairServiceCatalogKey(value: unknown): value is string {
  return typeof value === "string" && repairServiceCatalogByKey.has(value);
}
