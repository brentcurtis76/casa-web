#!/usr/bin/env bash
#
# selftest.sh — self-test de scripts/gates/changed-files-diagnostics.sh
#
#   bash scripts/gates/selftest.sh
#
# NO es un test de Vitest ni de Deno: no está registrado en ningún runner y no tiene
# script de npm. Se ejecuta por ruta.
#
# Por qué existe: tres rondas seguidas de P0 regresaron en el mismo bloque —el que
# decide si cada herramienta llegó a correr— y cada regresión solo se detectó con
# sondas manuales ad hoc. Este fichero commitea esas sondas. Cada caso fija un defecto
# concreto ya visto (ver la tabla del README).
#
# Cómo funciona: construye ejecutables `npx` y `deno` de mentira en un directorio
# temporal, los pone primero en PATH, corre el gate sobre un fichero real del repo y
# comprueba SU CÓDIGO DE SALIDA. Las herramientas reales nunca se ejecutan.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="$SCRIPT_DIR/changed-files-diagnostics.sh"
TARGET="scripts/gates/README.md"   # fichero real del repo; da igual cuál, no se analiza

STUBS=()
cleanup() { for d in "${STUBS[@]:-}"; do [ -n "$d" ] && rm -rf "$d"; done; }
trap cleanup EXIT

FAILURES=0

# PATH sin ningún directorio que contenga un `deno` ejecutable: es lo que hace que el
# caso 2 ("binario ausente") sea de verdad un `command not found` y no un stub.
path_without_deno() {
  local out="" d
  local -a parts
  IFS=':' read -ra parts <<< "$PATH"
  for d in "${parts[@]}"; do
    [ -n "$d" ] || continue
    [ -x "$d/deno" ] && continue
    out="${out:+$out:}$d"
  done
  printf '%s' "$out"
}

# make_stubs <con_deno: yes|no> -> imprime el directorio creado
make_stubs() {
  local with_deno="$1"
  local dir
  dir="$(mktemp -d)"
  STUBS+=("$dir")

  cat > "$dir/npx" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  tsc)    printf '%s' "${STUB_TSC_OUT:-}";    exit "${STUB_TSC_EXIT:-0}" ;;
  eslint) printf '%s' "${STUB_ESLINT_OUT:-}"; exit "${STUB_ESLINT_EXIT:-0}" ;;
esac
exit 0
EOF
  chmod +x "$dir/npx"

  if [ "$with_deno" = "yes" ]; then
    cat > "$dir/deno" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  lint)  printf '%s' "${STUB_DENOLINT_OUT:-}";  exit "${STUB_DENOLINT_EXIT:-0}" ;;
  check) printf '%s' "${STUB_DENOCHECK_OUT:-}"; exit "${STUB_DENOCHECK_EXIT:-0}" ;;
esac
exit 0
EOF
    chmod +x "$dir/deno"
  fi

  printf '%s' "$dir"
}

# run_case <n> <descripción> <esperado> <con_deno> — el resto de la config va por env
run_case() {
  local n="$1" desc="$2" expected="$3" with_deno="$4"
  local dir base_path actual
  dir="$(make_stubs "$with_deno")"
  if [ "$with_deno" = "yes" ]; then base_path="$PATH"; else base_path="$(path_without_deno)"; fi

  PATH="$dir:$base_path" bash "$GATE" "$TARGET" >/dev/null 2>&1
  actual=$?

  if [ "$actual" = "$expected" ]; then
    printf 'OK    caso %s — %s (exit %s)\n' "$n" "$desc" "$actual"
  else
    printf 'FALLO caso %s — %s (esperado exit %s, obtenido %s)\n' "$n" "$desc" "$expected" "$actual"
    FAILURES=$((FAILURES + 1))
  fi
}

CLEAN_ESLINT='[]'
CLEAN_DENOLINT='{"version":1,"diagnostics":[]}'

# Config por defecto: las cuatro herramientas limpias y con éxito. Cada caso solo
# altera lo suyo, de modo que el fallo esperado tenga una única causa.
reset_env() {
  export STUB_TSC_OUT=""        STUB_TSC_EXIT=0
  export STUB_ESLINT_OUT="$CLEAN_ESLINT"      STUB_ESLINT_EXIT=0
  export STUB_DENOLINT_OUT="$CLEAN_DENOLINT"  STUB_DENOLINT_EXIT=0
  export STUB_DENOCHECK_OUT=""  STUB_DENOCHECK_EXIT=0
}

# 1 — ejecución genuinamente limpia. Hallazgo BLOCKING de Codex en la ronda 2: cuatro
#     herramientas con salida válida y vacía NO son cuatro herramientas caídas.
reset_env
run_case 1 "las cuatro herramientas limpias y con éxito" 0 yes

# 2 — binario `deno` ausente. Hallazgo de la ronda 1: sin comprobación, el gate
#     imprimía ceros y salía 0 con la cadena de herramientas rota.
reset_env
run_case 2 "el binario deno no existe" 1 no

# 3 — ESLint imprime algo que no es JSON.
reset_env
export STUB_ESLINT_OUT='not json'
run_case 3 "eslint imprime texto no parseable, exit 0" 1 yes

# 4, 5, 6 — el falso negativo de la ronda 3: para las herramientas JSON, la forma de la
#     salida suplantaba al código de salida capturado. `deno lint` ni siquiera se
#     consultaba, y de ESLint solo se rechazaba > 1.
reset_env
export STUB_DENOLINT_EXIT=127
run_case 4 "deno lint con JSON válido vacío pero exit 127" 1 yes

reset_env
export STUB_ESLINT_EXIT=1
run_case 5 "eslint con [] pero exit 1" 1 yes

reset_env
export STUB_DENOLINT_EXIT=1
run_case 6 "deno lint con JSON válido vacío pero exit 1" 1 yes

# 7 — JSON válido con forma inesperada.
reset_env
export STUB_ESLINT_OUT='{}'
run_case 7 "eslint con JSON válido de forma incorrecta, exit 0" 1 yes

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "selftest: 7/7 OK"
  exit 0
fi
echo "selftest: $FAILURES caso(s) en FALLO"
exit 1
