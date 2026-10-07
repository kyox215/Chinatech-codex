import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, "scripts/windows-toolbox");
const output = resolve(root, "public/toolbox/windows");
const config = JSON.parse(readFileSync(resolve(source, "release.json"), "utf8"));
const messages = JSON.parse(readFileSync(resolve(source, "messages.json"), "utf8"));
const sha = data => createHash("sha256").update(data).digest("hex");
const escapeXml = text => String(text).replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
const quotePS = value => `'${value.replace(/['\u2018\u2019]/g, "''")}'`;
const crlf = text => text.replace(/\r?\n/g, "\r\n");
if (config.schemaVersion !== 1 || config.target?.edition !== "Professional" || config.target?.architecture !== "x64" || !Array.isArray(config.verifiedRoutes) || !Array.isArray(config.media) || !Array.isArray(config.sources)) throw new Error("Invalid Windows release schema/target.");
const hashPattern = /^[a-f0-9]{64}$/;
const sourceInputs = Object.fromEntries(["build.mjs", "messages.json", "runner.ps1", "workflow.ps1"].map(name => [name, sha(readFileSync(resolve(source, name)))]));
const sourceInputSha256 = sha(JSON.stringify(sourceInputs));
// Bind evidence to what will actually run, excluding report hashes (circular)
// and expiring Microsoft URL tokens. Downloaded bytes remain SHA256-pinned.
const routePolicy = ({ id, language, sourceVersion, sourceBuild, sourceEdition, architecture, hardwarePolicy, stages }) => ({ id, language, sourceVersion, sourceBuild, sourceEdition, architecture, hardwarePolicy, stages });
const releasePolicy = { schemaVersion: config.schemaVersion, target: config.target, routes: config.verifiedRoutes.map(routePolicy), media: config.media.map(image => Object.fromEntries(Object.entries(image).filter(([key]) => key !== "url"))), sources: config.sources };
const releasePolicySha256 = sha(JSON.stringify(releasePolicy));

