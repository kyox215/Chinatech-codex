#!/usr/bin/env python3
"""Build the independent 1.0 assistant. No server credentials or runner bundles."""
import argparse, hashlib, json, os, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--dotnet', default=str(root / '.local/office-desktop/toolchain/dotnet/dotnet'))
parser.add_argument('--rid', choices=['win-x64', 'win-arm64'], required=True)
args = parser.parse_args()
env = os.environ.copy()
env.update(DOTNET_CLI_HOME=str(root / '.local/office-desktop/dotnet-home'), NUGET_PACKAGES=str(root / '.local/office-desktop/nuget'), DOTNET_CLI_TELEMETRY_OPTOUT='1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1', DOTNET_GENERATE_ASPNET_CERTIFICATE='false')
source = root / 'desktop/office-assistant'
out = root / '.local/office-rebuild-1.0/dist' / args.rid
out.mkdir(parents=True, exist_ok=True)
subprocess.run([args.dotnet, 'publish', str(source / 'Client/ChinaTech.OfficeAssistant.csproj'), '-c', 'Release', '-r', args.rid, '-o', str(out), '-p:RestoreConfigFile=' + str(source / 'NuGet.Config')], env=env, check=True)
exe = out / 'ChinaTech.OfficeAssistant.exe'
inputs = sorted([*source.joinpath('Core').glob('*.cs'), *source.joinpath('Client').glob('*.cs'), *source.glob('*.py'), *source.joinpath('Core').glob('*.csproj'), *source.joinpath('Client').glob('*.csproj'), source / 'Client/app.manifest', source / 'NuGet.Config'])
manifest = dict(version='1.0.0', runtime=args.rid, executable=exe.name, bytes=exe.stat().st_size, sha256=hashlib.sha256(exe.read_bytes()).hexdigest(), standalone=True, authenticodeSigned=False, releaseReady=False,
                realWindowsAcceptance='pending', sources={str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs})
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in manifest.items() if k != 'sources'}))
