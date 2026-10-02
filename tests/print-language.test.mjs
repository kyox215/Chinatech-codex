import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

async function module(name) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true });
  assert.deepEqual(result.diagnostics, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}
const { printLabel, printMoney, printDate, printMonths, printKnownOrOriginal, printFault, printIssue, printServiceRequests, printCustody, printRepairStage, printAccessories, printRetailAccessories, printRetailSpecs, printLanguageName, formatIntakeIssue, translatePrintValue, printIntakeServiceLabels } = await module("print-language");
const { repairIntakeTermsVersion, repairIntakeTerms, repairIntakeStatutoryRights, repairIntakeAcknowledgement } = await module("repair-print-terms");
const { retailWarrantyTerms, retailStatutoryRights } = await module("retail-warranty-terms");
const latinLanguages = ["it", "en"];
const noChinese = value => assert.doesNotMatch(value, /[\u3400-\u9fff]/);

test("全部可选故障及细项的系统内容提供意英中三语", () => {
  const groups = {
    屏幕: ["碎裂", "不显示", "触摸失灵", "显示异常"], 电池: ["续航差", "不充电", "鼓包", "自动关机"], 尾插: ["接口松动", "无法充电", "无法传输数据"],
    摄像头: ["无法拍摄", "模糊", "镜片破损"], 进水: ["接触液体", "无法开机", "需检查腐蚀"], 主板: ["无法开机", "重启", "发热", "无信号"],
    系统: ["卡顿", "无法启动", "软件异常"], 后盖: ["破损", "开胶", "变形"], "面容/指纹": ["无法识别", "无法录入"],
    扬声器: ["无声音", "杂音", "声音小"], 麦克风: ["无声音", "声音小", "通话异常"], 按键: ["电源键", "音量键", "键盘", "摇杆"],
  };
  for (const [group, details] of Object.entries(groups)) for (const value of [group, ...details.map(detail => `${group}：${detail}`)]) {
    for (const language of latinLanguages) { assert.ok(printFault(value, language)); noChinese(printFault(value, language)); }
    assert.equal(printFault(value, "zh"), value.replace("：", ": "));
  }
  assert.equal(printFault("屏幕：蓝色", "en"), undefined);
  assert.equal(printFault("屏幕：DEMO 自定义现象", "it"), undefined);
});

test("新接机结构化故障与客户补充分别呈现，品牌型号人名不进入翻译", () => {
  const data = { issue: "旧组合不作为新资料", faults: ["屏幕：触摸失灵", "主板：重启"], issueNote: "DEMO 客户补充：重启后正常" };
  const result = printIssue(data, "en");
  assert.deepEqual(result.faults, ["Screen: Touch not working", "Mainboard: Restarting"]);
  assert.equal(result.note, data.issueNote);
  assert.equal(printKnownOrOriginal("DEMO 雾蓝", "en", true), "DEMO 雾蓝 (Customer's original text)");
  assert.deepEqual(formatIntakeIssue(data, "en"), result);
  assert.equal(translatePrintValue("SIM 卡托", "en"), "SIM tray");
});

test("旧组合故障识别完整已知标签，保留自由说明与未完整分离的新记录补充", () => {
  assert.deepEqual(printIssue({ issue: "屏幕：碎裂、电池：鼓包；DEMO 补充：摔过" }, "en"), { faults: ["Screen: Cracked", "Battery: Swollen battery"], note: "DEMO 补充：摔过" });
  assert.deepEqual(printIssue({ issue: "屏幕：碎裂、DEMO 自填" }, "en"), { faults: ["Screen: Cracked"], note: "DEMO 自填" });
  assert.deepEqual(printIssue({ issue: "无法充电，DEMO 描述重启。" }, "it"), { faults: [], note: "无法充电，DEMO 描述重启。" });
  assert.equal(printIssue({ issue: "屏幕：碎裂；DEMO 未拆补充", faults: ["屏幕：碎裂"] }, "en").note, "DEMO 未拆补充");
});

test("配件原装组装屏幕技术和Apple服务全部使用所选语言且不变成检测结论", () => {
  for (const language of latinLanguages) for (const quality of ["original", "assembled"]) for (const technology of ["incell", "tft", "oled"]) for (const appleService of ["capacity", "diagnostics", "both"]) {
    const services = { screen: { quality, technology }, battery: { quality, appleService }, port: { quality } };
    const result = printServiceRequests(services, language);
    assert.equal(result.length, 4); result.forEach(noChinese);
    assert.deepEqual(printIntakeServiceLabels(services, language), result);
    if (quality === "original") assert.doesNotMatch(result[0], /Incell|TFT|OLED/);
    if (quality === "assembled") assert.match(result[0], new RegExp(technology === "incell" ? "Incell" : technology.toUpperCase()));
    if (appleService.includes("diagnostics") || appleService === "both") assert.match(result[2], language === "en" ? /requested/ : /richiesta/);
  }
});