const fail = reason => { throw new Error(`Verified Windows release rejected: ${reason}`); };
const evidenceFiles = {};
const readEvidence = (path, expected, kind, route) => {
  if (typeof path !== "string" || isAbsolute(path) || path.includes("\\") || relative(root, resolve(root, path)).startsWith("..")) fail(`${kind} evidence must be a project relative path`);
  const actual = realpathSync(resolve(root, path));
  if (relative(realpathSync(root), actual).startsWith("..")) fail(`${kind} evidence outside project`);
  const bytes = readFileSync(actual);
  if (!hashPattern.test(expected) || sha(bytes) !== expected) fail(`${kind} evidence fingerprint`);
  const report = JSON.parse(bytes.toString("utf8"));
  if (report.schemaVersion !== 1 || report.fixture !== false || report.route !== route.id || report.sourceInputSha256 !== sourceInputSha256 || report.releasePolicySha256 !== releasePolicySha256) fail(`${kind} evidence source/route binding`);
  evidenceFiles[`${route.id}:${kind}`] = { sha256: expected, bytes: bytes.length };
  return report;
};
if (config.status === "inspection-only") {
  if (config.verifiedRoutes.length || config.media.length) fail("inspection releases cannot contain execution routes/media");
} else if (config.status === "verified") {
  if (!config.verifiedRoutes.length || !config.media.length || !Number.isSafeInteger(config.target.build) || config.target.build < 22000 || config.target.osVersion !== "10.0") fail("target and real media/route evidence required");
  const ids = new Set(); const mediaIds = new Set();
  for (const image of config.media) {
    if (!/^[a-z0-9-]{1,64}$/.test(image.id) || mediaIds.has(image.id) || !hashPattern.test(image.sha256) || !/^[a-z]{2,3}-[A-Za-z]{2,4}$/.test(image.language) || image.architecture !== "x64" || !["Core","CoreSingleLanguage","CoreCountrySpecific","Professional"].includes(image.edition) || !Number.isSafeInteger(image.build) || image.build < 10240 || image.version !== "10.0" || image.type !== "iso") fail("media identity/metadata");
    if (image.type === "iso" && !/^https:\/\/(software-download\.microsoft\.com|software\.download\.prss\.microsoft\.com)\/[^\s]+$/.test(image.url)) fail("Microsoft ISO source required");
    mediaIds.add(image.id);
  }
  for (const route of config.verifiedRoutes) {
    if (!/^(windows10|windows11)-(home|pro)-x64$/.test(route.id) || ids.has(route.id) || route.sourceVersion !== "10.0" || !Number.isSafeInteger(route.sourceBuild) || route.sourceBuild < 10240 || !["Core","CoreSingleLanguage","CoreCountrySpecific","Professional"].includes(route.sourceEdition) || route.architecture !== "x64" || route.hardwarePolicy !== "setup-scan" || route.codeSha256 !== sourceInputSha256 || !hashPattern.test(route.windowsEvidence) || !hashPattern.test(route.independentReview) || !/^[a-z]{2,3}-[A-Za-z]{2,4}$/.test(route.language) || !Array.isArray(route.stages) || !route.stages.length) fail("route evidence/source binding");
    ids.add(route.id);
    const family = route.sourceBuild >= 22000 ? "windows11" : "windows10";
    const kind = route.sourceEdition === "Professional" ? "pro" : "home";
    if (route.id !== `${family}-${kind}-x64`) fail("source identity does not match route");
    const stageIds = new Set();
    let expectedBuild = route.sourceBuild; let expectedEdition = route.sourceEdition;
    for (const stage of route.stages) {
      if (!/^[a-z0-9-]{1,48}$/.test(stage.id) || stageIds.has(stage.id) || !["upgrade","conversion","activation","verify"].includes(stage.kind) || stage.expectedVersion !== "10.0" || !Number.isSafeInteger(stage.expectedBuild) || !["Core","CoreSingleLanguage","CoreCountrySpecific","Professional"].includes(stage.expectedEdition)) fail("stage policy");
      stageIds.add(stage.id);
      if (stage.expectedBuild < expectedBuild) fail("stage downgrade is forbidden");
      if (stage.kind === "upgrade" && stage.expectedEdition !== expectedEdition) fail("upgrade cannot silently convert edition");
      if (stage.kind !== "upgrade" && stage.expectedBuild !== expectedBuild) fail("only upgrade can change build");
      if (stage.kind !== "conversion" && stage.expectedEdition !== expectedEdition) fail("only native conversion can change edition");
      if (stage.kind === "upgrade") {
        const media = config.media.find(image => image.id === stage.mediaId);
        if (stage.scanSupported !== true || !media || media.language !== route.language || media.version !== stage.expectedVersion || media.build !== stage.expectedBuild || media.edition !== stage.expectedEdition) fail("retention and matched stage media required");
      }
      if (stage.kind === "conversion" && (stage.conversionMode !== "native-ui" || stage.expectedEdition !== "Professional" || expectedEdition === "Professional")) fail("verified native conversion required");
      expectedBuild = stage.expectedBuild; expectedEdition = stage.expectedEdition;
    }
    const last = route.stages.at(-1);
    if (last.kind !== "verify" || last.expectedEdition !== "Professional" || last.expectedBuild !== config.target.build || last.expectedVersion !== config.target.osVersion) fail("last stage must verify exact target");
    const windows = readEvidence(route.evidence?.windowsPath, route.windowsEvidence, "windows", route);
    const review = readEvidence(route.evidence?.reviewPath, route.independentReview, "review", route);
    if (windows.platform !== "Windows" || windows.result !== "passed" || windows.language !== route.language || windows.sourceVersion !== route.sourceVersion || windows.sourceBuild !== route.sourceBuild || windows.sourceEdition !== route.sourceEdition || windows.architecture !== route.architecture || windows.hardwarePolicy !== route.hardwarePolicy || ["personalFilesSha256","applications","settings","officePreserved","resume","rollback","retentionScan"].some(check => windows.checks?.[check] !== true)) fail("actual Windows retention/recovery checks required");
    for (const stage of route.stages.filter(stage => stage.kind === "upgrade")) {
      const media = config.media.find(image => image.id === stage.mediaId);
      if (!windows.media?.some(item => item.id === media.id && item.sha256 === media.sha256)) fail("Windows evidence media binding");
    }
    if (review.result !== "approved" || typeof review.reviewer !== "string" || !review.reviewer.trim()) fail("independent review approval required");
  }
} else fail("unknown status");
for (const [key, values] of Object.entries(messages)) {
  if (values.length !== 3 || values.some(text => !text.trim())) throw new Error(`Incomplete launcher translation: ${key}`);
  const vars = text => [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort().join(",");
  if (values.some(text => vars(text) !== vars(values[0]))) throw new Error(`Launcher variables differ: ${key}`);
}
for (const upstream of config.sources) {
  if (!/^[a-f0-9]{40}$/.test(upstream.commit) || !/^[a-f0-9]{64}$/.test(upstream.sha256)) throw new Error("Unpinned upstream.");
}
mkdirSync(output, { recursive: true });
const attributes = object => Object.entries(object).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) fail("XML attribute name");
  return `${key}="${escapeXml(value)}"`;
}).join(" ");
const xml = crlf(`<?xml version="1.0" encoding="utf-8"?>
<release schemaVersion="1" version="${escapeXml(config.version)}" status="${escapeXml(config.status)}">
  <target ${attributes(config.target)} />
  <verifiedRoutes>
${config.verifiedRoutes.map(route => `    <route ${attributes(route)}><stages>\n${route.stages.map(stage => `      <stage ${attributes(stage)} />`).join("\n")}\n    </stages></route>`).join("\n")}
  </verifiedRoutes>
  <media>
${config.media.map(image => `    <image ${attributes(image)} />`).join("\n")}
  </media>
  <sources>
${config.sources.map(item => `    <source ${attributes(item)} />`).join("\n")}
  </sources>
</release>
`);
writeFileSync(resolve(output, "release.xml"), xml);
const table = "@{\n" + Object.entries(messages).map(([key, values]) => `    ${quotePS(key)} = @(${values.map(quotePS).join(", ")})`).join("\n") + "\n}";
// The expected digest is compiled into each loader. One read supplies both the
// hash and ScriptBlock: changing the file between verification and execution
// cannot substitute bytes. All package/resume values remain encoded data.
const loaderTemplate = `$ErrorActionPreference='Stop';try{function d([string]$v){[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($v))};$pkg=d '__PACKAGE_B64__';if(-not $pkg){$pkg=$env:CT_TOOLBOX_PACKAGE};$expected=d '__HASH_B64__';$lang=d '__LANGUAGE_B64__';$resume=d '__RESUME_B64__';$owner=d '__OWNER_B64__';$hostPath=[IO.Path]::GetFullPath([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName);$native=[IO.Path]::GetFullPath((Join-Path ([Environment]::SystemDirectory) 'WindowsPowerShell\\v1.0\\powershell.exe'));if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or $hostPath -ine $native){throw 'host'};$sig=Get-AuthenticodeSignature -LiteralPath $native -ErrorAction Stop;if($sig.Status -ne 'Valid' -or $null -eq $sig.SignerCertificate -or $sig.SignerCertificate.Subject -notmatch '(^|,\\s*)O=Microsoft Corporation(,|$)'){throw 'signature'};$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;if($sid -notmatch '^S-1-5-21-\\d+-\\d+-\\d+-\\d+$' -or ($owner -and $owner -ne $sid)){throw 'owner'};$bytes=[IO.File]::ReadAllBytes((Join-Path $pkg 'ChinaTech-Windows.ps1'));$a=[Security.Cryptography.SHA256]::Create();try{$h=([BitConverter]::ToString($a.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$a.Dispose()};if($expected -notmatch '^[a-f0-9]{64}$' -or $h -ne $expected){throw 'integrity'};$code=[Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]65279);& ([ScriptBlock]::Create($code)) -Language $lang -PackageDirectory $pkg -EntryHash $expected -ResumePath $resume -OwnerSid $sid}catch{Write-Host (d '__ERROR_B64__');exit 2}`;
const template = readFileSync(resolve(source, "runner.ps1"), "utf8");
const replacements = {
  __RELEASE_HASH__: sha(xml), __MESSAGES__: table,
  __AUTOMATION_ENABLED__: config.status === "verified" ? "$true" : "$false",
  __SOURCE_INPUT_HASH__: sourceInputSha256,
  __ENTRY_LOADER_TEMPLATE__: Buffer.from(loaderTemplate).toString("base64"),
  __WORKFLOW_BASE64__: readFileSync(resolve(source, "workflow.ps1")).toString("base64"),
};
let compiled = template;
for (const [key, value] of Object.entries(replacements)) compiled = compiled.replace(key, () => value);
const runner = Buffer.from("\ufeff" + crlf(compiled));
writeFileSync(resolve(output, "ChinaTech-Windows.ps1.txt"), runner);

