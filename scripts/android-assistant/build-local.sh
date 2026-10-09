#!/bin/sh
# The default entry follows the current source; never overwrite a frozen legacy APK.
set -eu
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec "$TASK_ROOT/scripts/android-assistant/build-v3.sh"
