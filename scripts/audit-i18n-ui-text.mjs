import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd(), "src");
const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
if (!configPath) throw new Error("tsconfig.json not found");

const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const files = parsed.fileNames.filter(
  (file) =>
    file.startsWith(root) &&
    /\.tsx$/.test(file) &&
    !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(file) &&
    !file.includes("/server/") &&
    !file.includes("/testing/") &&
    !file.includes("/app/api/") &&
    !file.includes("/shared/i18n/messages.ts"),
);

const rows = [];
for (const file of files) {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    let value;
    let kind;
    if (ts.isJsxText(node)) {
      value = node.getText(source).replace(/\s+/g, " ").trim();
      kind = "jsx";
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return;
      value = node.text.trim();
      kind = ts.isJsxAttribute(node.parent) ? "attribute" : "string";
    }

    if (value && /\p{Script=Han}/u.test(value)) {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source));
      rows.push({
        file: relative(process.cwd(), file),
        line: position.line + 1,
        kind,
        text: value,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const unique = new Map();
for (const row of rows) {
  const current = unique.get(row.text) ?? { count: 0, examples: [] };
  current.count += 1;
  if (current.examples.length < 3) current.examples.push(`${row.file}:${row.line}:${row.kind}`);
  unique.set(row.text, current);
}

const summary = [...unique.entries()]
  .map(([text, value]) => ({ text, ...value }))
  .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "zh-CN"));

if (process.argv.includes("--summary")) {
  const byKind = Object.fromEntries(
    ["jsx", "attribute", "string"].map((kind) => [
      kind,
      rows.filter((row) => row.kind === kind).length,
    ]),
  );
  process.stdout.write(
    `UI Han-script candidates: ${rows.length} occurrences, ${summary.length} unique; ${JSON.stringify(byKind)}\n`,
  );
} else if (process.argv.includes("--json")) {
  process.stdout.write(
    `${JSON.stringify({ occurrences: rows.length, unique: summary }, null, 2)}\n`,
  );
} else {
  process.stdout.write(
    `UI Han-script candidates: ${rows.length} occurrences, ${summary.length} unique\n`,
  );
  for (const row of summary) {
    process.stdout.write(
      `${String(row.count).padStart(4)}\t${row.text}\t${row.examples.join(", ")}\n`,
    );
  }
}
