import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HAN = /[\u3400-\u9fff]/u;
const dictionaryFiles = ["lib/i18n/structured.json", "lib/i18n/errors.ts", "lib/i18n/interface.ts", "lib/i18n/public.ts"];
const dictionaryNames = new Set(["interfaceMessages", "errorMessages", "publicMessages"]);
const normal = text => text.trim().replace(/\s+/gu, " ");
const variables = text => [...text.matchAll(/\{(\w+)\}/gu)].map(match => match[1]).sort();
const numbers = text => text.replace(/\{\w+\}/gu, "").match(/\d+(?:[.,]\d+)?/gu) ?? [];
const shape = text => normal(text).replace(/\{\w+\}/gu, "{}");

// Each exclusion names a source of original facts or a separately validated language
// system. It is not a blanket exception for Chinese, for a directory, or for labels.
export const sourceExceptions = new Map([
  ["lib/repair-fixtures.ts", "Fictional repair records: customer names, reported issues and historical facts stay original."],
  ["lib/procurement-fixtures.ts", "Fictional supplier/part records and existing event facts stay original."],
  ["lib/retail-fixtures.ts", "Fictional unit identities, notes and stored event facts stay original."],
  ["lib/repair-print-terms.ts", "Versioned signed policy text has its own explicit three-language registry; tests/print-language.test.mjs validates it."],
  ["lib/retail-warranty-terms.ts", "Versioned sale policy text is frozen; tests/print-language.test.mjs validates its independent language registry."],
  ["lib/print-language.ts", "Independent signing/printing language, structured values and original-text parser; tests/print-language.test.mjs owns coverage."],
  ["lib/tutorials.ts", "Explicit locale-specific tutorial records; tests/i18n.test.mjs validates all 15 media records and captions."],
]);

