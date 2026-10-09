#!/bin/sh
set -eu
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
python3 "$TASK_ROOT/scripts/android-assistant/verify-v3.py"
exec python3 "$TASK_ROOT/scripts/android-assistant/test-v3.py"
