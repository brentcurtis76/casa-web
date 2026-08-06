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
( cd "$ROOT" && npx tsc -p tsconfig.app.json --noEmit ) \
  > "$WORK/tsc.txt" 2>&1

( cd "$ROOT" && npx eslint . -f json ) \
  > "$WORK/eslint.json" 2> "$WORK/eslint.err"

( cd "$ROOT/supabase/functions" && deno lint --json ) \
  > "$WORK/deno-lint.json" 2> "$WORK/deno-lint.err"

( cd "$ROOT/supabase/functions" && deno check . ) \
  > "$WORK/deno-check.txt" 2>&1

# --- 2. Atribuir y emitir --------------------------------------------------------
node -e '
const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

const [root, work, ...files] = process.argv.slice(1);

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const read = (f) => { try { return stripAnsi(fs.readFileSync(path.join(work, f), "utf8")); } catch { return ""; } };
const rel = (p) => path.relative(root, p).split(path.sep).join("/");

// Recuento GLOBAL por herramienta (todo el proyecto, no solo los ficheros pedidos)
// y errores de parseo. Se usan para detectar que una herramienta no llegó a correr.
const totals = { "tsc": 0, "eslint": 0, "deno lint": 0, "deno check": 0 };
const parseErrors = new Map();
const readJson = (f, tool) => {
  try { return JSON.parse(read(f)); }
  catch (e) { parseErrors.set(tool, e.message); return null; }
};

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
  const results = readJson("eslint.json", "eslint") || [];
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

// --- la herramienta no corrió ------------------------------------------------------
// Las cuatro tienen una base grande y distinta de cero en este repo, y arreglarla es un
// no-objetivo declarado del workstream. Un cero GLOBAL no significa que el repo se
// limpió: significa que la herramienta no llegó a producir diagnósticos. Sin esto el
// gate devuelve todo ceros y "cero diagnósticos nuevos" se cumple trivialmente.
const failed = TOOLS.filter((t) => parseErrors.has(t) || totals[t] === 0);
if (failed.length > 0) {
  for (const t of failed) {
    const why = parseErrors.has(t)
      ? "salida no parseable (" + parseErrors.get(t) + ")"
      : "cero diagnósticos en TODO el proyecto";
    process.stderr.write("[gates] FALLO: " + LABEL[t] + " no produjo resultados utilizables — " + why + ".\n");
    const captured = read(ERRSRC[t]).split("\n").filter((l) => l.trim() !== "");
    const shown = captured.slice(0, 20);
    if (shown.length === 0) process.stderr.write("[gates]   stderr de " + LABEL[t] + ": (vacío)\n");
    for (const l of shown) process.stderr.write("[gates]   " + LABEL[t] + "> " + l + "\n");
    if (captured.length > shown.length) {
      process.stderr.write("[gates]   " + LABEL[t] + "> … (" + (captured.length - shown.length) + " líneas más)\n");
    }
  }
  process.stderr.write("[gates] La línea base de este repo es tsc=1041 eslint=160 deno-lint=94 deno-check=46 y\n");
  process.stderr.write("[gates] arreglarla es un no-objetivo del workstream UPGRADE: un cero global significa que\n");
  process.stderr.write("[gates] la herramienta no corrió, nunca que el repo se limpió. Ver scripts/gates/README.md.\n");
  // exitCode y no exit(): stdout puede ser una tubería y exit() la truncaría.
  process.exitCode = 1;
}
' "$ROOT" "$WORK" "$@"