// Exact source text exceptions are intentionally reviewable. Runtime customer data
// is never scraped, sent for translation or rewritten by this tool.
export const literalExceptions = [
  { file: "components/language-switcher.tsx", text: "语言 / Lingua / Language", reason: "The language picker identifies itself in all three supported languages." },
  { file: "components/dashboard/dashboard-content.tsx", owner: "repairs", text: "周先生", reason: "Fictional customer name; preserve original." },
  { file: "components/dashboard/dashboard-content.tsx", owner: "repairs", text: "林女士", reason: "Fictional customer name; preserve original." },
  ...["无法充电，偶发重启", "电池健康异常", "左侧摇杆漂移", "屏幕破裂"].map(text => ({ file: "components/dashboard/dashboard-content.tsx", owner: "repairs", text, reason: "Fictional customer's original reported issue." })),
  ...["iPhone 15 Pro", "MacBook Air M2", "Nintendo Switch OLED", "Samsung S24 Ultra", "Elena R.", "Marco B.", "CT-2026-0929", "CT-2026-0927", "CT-2026-0924", "CT-2026-0921"].map(text => ({ file: "components/dashboard/dashboard-content.tsx", owner: "repairs", text, reason: "Fictional device model, customer identity or order identifier; preserve the original fact." })),
  ...["周先生", "林女士"].map(text => ({ file: "lib/repair-intake.ts", owner: "intakeCustomers", text, reason: "Fictional customer name; preserve original." })),
  { file: "lib/staff.ts", text: "塔赫桑", reason: "Preview member's personal name, not a translated role." },
  { file: "lib/intake-services.ts", text: "苹果", reason: "Brand matching alias; never replace the business input." },
  ...["GTX 1050", "GTX 1050 Ti", "GTX 1060", "GTX 1070", "GTX 1080", "GTX 1650", "GTX 1650 Ti", "GTX 1660 Ti", "RTX 2060", "RTX 2070", "RTX 2070 SUPER", "RTX 2080", "RTX 2080 SUPER"].map(model => ({ file: "lib/retail-catalog.ts", owner: "gpuEntries", text: `${model}（移动版）`, reason: "Existing canonical catalog model; preserve model identity, including the explicit mobile suffix." })),
  { file: "lib/retail-catalog.ts", owner: "brandPresets", text: "自组电脑", reason: "Existing canonical brand identity for custom-built computers; stored brand remains original." },
  ...["Intel Core processor comparison", "Intel Core i5 mobile comparison", "Intel Core Ultra desktop and mobile datasheets", "Intel product specifications", "AMD desktop, laptop and workstation processor specifications", "AMD Athlon desktop processors", "AMD processor and graphics specification directory", "AMD desktop and mobile graphics support families", "NVIDIA current and previous GeForce desktop cards", "NVIDIA GeForce laptop GPUs", "Intel processor graphics reference", "Intel Arc dedicated graphics family", "Apple MacBook Pro model and technical specification archive", "Apple MacBook Pro technical specifications", "Apple Mac Studio technical specifications", "Apple Mac Studio model and specification archive", "PlayStation hardware history", "PlayStation console manuals", "Xbox Series X and Series S comparison", "Xbox original, Xbox 360 and Xbox One generations", "Nintendo Switch family", "Nintendo Switch 2 specifications", "Nintendo hardware history", "Valve Steam Deck models", "ASUS ROG Ally specifications", "ASUS ROG Ally X specifications", "Lenovo Legion Go 8APU1 PSREF"].map(text => ({ file: "lib/retail-catalog.ts", owner: "catalogSources", text, reason: "Original source-reference title in the offline hardware provenance registry, not an interface instruction." })),
  ...["IT", "US", "UK", "FR", "DE", "ES", "PT", "CH", "JP", "Nordic"].map(text => ({ file: "lib/retail-catalog.ts", owner: "keyboardOptions", text, reason: "Canonical keyboard layout designation. The accompanying descriptive detail is translated separately." })),
  ...["Incell", "TFT", "OLED"].map(text => ({ file: "components/repairs/intake-fault-picker.tsx", text, reason: "Display-panel technology names shared by all supported languages." })),
  { file: "lib/retail-history-import.ts", text: "IMEI/序列号", reason: "Exact legacy import column header; changing it would change input parsing, not display language." },
  ...["中文", "客户", "设备", "商家保修", "个月", "条款与接机资料", "已核对接机资料并阅读所显示条款。"].map(text => ({ file: "components/repairs/intake-signature.tsx", text, reason: "Explicit Chinese branch of the customer's independent signing language, not the operator language." })),
  { file: "components/photo-capture.tsx", text: "接机-{v0}-{v1}.jpg", reason: "Generated attachment filename; not a visible interface message or a business-value translation." },
  { file: "components/dashboard/dashboard-content.tsx", text: "08:52 · MobileParts SRL", reason: "Fictional time and supplier identity, not a system status." },
  ...["components/repairs/repair-detail.tsx", "components/retail/retail-detail-view.tsx"].map(file => ({ file, text: "v", reason: "Version-number prefix shared by the three languages." })),
  ...["Italiano", "English", "Cliente", "Customer", "Dispositivo", "Device", "Garanzia commerciale", "Commercial warranty", "mesi", "months", "Condizioni e dati da verificare", "Terms and intake details", "Email", "Ho verificato i dati di accettazione e letto le condizioni mostrate.", "I have checked the intake details and read the displayed terms."].map(text => ({ file: "components/repairs/intake-signature.tsx", text, reason: "Explicit Italian/English branch of the customer's independent signing language; must not follow operator locale." })),
  ...[
    ["app/api/auth/account/email/route.ts", "Unexpected account update identity."],
    ["app/api/auth/account/phone/route.ts", "Unexpected account update identity."],
    ["app/api/auth/account/link/route.ts", "Missing provider URL."],
    ["lib/server/account-auth.ts", "Account intent signing is not configured."],
    ["lib/server/account-oauth.ts", "Invalid authorization URL."],
    ["lib/server/account-oauth.ts", "Invalid identity provider URL."],
    ["lib/server/auth-flows.ts", "Recovery signing is not configured."],
  ].map(([file, text]) => ({ file, text, reason: "Internal Error is replaced by authFailure's reviewed public fallback, not returned to the user." })),
  { file: "lib/backend/commands.ts", text: "IDENTITY_CHANGED", reason: "Canonical identity-change sentinel; caller selects the localized public error." },
  { file: "lib/backend/events.ts", text: "Invalid token", reason: "Internal token parsing failure; catch replaces it with the reviewed session-expired error." },
  { file: "lib/backend/intake-photos.ts", text: "Invalid dimensions", reason: "Internal decoder failure; the catch replaces it with a reviewed public error." },
];

// Exact shared technical symbols and sample addresses, not a rule allowing English
// prose or arbitrary uppercase text. Adding a new item requires semantic review.
export const invariantLabels = new Set(["ChinaTech", "CT", "SN", "SN：", "SN / IMEI", "SN / IMEI：", "IMEI", "IMEI 1", "IMEI 2", "IMEI 1：", "IMEI 2：", "CPU", "GPU", "RAM（GB）", "GB", "TB", "SSD", "HDD", "NVMe SSD", "name@example.com", "customer@example.com", "sales@demo.chinatech.local"]);

