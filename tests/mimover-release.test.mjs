import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const source = readFileSync(new URL("../lib/toolbox/mimover-release.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { mimoverRelease, isMimoverReleaseReady } = exports;
const verified = { ...mimoverRelease, status: "ready", available: true, bytes: 12345, sha256: "a".repeat(64), signerSha256: "b".repeat(64) };

test("Mi Mover availability alone cannot open an incomplete release", () => {
  assert.equal(isMimoverReleaseReady(verified), true);
  for (const change of [
    { status: "building" }, { available: false }, { bytes: null }, { bytes: 0 },
    { bytes: -1 }, { bytes: 12.5 }, { bytes: NaN }, { bytes: Number.MAX_SAFE_INTEGER + 1 },
    { sha256: null }, { sha256: "a".repeat(63) }, { sha256: "z".repeat(64) },
    { signerSha256: null }, { signerSha256: "b".repeat(63) },
  ]) assert.equal(isMimoverReleaseReady({ ...verified, ...change }), false, JSON.stringify(change));
});

test("Mi Mover building metadata does not expose invented integrity values", () => {
  if (mimoverRelease.status === "building") {
    assert.equal(mimoverRelease.available, false);
    assert.equal(mimoverRelease.bytes, null);
    assert.equal(mimoverRelease.sha256, null);
    assert.equal(mimoverRelease.signerSha256, null);
  } else {
    assert.equal(isMimoverReleaseReady(mimoverRelease), true);
  }
});


test("Mi Mover ready metadata matches the frozen APK and download instructions", () => {
  if (!isMimoverReleaseReady(mimoverRelease)) return;
  const release = mimoverRelease;
  const apk = readFileSync(new URL(`../public${release.apkPath}`, import.meta.url));
  assert.equal(apk.length, release.bytes);
  assert.equal(createHash("sha256").update(apk).digest("hex"), release.sha256);
  const instructions = readFileSync(new URL(`../public${release.instructionsPath}`, import.meta.url), "utf8");
  assert.ok(instructions.includes(release.version));
  for (const language of ["中文", "Italiano", "English"]) assert.ok(instructions.includes(language));
  const checksums = readFileSync(new URL(`../public${release.checksumsPath}`, import.meta.url), "utf8");
  assert.ok(checksums.includes(`${release.sha256}  ${release.apkPath.split("/").at(-1)}`));
});
