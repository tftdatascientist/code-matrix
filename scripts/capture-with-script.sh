#!/usr/bin/env bash
# Captures Claude Code PTY output to a pipe file for the bridge to read.
#
# Usage (Unix/macOS):
#   ./scripts/capture-with-script.sh
#
# Usage (Windows Git Bash / fallback):
#   ./scripts/capture-with-script.sh --tee
#
# The bridge reads from MATRIX_PTY_PIPE (default: /tmp/cc-matrix-pipe)

set -euo pipefail

# Use platform-appropriate temp directory
if [[ "$(uname -o 2>/dev/null)" == "Msys" ]] || [[ -n "$TEMP" ]]; then
  DEFAULT_PIPE="${TEMP:-/tmp}/cc-matrix-pipe"
else
  DEFAULT_PIPE="/tmp/cc-matrix-pipe"
fi
PIPE_PATH="${MATRIX_PTY_PIPE:-$DEFAULT_PIPE}"

# Clean up on exit
cleanup() {
  rm -f "$PIPE_PATH"
  echo "Capture stopped, pipe removed."
}
trap cleanup EXIT

# Create/reset the pipe file
rm -f "$PIPE_PATH"
touch "$PIPE_PATH"

echo "Capturing CC output to: $PIPE_PATH"
echo "Start the bridge in another terminal: npm run dev:bridge"
echo ""

if [[ "${1:-}" == "--tee" ]] || [[ "$(uname -o 2>/dev/null)" == "Msys" ]]; then
  # Windows / Git Bash: use tee (no `script` command)
  echo "Mode: tee (cross-platform)"
  echo "Launching claude... (output mirrored to pipe)"
  claude 2>&1 | tee -a "$PIPE_PATH"
else
  # Unix/macOS: use `script` for proper PTY capture (preserves ANSI codes)
  echo "Mode: script (PTY capture)"
  echo "Launching claude inside script..."
  script -q -f "$PIPE_PATH" bash -c "claude"
fi