const translatedCalls = new Set(["t", "translate", "systemText", "translateSystemMessage", "printText", "printStructured", "printIssue", "printKnownOrOriginal", "repairDisplayIssue", "repairDisplayMessage"]);
// These local helpers translate only the named argument; other arguments are facts.
const translatedHelperArguments = new Map([
  ["components/repairs/intake-review.tsx:edit", new Set([1])],
  ["components/retail/retail-history-detail.tsx:fact", new Set([0])],
]);
const visibleProps = new Set(["title", "label", "text", "tooltip", "placeholder", "alt", "aria-label", "aria-description", "aria-placeholder", "aria-valuetext", "description", "hint", "message", "emptyText", "clearLabel", "backLabel", "caption", "heading"]);
const translatedComponentProps = new Map([
  ["SingleChoice", new Set(["label", "options"])], ["MultiChoice", new Set(["label", "options"])],
  ["SearchCombobox", new Set(["placeholder", "emptyText"])],
]);

function location(source, node) {
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { file: source.fileName, line: line + 1, column: character + 1 };
}

export function parseDictionary(file, text) {
  const json = file.endsWith(".json");
  const source = ts.createSourceFile(file, json ? `(${text})` : text, ts.ScriptTarget.Latest, true);
  const entries = [];
  const issues = [];
  function readObject(object) {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name)) continue;
      const key = property.name.text;
      const values = ts.isArrayLiteralExpression(property.initializer) ? property.initializer.elements : [];
      if (values.length !== 2 || values.some(value => !ts.isStringLiteralLike(value))) {
        issues.push({ ...location(source, property), kind: "dictionary-shape", text: key, detail: "Expected exactly [Italian, English] string literals." });
        continue;
      }
      entries.push({ ...location(source, property), key, translations: values.map(value => value.text) });
    }
  }
  function visit(node) {
    if (json && ts.isObjectLiteralExpression(node)) { readObject(node); return; }
    if (ts.isVariableDeclaration(node) && dictionaryNames.has(node.name.getText(source)) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) { readObject(node.initializer); return; }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { entries, issues };
}

export function validateDictionaries(entries) {
  const issues = [];
  const seen = new Map();
  const normalizedKeys = new Map();
  for (const entry of entries) {
    const prior = seen.get(entry.key);
    if (prior && JSON.stringify(prior.translations) !== JSON.stringify(entry.translations)) issues.push({ ...entry, kind: "conflicting-key", text: entry.key, detail: `${prior.file}:${prior.line} has different translations.` });
    seen.set(entry.key, entry);
    const normalizedPrior = normalizedKeys.get(normal(entry.key));
    if (normalizedPrior && normalizedPrior.key !== entry.key && JSON.stringify(normalizedPrior.translations.map(normal)) !== JSON.stringify(entry.translations.map(normal))) issues.push({ ...entry, kind: "conflicting-normalized-key", text: entry.key, detail: `${normalizedPrior.file}:${normalizedPrior.line} differs after the translator's whitespace normalization.` });
    normalizedKeys.set(normal(entry.key), entry);
    for (const [index, translated] of entry.translations.entries()) {
      const language = index ? "en" : "it";
      const fail = (kind, detail) => issues.push({ ...entry, kind, text: entry.key, detail: `${language}: ${detail}` });
      if (!translated.trim()) fail("empty-translation", "Translation is empty.");
      if (HAN.test(translated)) fail("untranslated-language", "Foreign-language translation contains Han text.");
      if (JSON.stringify(variables(entry.key)) !== JSON.stringify(variables(translated))) fail("message-variables", "Placeholder names or multiplicities differ.");
      if (JSON.stringify(numbers(entry.key)) !== JSON.stringify(numbers(translated))) fail("message-numbers", "Numeric limits or facts differ.");
    }
  }
  return { issues, messages: new Map([...seen].map(([key, entry]) => [key, entry.translations])) };
}

function ownerOf(node) {
  for (let current = node; current; current = current.parent) if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
  return "";
}

function isTypeOrKey(node) {
  const parent = node.parent;
  return ts.isLiteralTypeNode(parent) || (ts.isPropertyAssignment(parent) && parent.name === node)
    || (ts.isPropertySignature(parent) && parent.name === node) || ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)
    || ts.isElementAccessExpression(parent) && parent.argumentExpression === node;
}

