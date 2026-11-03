#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/_drafts/.delivery.lock"
ACTION="${1:-}"
OWNER="${2:-}"

case "$ACTION" in
  acquire|release)
    if ! [[ "$OWNER" =~ ^[a-z0-9][a-z0-9_-]{0,127}$ ]]; then
      printf 'A unique lowercase run ID is required (a-z, digits, underscore or hyphen).\n' >&2
      exit 1
    fi
    ;;
esac

case "$ACTION" in
  acquire)
    WAIT="${3:-1800}"
    if ! [[ "$WAIT" =~ ^[0-9]{1,5}$ ]]; then
      printf 'Timeout must be a non-negative integer of at most five digits.\n' >&2
      exit 1
    fi
    WAIT=$((10#$WAIT))
    START=$(date +%s)
    while ! mkdir "$LOCK" 2>/dev/null; do
      if [ $(( $(date +%s) - START )) -ge "$WAIT" ]; then
        printf 'LOCK TIMEOUT: %s; inspect the owner before manual recovery.\n' "$LOCK" >&2
        exit 2
      fi
      sleep 1
    done
    printf '%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$LOCK/$OWNER"
    printf 'LOCK ACQUIRED: %s\n' "$OWNER"
    ;;
  release)
    if [ ! -f "$LOCK/$OWNER" ]; then
      printf 'LOCK NOT OWNED: %s\n' "$OWNER" >&2
      exit 1
    fi
    # A token-specific unlink cannot remove a later owner's token.
    rm -- "$LOCK/$OWNER"
    rmdir "$LOCK"
    printf 'LOCK RELEASED: %s\n' "$OWNER"
    ;;
  status)
    if [ -d "$LOCK" ]; then
      printf 'LOCKED\n'
      for FILE in "$LOCK"/*; do
        [ -f "$FILE" ] || continue
        IFS= read -r STARTED < "$FILE" || STARTED=unknown
        printf 'OWNER %s; acquired %s\n' "${FILE##*/}" "$STARTED"
      done
    else
      printf 'UNLOCKED\n'
    fi
    ;;
  *)
    printf 'Usage: %s acquire <run-id> [timeout-seconds] | release <run-id> | status\n' "$0" >&2
    exit 1
    ;;
esac