test("所有颜色、优先级、随件、维修阶段和保管的已知值保持同一语言", () => {
  const values = ["黑色", "白色", "银色", "灰色", "午夜色", "钛灰", "蓝色", "深蓝色", "绿色", "紫色", "粉色", "红色", "金色", "原色钛金属", "黑色钛金属", "白色钛金属", "蓝色钛金属", "普通", "优先", "紧急", "SIM 卡", "SIM 卡托", "手机壳", "保护膜", "充电器", "数据线", "包装盒", "其他"];
  for (const language of latinLanguages) {
    for (const value of values) noChinese(printKnownOrOriginal(value, language));
    for (const stage of ["diagnosis", "awaiting_quote", "awaiting_parts", "repairing", "testing", "ready", "completed", "cancelled", "awaiting_reply", "outsourced", "collected_unpaid", "ready_notified"]) noChinese(printRepairStage(stage, language));
    for (const custody of ["unknown", "store", "customer"]) noChinese(printCustody(custody, language));
    noChinese(printAccessories(["SIM 卡", "充电器"], language));
  }
  assert.match(printAccessories(["DEMO 随件"], "en"), /DEMO 随件.*Customer's original text/);
  assert.equal(printLanguageName("zh", "en"), "Chinese");
});

test("金额按欧分及语言格式化，未知不变为0；本地日期保持原日时并拒绝无效日期", () => {
  assert.match(printMoney(1234567, "it"), /12\.345,67/);
  assert.match(printMoney(1234567, "en"), /12,345\.67/);
  assert.match(printMoney(0, "en"), /0\.00/);
  assert.equal(printMoney(null, "en"), "To be confirmed");
  assert.equal(printMoney(undefined, "it"), "Da confermare");
  assert.equal(printDate("2026-10-02 09:16:00", "en"), "2 Oct 2026, 09:16");
  assert.equal(printDate("2026-10-02", "en"), "2 Oct 2026");
  assert.equal(printDate("2026-02-30", "en"), "2026-02-30");
  assert.equal(printDate("DEMO 日期未知", "en"), "DEMO 日期未知");
  assert.equal(printMonths(6, "en"), "6 months");
  assert.equal(printMonths(18, "it", true), "18 mesi dalla consegna effettiva");
});

test("整机规格从结构化快照生成，多盘未知容量和实测0保持不同，未知自由文字不冒充翻译", () => {
  const product = { ramGb: 16, bodyStorage: null, disks: [{ type: "SSD", capacity: null, unit: "TB" }, { type: "HDD", capacity: 2, unit: "TB" }], cpu: "DEMO CPU", gpu: "集成显卡", keyboard: "IT", edition: "数字版", controllers: 0 };
  const result = printRetailSpecs(product, "en");
  noChinese(result);
  assert.match(result, /16 GB RAM/); assert.match(result, /SSD: To be confirmed TB/); assert.match(result, /HDD: 2 TB/); assert.match(result, /Included controllers: 0/); assert.match(result, /Digital edition/);
  assert.match(printRetailSpecs({ ...product, cpu: "DEMO 自填 CPU" }, "en"), /DEMO 自填 CPU \(Original recorded text\)/);
  const mobile = printRetailSpecs({ ...product, cpu: "", gpu: "", keyboard: "", edition: "欧版", controllers: null, disks: [], bodyStorage: { capacity: 256, unit: "GB" } }, "it");
  noChinese(mobile); assert.match(mobile, /Memoria interna: 256 GB/);
  assert.equal(printRetailAccessories("电源线；不含手柄", "en"), "Power cable, No controller included");
  assert.equal(printRetailAccessories("DEMO 自填随件", "it"), "DEMO 自填随件 (Testo originale registrato)");
});

test("维修条款及接机确认具有固定版本和三语文案，确认范围排除付款检测报价及法定权利放弃", () => {
  assert.equal(repairIntakeTermsVersion, "repair-intake-2026-10-v1");
  for (const language of ["it", "en", "zh"]) {
    assert.equal(repairIntakeTerms[language].length, 5);
    assert.ok(repairIntakeStatutoryRights[language]); assert.ok(repairIntakeAcknowledgement[language]);
    if (language !== "zh") { repairIntakeTerms[language].forEach(noChinese); noChinese(repairIntakeAcknowledgement[language]); }
  }
  assert.match(repairIntakeAcknowledgement.en, /does not confirm payment, diagnosis, testing or acceptance of a quote/);
  assert.match(repairIntakeAcknowledgement.en, /does not waive statutory rights/);
  assert.match(repairIntakeTerms.en[0], /actually returned/);
});

test("整机原有条款保留三语并且旧销售未知承诺、双联标题和纸张系统文案可翻译", () => {
  for (const language of ["it", "en", "zh"]) {
    for (const term of retailWarrantyTerms) assert.ok(term[language]);
    assert.ok(retailStatutoryRights[language]);
    for (const key of ["warrantyUnknown", "guarantorUnknown", "historicalTerms", "historicalRights", "productMissing", "a4", "a5", "half", "double", "customerCopy", "shopCopy"]) {
      assert.ok(printLabel(key, language)); if (language !== "zh") noChinese(printLabel(key, language));
    }
  }
});

test("新增维修分组状态的三语打印保留具体含义", () => {
  for (const stage of ["awaiting_reply", "outsourced", "collected_unpaid", "ready_notified"]) for (const language of ["it", "en", "zh"]) {
    assert.notEqual(printRepairStage(stage,language),printLabel("pending",language));
  }
  assert.match(printRepairStage("collected_unpaid","en"),/balance outstanding/);
  assert.equal(printRepairStage("ready_notified","zh"),"修好已通知");
});
