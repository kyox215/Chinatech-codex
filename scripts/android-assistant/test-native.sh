#!/bin/sh
set -eu
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
python3 "$TASK_ROOT/scripts/android-assistant/verify-v5.py"
exec python3 "$TASK_ROOT/tests/android-phone-gate.test.py"
