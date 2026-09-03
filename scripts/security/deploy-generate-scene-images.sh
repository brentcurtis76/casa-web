#!/usr/bin/env bash
# =============================================================================
# CASA-only deployment guard for the generate-scene-images Edge Function.
#
# The deployment source is ANCHORED to this repository: the script resolves the
# repository root from its own location (BASH_SOURCE, canonical paths) and never
# trusts the caller's working directory. The function may be deployed ONLY to the
# CASA Supabase project (ref mulsqxfhxxdsadxsljss); the unrelated FNE project
# (ref sxlogxqzmarhqsblxmtj) and every other project are refused.
#
# Usage:
#   scripts/security/deploy-generate-scene-images.sh --check     # verify only (default; no deploy)
#   scripts/security/deploy-generate-scene-images.sh --dry-run   # print the exact deploy command
#   scripts/security/deploy-generate-scene-images.sh --deploy    # run `supabase functions deploy` for CASA
#
# Environment:
#   SUPABASE_DIR           --check / --dry-run only: alternate directory holding config.toml
#                          (used by the test-suite with fixtures). With --deploy it is REFUSED.
#   SUPABASE_PROJECT_REF   if set, must equal the CASA ref.
#
# Exit codes: 0 ok · 2 project is not CASA · 3 project is FNE (explicit deny)
#             4 forbidden argument · 5 verify_jwt misconfigured · 6 source/function files invalid
# =============================================================================
set -euo pipefail

FUNCTION_NAME="generate-scene-images"
CASA_PROJECT_REF="mulsqxfhxxdsadxsljss"
FNE_PROJECT_REF="sxlogxqzmarhqsblxmtj"

refuse() { local code="$1"; shift; echo "DEPLOY GUARD REFUSED [$FUNCTION_NAME]: $*" >&2; exit "$code"; }

canonical_dir() { (cd "$1" 2>/dev/null && pwd -P) || return 1; }

# ── Anchor: repository root derived from this script's own canonical location ──
SCRIPT_DIR="$(canonical_dir "$(dirname "${BASH_SOURCE[0]}")")" || refuse 6 "cannot resolve the script directory"
REPO_ROOT="$(canonical_dir "$SCRIPT_DIR/../..")" || refuse 6 "cannot resolve the repository root"
CANONICAL_SUPABASE_DIR="$REPO_ROOT/supabase"
[ -f "$REPO_ROOT/package.json" ] && [ -d "$CANONICAL_SUPABASE_DIR" ] || refuse 6 "anchored repository root '$REPO_ROOT' does not look like the CASA repository"

MODE="check"
for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --dry-run) MODE="dry-run" ;;
    --deploy) MODE="deploy" ;;
    --no-verify-jwt) refuse 4 "--no-verify-jwt is never allowed for this function" ;;
    *) refuse 4 "unknown argument '$arg' (allowed: --check, --dry-run, --deploy)" ;;
  esac
done

# ── Source directory: canonical repository supabase/ for deploy; fixtures allowed for checks ──
if [ "$MODE" = "deploy" ]; then
  if [ -n "${SUPABASE_DIR:-}" ]; then
    refuse 6 "SUPABASE_DIR is not allowed with --deploy; the deployment source is fixed to $CANONICAL_SUPABASE_DIR"
  fi
  SOURCE_DIR="$CANONICAL_SUPABASE_DIR"
else
  SOURCE_DIR="$(canonical_dir "${SUPABASE_DIR:-$CANONICAL_SUPABASE_DIR}")" || refuse 6 "SUPABASE_DIR does not resolve to a directory"
fi

check_ref() {
  local source="$1" ref="$2"
  if [ "$ref" = "$FNE_PROJECT_REF" ]; then
    refuse 3 "$source resolves to the FNE project; this CASA function must never target FNE"
  fi
  if [ "$ref" != "$CASA_PROJECT_REF" ]; then
    refuse 2 "$source resolves to project '$ref', not the CASA project '$CASA_PROJECT_REF'"
  fi
}

