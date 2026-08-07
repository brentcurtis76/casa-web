#!/usr/bin/env bash
#
# changed-files-diagnostics.sh — gate D8 de docs/plan/upgrade/PLAN.md
#
#   scripts/gates/changed-files-diagnostics.sh <fichero> [<fichero> ...]
#
# Emite, por cada fichero pedido y en el orden pedido, los diagnósticos crudos de
# tsc, ESLint, `deno lint` y `deno check` atribuibles a ese fichero, con su recuento.
#
# NO canonicaliza, NO agrupa, NO hashea: la salida es el mensaje crudo filtrado por
# ruta. Ver scripts/gates/README.md.
#
# Los cuatro comandos salen con código != 0 cuando encuentran problemas (en este repo
# siempre lo hacen), por eso NO hay `set -e`.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

if [ "$#" -eq 0 ]; then
  echo "uso: $0 <fichero> [<fichero> ...]   (rutas relativas a la raíz del repo)" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export NO_COLOR=1
export FORCE_COLOR=0

# --- 1. Ejecutar cada herramienta UNA vez sobre todo el proyecto -----------------
# El código de salida de cada frontera de comando se captura aquí: es una de las
# señales con las que el paso 2 distingue "ejecución limpia" de "la herramienta no
# corrió". Ver el bloque de clasificación al final y scripts/gates/README.md.
( cd "$ROOT" && npx tsc -p tsconfig.app.json --noEmit ) \
  > "$WORK/tsc.txt" 2>&1
echo $? > "$WORK/tsc.exit"

( cd "$ROOT" && npx eslint . -f json ) \
  > "$WORK/eslint.json" 2> "$WORK/eslint.err"
echo $? > "$WORK/eslint.exit"

( cd "$ROOT/supabase/functions" && deno lint --json ) \
  > "$WORK/deno-lint.json" 2> "$WORK/deno-lint.err"
echo $? > "$WORK/deno-lint.exit"

( cd "$ROOT/supabase/functions" && deno check . ) \
  > "$WORK/deno-check.txt" 2>&1
echo $? > "$WORK/deno-check.exit"

# --- 2. Atribuir y emitir --------------------------------------------------------
node -e '
const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

const [root, work, ...files] = process.argv.slice(1);

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const read = (f) => { try { return stripAnsi(fs.readFileSync(path.join(work, f), "utf8")); } catch { return ""; } };
const rel = (p) => path.relative(root, p).split(path.sep).join("/");

// Recuento GLOBAL por herramienta (todo el proyecto, no solo los ficheros pedidos):
// la observación de D8 punto 5, que se emite por stderr. NO es criterio de aprobación.
// Los errores de parseo y la forma del JSON sí lo son: alimentan la clasificación
// "¿corrió cada herramienta?" del final, junto con los códigos de salida capturados.
const totals = { "tsc": 0, "eslint": 0, "deno lint": 0, "deno check": 0 };
const parseErrors = new Map();
const readJson = (f, tool) => {
  try { return JSON.parse(read(f)); }
  catch (e) { parseErrors.set(tool, e.message); return null; }
};
const exitOf = (f) => { const s = read(f).trim(); return s === "" ? -1 : parseInt(s, 10); };
const exits = {
  "tsc": exitOf("tsc.exit"),
  "eslint": exitOf("eslint.exit"),
  "deno lint": exitOf("deno-lint.exit"),
  "deno check": exitOf("deno-check.exit"),
};
const shapeOk = new Map();

// buckets: rel path -> tool -> [diagnostic (array of lines)]
const buckets = new Map();
const put = (file, tool, lines) => {
  totals[tool] += 1;
  if (!buckets.has(file)) buckets.set(file, {});
  const b = buckets.get(file);
  (b[tool] = b[tool] || []).push(lines);
};

// --- tsc: cabecera "ruta(l,c): error TSxxxx: msg" + líneas indentadas de continuación
{
  const head = /^(\S.*?)\((\d+),(\d+)\): error TS\d+:/;
  let cur = null, curFile = null;
  const flush = () => { if (cur && curFile) put(curFile, "tsc", cur); cur = null; curFile = null; };
  for (const line of read("tsc.txt").split("\n")) {
    const m = line.match(head);
    if (m) { flush(); curFile = m[1]; cur = [line]; }
    else if (cur && /^\s/.test(line) && line.trim() !== "") cur.push(line);
    else if (line.trim() === "") continue;
    else if (cur) cur.push(line);
  }
  flush();
}

// --- ESLint: JSON, filePath ABSOLUTO -> relativizar
{
  const parsed = readJson("eslint.json", "eslint");
  shapeOk.set("eslint", Array.isArray(parsed));
  const results = Array.isArray(parsed) ? parsed : [];
  for (const r of results) {
    const f = rel(r.filePath);
    for (const m of r.messages) {
      const sev = m.severity === 2 ? "error" : "warning";
      const rule = m.ruleId || "(fatal)";
      const msg = String(m.message).replace(/\s*\n\s*/g, " ");
      put(f, "eslint", [`${f}(${m.line},${m.column}): ${sev} ${rule}: ${msg}`]);
    }
  }
}

// --- deno lint: JSON, filename es una URL file://
{
  const data = readJson("deno-lint.json", "deno lint");
  shapeOk.set("deno lint", !!data && Array.isArray(data.diagnostics));
  for (const d of (data && data.diagnostics) || []) {
    const f = rel(fileURLToPath(d.filename));
    const msg = String(d.message).replace(/\s*\n\s*/g, " ");
    put(f, "deno lint", [`${f}(${d.range.start.line},${d.range.start.col}): ${d.code}: ${msg}`]);
  }
}