function isCanonicalComparison(node) {
  const parent = node.parent;
  if (ts.isArrayLiteralExpression(parent) && ts.isPropertyAccessExpression(parent.parent) && parent.parent.name.text === "includes") return true;
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === "includes" && parent.arguments.includes(node)) return true;
  return ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(parent.operatorToken.kind)
    || ts.isCaseClause(parent) && parent.expression === node;
}

function callName(node) { return ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ""; }
function inTranslation(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isCallExpression(current) && translatedCalls.has(callName(current))) return Boolean(current.arguments[0] && current.arguments[0].pos <= node.pos && current.arguments[0].end >= node.end);
    if (ts.isCallExpression(current)) {
      const indices = translatedHelperArguments.get(`${node.getSourceFile().fileName}:${callName(current)}`);
      if (indices && current.arguments.some((argument, index) => indices.has(index) && argument.pos <= node.pos && argument.end >= node.end)) return true;
    }
    if (ts.isJsxElement(current) || ts.isJsxAttribute(current) || ts.isStatement(current)) return false;
  }
  return false;
}

// Resolve bounded local constants and map callback fields, not arbitrary data flow.
// All returned leaves are the original AST nodes; unknown runtime values stay unknown.
function finiteSources(source) {
  const declarations = new Map();
  function scope(node) {
    for (let parent = node.parent; parent; parent = parent.parent) if (ts.isBlock(parent) || ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return parent;
    return source;
  }
  function index(node) {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name)) {
      const values = declarations.get(node.name.text) ?? [];
      values.push({ node, scope: scope(node) }); declarations.set(node.name.text, values);
    }
    ts.forEachChild(node, index);
  }
  index(source);
  function properties(node, name) {
    if (ts.isObjectLiteralExpression(node)) return node.properties.filter(ts.isPropertyAssignment).filter(item => name === undefined || item.name.getText(source).replace(/^["']|["']$/gu, "") === name).map(item => item.initializer);
    if (ts.isArrayLiteralExpression(node)) return name === undefined ? [...node.elements] : node.elements[Number(name)] ? [node.elements[Number(name)]] : [];
    return [];
  }
  function possibilities(node, visited = new Set()) {
    if (!node || visited.has(node) || visited.size > 40) return [];
    const next = new Set(visited).add(node);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return possibilities(node.expression, next);
    if (ts.isConditionalExpression(node)) return [...possibilities(node.whenTrue, next), ...possibilities(node.whenFalse, next)];
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return [...possibilities(node.left, next), ...possibilities(node.right, next)];
    if (ts.isIdentifier(node)) {
      const entry = (declarations.get(node.text) ?? []).filter(item => item.scope.pos <= node.pos && item.scope.end >= node.end).sort((a, b) => a.scope.end - a.scope.pos - (b.scope.end - b.scope.pos))[0];
      if (!entry) return [];
      const declaration = entry.node;
      if (ts.isVariableDeclaration(declaration)) return possibilities(declaration.initializer, next);
      const parameter = ts.isParameter(declaration) ? declaration : declaration.parent.parent;
      const callback = parameter.parent;
      const call = callback.parent;
      if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || !["map", "flatMap", "filter", "find", "some"].includes(call.expression.name.text)) return [];
      const rows = possibilities(call.expression.expression, next).flatMap(item => ts.isArrayLiteralExpression(item) ? [...item.elements] : [item]);
      if (ts.isParameter(declaration)) return rows.flatMap(item => possibilities(item, next));
      const name = ts.isObjectBindingPattern(declaration.parent) ? declaration.propertyName?.getText(source) ?? declaration.name.getText(source) : String(declaration.parent.elements.indexOf(declaration));
      return rows.flatMap(item => properties(item, name)).flatMap(item => possibilities(item, next));
    }
    if (ts.isPropertyAccessExpression(node)) return possibilities(node.expression, next).flatMap(item => properties(item, node.name.text)).flatMap(item => possibilities(item, next));
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression && (ts.isStringLiteralLike(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)) ? node.argumentExpression.text : undefined;
      return possibilities(node.expression, next).flatMap(item => properties(item, key)).flatMap(item => possibilities(item, next));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === "Object") {
      const method = node.expression.name.text;
      const objects = possibilities(node.arguments[0], next).filter(ts.isObjectLiteralExpression);
      if (method === "values") return objects.flatMap(item => properties(item)).flatMap(item => possibilities(item, next));
      if (method === "keys") return objects.flatMap(item => item.properties.filter(ts.isPropertyAssignment).map(property => property.name));
      if (method === "entries") return objects.flatMap(item => item.properties.filter(ts.isPropertyAssignment).map(property => ts.factory.createArrayLiteralExpression([property.name, property.initializer])));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["map", "flatMap"].includes(node.expression.name.text)) {
      const callback = node.arguments[0];
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        if (!ts.isBlock(callback.body)) return possibilities(callback.body, next);
        return callback.body.statements.filter(ts.isReturnStatement).flatMap(statement => possibilities(statement.expression, next));
      }
    }
    return ts.isStringLiteralLike(node) || ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node) ? [node] : [];
  }
  return possibilities;
}

