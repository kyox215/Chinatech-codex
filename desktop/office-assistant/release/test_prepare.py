import hashlib
import importlib.util
import json
import contextlib
import io
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).with_name('prepare.py')
SPEC = importlib.util.spec_from_file_location('office_release_prepare', MODULE)
prepare = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepare)


def fixture(machine, signed=False):
    value = bytearray(512)
    value[:2] = b'MZ'
    struct.pack_into('<I', value, 60, 64)
    value[64:68] = b'PE\0\0'
    struct.pack_into('<H', value, 68, machine)
    struct.pack_into('<H', value, 84, 240)
    struct.pack_into('<H', value, 88, 0x20B)
    struct.pack_into('<I', value, 88 + 108, 16)
    if signed:
        struct.pack_into('<II', value, 88 + 144, 400, 112)
    return value


class FrozenReleaseTests(unittest.TestCase):
    def setUp(self):
        work = prepare.PROJECT / '.local' / 'office-signing-20261011'
        work.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=work)
        self.root = Path(self.temporary.name)
        self.arm64 = self.root / 'ARM64.exe'
        self.x64 = self.root / 'x64.exe'
        self.arm64.write_bytes(fixture(0xAA64))
        self.x64.write_bytes(fixture(0x8664))

    def tearDown(self):
        self.temporary.cleanup()

    def arguments(self):
        result = dict(sources={'win-arm64': self.arm64, 'win-x64': self.x64},
                    expected_hashes={'win-arm64': prepare.sha256(self.arm64), 'win-x64': prepare.sha256(self.x64)},
                    output=self.root / 'stage', version='0.2.2', published_version='0.2.1',
                    source_commit='a' * 40, runner_sha256='b' * 64)
        metadata_paths = {}
        for runtime, source in result['sources'].items():
            path = self.root / (runtime + '.build.json')
            path.write_text(json.dumps({'server': 'https://www.chinatech.in/', 'development': False,
                                       'version': result['version'], 'runtime': runtime,
                                       'runnerSha256': result['runner_sha256'], 'exeSha256': prepare.sha256(source),
                                       'bytes': source.stat().st_size}))
            metadata_paths[runtime] = path
        result['build_manifests'] = metadata_paths
        return result

    def rejected(self, expected, **changes):
        args = self.arguments()
        args.update(changes)
        with self.assertRaisesRegex(prepare.PreparationError, expected):
            prepare.prepare(**args)

    def test_valid_stage_preserves_inputs_and_has_no_release_claim(self):
        before = [self.arm64.read_bytes(), self.x64.read_bytes()]
        value = prepare.prepare(**self.arguments())
        self.assertEqual(before, [self.arm64.read_bytes(), self.x64.read_bytes()])
        self.assertFalse(value['signatureVerified'])
        self.assertFalse(value['releaseReady'])
        self.assertEqual(len(value['files']), 2)
        for file in value['files']:
            self.assertEqual(prepare.sha256(self.root / 'stage' / file['name']), file['unsignedSha256'])

    def test_existing_version_requires_inspection_and_cannot_claim_release(self):
        self.rejected('VERSION_NOT_NEWER', version='0.2.1')
        args = self.arguments()
        args.update(version='0.2.1', inspection_only=True)
        result = prepare.prepare(**args)
        self.assertTrue(result['inspectionOnly'])
        self.assertFalse(result['releaseReady'])

    def test_version_format_is_strict(self):
        for version in ('01.2.3', '1.2.3.4', 'v0.2.2', '0.2.2-beta', '0.65536.2', '0.999999.2'):
            with self.subTest(version=version):
                self.rejected('INVALID_VERSION', version=version)

    def test_both_architectures_are_required(self):
        self.rejected('BOTH_ARCHITECTURES_REQUIRED', sources={'win-x64': self.x64})

    def test_formal_build_metadata_is_required(self):
        self.rejected('FORMAL_BUILD_METADATA_REQUIRED', build_manifests=None)

    def test_development_build_metadata_cannot_be_declared_formal(self):
        args = self.arguments()
        path = args['build_manifests']['win-arm64']
        value = json.loads(path.read_text())
        value['development'] = True
        path.write_text(json.dumps(value))
        with self.assertRaisesRegex(prepare.PreparationError, 'NON_PRODUCTION_BUILD_METADATA'):
            prepare.prepare(**args)

    def test_build_manifest_from_another_file_is_rejected(self):
        args = self.arguments()
        path = args['build_manifests']['win-arm64']
        value = json.loads(path.read_text())
        value['exeSha256'] = '0' * 64
        path.write_text(json.dumps(value))
        with self.assertRaisesRegex(prepare.PreparationError, 'BUILD_METADATA_MISMATCH'):
            prepare.prepare(**args)

    def test_wrong_sha_fails_before_creating_output(self):
        args = self.arguments()
        args['expected_hashes']['win-arm64'] = '0' * 64
        with self.assertRaisesRegex(prepare.PreparationError, 'INPUT_SHA_MISMATCH'):
            prepare.prepare(**args)
        self.assertFalse(args['output'].exists())

    def test_swapped_architectures_with_correct_hashes_are_rejected(self):
        self.rejected('ARCHITECTURE_MISMATCH',
                      sources={'win-arm64': self.x64, 'win-x64': self.arm64},
                      expected_hashes={'win-arm64': prepare.sha256(self.x64), 'win-x64': prepare.sha256(self.arm64)})

    def test_development_executable_is_rejected(self):
        dev = self.root / 'Assistant.DEV.exe'
        dev.write_bytes(self.arm64.read_bytes())
        self.rejected('DEVELOPMENT_INPUT', sources={'win-arm64': dev, 'win-x64': self.x64})

    def test_signed_input_cannot_be_resigned_as_frozen_unsigned_input(self):
        self.arm64.write_bytes(fixture(0xAA64, signed=True))
        self.rejected('INPUT_ALREADY_SIGNED')

    def test_truncated_pe_is_rejected(self):
        self.arm64.write_bytes(fixture(0xAA64)[:110])
        self.rejected('INVALID_PE')

    def test_source_link_is_rejected(self):
        link = self.root / 'ARM-link.exe'
        link.symlink_to(self.arm64)
        self.rejected('PATH_OUTSIDE_PROJECT_OR_LINK', sources={'win-arm64': link, 'win-x64': self.x64})

    def test_existing_output_is_not_modified(self):
        output = self.root / 'stage'
        output.mkdir()
        marker = output / 'existing.txt'
        marker.write_text('preserve')
        self.rejected('OUTPUT_ALREADY_EXISTS')
        self.assertEqual(marker.read_text(), 'preserve')

    def test_source_changed_during_copy_cannot_create_manifest(self):
        original = prepare.shutil.copyfile
        def changed(source, destination):
            original(source, destination)
            source.write_bytes(source.read_bytes() + b'changed')
        with patch.object(prepare.shutil, 'copyfile', side_effect=changed):
            self.rejected('INPUT_CHANGED_DURING_COPY')
        self.assertFalse((self.root / 'stage' / 'input-manifest.json').exists())

    def test_partial_publication_never_leaves_success_manifest(self):
        original = prepare.os.link
        calls = 0
        def failed(source, destination):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError('test interruption')
            original(source, destination)
        with patch.object(prepare.os, 'link', side_effect=failed):
            with self.assertRaises(OSError):
                prepare.prepare(**self.arguments())
        self.assertFalse((self.root / 'stage' / 'input-manifest.json').exists())

    def test_cleanup_failure_after_commit_reports_warning_and_success(self):
        warning = io.StringIO()
        with patch.object(prepare.shutil, 'rmtree', side_effect=OSError('test cleanup denied')):
            with contextlib.redirect_stderr(warning):
                result = prepare.prepare(**self.arguments())
        self.assertTrue(result['temporaryCleanupWarning'])
        self.assertTrue((self.root / 'stage' / 'input-manifest.json').is_file())
        self.assertIn('TEMPORARY_CLEANUP_WARNING', warning.getvalue())

    def test_cleanup_failure_never_masks_original_failure(self):
        with patch.object(prepare.shutil, 'copyfile', side_effect=OSError('original copy failure')):
            with patch.object(prepare.shutil, 'rmtree', side_effect=OSError('cleanup failure')):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaisesRegex(OSError, 'original copy failure'):
                        prepare.prepare(**self.arguments())
        self.assertFalse((self.root / 'stage' / 'input-manifest.json').exists())


if __name__ == '__main__':
    unittest.main()
