#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Generate a contacts import CSV for prod/staging smoke tests.

Uses Gmail-style plus addressing so every import lands in the same inbox
but stays a distinct contact in Merlin (e.g. diego+123@gmail.com).

Usage:
  ./scripts/generate-import-csv.sh --email diego@gmail.com --suffix 123
  yarn generate:import-csv --email diego@gmail.com --suffix 123

Options:
  --email       Base inbox (required), e.g. diego@gmail.com
  --suffix      Plus-tag label (default: test-<unix-ts>)
  --count       Rows to generate (default: 1). Adds -1, -2, … when count > 1
  --subscribed  true|false (default: true)
  --first-name  firstName column value (default: Test)
  --output      Output path (default: contacts-import-<suffix>.csv)
  -h, --help    Show this help
EOF
}

EMAIL=""
SUFFIX=""
COUNT=1
SUBSCRIBED="true"
FIRST_NAME="Test"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --suffix)
      SUFFIX="${2:-}"
      shift 2
      ;;
    --count)
      COUNT="${2:-}"
      shift 2
      ;;
    --subscribed)
      SUBSCRIBED="${2:-}"
      shift 2
      ;;
    --first-name)
      FIRST_NAME="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$EMAIL" ]]; then
  echo "error: --email is required" >&2
  usage >&2
  exit 1
fi

if [[ ! "$EMAIL" =~ ^[^@+]+@[^@]+$ ]]; then
  echo "error: --email must be a plain address without '+' (e.g. diego@gmail.com)" >&2
  exit 1
fi

if [[ ! "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "error: --count must be a positive integer" >&2
  exit 1
fi

if [[ "$SUBSCRIBED" != "true" && "$SUBSCRIBED" != "false" ]]; then
  echo "error: --subscribed must be true or false" >&2
  exit 1
fi

if [[ -z "$SUFFIX" ]]; then
  SUFFIX="test-$(date +%s)"
fi

LOCAL_PART="${EMAIL%%@*}"
DOMAIN="${EMAIL#*@}"

plus_email() {
  local tag="$1"
  printf '%s+%s@%s' "$LOCAL_PART" "$tag" "$DOMAIN"
}

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="contacts-import-${SUFFIX}.csv"
fi

{
  printf '%s\n' "email,firstName,subscribed"
  for ((i = 1; i <= COUNT; i++)); do
    if [[ "$COUNT" -eq 1 ]]; then
      tag="$SUFFIX"
      name="$FIRST_NAME"
    else
      tag="${SUFFIX}-${i}"
      name="${FIRST_NAME} ${i}"
    fi
    printf '%s,%s,%s\n' "$(plus_email "$tag")" "$name" "$SUBSCRIBED"
  done
} >"$OUTPUT"

echo "Wrote $COUNT row(s) to $OUTPUT"
if [[ "$COUNT" -eq 1 ]]; then
  echo "Primary test address: $(plus_email "$SUFFIX")"
else
  echo "Addresses: $(plus_email "${SUFFIX}-1") … $(plus_email "${SUFFIX}-${COUNT}")"
fi