const files = { "ChinaTech-Windows.ps1": runner, "release.xml": Buffer.from(xml) };
for (const language of ["zh-CN", "it", "en"]) {
  const languageIndex = ["zh-CN", "it", "en"].indexOf(language);
  let loader = loaderTemplate;
  const data = { PACKAGE: "", HASH: sha(runner), LANGUAGE: language, RESUME: "", OWNER: "", ERROR: messages.integrity[languageIndex] };
  for (const [name, value] of Object.entries(data)) loader = loader.replace(`__${name}_B64__`, Buffer.from(value, "utf16le").toString("base64"));
  // Delayed expansion only passes the system location as data after CMD parsing.
  // Keep it disabled when reading %~dp0, so ! in a real package path is intact.
  files[`Start-${language}.cmd`] = Buffer.from(crlf(String.raw`@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
set "CT_TOOLBOX_PACKAGE=%~dp0"
setlocal EnableDelayedExpansion
if exist "!SystemRoot!\Sysnative\WindowsPowerShell\v1.0\powershell.exe" (
  "!SystemRoot!\Sysnative\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "${loader}"
) else (
  if not exist "!SystemRoot!\System32\WindowsPowerShell\v1.0\powershell.exe" goto missing
  "!SystemRoot!\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "${loader}"
)
if errorlevel 11 goto failure
if errorlevel 10 exit /b 10
if errorlevel 1 goto failure
exit /b 0
:missing
echo ${messages.missingPowerShell[languageIndex]}
:failure
echo ${messages.pressEnter[languageIndex]}
set /p "CT_TOOLBOX_CLOSE="
exit /b 2
`));
  writeFileSync(resolve(output, `Start-${language}.cmd.txt`), files[`Start-${language}.cmd`]);
}
const readme = [
  config.status === "inspection-only" ? "ChinaTech Windows — inspection release / 检测版 / versione di verifica" : "ChinaTech Windows — verified routes / 已验路线 / percorsi verificati",
  "",
  config.status === "inspection-only" ? "解压整个包，打开 Start-zh-CN.cmd。只读检测；不会激活、安装、转换版本或设置重启任务。" : "解压整个包，打开 Start-zh-CN.cmd。先检测，匹配已验路线后在本机确认一次；中断恢复重新核对系统与身份。",
  config.status === "inspection-only" ? "Estrai tutto il pacchetto e apri Start-it.cmd. Verifica in sola lettura; nessuna attivazione, installazione, conversione o attività di riavvio." : "Estrai tutto il pacchetto e apri Start-it.cmd. Dopo la verifica conferma una volta un percorso corrispondente. La ripresa controlla di nuovo sistema e identità.",
  config.status === "inspection-only" ? "Extract the entire package and open Start-en.cmd. Read-only inspection; no activation, installation, edition conversion or restart tasks." : "Extract the entire package and open Start-en.cmd. Inspect first, then confirm a matching verified route once locally. Recovery rechecks the system and identity.",
  "",
  config.status === "inspection-only" ? "自动升级尚未开放：执行／恢复驱动已接入，但没有真实 Windows 升级、数据保留及匹配媒体路线验收。" : "只有与已验系统版本、语言、架构及媒体完全匹配的路线才能确认执行；请先备份重要文件。",
  config.status === "inspection-only" ? "Aggiornamento automatico non disponibile: il driver di esecuzione e ripristino è integrato, ma aggiornamento reale, conservazione dei dati e percorsi con supporti corrispondenti non sono verificati su Windows." : "Puoi confermare solo percorsi con versione, lingua, architettura e supporti identici a quelli verificati. Salva prima i file importanti.",
  config.status === "inspection-only" ? "Automatic upgrade is unavailable: the execution/recovery driver is integrated, but real Windows upgrades, data retention and matching media routes have not passed verification." : "Only routes with the exact verified system version, language, architecture and media can be confirmed. Back up important files first.",
  "",
  config.status === "inspection-only" ? "Third-party sources are pinned references, not bundled or executed by this inspection release." : "Third-party code is not bundled. A verified route can fetch only the pinned source approved by its policy.",
  ...config.sources.map(item => `https://github.com/${item.repository}/blob/${item.commit}/${item.path}\r\nSHA256 ${item.sha256}`),
  "",
].join("\n");
files["README.txt"] = Buffer.from("\ufeff" + crlf(readme));
writeFileSync(resolve(output, "README.txt"), files["README.txt"]);
const payload = Object.fromEntries(Object.entries(files).map(([name, data]) => [name, data.toString("base64")]));
// Python's standard library produces a deterministic ZIP; no build-time downloads.
execFileSync("python3", ["-c", `import base64,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for name,data in sorted(json.load(sys.stdin).items()):
  item=zipfile.ZipInfo(name,date_time=(2026,10,7,0,0,0));item.compress_type=zipfile.ZIP_DEFLATED;item.external_attr=0o100644<<16
  archive.writestr(item,base64.b64decode(data))`, resolve(output, "ChinaTech-Windows-Check.zip")], { input: JSON.stringify(payload) });
const archive = readFileSync(resolve(output, "ChinaTech-Windows-Check.zip"));
const metadata = {
  version: config.version, status: config.status, target: config.target,
  sourceInputSha256, releasePolicySha256, evidenceFiles,
  inputs: Object.fromEntries(["release.json", "messages.json", "runner.ps1", "workflow.ps1", "build.mjs"].map(name => [name, sha(readFileSync(resolve(source, name)))])),
  archive: { path: "/toolbox/windows/ChinaTech-Windows-Check.zip", sha256: sha(archive), bytes: archive.length },
  files: Object.fromEntries(Object.entries(files).map(([name, data]) => [name, { sha256: sha(data), bytes: data.length }])),
  sources: config.sources,
};
writeFileSync(resolve(output, "checksums.json"), JSON.stringify(metadata, null, 2) + "\n");
writeFileSync(resolve(root, "lib/toolbox/windows-release.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log(`Built ${config.version}: ${archive.length} bytes, SHA256 ${sha(archive)} (${config.status})`);
