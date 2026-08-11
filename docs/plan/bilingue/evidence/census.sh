#!/bin/bash
# CASA BILINGUE locked census implementation. D1a runs this file only to verify file selection;
# no run output is recorded in any D1a artifact.
# SOURCE_SHA=e0c9342edcd1d9eddea0662244bf1934bfdb5cb0
# PLAN_SHA=c842161d0edcba560a077fdb81b31edad2f23396
# TARGET_OS=macOS Darwin 24.3.0
# TARGET_LOCALE=en_US.UTF-8
# BLIND_SPOT=Static frozen roots and lexical markers cannot prove complete surface coverage.
# EXTENSION_RULE=Commit and review a new method before collecting evidence with it.

set -euo pipefail
export LC_ALL=en_US.UTF-8

GIT=/usr/bin/git
FIND=/usr/bin/find
SORT=/usr/bin/sort
GREP=/usr/bin/grep
WC=/usr/bin/wc
AWK=/usr/bin/awk

SOURCE_SHA=e0c9342edcd1d9eddea0662244bf1934bfdb5cb0
WORDLIST=docs/plan/bilingue/evidence/wordlist-passB.txt
ACCENT='[áéíóúñüÁÉÍÓÚÑÜ¿¡]'
COMMENT='^[[:space:]]*(//|\*|/\*)'
FILE_ERE='.*\.(ts|tsx|json)$'
ORPHAN_ERE='.* [0-9]\.(ts|tsx)'
TEST_PATH_ERE='(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$'
REFERRER_ROOTS=(src supabase)

PASS_A_ROOTS=(
  src/components/liturgia-builder
  src/components/liturgia
  src/lib/liturgia
  src/pages/ConstructorLiturgiasPage.tsx
  src/data/elementos-fijos
  src/components/presentation
  src/lib/presentation
  src/hooks/presentation
  src/lib/cuentacuentos
  src/lib/children-ministry
  src/lib/music-planning
  src/types/shared/liturgy.ts
  supabase/functions/generate-story
  supabase/functions/refine-story
  supabase/functions/generate-oraciones
  supabase/functions/generate-children-lesson
  supabase/functions/refine-children-lesson
  supabase/functions/fetch-bible-passage
  supabase/functions/process-reflexion-pdf
  supabase/functions/send-children-service-packet
  supabase/functions/send-music-service-packet
  supabase/functions/wa-send
  supabase/functions/wa-reminders
  supabase/functions/_shared/whatsapp
)

PASS_B_ROOTS=("${PASS_A_ROOTS[@]}" src/lib/whatsapp)

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ "$($GIT rev-parse --show-toplevel)" == "$PWD" ]] || fail 'run from the repository root'
[[ -r "$WORDLIST" ]] || fail "missing word list: $WORDLIST"
[[ -z "$($GIT status --porcelain --untracked-files=normal -- src supabase)" ]] \
  || fail 'source tree is not clean'
$GIT diff --quiet "$SOURCE_SHA" -- src supabase \
  || fail "source tree differs from $SOURCE_SHA"

for root in "${PASS_B_ROOTS[@]}"; do
  [[ -e "$root" ]] || fail "missing configured root: $root"
done

WORDS=
while IFS= read -r word || [[ -n "$word" ]]; do
  [[ -z "$word" || "$word" == \#* ]] && continue
  if [[ -z "$WORDS" ]]; then
    WORDS=$word
  else
    WORDS="$WORDS|$word"
  fi
done < "$WORDLIST"
[[ -n "$WORDS" ]] || fail 'word list has no entries'
WORD_PATTERN="\\b($WORDS)\\b"

# A .json inside the roots is test evidence when every file that names it is a test file.
# The rule is who-refers-to-it, not what-it-is-called: a captured baseline follows no naming
# convention, so no name predicate can reach it. A .json that no module names at all is kept,
# because the safe direction of this rule is to include.
json_is_test_evidence() {
  local file=$1
  local base referrers
  base=${file##*/}
  referrers=$("$GREP" -rlF --include='*.ts' --include='*.tsx' -- "$base" "${REFERRER_ROOTS[@]}" \
    | "$SORT" -u || true)
  [[ -n "$referrers" ]] || return 1
  if printf '%s\n' "$referrers" | "$GREP" -qvE "$TEST_PATH_ERE"; then
    return 1
  fi
  return 0
}

name_selected() {
  "$FIND" -E "$@" -type f -regex "$FILE_ERE" \
    -not -path '*__tests__*' -not -name '*.test.*' -not -name '*_test.*' \
    -not -regex "$ORPHAN_ERE" \
    | "$SORT" -u
}

PASS_A_FILES=()
while IFS= read -r file; do
  if [[ "$file" == *.json ]] && json_is_test_evidence "$file"; then
    continue
  fi
  PASS_A_FILES+=("$file")
done < <(name_selected "${PASS_A_ROOTS[@]}")

PASS_B_FILES=()
while IFS= read -r file; do
  if [[ "$file" == *.json ]] && json_is_test_evidence "$file"; then
    continue
  fi
  PASS_B_FILES+=("$file")
done < <(name_selected "${PASS_B_ROOTS[@]}")

count_pattern() {
  local file=$1
  local pattern=$2
  local value
  if [[ "$file" == *.json ]]; then
    value=$("$GREP" -E "$pattern" "$file" | "$WC" -l | "$AWK" '{print $1}' || true)
  else
    value=$("$GREP" -E "$pattern" "$file" | "$GREP" -vE "$COMMENT" \
      | "$WC" -l | "$AWK" '{print $1}' || true)
  fi
  printf '%s' "${value:-0}"
}

count_pattern_without_accent() {
  local file=$1
  local pattern=$2
  local value
  if [[ "$file" == *.json ]]; then
    value=$("$GREP" -E "$pattern" "$file" | "$GREP" -vE "$ACCENT" \
      | "$WC" -l | "$AWK" '{print $1}' || true)
  else
    value=$("$GREP" -E "$pattern" "$file" | "$GREP" -vE "$COMMENT" \
      | "$GREP" -vE "$ACCENT" | "$WC" -l | "$AWK" '{print $1}' || true)
  fi
  printf '%s' "${value:-0}"
}

run_pass_a() {
  local hits=0
  local file file_hits
  for file in "${PASS_A_FILES[@]}"; do
    file_hits=$(count_pattern "$file" "$ACCENT")
    hits=$((hits + file_hits))
    printf 'PASS_A\t%s\thits=%s\n' "$file" "$file_hits"
  done
  printf 'PASS_A_SUMMARY\tfiles=%s\thits=%s\n' "${#PASS_A_FILES[@]}" "$hits"
}

run_pass_b() {
  local hits=0
  local no_accent_hits=0
  local file file_hits file_no_accent_hits
  for file in "${PASS_B_FILES[@]}"; do
    file_hits=$(count_pattern "$file" "$WORD_PATTERN")
    file_no_accent_hits=$(count_pattern_without_accent "$file" "$WORD_PATTERN")
    hits=$((hits + file_hits))
    no_accent_hits=$((no_accent_hits + file_no_accent_hits))
    printf 'PASS_B\t%s\thits=%s\tno_accent_hits=%s\n' \
      "$file" "$file_hits" "$file_no_accent_hits"
  done
  printf 'PASS_B_SUMMARY\tfiles=%s\thits=%s\tno_accent_hits=%s\n' \
    "${#PASS_B_FILES[@]}" "$hits" "$no_accent_hits"
}

run_pass_a
run_pass_b