# verify_jwt value inside a [functions.<name>] block of a TOML file ("" when absent)
read_verify_jwt() {
  local file="$1"
  awk -v header="[functions.$FUNCTION_NAME]" '
    $0 == header { inblock = 1; next }
    /^[[:space:]]*\[/ { inblock = 0 }
    inblock && $1 == "verify_jwt" { gsub(/[[:space:]]/, "", $0); sub(/^verify_jwt=/, "", $0); print; exit }
  ' "$file"
}

CONFIG_FILE="$SOURCE_DIR/config.toml"
[ -f "$CONFIG_FILE" ] || refuse 6 "missing $CONFIG_FILE"

CONFIG_REF="$(awk -F'"' '/^[[:space:]]*project_id[[:space:]]*=/ { print $2; exit }' "$CONFIG_FILE")"
[ -n "$CONFIG_REF" ] || refuse 6 "no project_id found in $CONFIG_FILE"
check_ref "$CONFIG_FILE project_id" "$CONFIG_REF"

if [ -f "$SOURCE_DIR/.temp/project-ref" ]; then
  LINKED_REF="$(tr -d '[:space:]' < "$SOURCE_DIR/.temp/project-ref")"
  check_ref "linked project ($SOURCE_DIR/.temp/project-ref)" "$LINKED_REF"
fi

if [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  check_ref "environment SUPABASE_PROJECT_REF" "$SUPABASE_PROJECT_REF"
fi

FUNCTION_DIR="$SOURCE_DIR/functions/$FUNCTION_NAME"
[ -f "$FUNCTION_DIR/index.ts" ] || refuse 6 "missing $FUNCTION_DIR/index.ts"
FUNCTION_DIR_CANONICAL="$(canonical_dir "$FUNCTION_DIR")" || refuse 6 "cannot resolve $FUNCTION_DIR"
case "$FUNCTION_DIR_CANONICAL" in
  "$SOURCE_DIR"/functions/*) ;;
  *) refuse 6 "function directory escapes the source directory (symlink?): $FUNCTION_DIR_CANONICAL" ;;
esac

ROOT_VERIFY="$(read_verify_jwt "$CONFIG_FILE")"
[ "$ROOT_VERIFY" = "true" ] || refuse 5 "$CONFIG_FILE must set verify_jwt = true under [functions.$FUNCTION_NAME] (found: '${ROOT_VERIFY:-unset}')"

if [ -f "$FUNCTION_DIR/config.toml" ]; then
  FN_VERIFY="$(read_verify_jwt "$FUNCTION_DIR/config.toml")"
  if [ -n "$FN_VERIFY" ] && [ "$FN_VERIFY" != "true" ]; then
    refuse 5 "$FUNCTION_DIR/config.toml sets verify_jwt = $FN_VERIFY; it must be true"
  fi
fi

DEPLOY_CMD=(supabase functions deploy "$FUNCTION_NAME" --project-ref "$CASA_PROJECT_REF" --workdir "$REPO_ROOT")

echo "OK: $FUNCTION_NAME source=$FUNCTION_DIR_CANONICAL project=$CASA_PROJECT_REF (config project_id=$CONFIG_REF, verify_jwt=true)"
case "$MODE" in
  check) exit 0 ;;
  dry-run)
    echo "DRY RUN (cwd would be $REPO_ROOT): ${DEPLOY_CMD[*]}"
    exit 0
    ;;
  deploy)
    [ "$SOURCE_DIR" = "$CANONICAL_SUPABASE_DIR" ] || refuse 6 "deployment source must be $CANONICAL_SUPABASE_DIR"
    command -v supabase >/dev/null 2>&1 || refuse 6 "supabase CLI not found"
    cd "$REPO_ROOT"
    echo "Deploying from $REPO_ROOT: ${DEPLOY_CMD[*]}"
    exec "${DEPLOY_CMD[@]}"
    ;;
esac
