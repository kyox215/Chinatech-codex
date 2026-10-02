import type { IntakeServices } from "./intake-services";
import type { RetailUnit } from "./retail";

export type PrintLanguage = "it" | "en" | "zh";
export const printLanguages = [{ value: "it", label: "Italiano" }, { value: "en", label: "English" }, { value: "zh", label: "中文" }] as const;
const languageIndex: Record<PrintLanguage, number> = { it: 0, en: 1, zh: 2 };
const locales: Record<PrintLanguage, string> = { it: "it-IT", en: "en-GB", zh: "zh-CN" };
type Translation = readonly [string, string, string];

const labels = {
  repairPreview: ["Stampa ordine di riparazione", "Print repair intake receipt", "打印接机单"],
  salePreview: ["Documento di vendita e garanzia", "Sale and warranty receipt", "销售与保修单"],
  productPreview: ["Anteprima garanzia prodotto", "Product warranty preview", "商品保修单预览"],
  close: ["Chiudi anteprima", "Close print preview", "关闭打印预览"],
  paper: ["Carta", "Paper", "纸张"], printLanguage: ["Lingua di stampa", "Print language", "打印语言"],
  print: ["Stampa", "Print", "打印"], a4: ["A4 orizzontale", "A4 landscape", "A4 横向"],
  a5: ["A5 orizzontale", "A5 landscape", "A5 横向"], half: ["A4 metà superiore", "A4 upper half", "A4 上半页"], double: ["A4 doppia copia", "A4 two copies", "A4 双联"],
  customerCopy: ["Copia cliente", "Customer copy", "客户联"], shopCopy: ["Copia negozio", "Shop copy", "门店联"],
  repairTitle: ["ORDINE DI RIPARAZIONE", "REPAIR INTAKE RECEIPT", "维修接机单"],
  customerDocument: ["Documento per il cliente", "Customer document", "客户凭证"],
  orderNumber: ["Numero ordine", "Order number", "工单编号"], date: ["Data", "Date", "日期"],
  customer: ["Cliente", "Customer", "客户"], phone: ["Telefono", "Phone", "联系电话"],
  contact: ["Tel / WhatsApp", "Phone / WhatsApp", "电话 / WhatsApp"], device: ["Dispositivo", "Device", "设备"],
  brand: ["Marca", "Brand", "品牌"], model: ["Modello", "Model", "型号"],
  category: ["Tipo di dispositivo", "Device type", "设备类别"], serial: ["IMEI / Seriale", "IMEI / Serial", "IMEI / SN"],
  color: ["Colore", "Colour", "颜色"], unrecorded: ["Non registrato", "Not recorded", "未记录"],
  pending: ["Da confermare", "To be confirmed", "待确认"], unspecified: ["Non specificato", "Not specified", "未指定"],
  originalText: ["Testo originale del cliente", "Customer's original text", "客户原文"],
  recordedText: ["Testo originale registrato", "Original recorded text", "记录原文"],
  requested: ["Intervento richiesto", "Requested work", "维修需求"],
  description: ["Descrizione", "Description", "说明"], amount: ["Importo", "Amount", "金额"],
  evaluate: ["Da valutare", "To be assessed", "待评估"], define: ["Da definire", "To be determined", "待确定"],
  reportedFault: ["Difetto segnalato", "Reported fault", "报告故障"],
  issueNote: ["Dettagli del difetto · testo originale del cliente", "Fault details · customer's original text", "故障补充 · 客户原文"],
  diagnosis: ["Diagnosi", "Diagnosis", "检测"], incomplete: ["Da completare", "Pending", "待完成"],
  amounts: ["Importi (EUR)", "Amounts (EUR)", "金额 (EUR)"], total: ["Totale ordine", "Order total", "工单总额"],
  unquoted: ["Non preventivato", "Not quoted", "未报价"], deposit: ["Acconto", "Deposit", "预付款"],
  balance: ["Saldo dovuto", "Balance due", "应付余额"], service: ["Servizio", "Service", "服务"],
  technician: ["Tecnico", "Technician", "维修员"], unassigned: ["Da assegnare", "Unassigned", "未分配"],
  orderType: ["Tipo ordine", "Order type", "工单类型"], repair: ["Riparazione", "Repair", "维修"],
  status: ["Stato", "Status", "状态"], custody: ["Custodia del dispositivo", "Device custody", "设备保管"],
  warrantyDuration: ["Durata garanzia commerciale", "Commercial warranty period", "商家保修期"],
  accessories: ["Accessori consegnati", "Accessories received", "随件"], priority: ["Priorità", "Priority", "优先级"],
  local: ["ANTEPRIMA LOCALE · NON FISCALE", "LOCAL PREVIEW · NON-FISCAL", "本地预览 · 非税务单据"],
  repairWarrantyTitle: ["GARANZIA E INFORMAZIONI NEGOZIO", "WARRANTY AND SHOP DETAILS", "保修与门店资料"],
  trackingTitle: ["STATO RIPARAZIONE", "REPAIR STATUS", "维修状态"],
  scan: ["Scansiona per trovare l'ordine.", "Scan to find the order.", "扫码查找工单。"],
  trackingLimit: ["Solo questo browser · accesso riservato", "This browser only · authorised access", "仅此浏览器 · 需获授权访问"],
  qr: ["Codice QR per l'ordine", "Order QR code", "工单二维码"],
  qrLoading: ["Generazione codice QR…", "Generating QR code…", "正在生成二维码…"],
  qrError: ["Generazione codice QR non riuscita.", "QR code generation failed.", "二维码生成失败。"],
  qrRetry: ["Riprova codice QR", "Retry QR code", "重新生成二维码"],
  receiptUnavailable: ["Dati o impostazioni non disponibili. Riaprire l'anteprima prima di stampare.", "Receipt data or settings are unavailable. Reopen the preview before printing.", "资料或设置无法读取，请重新打开预览后打印。"],
  warrantyTerms: ["Termini della garanzia commerciale", "Commercial warranty terms", "商家保修条款"],
  statutoryRights: ["Diritti del consumatore", "Consumer rights", "消费者权利"],
  customerSignature: ["Firma cliente · verifica dati di accettazione", "Customer signature · intake details review", "客户签名 · 接机资料核对"],
  signatureLanguage: ["Lingua della firma", "Signing language", "签署语言"],
  signedAt: ["Firmato il", "Signed at", "签署时间"],
  historicalSignature: ["La firma precedente riguarda dati storici e non copre questi dati. Occorre una nuova firma.", "The previous signature covers historical details, not the current details. A new signature is required.", "历史签名不覆盖当前资料，需重新签署。"],
  keepReceipt: ["Conservare questo documento per l'assistenza.", "Keep this document for support.", "请保留本单以便办理售后。"],
  salesTitle: ["DOCUMENTO DI VENDITA", "SALE RECEIPT", "销售单"],
  productTitle: ["SCHEDA PRODOTTO · ANTEPRIMA", "PRODUCT DETAILS · PREVIEW", "商品资料 · 预览"],
  saleRecorded: ["Vendita registrata localmente", "Sale recorded locally", "销售已本地记录"],
  notSale: ["Non attesta una vendita", "Does not confirm a sale", "不证明已售出"],
  reprintShop: ["Negozio di contatto per questa ristampa", "Contact shop for this reprint", "本次重打联系门店"],
  reference: ["Riferimento", "Reference", "单机编号"], historicalProduct: ["Prodotto storico non registrato", "Historical product not recorded", "历史商品未记录"],
  registrationDate: ["Data registrazione", "Registration date", "登记时间"], notSold: ["Non venduto", "Not sold", "未售出"],
  product: ["Prodotto", "Product", "商品"], brandModel: ["Marca / modello", "Brand / model", "品牌 / 型号"],
  condition: ["Categoria commerciale", "Sale condition", "商品分类"],
  specs: ["Specifiche", "Specifications", "规格"], productType: ["Tipo prodotto", "Product type", "商品类型"],
  declaredCondition: ["Condizioni dichiarate · testo originale", "Declared condition · original text", "已知问题 · 记录原文"],
  productMissing: ["Identità e specifiche della vendita originale non registrate. Verificare il documento originale.", "The original sale's product identity and specifications were not recorded. Check the original receipt.", "原销售商品身份和规格未记录，请核对原凭证。"],
  email: ["Email", "Email", "电子邮箱"], address: ["Indirizzo", "Address", "地址"],
  salePrice: ["Prezzo di vendita", "Sale price", "成交价"], indicativePrice: ["Prezzo indicativo", "Indicative price", "参考售价"],
  payment: ["Pagamento", "Payment", "已收款"], refunds: ["Rimborsi registrati", "Recorded refunds", "已记录退款"],
  returnedProduct: ["Prodotto restituito", "Product returned", "实物已退回"], delivery: ["Consegna", "Delivery", "交付"],
  deliveryUndated: ["Registrata, data non disponibile", "Recorded, date unavailable", "已记录，日期未知"],
  commercialWarranty: ["Garanzia commerciale", "Commercial warranty", "商家保修"], duration: ["Durata", "Period", "期限"],
  warrantyUnknown: ["Non registrata · verificare il documento originale", "Not recorded · check the original receipt", "未记录 · 核对原凭证"],
  starts: ["Decorrenza", "Starts", "起算日"], actualDelivery: ["Dalla consegna effettiva · data da confermare", "From actual delivery · date to be confirmed", "从实际交付起 · 日期待确认"],
  expires: ["Scadenza", "Expires", "到期日"], noCommercialWarranty: ["Nessuna garanzia commerciale aggiuntiva", "No additional commercial warranty", "无额外商家保修"],
  notApplicable: ["Non applicabile alla garanzia commerciale", "Not applicable to commercial warranty", "商家保修不适用"],
  afterDelivery: ["Da confermare dopo la consegna", "To be confirmed after delivery", "交付后确认"],
  nonFiscal: ["Non sostituisce scontrino o fattura.", "Does not replace a fiscal receipt or invoice.", "不替代税务收据或发票。"],
  saleWarrantyTitle: ["GARANZIA E ASSISTENZA", "WARRANTY AND SUPPORT", "保修与售后"],
  guarantor: ["Garante", "Warranty provider", "保修门店"],
  guarantorUnknown: ["Garante della vendita: non registrato · verificare il documento originale", "Original warranty provider: not recorded · check the original receipt", "原销售保修门店未记录 · 核对原凭证"],
  historicalRights: ["I rimedi gratuiti per i difetti di conformità previsti dalla legge restano salvi. Questa ristampa non ricostruisce né modifica le condizioni della vendita originale.", "Free statutory remedies for lack of conformity remain unaffected. This reprint does not reconstruct or change the original sale terms.", "法定符合性免费救济不受影响。本次重打不重建或修改原销售条款。"],
  historicalTerms: ["Condizioni originali non registrate. Nessuna durata o esclusione viene attribuita retroattivamente a questa vendita.", "Original terms were not recorded. No period or exclusion is applied retrospectively to this sale.", "原条款未记录，不为此销售追溯添加保修期或除外条款。"],
  saleSignature: ["Firma cliente · presa visione", "Customer signature · acknowledgement", "客户签名 · 已阅"],
  saleSignatureNote: ["La firma non comporta rinuncia ai diritti previsti dalla legge. Conservare la prova d'acquisto e questo documento.", "Signing does not waive statutory rights. Keep the proof of purchase and this document.", "签名不放弃法定权利。请保留购买证明与本单。"],
  originalTermsUnknown: ["Condizioni originali non registrate", "Original terms not recorded", "原条款未记录"],
  currentTerms: ["Anteprima delle condizioni attuali", "Preview of current terms", "当前条款预览"],
  bodyStorage: ["Memoria interna", "Internal storage", "机身存储"],
  keyboard: ["Layout tastiera", "Keyboard layout", "键盘布局"], controllers: ["Controller inclusi", "Included controllers", "随附手柄"],
  batteryHealth: ["Salute batteria", "Battery health", "电池健康"], appearanceGrade: ["Grado estetico", "Appearance grade", "外观等级"],
} as const satisfies Record<string, Translation>;
export type PrintLabel = keyof typeof labels;
export function printLabel(key: PrintLabel, language: PrintLanguage): string { return labels[key][languageIndex[language]]; }
export function printLanguageName(value: PrintLanguage, language: PrintLanguage): string {
  const names: Record<PrintLanguage, Translation> = { it: ["Italiano", "Italian", "意大利语"], en: ["Inglese", "English", "英语"], zh: ["Cinese", "Chinese", "中文"] };
  return names[value][languageIndex[language]];
}
export function printMonths(months: number, language: PrintLanguage, fromDelivery = false): string {
  const value = new Intl.NumberFormat(locales[language]).format(months);
  return language === "it" ? `${value} mesi${fromDelivery ? " dalla consegna effettiva" : ""}` : language === "en" ? `${value} months${fromDelivery ? " from actual delivery" : ""}` : `${value} 个月${fromDelivery ? "，从实际交付起算" : ""}`;
}
export function printMoney(cents: number | null | undefined, language: PrintLanguage): string {
  return cents == null || !Number.isFinite(cents) ? printLabel("pending", language) : new Intl.NumberFormat(locales[language], { style: "currency", currency: "EUR" }).format(cents / 100);
}
// Plain local record times are wall-clock values: preserve their date and time,
// while formatting the order of fields. ISO timestamps are displayed in Rome.
export function printDate(value: string, language: PrintLanguage): string {
  if (!value) return printLabel("unrecorded", language);
  const local = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  const date = local ? new Date(Date.UTC(+local[1], +local[2] - 1, +local[3], +(local[4] ?? 0), +(local[5] ?? 0), +(local[6] ?? 0))) : new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  if (local && (date.getUTCFullYear() !== +local[1] || date.getUTCMonth() + 1 !== +local[2] || date.getUTCDate() !== +local[3] || +(local[4] ?? 0) > 23 || +(local[5] ?? 0) > 59 || +(local[6] ?? 0) > 59)) return value;
  return new Intl.DateTimeFormat(locales[language], { dateStyle: "medium", ...(local && !local[4] ? {} : { timeStyle: "short" }), timeZone: local ? "UTC" : "Europe/Rome" }).format(date);
}

