import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = process.cwd();
const sha = value => createHash("sha256").update(value).digest("hex");
const read = path => readFileSync(resolve(root, path));
const config = JSON.parse(read("scripts/windows-toolbox/release.json"));
const manifest = JSON.parse(read("lib/toolbox/windows-release.json"));
const runner = read("public/toolbox/windows/ChinaTech-Windows.ps1.txt").toString("utf8");
const workflow = Buffer.from(runner.match(/\$script:WorkflowBytes = '([^']+)'/)[1], "base64").toString("utf8");
const decodeLiteral = (code, name) => Buffer.from(code.match(new RegExp(`\\$${name}=d '([^']*)'`))[1], "base64").toString("utf16le");

test("unverified release cannot advertise verified routes or configured installation media", () => {
  assert.equal(config.status, "inspection-only");
  assert.deepEqual(config.verifiedRoutes, []);
  assert.deepEqual(config.media, []);
  assert.equal(manifest.status, config.status);
  assert.ok(runner.includes("$script:AutomationEnabled = $false"));
  const entry = runner.slice(runner.indexOf("function Invoke-Inspection"), runner.indexOf("if (-not $LibraryOnly)"));
  for (const dangerous of ["Start-Process", "Invoke-WindowsActivation", "Receive-VerifiedFile", "Set-ItemProperty", "New-Item", "schtasks", "shutdown"]) {
    assert.ok(!entry.includes(dangerous), `${dangerous} must not be in the inspection entry`);
  }
});

test("the package and source are byte-for-byte consistent with website checksums", () => {
  for (const [name, hash] of Object.entries(manifest.inputs)) {
    assert.equal(sha(read(`scripts/windows-toolbox/${name}`)), hash, `Regenerate after changing ${name}`);
  }
  assert.equal(sha(read("public" + manifest.archive.path)), manifest.archive.sha256);
  assert.equal(sha(read("public/toolbox/windows/release.xml")), manifest.files["release.xml"].sha256);
  assert.equal(sha(read("public/toolbox/windows/ChinaTech-Windows.ps1.txt")), manifest.files["ChinaTech-Windows.ps1"].sha256);
  assert.ok(runner.includes(`$script:ExpectedReleaseHash = '${manifest.files["release.xml"].sha256}'`));
  assert.deepEqual(JSON.parse(read("public/toolbox/windows/checksums.json")), manifest);
  const entries = JSON.parse(execFileSync("python3", ["-c", `import hashlib,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
 assert archive.testzip() is None
 print(json.dumps({i.filename:{'sha256':hashlib.sha256(archive.read(i)).hexdigest(),'bytes':i.file_size} for i in archive.infolist()}))`, resolve(root, "public" + manifest.archive.path)], { encoding: "utf8" }));
  assert.deepEqual(entries, manifest.files);
  assert.ok(!Object.keys(entries).some(name => /KMS|MediaCreationTool/.test(name)), "Third-party activation scripts are not redistributed in this release.");
});

test("each language launcher pins the executed file and avoids dynamic remote execution", () => {
  for (const language of ["zh-CN", "it", "en"]) {
    const cmd = read(`public/toolbox/windows/Start-${language}.cmd.txt`).toString("utf8");
    const encoded = cmd.match(/-EncodedCommand ([A-Za-z0-9+/=]+)/)?.[1];
    assert.ok(encoded);
    const code = Buffer.from(encoded, "base64").toString("utf16le");
    assert.equal(decodeLiteral(code, "expected"), manifest.files["ChinaTech-Windows.ps1"].sha256);
    assert.equal(decodeLiteral(code, "lang"), language);
    assert.ok(code.includes("$env:CT_TOOLBOX_PACKAGE"));
    assert.ok(cmd.includes("DisableDelayedExpansion"));
    assert.ok(cmd.includes(String.raw`!SystemRoot!\System32\WindowsPowerShell\v1.0\powershell.exe`));
    assert.ok(cmd.includes(String.raw`!SystemRoot!\Sysnative\WindowsPowerShell\v1.0\powershell.exe`));
    assert.ok(code.includes("[Environment]::SystemDirectory"));
    assert.ok(code.includes("Get-AuthenticodeSignature"));
    assert.equal((code.match(/ReadAllBytes/g) || []).length, 1, "One read supplies hash and executed bytes");
    assert.ok(code.includes("ComputeHash($bytes)"));
    assert.ok(code.includes("[ScriptBlock]::Create($code)"));
    assert.ok(code.includes("-PackageDirectory $pkg -EntryHash $expected -ResumePath $resume -OwnerSid $sid"));
    assert.ok(!code.includes("& $p") && !code.includes("OpenRead"));
    assert.match(cmd, /^[\x09\x0a\x0d\x20-\x7e]+$/, "CMD must contain only ASCII syntax");
    assert.ok(cmd.split("\r\n").every(line => line.length < 8191), "CMD line must fit Windows limit");
    assert.ok(!/iex|Invoke-Expression|https?:|runas|-Command /i.test(cmd));
    assert.ok(!cmd.includes("& '%~dp0"));
    assert.equal(cmd.replaceAll("\r\n", "").includes("\n"), false);
  }
});

