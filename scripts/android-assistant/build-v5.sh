#!/bin/sh
# Native Java build: official SDK tools only; no global SDK, Gradle, dependencies, or network access.
set -eu
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
TASK_WORKSPACE=${CHINATECH_WORKSPACE_ROOT:-$(CDPATH= cd -- "$TASK_ROOT/../../.." && pwd)}
TASK_TOOLS="$TASK_WORKSPACE/.local/android-assistant/toolchain"
TASK_PROOF="$TASK_ROOT/.local/android-phone-gate/native-proof"
TASK_KEY="$TASK_WORKSPACE/.local/android-assistant/native-proof/candidate-key.p12"
TASK_BUILD="$TASK_PROOF/build"
TASK_SOURCE="$TASK_ROOT/android/phone-assistant/app/src/main"
TASK_DELIVERY="$TASK_ROOT/.local/android-phone-gate/delivery"
TASK_JDK=$(find "$TASK_TOOLS/jdk" -path '*/Contents/Home' -type d | head -1)
export JAVA_HOME="$TASK_JDK"
export PATH="$JAVA_HOME/bin:$PATH"
TASK_BT="$TASK_TOOLS/sdk/android-16"
TASK_PLATFORM="$TASK_TOOLS/sdk/android-37.0/android.jar"
TASK_ZXING="$TASK_TOOLS/deps/zxing-core-3.5.3.jar"
python3 - "$TASK_ZXING" <<'PY'
from pathlib import Path
import sys,hashlib
assert hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()=="8d8064c1636fdaef7189dd9055c7d59950a8940a12f2293956446ec3c109fd82"
PY
[ -f "$TASK_PLATFORM" ] || { echo 'Missing project-local API 37.0 SDK; see README.' >&2; exit 1; }
[ -x "$JAVA_HOME/bin/java" ] || { echo 'Missing project-local JDK; see README.' >&2; exit 1; }
python3 - "$TASK_BUILD" <<'PY'
from pathlib import Path
import shutil,sys
build=Path(sys.argv[1])
assert build.name=='build' and build.parent.name=='native-proof'
if build.exists(): shutil.rmtree(build)
PY
mkdir -p "$TASK_BUILD/generated" "$TASK_BUILD/classes" "$TASK_BUILD/dex" "$TASK_DELIVERY"
chmod +x "$TASK_BT/aapt2" "$TASK_BT/d8" "$TASK_BT/zipalign" "$TASK_BT/apksigner"
"$TASK_BT/aapt2" compile --dir "$TASK_SOURCE/res" -o "$TASK_BUILD/resources.zip"
"$TASK_BT/aapt2" link -o "$TASK_BUILD/unsigned.apk" --manifest "$TASK_SOURCE/AndroidManifest.xml" -I "$TASK_PLATFORM" --java "$TASK_BUILD/generated" -A "$TASK_SOURCE/assets" --min-sdk-version 26 --target-sdk-version 37 "$TASK_BUILD/resources.zip"
find "$TASK_SOURCE/java" "$TASK_BUILD/generated" -name '*.java' > "$TASK_BUILD/java-sources.txt"
python3 - "$TASK_BUILD/java-sources.txt" "$TASK_BUILD/javac.args" <<'PY'
from pathlib import Path
import sys
Path(sys.argv[2]).write_text('\n'.join('"'+s.replace('\\','\\\\').replace('"','\\"')+'"' for s in Path(sys.argv[1]).read_text().splitlines()))
PY
"$JAVA_HOME/bin/javac" --release 8 -encoding UTF-8 -cp "$TASK_PLATFORM:$TASK_ZXING" -d "$TASK_BUILD/classes" "@$TASK_BUILD/javac.args"
"$JAVA_HOME/bin/jar" --create --file "$TASK_BUILD/classes.jar" -C "$TASK_BUILD/classes" .
"$TASK_BT/d8" --lib "$TASK_PLATFORM" --min-api 26 --output "$TASK_BUILD/dex" "$TASK_BUILD/classes.jar" "$TASK_ZXING"
python3 - "$TASK_BUILD/unsigned.apk" "$TASK_BUILD/dex" <<'PY'
import sys,zipfile
from pathlib import Path
with zipfile.ZipFile(sys.argv[1],'a',compression=zipfile.ZIP_DEFLATED) as z:
 for p in Path(sys.argv[2]).glob('*.dex'):z.write(p,p.name)
PY
"$TASK_BT/zipalign" -P 16 -f 4 "$TASK_BUILD/unsigned.apk" "$TASK_BUILD/aligned.apk"
# Preserve the existing installed signing identity. Never generate a replacement certificate.
[ -f "$TASK_KEY" ] || { echo 'Existing project candidate signing identity missing.' >&2; exit 1; }
TASK_APK="$TASK_DELIVERY/ChinaTech-Phone-Assistant.apk"
"$TASK_BT/apksigner" sign --v4-signing-enabled false --ks "$TASK_KEY" --ks-key-alias candidate --ks-pass pass:android --key-pass pass:android --out "$TASK_APK" "$TASK_BUILD/aligned.apk"
"$TASK_BT/apksigner" verify --verbose --print-certs "$TASK_APK" > "$TASK_PROOF/apk-signature.txt"
"$TASK_BT/aapt2" dump badging "$TASK_APK" > "$TASK_PROOF/apk-badging.txt"
"$TASK_BT/aapt2" dump xmltree "$TASK_APK" --file AndroidManifest.xml > "$TASK_PROOF/apk-manifest.txt"
"$TASK_BT/zipalign" -c -P 16 -v 4 "$TASK_APK" > "$TASK_PROOF/apk-alignment.txt"
python3 - "$TASK_APK" "$TASK_PROOF" <<'PY'
from pathlib import Path
import hashlib,json,re,sys
apk=Path(sys.argv[1]);p=Path(sys.argv[2]);cert=re.search(r'certificate SHA-256 digest: (\w+)',(p/'apk-signature.txt').read_text()).group(1)
assert cert=='bb8969df392a7c575895c4b4e9bb9219847c20bacadd3980a9bcb956f19e1329'
obj={'package':'in.chinatech.phoneassistant','versionName':'0.5.0-test','versionCode':5,'releaseId':'phone-assistant-0.5.0','minSdk':26,'targetSdk':37,'compileSdk':'37.0 r02','apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apkBytes':apk.stat().st_size,'signerCertificateSha256':cert,'signing':'project-local candidate; not production update key','deviceVerification':'not yet verified on physical Android devices','published':False}
source=p.parents[2]/'android/phone-assistant/app/src/main'
inputs=[{'path':str(x.relative_to(source)), 'sha256':hashlib.sha256(x.read_bytes()).hexdigest(),'bytes':x.stat().st_size} for x in sorted(source.rglob('*')) if x.is_file()]
obj['sourceInputsSha256']=hashlib.sha256(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()).hexdigest()
(p/'source-inputs.json').write_text(json.dumps({'files':inputs,'sha256':obj['sourceInputsSha256']},indent=2)+'\n')
(p/'apk-verification.json').write_text(json.dumps(obj,indent=2)+'\n');print(json.dumps(obj,indent=2))
PY
