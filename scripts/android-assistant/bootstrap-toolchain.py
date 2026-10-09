#!/usr/bin/env python3
"""Pinned official artifacts, isolated to this project. macOS Apple Silicon only. No global installation."""
from pathlib import Path
import hashlib,json,platform,tarfile,urllib.request,zipfile
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'.local/android-assistant/toolchain'
ARTIFACTS=[
 ('build-tools.zip','https://dl.google.com/android/repository/build-tools_r36_macosx.zip','04e7f3a72044de4926fa038fa0e251a37bba1e1c3fb8beab6f8401bfd9eb4bf3'),
 ('platform.zip','https://dl.google.com/android/repository/platform-37.0_r02.zip','840b23e827f96e64aea4c89a1194aac3dc5f6bad37edb231c5c795d890330e8d'),
 ('jdk.tar.gz','https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.12.1_1.tar.gz','3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998'),
 ('zxing-core-3.5.3.jar','https://repo.maven.apache.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar','8d8064c1636fdaef7189dd9055c7d59950a8940a12f2293956446ec3c109fd82'),
]
if platform.system()!='Darwin' or platform.machine()!='arm64':raise SystemExit('This local bootstrap is pinned for macOS arm64. Adapt official tool artifacts explicitly for other hosts.')
(BASE/'downloads').mkdir(parents=True,exist_ok=True)
for name,url,digest in ARTIFACTS:
 dest=BASE/('deps' if name.endswith('.jar') else 'downloads')/name;dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'ChinaTech-local-Android-build/0.1'})
  with urllib.request.urlopen(request,timeout=120) as response,dest.open('wb') as out:
   while chunk:=response.read(1024*1024):out.write(chunk)
 actual=hashlib.sha256(dest.read_bytes()).hexdigest()
 if actual!=digest:raise SystemExit('Integrity mismatch: '+name)
 if name.endswith('.zip'):
  with zipfile.ZipFile(dest) as archive:
   for member in archive.namelist():
    if not (BASE/'sdk'/member).resolve().is_relative_to((BASE/'sdk').resolve()):raise SystemExit('Unsafe archive path')
   archive.extractall(BASE/'sdk')
 elif name.endswith('.tar.gz'):
  with tarfile.open(dest) as archive:archive.extractall(BASE/'jdk',filter='data')
 print(name+' verified')
(BASE/'pinned-artifacts.json').write_text(json.dumps([{'name':n,'url':u,'sha256':h} for n,u,h in ARTIFACTS],indent=2)+'\n')
