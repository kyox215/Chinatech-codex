import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { writePrivateFile, writePrivateJson } from "./secure-output";

const cleanupPaths: string[] = [];

function privateFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "repairdesk-private-output-"));
  cleanupPaths.push(root);
  const outputDir = path.join(root, "private");
  mkdirSync(outputDir, { mode: 0o700 });
  return { root, outputDir };
}

afterEach(() => {
  for (const item of cleanupPaths.splice(0)) rmSync(item, { recursive: true, force: true });
});

describe("private output writer", () => {
  it("creates and re-tightens files to owner-only permissions", () => {
    const { outputDir } = privateFixture();
    const target = path.join(outputDir, "report.json");
    writeFileSync(target, "old", { mode: 0o666 });
    chmodSync(target, 0o666);

    writePrivateJson(target, { ok: true });

    expect(lstatSync(target).mode & 0o777).toBe(0o600);
  });

  it("rejects repository-local output", () => {
    const { root, outputDir } = privateFixture();
    expect(() =>
      writePrivateFile(path.join(outputDir, "report.json"), "secret", {
        forbiddenRoot: root,
      }),
    ).toThrow(/outside the repository/i);
  });

  it("rejects a symbolic-link target", () => {
    const { outputDir } = privateFixture();
    const realTarget = path.join(outputDir, "real.json");
    const linkedTarget = path.join(outputDir, "linked.json");
    writeFileSync(realTarget, "old", { mode: 0o600 });
    symlinkSync(realTarget, linkedTarget);

    expect(() => writePrivateFile(linkedTarget, "replacement")).toThrow(/symbolic link/i);
  });

  it("rejects a group-readable parent directory", () => {
    const { outputDir } = privateFixture();
    chmodSync(outputDir, 0o750);

    expect(() => writePrivateFile(path.join(outputDir, "report.json"), "secret")).toThrow(
      /group or other permissions/i,
    );
  });
});