// --- deno check: texto multilínea. Bloque = desde "TSxxxx [ERROR]:" hasta su
//     primera línea "    at file:///…:l:c" (inclusive), que es la que da el fichero.
{
  let cur = null;
  for (const line of read("deno-check.txt").split("\n")) {
    if (/^TS\d+ \[[A-Z]+\]:/.test(line)) { cur = [line]; continue; }
    if (cur === null) continue;
    if (/^Check \S/.test(line)) continue;
    cur.push(line);
    const at = line.match(/^(\s+)at (file:\/\/\S+?):(\d+):(\d+)\s*$/);
    if (at) {
      const f = rel(fileURLToPath(at[2]));
      // La única normalización del script: la línea de localización trae la ruta
      // ABSOLUTA (y percent-encoded) del checkout. Se reescribe a ruta relativa al
      // repo para que la base tomada en un worktree sea comparable. El mensaje no
      // se toca. Ver README.
      cur[cur.length - 1] = `${at[1]}at ${f}:${at[3]}:${at[4]}`;
      put(f, "deno check", cur);
      cur = null;
    }
  }
}

// --- salida
const TOOLS = ["tsc", "eslint", "deno lint", "deno check"];
const out = [];
for (const f of files) {
  out.push(`=== ${f}`);
  const b = buckets.get(f) || {};
  for (const tool of TOOLS) {
    const diags = (b[tool] || []).map((lines) => lines.join("\n")).sort();
    out.push(`--- ${tool} (${diags.length})`);
    for (const d of diags) out.push(d);
  }
}
process.stdout.write(out.join("\n") + "\n");

// --- observación D8 punto 5: recuentos globales, SIEMPRE por stderr ---------------
// stdout es el artefacto que se difea entre el commit padre y la punta de la rama:
// meter los totales ahí inyectaría una línea de ruido en cada comparación e
// invalidaría la base ya commiteada. Por stderr son exactamente lo que pide D8: una
// observación para detectar sorpresas, no un criterio de aprobación.
const LABEL = { "tsc": "tsc", "eslint": "eslint", "deno lint": "deno-lint", "deno check": "deno-check" };
const ERRSRC = { "tsc": "tsc.txt", "eslint": "eslint.err", "deno lint": "deno-lint.err", "deno check": "deno-check.txt" };
process.stderr.write("[gates] totales del proyecto: " + TOOLS.map((t) => LABEL[t] + "=" + totals[t]).join(" ") + "\n");

// --- ¿corrió cada herramienta? -----------------------------------------------------
// Se clasifica cada frontera de comando sobre (código de salida, validez de la salida,
// recuento), NUNCA sobre el recuento global a solas: los totales son la observación de
// D8 punto 5, no un criterio, y una ejecución limpia con cero diagnósticos es legítima.
//
// - eslint / deno lint tienen modo JSON: la señal fuerte de que corrieron es que su
//   salida parsea a la forma esperada (array de resultados / objeto con .diagnostics).
//   Una lista vacía es una ejecución limpia. Binario ausente o crash => stdout vacío o
//   basura => el parseo o la forma fallan.
// - tsc / deno check no tienen modo JSON: salida 0 = limpio; salida != 0 con
//   diagnósticos atribuidos = rojo de base normal; salida != 0 SIN ningún diagnóstico
//   utilizable (127 binario ausente, crash, formato irreconocible) = caída.
const failWhy = new Map();
for (const t of ["tsc", "deno check"]) {
  if (exits[t] !== 0 && totals[t] === 0) {
    failWhy.set(t, "salió con código " + exits[t] + " sin producir ningún diagnóstico utilizable");
  }
}
for (const t of ["eslint", "deno lint"]) {
  if (parseErrors.has(t)) {
    failWhy.set(t, "salida no parseable (" + parseErrors.get(t) + ")");
  } else if (!shapeOk.get(t)) {
    failWhy.set(t, "JSON válido pero sin la forma esperada");
  } else if (t === "eslint" && exits[t] > 1) {
    failWhy.set(t, "salió con código " + exits[t] + " (fatal para ESLint, que usa 0/1)");
  }
}
if (failWhy.size > 0) {
  for (const [t, why] of failWhy) {
    process.stderr.write("[gates] FALLO: " + LABEL[t] + " no produjo resultados utilizables — " + why + ".\n");
    const captured = read(ERRSRC[t]).split("\n").filter((l) => l.trim() !== "");
    const shown = captured.slice(0, 20);
    if (shown.length === 0) process.stderr.write("[gates]   stderr de " + LABEL[t] + ": (vacío)\n");
    for (const l of shown) process.stderr.write("[gates]   " + LABEL[t] + "> " + l + "\n");
    if (captured.length > shown.length) {
      process.stderr.write("[gates]   " + LABEL[t] + "> … (" + (captured.length - shown.length) + " líneas más)\n");
    }
  }
  process.stderr.write("[gates] Una herramienta caída aprueba el gate en silencio: \"cero diagnósticos nuevos\"\n");
  process.stderr.write("[gates] se cumple trivialmente si la herramienta no llegó a correr. Ver scripts/gates/README.md.\n");
  // exitCode y no exit(): stdout puede ser una tubería y exit() la truncaría.
  process.exitCode = 1;
}
' "$ROOT" "$WORK" "$@"
