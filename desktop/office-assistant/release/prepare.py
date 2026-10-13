#!/usr/bin/env python3
"""Freeze two unsigned Office binaries for signing without changing originals."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import sys
import tempfile

PROJECT = Path(__file__).resolve().parents[3]
FILES = {
    "win-arm64": ("ChinaTech-Office-Assistant-ARM64.exe", 0xAA64),
    "win-x64": ("ChinaTech-Office-Assistant-x64.exe", 0x8664),
}


class PreparationError(ValueError):
    pass


def require_hex(value, length):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-fA-F]{" + str(length) + r"}", value):
        raise PreparationError("INVALID_FINGERPRINT")
    return value.lower()


def version_tuple(value):
    if not isinstance(value, str) or not re.fullmatch(r"(?:0|[1-9][0-9]{0,4})\.(?:0|[1-9][0-9]{0,4})\.(?:0|[1-9][0-9]{0,4})", value):
        raise PreparationError("INVALID_VERSION")
    result = tuple(int(part) for part in value.split("."))
    if any(part > 65535 for part in result):
        raise PreparationError("INVALID_VERSION")
    return result


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def unsigned_pe_machine(path):
    """Inspect PE headers, not executable code or Windows trust/reputation."""
    size = path.stat().st_size
    with path.open("rb") as stream:
        header = stream.read(64)
        if len(header) != 64 or header[:2] != b"MZ":
            raise PreparationError("INVALID_PE")
        pe_offset = struct.unpack_from("<I", header, 60)[0]
        if pe_offset < 64 or pe_offset + 24 > size:
            raise PreparationError("INVALID_PE")
        stream.seek(pe_offset)
        header = stream.read(24)
        if header[:4] != b"PE\0\0":
            raise PreparationError("INVALID_PE")
        machine = struct.unpack_from("<H", header, 4)[0]
        optional_size = struct.unpack_from("<H", header, 20)[0]
        optional = stream.read(optional_size)
        if len(optional) != optional_size or optional_size < 152:
            raise PreparationError("INVALID_PE")
        # These two supported Windows architectures use PE32+.
        if struct.unpack_from("<H", optional, 0)[0] != 0x20B:
            raise PreparationError("INVALID_PE")
        if struct.unpack_from("<I", optional, 108)[0] < 5:
            raise PreparationError("INVALID_PE")
        certificate_offset, certificate_size = struct.unpack_from("<II", optional, 144)
        if certificate_offset or certificate_size:
            raise PreparationError("INPUT_ALREADY_SIGNED")
        return machine


def project_path(path, *, must_exist):
    raw = Path(os.path.abspath(path))
    resolved = raw.resolve(strict=must_exist)
    if resolved != raw or not resolved.is_relative_to(PROJECT):
        raise PreparationError("PATH_OUTSIDE_PROJECT_OR_LINK")
    return resolved


def prepare(*, sources, expected_hashes, output, version, published_version,
            source_commit, runner_sha256, inspection_only=False, build_manifests=None):
    current = version_tuple(version)
    published = version_tuple(published_version)
    if not isinstance(inspection_only, bool):
        raise PreparationError("INVALID_INSPECTION_FLAG")
    if current <= published and not inspection_only:
        raise PreparationError("VERSION_NOT_NEWER_THAN_PUBLISHED")
    commit = require_hex(source_commit, 40)
    runner = require_hex(runner_sha256, 64)
    if set(sources) != set(FILES) or set(expected_hashes) != set(FILES):
        raise PreparationError("BOTH_ARCHITECTURES_REQUIRED")
    if not inspection_only and (not build_manifests or set(build_manifests) != set(FILES)):
        raise PreparationError("FORMAL_BUILD_METADATA_REQUIRED")
    output = project_path(output, must_exist=False)
    if output.exists():
        raise PreparationError("OUTPUT_ALREADY_EXISTS")
    entries = []
    checked = {}
    checked_metadata = {}
    for runtime, (filename, machine) in FILES.items():
        source = project_path(sources[runtime], must_exist=True)
        if not source.is_file() or source.suffix.lower() != ".exe" or "dev" in source.name.lower():
            raise PreparationError("INVALID_OR_DEVELOPMENT_INPUT")
        expected = require_hex(expected_hashes[runtime], 64)
        if sha256(source) != expected:
            raise PreparationError("INPUT_SHA_MISMATCH")
        if unsigned_pe_machine(source) != machine:
            raise PreparationError("ARCHITECTURE_MISMATCH")
        checked[runtime] = source
        entry = {"runtime": runtime, "name": filename,
                 "unsignedSha256": expected, "bytes": source.stat().st_size,
                 "machine": f"0x{machine:04x}"}
        if not inspection_only:
            metadata_path = project_path(build_manifests[runtime], must_exist=True)
            if not metadata_path.is_file() or metadata_path.stat().st_size > 65536:
                raise PreparationError("INVALID_BUILD_METADATA")
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (ValueError, UnicodeError):
                raise PreparationError("INVALID_BUILD_METADATA")
            if not isinstance(metadata, dict) or metadata.get("development") is not False or metadata.get("server") != "https://www.chinatech.in/":
                raise PreparationError("NON_PRODUCTION_BUILD_METADATA")
            facts = {"version": version, "runtime": runtime, "runnerSha256": runner,
                     "exeSha256": expected, "bytes": source.stat().st_size}
            if any(metadata.get(key) != value for key, value in facts.items()):
                raise PreparationError("BUILD_METADATA_MISMATCH")
            entry.update(buildManifestName=runtime + ".build.json", buildManifestSha256=sha256(metadata_path))
            checked_metadata[runtime] = metadata_path
        entries.append(entry)
    manifest = {"schemaVersion": 1, "kind": "office-signing-input", "version": version,
                "publishedVersion": published_version, "inspectionOnly": inspection_only,
                "sourceCommit": commit, "runnerSha256": runner,
                "formalBuildMetadataChecked": not inspection_only,
                "signatureVerified": False, "releaseReady": False, "files": entries}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".office-signing-", dir=output.parent))
    committed = False
    try:
        for entry in entries:
            source = checked[entry["runtime"]]
            target = temporary / entry["name"]
            shutil.copyfile(source, target)
            # A changed source or incomplete copy cannot produce a usable stage.
            if sha256(source) != entry["unsignedSha256"] or sha256(target) != entry["unsignedSha256"]:
                raise PreparationError("INPUT_CHANGED_DURING_COPY")
            if entry["runtime"] in checked_metadata:
                metadata = checked_metadata[entry["runtime"]]
                destination = temporary / entry["buildManifestName"]
                shutil.copyfile(metadata, destination)
                if sha256(metadata) != entry["buildManifestSha256"] or sha256(destination) != entry["buildManifestSha256"]:
                    raise PreparationError("INPUT_CHANGED_DURING_COPY")
        (temporary / "input-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        # Publish with no-replace links; the complete manifest is always last.
        output.mkdir()
        for entry in entries:
            os.link(temporary / entry["name"], output / entry["name"])
            if entry.get("buildManifestName"):
                os.link(temporary / entry["buildManifestName"], output / entry["buildManifestName"])
        os.link(temporary / "input-manifest.json", output / "input-manifest.json")
        committed = True
    finally:
        # Incomplete output has no manifest. Never delete a raced output.
        try:
            shutil.rmtree(temporary)
        except OSError:
            # Cleanup cannot turn an already committed, complete stage into a
            # reported failure, or replace the original preparation error.
            print("TEMPORARY_CLEANUP_WARNING", file=sys.stderr)
            if committed:
                manifest["temporaryCleanupWarning"] = True
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("arm64", "x64"):
        parser.add_argument("--" + name, required=True, type=Path)
        parser.add_argument("--" + name + "-sha256", required=True)
        parser.add_argument("--" + name + "-build-manifest", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--published-version", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--runner-sha256", required=True)
    parser.add_argument("--inspection-only", action="store_true")
    args = parser.parse_args()
    try:
        manifest = prepare(sources={"win-arm64": args.arm64, "win-x64": args.x64},
                           expected_hashes={"win-arm64": args.arm64_sha256, "win-x64": args.x64_sha256},
                           output=args.output, version=args.version, published_version=args.published_version,
                           source_commit=args.source_commit, runner_sha256=args.runner_sha256,
                           inspection_only=args.inspection_only,
                           build_manifests={"win-arm64": args.arm64_build_manifest, "win-x64": args.x64_build_manifest}
                           if args.arm64_build_manifest and args.x64_build_manifest else None)
    except (PreparationError, OSError) as error:
        code = str(error) if isinstance(error, PreparationError) else "FILE_OPERATION_FAILED"
        parser.exit(1, code + "\n")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