function visibleUse(node) {
  if (ts.isJsxText(node)) return ["style", "script"].includes(node.parent.openingElement?.tagName.getText()) ? null : { kind: "jsx-text" };
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isConditionalExpression(parent) && parent.condition === current) return null;
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.left === current) return null;
    if (ts.isCallExpression(parent)) return null; // Arguments are inputs, not the call's displayed return value.
    // A collection's input values are not rendered by .map itself. Its callback
    // output is checked separately, including plain `items.map(item => item)`.
    if (ts.isPropertyAccessExpression(parent) && parent.expression === current && ["map", "flatMap", "filter", "find", "some"].includes(parent.name.text)) return null;
    if (ts.isJsxAttribute(parent)) {
      const name = parent.name.getText();
      const component = parent.parent.parent.tagName.getText();
      if (translatedComponentProps.get(component)?.has(name)) return null;
      return visibleProps.has(name) || /(?:Label|Title|Text|Message|Hint)$/u.test(name) ? { kind: "jsx-attribute", attribute: name } : null;
    }
    if (ts.isJsxExpression(parent) && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) return ["style", "script"].includes(parent.parent.openingElement?.tagName.getText()) ? null : { kind: "jsx-expression" };
    if (ts.isFunctionLike(parent) || ts.isStatement(parent) || ts.isJsxElement(parent)) return null;
    current = parent;
  }
  return null;
}

function messageCategory(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isNewExpression(current) && /Error$/u.test(current.expression.getText())) return "system-error";
    if (ts.isPropertyAssignment(current) && /^(?:error|message)$/u.test(current.name.getText())) return "system-feedback";
    if (ts.isCallExpression(current) && /^(?:setError|setMessage|fail|errorResponse)$/u.test(callName(current))) return "system-feedback";
    if (ts.isStatement(current)) break;
  }
  return "enumerable-source";
}

function templateText(node) {
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span, index) => `{v${index}}${span.literal.text}`).join("");
  return null;
}