test("launcher messages preserve all language variants and format variables", () => {
  const messages = JSON.parse(read("scripts/windows-toolbox/messages.json"));
  const variables = text => [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort();
  for (const [key, values] of Object.entries(messages)) {
    assert.equal(values.length, 3, key);
    for (const value of values) { assert.ok(value.trim(), key); assert.deepEqual(variables(value), variables(values[0]), key); }
  }
});

test("both upstream sources use immutable commit URLs and expected fingerprints", () => {
  for (const source of config.sources) {
    assert.match(source.commit, /^[a-f0-9]{40}$/);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(config.sources.find(source => source.id === "mediacreationtool").role, "reference-only");
  assert.equal(config.sources.find(source => source.id === "kms").license, "not-established");
  assert.ok(workflow.includes("/m /w"));
  assert.ok(!/ArgumentList[^\n]*\/a\b/.test(workflow));
  assert.ok(!runner.includes("$env:ComSpec") && !runner.includes("function Invoke-WindowsActivation"), "No legacy activation bypass remains");
});

test("modern workflow is byte-pinned and every workflow failure has three translations", () => {
  assert.equal(sha(Buffer.from(workflow)), manifest.inputs["workflow.ps1"]);
  assert.equal(workflow, read("scripts/windows-toolbox/workflow.ps1").toString("utf8"));
  assert.ok(runner.includes("$PSVersionTable.PSVersion -lt [Version]'5.1'"));
  const messages = JSON.parse(read("scripts/windows-toolbox/messages.json"));
  for (const match of workflow.matchAll(/Throw-CT '([^']+)'/g)) assert.equal(messages[`workflow.${match[1]}`]?.length, 3, match[1]);
  assert.ok(runner.includes(`$script:SourceInputHash = '${manifest.sourceInputSha256}'`));
});

test("verified builds require source-bound Windows and media evidence before writing output", () => {
  // Separate synthetic build roots: no public config is changed and fake reports
  // never become Windows evidence. Missing and stale reports must fail closed.
  mkdirSync(join(root, ".local/windows-toolbox"), { recursive: true });
  const fixture = mkdtempSync(join(root, ".local/windows-toolbox/build-gate-"));
  try {
    mkdirSync(join(fixture, "scripts/windows-toolbox"), { recursive: true });
    for (const name of ["build.mjs", "runner.ps1", "workflow.ps1", "messages.json"]) writeFileSync(join(fixture, "scripts/windows-toolbox", name), read(`scripts/windows-toolbox/${name}`));
    const check = (candidate, label) => {
      writeFileSync(join(fixture, "scripts/windows-toolbox/release.json"), JSON.stringify(candidate));
      const result = spawnSync(process.execPath, [join(fixture, "scripts/windows-toolbox/build.mjs")], { encoding: "utf8" });
      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, /Verified Windows release rejected:/, label);
    };
    check({ ...config, status: "verified" }, "changing status cannot unlock empty media");
    check({ ...config, verifiedRoutes: [{ id: "windows10-pro-x64" }] }, "inspection cannot gain a route");
    const target = { ...config.target, osVersion: "10.0", build: 26200 };
    const media = [{ id: "w11-it", type: "iso", version: "10.0", build: 26200, edition: "Professional", architecture: "x64", language: "it-IT", sha256: "a".repeat(64), url: "https://software-download.microsoft.com/test.iso" }];
    const route = { id: "windows10-pro-x64", language: "it-IT", sourceVersion: "10.0", sourceBuild: 19045, sourceEdition: "Professional", architecture: "x64", hardwarePolicy: "setup-scan", codeSha256: manifest.sourceInputSha256, windowsEvidence: "b".repeat(64), independentReview: "c".repeat(64), stages: [{ id: "upgrade", kind: "upgrade", expectedVersion: "10.0", expectedBuild: 26200, expectedEdition: "Professional", mediaId: "w11-it", scanSupported: true }, { id: "verify", kind: "verify", expectedVersion: "10.0", expectedBuild: 26200, expectedEdition: "Professional" }] };
    check({ ...config, status: "verified", target, media, verifiedRoutes: [route] }, "hex evidence with no report cannot unlock");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [{ ...route, codeSha256: "d".repeat(64) }] }, "stale code fingerprint rejects");
    check({ ...config, status: "verified", target, media: [{ ...media[0], url: "https://example.com/setup.iso" }], verifiedRoutes: [route] }, "untrusted media rejects");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [{ ...route, hardwarePolicy: "bypass-tpm" }] }, "unverified hardware bypass rejects");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [{ ...route, sourceBuild: 22631 }] }, "route id cannot broaden to another OS family");
    const policyRoute = (({ id, language, sourceVersion, sourceBuild, sourceEdition, architecture, hardwarePolicy, stages }) => ({ id, language, sourceVersion, sourceBuild, sourceEdition, architecture, hardwarePolicy, stages }))(route);
    const releasePolicySha256 = sha(JSON.stringify({ schemaVersion: config.schemaVersion, target, routes: [policyRoute], media: media.map(image => Object.fromEntries(Object.entries(image).filter(([key]) => key !== "url"))), sources: config.sources }));
    const windows = { schemaVersion: 1, fixture: false, platform: "Windows", result: "passed", sourceInputSha256: manifest.sourceInputSha256, releasePolicySha256, route: route.id, language: route.language, sourceVersion: route.sourceVersion, sourceBuild: route.sourceBuild, sourceEdition: route.sourceEdition, architecture: route.architecture, hardwarePolicy: route.hardwarePolicy, media: [{ id: media[0].id, sha256: media[0].sha256 }], checks: Object.fromEntries(["personalFilesSha256","applications","settings","officePreserved","resume","rollback","retentionScan"].map(name => [name, true])) };
    const review = { schemaVersion: 1, fixture: false, result: "approved", sourceInputSha256: manifest.sourceInputSha256, releasePolicySha256, route: route.id, reviewer: "synthetic contract test only" };
    // These fabricated report objects exercise the builder contract in an
    // isolated temporary root; they are deleted and are not acceptance evidence.
    const writeReports = report => {
      const windowsBytes = Buffer.from(JSON.stringify(report)); const reviewBytes = Buffer.from(JSON.stringify(review));
      writeFileSync(join(fixture, "windows-test.json"), windowsBytes); writeFileSync(join(fixture, "review-test.json"), reviewBytes);
      return { ...route, windowsEvidence: sha(windowsBytes), independentReview: sha(reviewBytes), evidence: { windowsPath: "windows-test.json", reviewPath: "review-test.json" } };
    };
    check({ ...config, status: "verified", target, media, verifiedRoutes: [writeReports({ ...windows, fixture: true })] }, "fixture reports cannot be used for acceptance");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [writeReports({ ...windows, releasePolicySha256: "f".repeat(64) })] }, "evidence binds exact execution policy");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [writeReports({ ...windows, sourceBuild: 19044 })] }, "evidence cannot broaden to untested source build");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [writeReports({ ...windows, media: [{ id: media[0].id, sha256: "d".repeat(64) }] })] }, "evidence must match exact media hash");
    check({ ...config, status: "verified", target, media, verifiedRoutes: [writeReports({ ...windows, checks: { ...windows.checks, officePreserved: false } })] }, "Office preservation cannot be omitted");
    mkdirSync(join(fixture, "lib/toolbox"), { recursive: true });
    writeFileSync(join(fixture, "scripts/windows-toolbox/release.json"), JSON.stringify({ ...config, status: "verified", target, media, verifiedRoutes: [writeReports(windows)] }));
    const valid = spawnSync(process.execPath, [join(fixture, "scripts/windows-toolbox/build.mjs")], { encoding: "utf8" });
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.ok(readFileSync(join(fixture, "public/toolbox/windows/ChinaTech-Windows.ps1.txt"), "utf8").includes("$script:AutomationEnabled = $true"), "complete synthetic contract permits future verified compilation");
    assert.equal(JSON.parse(readFileSync(join(fixture, "public/toolbox/windows/checksums.json"))).status, "verified");
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

const pwsh = process.env.WINDOWS_TOOLBOX_PWSH || "pwsh";
const available = spawnSync(pwsh, ["-NoLogo", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], { encoding: "utf8" }).status === 0;
test("real PowerShell parser and pure route, retention, release-gate and failure tests", { skip: available ? false : "PowerShell runtime unavailable; this does not prove Windows execution" }, () => {
  const result = spawnSync(pwsh, ["-NoLogo", "-NoProfile", "-File", "tests/windows-toolbox.ps1"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PowerShell checks passed/);
});
