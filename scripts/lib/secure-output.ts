import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export interface PrivateOutputOptions {
  forbiddenRoot?: string;
  requirePrivateParent?: boolean;
}

function isWithinRoot(candidate: string, root: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function assertPrivateOutputPath(filePath: string, options: PrivateOutputOptions = {}) {
  const resolvedPath = path.resolve(filePath);
  const forbiddenRoot = path.resolve(options.forbiddenRoot ?? process.cwd());
  if (isWithinRoot(resolvedPath, forbiddenRoot)) {
    throw new Error("Sensitive or pseudonymized output must be written outside the repository.");
  }

  const parentDir = path.dirname(resolvedPath);
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true, mode: 0o700 });
  const parent = lstatSync(parentDir);
  if (parent.isSymbolicLink() || !parent.isDirectory()) {
    throw new Error("Private output parent must be a real directory, not a symbolic link.");
  }
  if ((options.requirePrivateParent ?? true) && (parent.mode & 0o077) !== 0) {
    throw new Error("Private output parent must not grant group or other permissions.");
  }

  if (existsSync(resolvedPath)) {
    const target = lstatSync(resolvedPath);
    if (target.isSymbolicLink() || !target.isFile()) {
      throw new Error("Private output target must be a regular file, not a symbolic link.");
    }
  }
  return resolvedPath;
}

export function writePrivateFile(
  filePath: string,
  contents: string,
  options: PrivateOutputOptions = {},
) {
  const resolvedPath = assertPrivateOutputPath(filePath, options);
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const descriptor = openSync(
    resolvedPath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow,
    0o600,
  );
  try {
    writeFileSync(descriptor, contents, { encoding: "utf8" });
  } finally {
    closeSync(descriptor);
  }
  chmodSync(resolvedPath, 0o600);
  return resolvedPath;
}

export function writePrivateJson(
  filePath: string,
  value: unknown,
  options: PrivateOutputOptions = {},
) {
  return writePrivateFile(filePath, JSON.stringify(value, null, 2), options);
}
