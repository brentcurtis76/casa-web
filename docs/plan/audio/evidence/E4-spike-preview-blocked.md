# EVIDENCIA — el método de `E4-spike` está refutado: los previews de Vercel exigen SSO

**Tomada por el PM en el bootstrap de `E4-spike` (2026-08-12), en la pasada de falsificación de
contrato que el overlay exige para las fases que no son `STANDARD`.**

No es una fase ejecutada. Es la medición que impidió despachar un contrato inviable.

---

## La claim que se cayó

```text
CLAIM:         E4s.5 se comprueba desplegando el prototipo en un preview de Vercel y
               pasando esa URL por WhatsApp y Facebook.
COUNTEREXAMPLE: si el preview está protegido, el crawler recibe un redirect a login y
               nunca ve el HTML — el criterio sería incomprobable por construcción.
CHECK:         curl sin credenciales contra los dos previews más recientes del proyecto,
               y otra vez con el user-agent de Facebook.
RESULT:        REFUTED
```

## La salida cruda

```
$ curl -o /dev/null -w "%{http_code}  %{content_type}  %{url}\n" \
    https://casa-84h1sm85t-brent-curtis-projects.vercel.app/reflexiones
302  text/plain  https://casa-84h1sm85t-brent-curtis-projects.vercel.app

$ curl ... https://casa-a4an0u2fo-brent-curtis-projects.vercel.app/reflexiones
302  text/plain  https://casa-a4an0u2fo-brent-curtis-projects.vercel.app
```

Con el user-agent real del crawler de Facebook, **exactamente lo mismo**:

```
$ curl -A 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' \
    https://casa-84h1sm85t-brent-curtis-projects.vercel.app/reflexiones
status=302 type=text/plain
```

A dónde redirige:

```
$ curl -I https://casa-84h1sm85t-brent-curtis-projects.vercel.app/
HTTP/2 302
location: https://vercel.com/sso-api?url=https%3A%2F%2Fcasa-84h1sm85t-brent-curtis-projects.vercel.app%2F&nonce=8ca26b…
set-cookie: _vercel_sso_nonce=…; Max-Age=3600; Path=/; Secure; HttpOnly; SameSite=Lax
x-vercel-id: gru1::kdq4l-1786542829310-af9b84ee4a04
```

**Vercel Deployment Protection está activa en los previews de `casa-web`.** Ni WhatsApp ni
Facebook pueden leer un preview protegido: no tienen sesión de Vercel y no la van a tener.

## Decisión de Brent (2026-08-12)

Ante las tres salidas —proyecto Vercel desechable, apagar la protección de `casa-web`, o token de
bypass en el query string— **Brent eligió el proyecto desechable**. Queda como **D25** en el PLAN.

Lo que se descartó y por qué queda escrito, porque el bloque de `E4-spike` tiene que justificar su
arquitectura contra las alternativas:

- **Apagar la protección de `casa-web`** haría públicos *todos* los previews futuros del sitio
  real, incluidos los de trabajo sin publicar. Es un cambio de seguridad a nivel de proyecto para
  conveniencia de un spike.
- **Token de bypass en el query string** (`?x-vercel-protection-bypass=…`) mete un secreto en la
  URL que se comparte, y hace divergir la URL buscada de `og:url`/`canonical`, que es justo lo que
  el spike mide. Además el comportamiento de los crawlers con ese parámetro **no está verificado**:
  el spike podría fallar por el andamio y no por la arquitectura.

## Credenciales de despliegue — la precondición de la fase, verificada

La fase declaraba (Codex r8/S4) que sin credenciales de Vercel reporta `BLOCKED`. Medido:

```
$ vercel whoami
brentcurtis76

$ vercel project ls | grep casa-web
casa-web   https://casa-web-ebon.vercel.app   4m   22.x

$ vercel project inspect casa-web
ID                 prj_QkXgT1iWKGf9KjMx4FubidffUQ2F
Framework Preset   Vite
Node.js Version    22.x
```

**Hay credenciales.** Lo que falta no son credenciales: es una URL que un crawler pueda leer y un
episodio que previsualizar.

`vercel env ls` **no se pudo ejecutar**: `Error: Your codebase isn't linked to a project on Vercel`
(no existe `.vercel/`). No lo enlacé — escribir `.vercel/project.json` no es un artefacto de
planificación. **Queda como punto ciego declarado:** no sé qué `VITE_SUPABASE_URL` reciben los
previews. Por el código, `src/integrations/supabase/client.ts:5-6` cae al proyecto de producción
hardcodeado cuando la variable no está, así que **la hipótesis por defecto es que los previews
hablan con la base de producción**. El ejecutor de `E4-spike` lo mide antes de confiar en ello.

---

## Lo demás que la falsificación encontró en el borrador de `E4-spike`

### El problema base sigue en pie, y ahora está medido en producción

```
$ curl -o /dev/null -w 'status=%{http_code}\n' -L \
    https://www.anglicanasanandres.cl/reflexiones/slug-que-no-existe-xyz
status=200

$ curl -L https://www.anglicanasanandres.cl/reflexiones/slug-que-no-existe-xyz | grep -E 'og:|canonical|<title>'
    <title>CASA - Comunidad Anglicana San Andrés</title>
    <meta property="og:title" content="CASA - Comunidad Anglicana San Andrés" />
    <meta property="og:url" content="https://anglicanasanandres.cl" />
    <link rel="canonical" href="https://anglicanasanandres.cl" />
```

Confirma dos criterios del borrador sobre el entorno real: **E4s.7** (un slug inexistente devuelve
`200`, no `404`) y el diagnóstico de que toda ruta recibe el mismo HTML genérico.

`vercel.json` en `db8ed2e`, verificado: un solo rewrite `"/(.*)"` → `"/index.html"`,
`framework: vite`, y **no existe directorio `api/`** en `main` (`git ls-tree -r main | grep '^api/'`
→ vacío). Así que **A10a.1 sigue sin medir**: que este proyecto Vite admita funciones serverless
es una incógnita, no un hecho heredado.

### El recuento de "12 etiquetas" de E4s.4 se queda corto

Medido sobre `main:index.html` (94 líneas):

```
$ git show main:index.html | grep -c 'property="og:'      → 6
$ git show main:index.html | grep -c 'name="twitter:'     → 5
$ git show main:index.html | grep -c 'application/ld+json'→ 1
                                                    total = 12  ✓
```

El 12 es correcto **para lo que cuenta**. Pero fuera de esas 12 hay etiquetas igual de genéricas
que el spike **también** tiene que reemplazar, porque E4s.2 exige título y canonical por episodio:

```
7:  <title>CASA - Comunidad Anglicana San Andrés</title>
8:  <meta name="description" content="CASA es una comunidad anglicana inclusiva…" />
28: <link rel="canonical" href="https://anglicanasanandres.cl" />
```

**Son 15, no 12.** El criterio se corrige en el PLAN.

### `index.html` contradice a D19

`og:url` (`:17`) y `canonical` (`:28`) apuntan al **apex** `https://anglicanasanandres.cl`.
**D19 congela el origen canónico en `https://www.anglicanasanandres.cl`**, y el código de
`E3a`/`E3b` ya lo respeta:

```
$ git grep -n CANONICAL_ORIGIN main -- src/
main:src/lib/sermon-editor/publishService.ts:20:
  export const CANONICAL_ORIGIN = 'https://www.anglicanasanandres.cl';
```

Y la r2 del plan ya midió que el apex responde **307 → www**. Así que el HTML estático emite hoy
una canonical que redirige a otro host. `E4-spike` hereda arreglarlo, y se añade como criterio.
