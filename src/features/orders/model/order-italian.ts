import { formatMoney } from "@/lib/money";
import type { RepairOrderStatus } from "@/lib/mock/enums";

export const orderTypeItalian = {
  quick_repair: "Riparazione rapida",
  dropoff_repair: "Riparazione in negozio",
} as const;

export const statusItalian: Record<RepairOrderStatus, string> = {
  new: "Nuovo",
  rework: "Rientro in garanzia",
  mail_in_progress: "Spedizione in corso",
  diagnosing: "In diagnosi",
  quoted: "Preventivo emesso",
  waiting_approval: "In attesa di approvazione",
  parts_ordered: "Ricambi ordinati",
  parts_arrived: "Ricambi arrivati",
  repairing: "In riparazione",
  repaired: "Riparato",
  notified: "Cliente avvisato",
  unfixed_pickup: "Ritiro senza riparazione",
  waiting_pickup: "In attesa di ritiro",
  completed: "Completato",
  cancelled: "Annullato",
};

const faultItalianTerms: Record<string, string> = {
  屏幕: "Display",
  外屏碎裂: "Vetro esterno rotto",
  内屏漏液: "LCD danneggiato",
  触摸失灵: "Touch non funzionante",
  电池: "Batteria",
  健康度低: "Salute batteria bassa",
  耗电快: "Consumo rapido",
  鼓包: "Batteria gonfia",
  尾插: "Connettore di ricarica",
  接口松动: "Porta allentata",
  无法充电: "Non carica",
  清洁尾插: "Pulizia connettore",
  摄像头: "Fotocamera",
  前摄异常: "Fotocamera frontale",
  后摄异常: "Fotocamera posteriore",
  镜头破损: "Lente danneggiata",
  进水: "Danni da liquido",
  清洁检测: "Pulizia e diagnosi",
  主板腐蚀: "Ossidazione scheda",
  主板: "Scheda madre",
  不开机: "Non si accende",
  无服务: "Nessun servizio",
  短路: "Corto circuito",
  系统: "Sistema",
  刷机恢复: "Ripristino software",
  资料迁移: "Trasferimento dati",
  账户问题: "Problema account",
  后盖: "Cover posteriore",
  玻璃破裂: "Vetro posteriore rotto",
  中框变形: "Telaio deformato",
  "面容/指纹": "Face ID / Impronta",
  面容异常: "Face ID non funzionante",
  指纹异常: "Impronta non funzionante",
  扬声器: "Altoparlante",
  声音小: "Volume basso",
  杂音: "Rumore",
  麦克风: "Microfono",
  无声: "Audio assente",
  通话杂音: "Rumore in chiamata",
  按键: "Tasti",
  电源键: "Tasto accensione",
  音量键: "Tasti volume",
  静音键: "Tasto silenzioso",
  不细分: "",
};

export function translateFaultName(name: string) {
  const direct = faultItalianTerms[name.trim()];
  if (direct) return direct;
  const parts = name
    .split(/\s*[-/]\s*/)
    .map((part) => faultItalianTerms[part.trim()] ?? part.trim())
    .filter(Boolean);
  return parts.length ? Array.from(new Set(parts)).join(" - ") : name;
}

export function toItalianWarranty(value?: string) {
  const text = value?.trim();
  if (!text || text === "无保修") return "Nessuna garanzia";
  if (text.includes("12")) return "12 mesi sulla parte riparata/sostituita";
  if (text.includes("6")) return "6 mesi sulla parte riparata/sostituita";
  if (text.includes("3")) return "3 mesi sulla parte riparata/sostituita";
  if (text.includes("90")) return "90 giorni sulla parte riparata/sostituita";
  return text;
}

export function formatEuro(amount: number) {
  return formatMoney(Number(amount) || 0);
}

export function formatItalianDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