export function scanSource(file, text, messages, { exceptions = literalExceptions } = {}) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const issues = [];
  const dynamicBoundaries = [];
  const finite = finiteSources(source);
  const counts = { literals: 0, translatedCalls: 0, visibleLiterals: 0, templates: 0, canonicalComparisons: 0, originalExceptions: 0 };
  const shapes = new Set([...messages.keys()].map(shape));
  const has = value => messages.has(value) || messages.has(normal(value));
  const independentPrintLabels = /const t = \(key: PrintLabel\) => printLabel\(key, language\)/u.test(text);
  function check(node, value, template = false) {
    if (isTypeOrKey(node)) return;
    const translated = inTranslation(node);
    const visible = visibleUse(node);
    const category = messageCategory(node);
    const displayConfig = ts.isPropertyAssignment(node.parent) && visibleProps.has(node.parent.name.getText(source).replace(/^["']|["']$/gu, ""));
    if (!HAN.test(value) && !((translated || visible || displayConfig || category !== "enumerable-source") && /[A-Za-zÀ-ž]/u.test(value.replace(/\{\w+\}/gu, "")))) return;
    if (!HAN.test(value) && translated && independentPrintLabels) return; // PrintLabel is checked by its own typed three-language registry.
    if (isCanonicalComparison(node)) { counts.canonicalComparisons++; return; }
    counts.literals++;
    if (invariantLabels.has(normal(value))) { counts.originalExceptions++; return; }
    const exception = exceptions.find(item => item.file === file && item.text === value && (!item.owner || item.owner === ownerOf(node)));
    if (exception) { counts.originalExceptions++; return; }
    const at = location(source, node);
    if (translated) counts.translatedCalls++;
    if (visible) counts.visibleLiterals++;
    if (template) counts.templates++;
    counts[category] = (counts[category] ?? 0) + 1;
    if (!has(value) && !(template && shapes.has(shape(value)))) issues.push({ ...at, kind: template ? "missing-template" : "missing-message", text: value, detail: category });
    if (visible && !translated) issues.push({ ...at, kind: "unwrapped-visible", text: value, detail: visible.attribute ?? visible.kind });
  }
  function visit(node) {
    if (ts.isTemplateExpression(node)) check(node, templateText(node), true);
    else if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) check(node, ts.isJsxText(node) ? normal(node.text) : node.text);
    if (ts.isCallExpression(node) && translatedCalls.has(callName(node)) && node.arguments[0] && !ts.isStringLiteralLike(node.arguments[0])) dynamicBoundaries.push({ ...location(source, node), kind: "dynamic-translation", text: node.arguments[0].getText(source).slice(0, 180) });
    if (ts.isJsxExpression(node) && node.expression && !ts.isStringLiteralLike(node.expression) && !ts.isTemplateExpression(node.expression) && visibleUse(node.expression) && !(ts.isCallExpression(node.expression) && translatedCalls.has(callName(node.expression)))) {
      const values = finite(node.expression).filter(ts.isStringLiteralLike).filter(item => /[\p{L}]/u.test(item.text) && !invariantLabels.has(normal(item.text)));
      for (const item of values) if (item !== node.expression && !exceptions.some(exception => exception.file === file && exception.text === item.text && (!exception.owner || exception.owner === ownerOf(item)))) issues.push({ ...location(source, node), kind: "unwrapped-enumerable", text: item.text, detail: `Finite display source at ${location(source, item).line}; ${node.expression.getText(source).slice(0, 100)}` });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { issues, dynamicBoundaries, counts };
}

function sourceFiles(root, directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(root, file) : /\.tsx?$/u.test(entry.name) && !entry.name.endsWith(".d.ts") ? [file] : [];
  });
}

export function auditI18n(root = ROOT) {
  const parsed = dictionaryFiles.map(file => parseDictionary(file, readFileSync(resolve(root, file), "utf8")));
  const dictionary = validateDictionaries(parsed.flatMap(result => result.entries));
  const issues = [...parsed.flatMap(result => result.issues), ...dictionary.issues];
  const dynamicBoundaries = [];
  const counts = { dictionaries: dictionaryFiles.length, entries: parsed.reduce((sum, item) => sum + item.entries.length, 0), uniqueMessages: dictionary.messages.size, sources: 0 };
  const skipped = [];
  for (const file of ["app", "components", "lib"].flatMap(directory => sourceFiles(root, directory))) {
    if (dictionaryFiles.includes(file)) continue;
    if (sourceExceptions.has(file)) { skipped.push({ file, reason: sourceExceptions.get(file) }); continue; }
    const result = scanSource(file, readFileSync(resolve(root, file), "utf8"), dictionary.messages);
    counts.sources++;
    for (const [key, value] of Object.entries(result.counts)) counts[key] = (counts[key] ?? 0) + value;
    issues.push(...result.issues);
    dynamicBoundaries.push(...result.dynamicBoundaries);
  }
  return { ok: !issues.length, counts, issues, dynamicBoundaries, sourceExceptions: skipped, limitations: ["AST checks static Chinese message sources and visible Chinese/Latin literals, not arbitrary runtime strings.", "Finite local constants and map output are checked; arbitrary function return values and cross-module data flow are not proven.", "Dynamic translation calls are listed for review; their presence does not prove complete runtime coverage.", "Customer free text, identifiers, brand/model data and frozen policy/sale snapshots must stay original; browser and domain tests still apply."] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditI18n();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`i18n: ${report.counts.uniqueMessages} keys; ${report.counts.sources} sources; ${report.counts.translatedCalls} static translated references; ${report.dynamicBoundaries.length} dynamic boundaries.`);
    for (const issue of report.issues) console.error(`${issue.file}:${issue.line}:${issue.column} ${issue.kind}: ${JSON.stringify(issue.text)} (${issue.detail})`);
    for (const limitation of report.limitations) console.log(limitation);
    console.log(report.ok ? "i18n static checks passed." : `i18n static checks failed: ${report.issues.length} findings.`);
  }
  process.exitCode = report.ok ? 0 : 1;
}