const known: Record<string, Translation> = {
  "屏幕": ["Display", "Screen", "屏幕"], "电池": ["Batteria", "Battery", "电池"], "尾插": ["Connettore di ricarica", "Charging port", "尾插"],
  "摄像头": ["Fotocamera", "Camera", "摄像头"], "进水": ["Liquidi", "Liquid ingress", "进水"], "主板": ["Scheda madre", "Mainboard", "主板"],
  "系统": ["Sistema", "System", "系统"], "后盖": ["Cover posteriore", "Back cover", "后盖"], "面容/指纹": ["Riconoscimento facciale / impronta", "Face / fingerprint recognition", "面容/指纹"],
  "扬声器": ["Altoparlante", "Speaker", "扬声器"], "麦克风": ["Microfono", "Microphone", "麦克风"], "按键": ["Tasti", "Buttons", "按键"],
  "碎裂": ["Rotto", "Cracked", "碎裂"], "不显示": ["Nessuna immagine", "No display", "不显示"], "触摸失灵": ["Touch non funzionante", "Touch not working", "触摸失灵"], "显示异常": ["Immagine anomala", "Display abnormality", "显示异常"],
  "续航差": ["Autonomia ridotta", "Poor battery life", "续航差"], "不充电": ["Non carica", "Not charging", "不充电"], "鼓包": ["Batteria gonfia", "Swollen battery", "鼓包"], "自动关机": ["Spegnimento spontaneo", "Unexpected shutdown", "自动关机"],
  "接口松动": ["Connettore allentato", "Loose port", "接口松动"], "无法充电": ["Impossibile caricare", "Unable to charge", "无法充电"], "无法传输数据": ["Trasferimento dati non funzionante", "Data transfer not working", "无法传输数据"],
  "无法拍摄": ["Impossibile scattare foto", "Unable to take photos", "无法拍摄"], "模糊": ["Immagine sfocata", "Blurred image", "模糊"], "镜片破损": ["Lente danneggiata", "Damaged lens", "镜片破损"],
  "接触液体": ["Contatto con liquidi", "Contact with liquid", "接触液体"], "无法开机": ["Non si accende", "Will not power on", "无法开机"], "需检查腐蚀": ["Verificare corrosione", "Corrosion check requested", "需检查腐蚀"],
  "重启": ["Riavvii", "Restarting", "重启"], "发热": ["Surriscaldamento", "Overheating", "发热"], "无信号": ["Nessun segnale", "No signal", "无信号"],
  "卡顿": ["Rallentamenti", "Lagging", "卡顿"], "无法启动": ["Avvio non riuscito", "Unable to boot", "无法启动"], "软件异常": ["Problema software", "Software issue", "软件异常"],
  "破损": ["Danneggiato", "Damaged", "破损"], "开胶": ["Adesivo staccato", "Adhesive separation", "开胶"], "变形": ["Deformato", "Deformed", "变形"],
  "无法识别": ["Riconoscimento non riuscito", "Recognition not working", "无法识别"], "无法录入": ["Registrazione non riuscita", "Unable to enrol", "无法录入"],
  "无声音": ["Nessun audio", "No sound", "无声音"], "杂音": ["Rumore audio", "Audio noise", "杂音"], "声音小": ["Volume basso", "Low volume", "声音小"], "通话异常": ["Problema nelle chiamate", "Call issue", "通话异常"],
  "电源键": ["Tasto accensione", "Power button", "电源键"], "音量键": ["Tasti volume", "Volume buttons", "音量键"], "键盘": ["Tastiera", "Keyboard", "键盘"], "摇杆": ["Joystick", "Joystick", "摇杆"],
  "黑色": ["Nero", "Black", "黑色"], "白色": ["Bianco", "White", "白色"], "银色": ["Argento", "Silver", "银色"], "灰色": ["Grigio", "Grey", "灰色"],
  "午夜色": ["Mezzanotte", "Midnight", "午夜色"], "钛灰": ["Grigio titanio", "Titanium grey", "钛灰"], "蓝色": ["Blu", "Blue", "蓝色"], "深蓝色": ["Blu scuro", "Dark blue", "深蓝色"],
  "绿色": ["Verde", "Green", "绿色"], "紫色": ["Viola", "Purple", "紫色"], "粉色": ["Rosa", "Pink", "粉色"], "红色": ["Rosso", "Red", "红色"], "金色": ["Oro", "Gold", "金色"],
  "原色钛金属": ["Titanio naturale", "Natural titanium", "原色钛金属"], "黑色钛金属": ["Titanio nero", "Black titanium", "黑色钛金属"], "白色钛金属": ["Titanio bianco", "White titanium", "白色钛金属"], "蓝色钛金属": ["Titanio blu", "Blue titanium", "蓝色钛金属"],
  "普通": ["Normale", "Normal", "普通"], "优先": ["Prioritaria", "Priority", "优先"], "紧急": ["Urgente", "Urgent", "紧急"],
  "SIM 卡": ["Scheda SIM", "SIM card", "SIM 卡"], "SIM 卡托": ["Carrellino SIM", "SIM tray", "SIM 卡托"], "手机壳": ["Custodia", "Phone case", "手机壳"], "保护膜": ["Pellicola protettiva", "Screen protector", "保护膜"],
  "充电器": ["Caricatore", "Charger", "充电器"], "数据线": ["Cavo dati", "Data cable", "数据线"], "包装盒": ["Scatola", "Box", "包装盒"], "其他": ["Altro", "Other", "其他"],
  "原装充电器": ["Caricatore originale", "Original charger", "原装充电器"], "电源线": ["Cavo di alimentazione", "Power cable", "电源线"], "不含手柄": ["Controller non incluso", "No controller included", "不含手柄"], "底座": ["Dock", "Dock", "底座"], "电源": ["Alimentatore", "Power adapter", "电源"], "Joy-Con 一对": ["Coppia di Joy-Con", "Pair of Joy-Con", "Joy-Con 一对"],
  "新机": ["Nuovo", "New", "新机"], "翻新机": ["Ricondizionato", "Refurbished", "翻新机"],
  "手机": ["Telefono", "Phone", "手机"], "平板": ["Tablet", "Tablet", "平板"], "电脑": ["Computer", "Computer", "电脑"], "笔记本": ["Portatile", "Laptop", "笔记本"], "台式电脑": ["Computer desktop", "Desktop computer", "台式电脑"], "游戏机": ["Console", "Game console", "游戏机"], "其他商品": ["Altro prodotto", "Other product", "其他商品"],
  "数字版": ["Edizione digitale", "Digital edition", "数字版"], "光驱版": ["Edizione con lettore", "Disc edition", "光驱版"], "国行": ["Versione Cina", "China edition", "国行"], "国际版": ["Versione internazionale", "International edition", "国际版"],
  "欧版": ["Versione europea", "European edition", "欧版"], "美版": ["Versione USA", "US edition", "美版"], "港版": ["Versione Hong Kong", "Hong Kong edition", "港版"], "日版": ["Versione Giappone", "Japan edition", "日版"],
  "单 SIM": ["SIM singola", "Single SIM", "单 SIM"], "双 SIM": ["Doppia SIM", "Dual SIM", "双 SIM"], "仅 eSIM": ["Solo eSIM", "eSIM only", "仅 eSIM"], "SIM + eSIM": ["SIM + eSIM", "SIM + eSIM", "SIM + eSIM"],
  "标准版": ["Edizione standard", "Standard edition", "标准版"], "特别版": ["Edizione speciale", "Special edition", "特别版"],
  "意大利语 IT": ["Italiano IT", "Italian IT", "意大利语 IT"], "待评估": ["Da valutare", "To be assessed", "待评估"], "集成显卡": ["Grafica integrata", "Integrated graphics", "集成显卡"],
};
for (const value of ["S", "A", "B", "C", "IT", "US", "UK", "FR", "DE", "ES", "PT", "CH", "JP", "Nordic", "Wi-Fi", "Wi-Fi + Cellular", "Wi-Fi + 4G", "Wi-Fi + 5G", "OLED", "LCD", "Lite", "Slim", "Pro"]) known[value] = [value, value, value];
export function printKnown(value: string, language: PrintLanguage): string | undefined { return known[value]?.[languageIndex[language]]; }
export function printOriginal(value: string, language: PrintLanguage, customer = false): string {
  return `${value} (${printLabel(customer ? "originalText" : "recordedText", language)})`;
}
export function printKnownOrOriginal(value: string, language: PrintLanguage, customer = false): string {
  return !value ? printLabel("unrecorded", language) : printKnown(value, language) ?? printOriginal(value, language, customer);
}
const faultDetails: Record<string, readonly string[]> = {
  "屏幕": ["碎裂", "不显示", "触摸失灵", "显示异常"], "电池": ["续航差", "不充电", "鼓包", "自动关机"], "尾插": ["接口松动", "无法充电", "无法传输数据"],
  "摄像头": ["无法拍摄", "模糊", "镜片破损"], "进水": ["接触液体", "无法开机", "需检查腐蚀"], "主板": ["无法开机", "重启", "发热", "无信号"],
  "系统": ["卡顿", "无法启动", "软件异常"], "后盖": ["破损", "开胶", "变形"], "面容/指纹": ["无法识别", "无法录入"],
  "扬声器": ["无声音", "杂音", "声音小"], "麦克风": ["无声音", "声音小", "通话异常"], "按键": ["电源键", "音量键", "键盘", "摇杆"],
};
export function printFault(value: string, language: PrintLanguage): string | undefined {
  const [group, ...details] = value.split(/[：:]/);
  if (Object.hasOwn(faultDetails, group) && !details.length) return printKnown(group, language);
  if (Object.hasOwn(faultDetails, group) && details.length === 1 && faultDetails[group].includes(details[0])) return `${printKnown(group, language)}: ${printKnown(details[0], language)}`;
  return undefined;
}
export function printIssue(data: { issue: string; faults?: string[]; issueNote?: string }, language: PrintLanguage): { faults: string[]; note: string } {
  const structured = data.faults ?? [];
  if (data.faults !== undefined || data.issueNote !== undefined) {
    const legacyNote = data.issueNote === undefined ? printIssue({ issue: data.issue }, language).note : data.issueNote;
    return { faults: structured.map(value => printFault(value, language)).filter((value): value is string => Boolean(value)), note: [...structured.filter(value => !printFault(value, language)), legacyNote].filter(Boolean).join("；") };
  }
  const faults: string[] = [], original: string[] = [];
  for (const section of data.issue.split(/[；;]/)) {
    const parts = section.split(/[、，]/);
    const translated = parts.map(value => printFault(value.trim(), language));
    if (!translated.some(Boolean)) { original.push(section); continue; }
    faults.push(...translated.filter((value): value is string => Boolean(value)));
    if (translated.some(value => !value)) original.push(parts.filter((_, index) => !translated[index]).join("、"));
  }
  return { faults, note: original.filter(Boolean).join("；") };
}
export function printServiceRequests(services: IntakeServices, language: PrintLanguage): string[] {
  const quality = { original: ["Originale", "Original", "原装"], assembled: ["Compatibile", "Aftermarket", "组装"] } as const;
  const apple = { capacity: ["Capacità aumentata", "Capacity upgrade", "扩容"], diagnostics: ["Diagnostica richiesta", "Diagnostics requested", "跑诊断"], both: ["Capacità aumentata e diagnostica richiesta", "Capacity upgrade and diagnostics requested", "扩容跑诊断"] } as const;
  const result: string[] = [];
  if (services.screen.quality) result.push([printKnown("屏幕", language), quality[services.screen.quality][languageIndex[language]], services.screen.quality === "assembled" && services.screen.technology ? (services.screen.technology === "incell" ? "Incell" : services.screen.technology.toUpperCase()) : ""].filter(Boolean).join(" · "));
  if (services.battery.quality) result.push(`${printKnown("电池", language)} · ${quality[services.battery.quality][languageIndex[language]]}`);
  if (services.battery.appleService) result.push(`Apple · ${printKnown("电池", language)} · ${apple[services.battery.appleService][languageIndex[language]]}`);
  if (services.port.quality) result.push(`${printKnown("尾插", language)} · ${quality[services.port.quality][languageIndex[language]]}`);
  return result;
}
const stages: Record<string, Translation> = {
  awaiting_reply: ["In attesa di risposta", "Awaiting customer reply", "久等 未答复"],
  collected_unpaid: ["Ritirato, saldo da pagare", "Collected, balance outstanding", "欠款 已拿走"],
  outsourced: ["Inviato in assistenza esterna", "Sent for external repair", "寄修"],
  ready_notified: ["Riparato, cliente avvisato", "Repaired, customer notified", "修好已通知"],
  diagnosis: ["Da diagnosticare", "Awaiting diagnosis", "待检测"], awaiting_quote: ["In attesa di conferma", "Awaiting confirmation", "待确认"],
  awaiting_parts: ["In attesa dei ricambi", "Awaiting parts", "待配件"], repairing: ["In riparazione", "Under repair", "维修中"],
  testing: ["Da testare", "Awaiting testing", "待测试"], ready: ["Pronto per il ritiro", "Ready for collection", "待取机"],
  completed: ["Riparazione conclusa", "Repair finished", "维修结束"], cancelled: ["Annullato", "Cancelled", "作废"],
};
const custodies: Record<string, Translation> = { unknown: ["Custodia da verificare", "Custody to be checked", "保管待核对"], store: ["Dispositivo in negozio", "Device left at shop", "设备已留下"], customer: ["Dispositivo presso il cliente", "Device not left at shop", "设备未留下"] };
export function printRepairStage(value: string, language: PrintLanguage): string { return stages[value]?.[languageIndex[language]] ?? printLabel("pending", language); }
export function printCustody(value: string, language: PrintLanguage): string { return custodies[value]?.[languageIndex[language]] ?? printLabel("pending", language); }
export function printAccessories(values: readonly string[], language: PrintLanguage, customer = true): string {
  return values.map(value => printKnownOrOriginal(value, language, customer)).join(", ") || "—";
}
export function printRetailAccessories(value: string, language: PrintLanguage): string {
  return value ? printAccessories(value.split(/[；;、]/).map(item => item.trim()).filter(Boolean), language, false) : printLabel("unrecorded", language);
}
// Build from the original structured product snapshot; no substring translation of customer-entered specs.
export function printRetailSpecs(unit: Pick<RetailUnit, "ramGb" | "bodyStorage" | "disks" | "cpu" | "gpu" | "keyboard" | "edition" | "controllers">, language: PrintLanguage): string {
  const numeric = (value: number) => new Intl.NumberFormat(locales[language]).format(value);
  const capacity = (value: { capacity: number | null; unit: string }) => `${value.capacity === null ? printLabel("pending", language) : numeric(value.capacity)} ${value.unit}`;
  return [unit.ramGb === null ? "" : `${numeric(unit.ramGb)} GB RAM`, unit.bodyStorage ? `${printLabel("bodyStorage", language)}: ${capacity(unit.bodyStorage)}` : "", ...unit.disks.map(disk => `${disk.type}: ${capacity(disk)}`), unit.cpu ? `CPU: ${printKnown(unit.cpu, language) ?? printOriginal(unit.cpu, language)}` : "", unit.gpu ? `GPU: ${printKnown(unit.gpu, language) ?? printOriginal(unit.gpu, language)}` : "", unit.keyboard ? `${printLabel("keyboard", language)}: ${printKnownOrOriginal(unit.keyboard, language)}` : "", unit.edition ? printKnown(unit.edition, language) ?? printOriginal(unit.edition, language) : "", unit.controllers === null ? "" : `${printLabel("controllers", language)}: ${numeric(unit.controllers)}`].filter(Boolean).join(" · ") || printLabel("pending", language);
}
export const formatIntakeIssue = printIssue;
export const printIntakeServiceLabels = printServiceRequests;
export const translatePrintValue = (value: string, language: PrintLanguage) => printKnownOrOriginal(value, language, true);
