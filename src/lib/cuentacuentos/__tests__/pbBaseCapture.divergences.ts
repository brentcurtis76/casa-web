/**
 * PB / G6 — DIVERGENCIAS DECLARADAS respecto del comportamiento base 185c370.
 *
 * Cada entrada es case-local y dice tres cosas, tal como exige G6:
 *   - `oldValue`: el resultado que el fixture base capturó. El comparador
 *     verifica que el fixture SIGA conteniéndolo: si alguien tocara el fixture
 *     para tapar una diferencia, esta aserción se caería.
 *   - `newValue`: el resultado que PB EXIGE después del cambio.
 *   - `reason`: la regla de G2/G3/G4 que la autoriza.
 *
 * Todo lo que no esté acá debe coincidir con la base. Una diferencia no
 * declarada es un FINDING, no una divergencia.
 *
 * GUARDA CONTRA EL SELLO DE GOMA: declarar un `newValue` no basta. El
 * comparador corre además `assertNewValueInvariants` sobre CADA `newValue` de
 * `uploads`, verificando de forma INDEPENDIENTE de esta tabla que:
 *   - toda subida lleve `upsert:false`;
 *   - todo path termine en `_<32 hex>.<ext>` (direccionado por contenido);
 *   - ningún path conserve la forma posicional `_<n>.` ni `_selected.`;
 *   - la extensión concuerde con el contentType olfateado.
 * Es decir: aunque alguien copiara acá lo que el código produce, la copia sólo
 * pasa si además satisface las invariantes de PB.
 *
 * Casos NO listados (idénticos a la base, como debe ser): los `explicitEmpty`
 * de las nueve categorías, `hook.selectFailure`, los tres `reload.*` y los
 * `editor.*.existingUrl`. Ninguno sube bytes nuevos.
 */

export interface DeclaredDivergence {
  /** Id exacto del caso en el fixture. */
  case: string;
  /** Path con puntos dentro del `CaseRecord`. */
  path: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export const DIVERGENCES: DeclaredDivergence[] = [
  {
    case: "editor.character.success",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.character.uploadFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.cover.success",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.cover.success",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/characters/char1_0.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png"
          ],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/characters/char1_0.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "editor.cover.uploadFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.cover.uploadFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/characters/char1_0.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "editor.cover.uploadFailure",
    path: "observed",
    oldValue: {
      "saveButtonCount": 2,
      "userVisibleMessage": "Error al guardar"
    },
    newValue: {
      "saveButtonCount": 0,
      "userVisibleMessage": "__no-ui__:expected <button type=\"button\" …(2)>…(2)</button> to be null\n\nIgnored nodes: comments, script, style\n\u001b[36m<html>\u001b[39m\n  \u001b[36m<head />\u001b[39m\n  \u001b[36m<body>\u001b[39m\n    \u001b[36m<div>\u001b[39m\n      \u001b[36m<div\u001b[39m\n        \u001b[33mclass\u001b[39m=\u001b[32m\"space-y-6\"\u001b[39m\n      \u001b[36m>\u001b[39m\n        \u001b[36m<div\u001b[39m\n          \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center gap-2 text-xs px-3 py-1.5 rounded-full\"\u001b[39m\n          \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgba(232, 201, 122, 0.19); color: rgb(184, 146, 61); width: fit-content;\"\u001b[39m\n        \u001b[36m>\u001b[39m\n          \u001b[36m<svg\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-circle\"\u001b[39m\n            \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n            \u001b[33mheight\u001b[39m=\u001b[32m\"12\"\u001b[39m\n            \u001b[33mstroke\u001b[39m=\u001b[32m\"currentColor\"\u001b[39m\n            \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n            \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n            \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n            \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n            \u001b[33mwidth\u001b[39m=\u001b[32m\"12\"\u001b[39m\n            \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<circle\u001b[39m\n              \u001b[33mcx\u001b[39m=\u001b[32m\"12\"\u001b[39m\n              \u001b[33mcy\u001b[39m=\u001b[32m\"12\"\u001b[39m\n              \u001b[33mr\u001b[39m=\u001b[32m\"10\"\u001b[39m\n            \u001b[36m/>\u001b[39m\n          \u001b[36m</svg>\u001b[39m\n          \u001b[0mSin guardar\u001b[0m\n        \u001b[36m</div>\u001b[39m\n        \u001b[36m<div\u001b[39m\n          \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-start justify-between\"\u001b[39m\n        \u001b[36m>\u001b[39m\n          \u001b[36m<div>\u001b[39m\n            \u001b[36m<h3\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"font-family: Merriweather; font-size: 20px; font-weight: 400; color: rgb(26, 26, 26); margin-bottom: 4px;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[0mCuentacuento\u001b[0m\n            \u001b[36m</h3>\u001b[39m\n            \u001b[36m<p\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"font-family: Montserrat; font-size: 14px; color: rgb(138, 138, 138);\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[0mHistoria ilustrada para el momento de niños\u001b[0m\n            \u001b[36m</p>\u001b[39m\n          \u001b[36m</div>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center gap-3\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<button\u001b[39m\n              \u001b[33maria-controls\u001b[39m=\u001b[32m\"radix-:r14:\"\u001b[39m\n              \u001b[33maria-expanded\u001b[39m=\u001b[32m\"false\"\u001b[39m\n              \u001b[33maria-haspopup\u001b[39m=\u001b[32m\"dialog\"\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-red-50\"\u001b[39m\n              \u001b[33mdata-state\u001b[39m=\u001b[32m\"closed\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"color: rgb(220, 38, 38); font-family: Montserrat;\"\u001b[39m\n              \u001b[33mtype\u001b[39m=\u001b[32m\"button\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[36m<svg\u001b[39m\n                \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-trash2\"\u001b[39m\n                \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n                \u001b[33mheight\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                \u001b[33mstroke\u001b[39m=\u001b[32m\"currentColor\"\u001b[39m\n                \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n                \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n                \u001b[33mwidth\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n              \u001b[36m>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M3 6h18\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<line\u001b[39m\n                  \u001b[33mx1\u001b[39m=\u001b[32m\"10\"\u001b[39m\n                  \u001b[33mx2\u001b[39m=\u001b[32m\"10\"\u001b[39m\n                  \u001b[33my1\u001b[39m=\u001b[32m\"11\"\u001b[39m\n                  \u001b[33my2\u001b[39m=\u001b[32m\"17\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<line\u001b[39m\n                  \u001b[33mx1\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                  \u001b[33mx2\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                  \u001b[33my1\u001b[39m=\u001b[32m\"11\"\u001b[39m\n                  \u001b[33my2\u001b[39m=\u001b[32m\"17\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n              \u001b[36m</svg>\u001b[39m\n              \u001b[0mEliminar\u001b[0m\n            \u001b[36m</button>\u001b[39m\n          \u001b[36m</div>\u001b[39m\n        \u001b[36m</div>\u001b[39m\n        \u001b[36m<div\u001b[39m\n          \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center justify-between mb-6\"\u001b[39m\n        \u001b[36m>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex flex-col items-center\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<div\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"w-10 h-10 rounded-full flex items-center justify-center mb-1\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgb(212, 168, 83); border: medium;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[36m<svg\u001b[39m\n                \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-check\"\u001b[39m\n                \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n                \u001b[33mheight\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mstroke\u001b[39m=\u001b[32m\"white\"\u001b[39m\n                \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n                \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n                \u001b[33mwidth\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n              \u001b[36m>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M20 6 9 17l-5-5\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n              \u001b[36m</svg>\u001b[39m\n            \u001b[36m</div>\u001b[39m\n            \u001b[36m<span\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"text-xs\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"color: rgb(138, 138, 138); font-weight: 400;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[0mConfigurar\u001b[0m\n            \u001b[36m</span>\u001b[39m\n          \u001b[36m</div>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex-1 h-0.5 mx-2\"\u001b[39m\n            \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgb(212, 168, 83);\"\u001b[39m\n          \u001b[36m/>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex flex-col items-center\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<div\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"w-10 h-10 rounded-full flex items-center justify-center mb-1\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgb(212, 168, 83); border: medium;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[36m<svg\u001b[39m\n                \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-check\"\u001b[39m\n                \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n                \u001b[33mheight\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mstroke\u001b[39m=\u001b[32m\"white\"\u001b[39m\n                \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n                \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n                \u001b[33mwidth\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n              \u001b[36m>\u001b[39m\n                \u001b[36m<path\u001b[39m\n  ..."
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "editor.end.success",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2fbb398aa5d2614298905c0e19e2c0a3.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.end.success",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/characters/char1_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/end/end_0.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/characters/char1_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/end/end_2fbb398aa5d2614298905c0e19e2c0a3.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "editor.end.uploadFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2fbb398aa5d2614298905c0e19e2c0a3.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.end.uploadFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/characters/char1_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "editor.end.uploadFailure",
    path: "observed",
    oldValue: {
      "saveButtonCount": 2,
      "userVisibleMessage": "Error al guardar"
    },
    newValue: {
      "saveButtonCount": 0,
      "userVisibleMessage": "__no-ui__:expected <button type=\"button\" …(2)>…(2)</button> to be null\n\nIgnored nodes: comments, script, style\n\u001b[36m<html>\u001b[39m\n  \u001b[36m<head />\u001b[39m\n  \u001b[36m<body>\u001b[39m\n    \u001b[36m<div>\u001b[39m\n      \u001b[36m<div\u001b[39m\n        \u001b[33mclass\u001b[39m=\u001b[32m\"space-y-6\"\u001b[39m\n      \u001b[36m>\u001b[39m\n        \u001b[36m<div\u001b[39m\n          \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center gap-2 text-xs px-3 py-1.5 rounded-full\"\u001b[39m\n          \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgba(232, 201, 122, 0.19); color: rgb(184, 146, 61); width: fit-content;\"\u001b[39m\n        \u001b[36m>\u001b[39m\n          \u001b[36m<svg\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-circle\"\u001b[39m\n            \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n            \u001b[33mheight\u001b[39m=\u001b[32m\"12\"\u001b[39m\n            \u001b[33mstroke\u001b[39m=\u001b[32m\"currentColor\"\u001b[39m\n            \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n            \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n            \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n            \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n            \u001b[33mwidth\u001b[39m=\u001b[32m\"12\"\u001b[39m\n            \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<circle\u001b[39m\n              \u001b[33mcx\u001b[39m=\u001b[32m\"12\"\u001b[39m\n              \u001b[33mcy\u001b[39m=\u001b[32m\"12\"\u001b[39m\n              \u001b[33mr\u001b[39m=\u001b[32m\"10\"\u001b[39m\n            \u001b[36m/>\u001b[39m\n          \u001b[36m</svg>\u001b[39m\n          \u001b[0mSin guardar\u001b[0m\n        \u001b[36m</div>\u001b[39m\n        \u001b[36m<div\u001b[39m\n          \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-start justify-between\"\u001b[39m\n        \u001b[36m>\u001b[39m\n          \u001b[36m<div>\u001b[39m\n            \u001b[36m<h3\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"font-family: Merriweather; font-size: 20px; font-weight: 400; color: rgb(26, 26, 26); margin-bottom: 4px;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[0mCuentacuento\u001b[0m\n            \u001b[36m</h3>\u001b[39m\n            \u001b[36m<p\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"font-family: Montserrat; font-size: 14px; color: rgb(138, 138, 138);\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[0mHistoria ilustrada para el momento de niños\u001b[0m\n            \u001b[36m</p>\u001b[39m\n          \u001b[36m</div>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center gap-3\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<button\u001b[39m\n              \u001b[33maria-controls\u001b[39m=\u001b[32m\"radix-:r1k:\"\u001b[39m\n              \u001b[33maria-expanded\u001b[39m=\u001b[32m\"false\"\u001b[39m\n              \u001b[33maria-haspopup\u001b[39m=\u001b[32m\"dialog\"\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-red-50\"\u001b[39m\n              \u001b[33mdata-state\u001b[39m=\u001b[32m\"closed\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"color: rgb(220, 38, 38); font-family: Montserrat;\"\u001b[39m\n              \u001b[33mtype\u001b[39m=\u001b[32m\"button\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[36m<svg\u001b[39m\n                \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-trash2\"\u001b[39m\n                \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n                \u001b[33mheight\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                \u001b[33mstroke\u001b[39m=\u001b[32m\"currentColor\"\u001b[39m\n                \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n                \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n                \u001b[33mwidth\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n              \u001b[36m>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M3 6h18\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<line\u001b[39m\n                  \u001b[33mx1\u001b[39m=\u001b[32m\"10\"\u001b[39m\n                  \u001b[33mx2\u001b[39m=\u001b[32m\"10\"\u001b[39m\n                  \u001b[33my1\u001b[39m=\u001b[32m\"11\"\u001b[39m\n                  \u001b[33my2\u001b[39m=\u001b[32m\"17\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n                \u001b[36m<line\u001b[39m\n                  \u001b[33mx1\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                  \u001b[33mx2\u001b[39m=\u001b[32m\"14\"\u001b[39m\n                  \u001b[33my1\u001b[39m=\u001b[32m\"11\"\u001b[39m\n                  \u001b[33my2\u001b[39m=\u001b[32m\"17\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n              \u001b[36m</svg>\u001b[39m\n              \u001b[0mEliminar\u001b[0m\n            \u001b[36m</button>\u001b[39m\n          \u001b[36m</div>\u001b[39m\n        \u001b[36m</div>\u001b[39m\n        \u001b[36m<div\u001b[39m\n          \u001b[33mclass\u001b[39m=\u001b[32m\"flex items-center justify-between mb-6\"\u001b[39m\n        \u001b[36m>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex flex-col items-center\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<div\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"w-10 h-10 rounded-full flex items-center justify-center mb-1\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgb(212, 168, 83); border: medium;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[36m<svg\u001b[39m\n                \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-check\"\u001b[39m\n                \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n                \u001b[33mheight\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mstroke\u001b[39m=\u001b[32m\"white\"\u001b[39m\n                \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n                \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n                \u001b[33mwidth\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n              \u001b[36m>\u001b[39m\n                \u001b[36m<path\u001b[39m\n                  \u001b[33md\u001b[39m=\u001b[32m\"M20 6 9 17l-5-5\"\u001b[39m\n                \u001b[36m/>\u001b[39m\n              \u001b[36m</svg>\u001b[39m\n            \u001b[36m</div>\u001b[39m\n            \u001b[36m<span\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"text-xs\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"color: rgb(138, 138, 138); font-weight: 400;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[0mConfigurar\u001b[0m\n            \u001b[36m</span>\u001b[39m\n          \u001b[36m</div>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex-1 h-0.5 mx-2\"\u001b[39m\n            \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgb(212, 168, 83);\"\u001b[39m\n          \u001b[36m/>\u001b[39m\n          \u001b[36m<div\u001b[39m\n            \u001b[33mclass\u001b[39m=\u001b[32m\"flex flex-col items-center\"\u001b[39m\n          \u001b[36m>\u001b[39m\n            \u001b[36m<div\u001b[39m\n              \u001b[33mclass\u001b[39m=\u001b[32m\"w-10 h-10 rounded-full flex items-center justify-center mb-1\"\u001b[39m\n              \u001b[33mstyle\u001b[39m=\u001b[32m\"background-color: rgb(212, 168, 83); border: medium;\"\u001b[39m\n            \u001b[36m>\u001b[39m\n              \u001b[36m<svg\u001b[39m\n                \u001b[33mclass\u001b[39m=\u001b[32m\"lucide lucide-check\"\u001b[39m\n                \u001b[33mfill\u001b[39m=\u001b[32m\"none\"\u001b[39m\n                \u001b[33mheight\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mstroke\u001b[39m=\u001b[32m\"white\"\u001b[39m\n                \u001b[33mstroke-linecap\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-linejoin\u001b[39m=\u001b[32m\"round\"\u001b[39m\n                \u001b[33mstroke-width\u001b[39m=\u001b[32m\"2\"\u001b[39m\n                \u001b[33mviewBox\u001b[39m=\u001b[32m\"0 0 24 24\"\u001b[39m\n                \u001b[33mwidth\u001b[39m=\u001b[32m\"20\"\u001b[39m\n                \u001b[33mxmlns\u001b[39m=\u001b[32m\"http://www.w3.org/2000/svg\"\u001b[39m\n              \u001b[36m>\u001b[39m\n                \u001b[36m<path\u001b[39m\n  ..."
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "editor.scene.success",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "editor.scene.uploadFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_selected.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.characterSheets.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.characterSheets.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.characterSheets.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/characters/char1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/characters/char1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.characterSheets.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": []
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.characterSheets.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": []
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.characterSheets.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/characters/char1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/characters/char1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.characterSheets.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/characters/char1_1.jpg",
              "user-pb/lit-pb/characters/char1_2.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
              "user-pb/lit-pb/characters/char1_cb0501d6c1250017af030077e00e88b9.jpg",
              "user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.characterSheets.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_1.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_2.png"
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_1.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_2.png"
          ]
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_cb0501d6c1250017af030077e00e88b9.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_cb0501d6c1250017af030077e00e88b9.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.characterSheets.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.characterSheets.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.characterSheets.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.characterSheets.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/characters/char1_2.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.characterSheets.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
            "not-base64!!!***",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_2.png"
          ]
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.characterSheets.midFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.characterSheets.midFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.characterSheets.midFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/characters/char1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/characters/char1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.characterSheets.midFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/characters/char1_2.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.characterSheets.midFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_2.png"
          ]
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.characterSheets.mixedInputs",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_1.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.characterSheets.mixedInputs",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/characters/char1_1.png",
              "user-pb/lit-pb/characters/char1_2.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/characters/char1_e4de9adb10f197cd553b011440c25c4c.png",
              "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.characterSheets.mixedInputs",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_1.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_2.png"
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_1.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_2.png"
          ]
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_e4de9adb10f197cd553b011440c25c4c.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_e4de9adb10f197cd553b011440c25c4c.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.cover.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.cover.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.cover.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.cover.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.cover.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
          "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.cover.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.cover.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png",
            "user-pb/lit-pb/cover/cover_1.jpg",
            "user-pb/lit-pb/cover/cover_2.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
            "user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
            "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.cover.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_1.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_2.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_1.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_2.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.cover.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.cover.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.cover.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.cover.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png",
            "user-pb/lit-pb/cover/cover_2.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.cover.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
          "not-base64!!!***",
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_2.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.cover.midFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.cover.midFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.cover.midFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.cover.midFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png",
            "user-pb/lit-pb/cover/cover_2.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.cover.midFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
          "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_2.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.cover.mixedInputs",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_1.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.cover.mixedInputs",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/characters/char1_0.png",
            "user-pb/lit-pb/cover/cover_1.png",
            "user-pb/lit-pb/cover/cover_2.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/characters/char1_0.png",
            "user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png",
            "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.cover.mixedInputs",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_1.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_2.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_1.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_2.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_e4de9adb10f197cd553b011440c25c4c.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.coverReference.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.coverReference.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.coverReference.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/coverRef/cover_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/coverRef/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.coverReference.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.coverReference.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.coverReference.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/coverRef/cover_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/coverRef/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.coverReference.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": "user-pb/lit-pb/coverRef/cover_0.png",
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": "user-pb/lit-pb/coverRef/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.coverReference.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_0.png",
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_0.png",
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.coverReference.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.coverReference.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.coverReference.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.coverReference.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": "not-base64!!!***",
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.duplicateConflict",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.duplicateConflict",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.duplicateConflict",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg=="
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.end.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.end.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.end.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/end/end_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/end/end_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.end.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.end.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
          "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.end.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/end/end_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/end/end_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.end.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/end/end_0.png",
            "user-pb/lit-pb/end/end_1.jpg",
            "user-pb/lit-pb/end/end_2.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
            "user-pb/lit-pb/end/end_cb0501d6c1250017af030077e00e88b9.jpg",
            "user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.end.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_1.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_2.png"
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_1.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_2.png"
        ],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_cb0501d6c1250017af030077e00e88b9.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png"
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_cb0501d6c1250017af030077e00e88b9.jpg",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png"
        ],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.end.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.end.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.end.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.end.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/end/end_0.png",
            "user-pb/lit-pb/end/end_2.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.end.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
          "not-base64!!!***",
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_2.png"
        ],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.end.midFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.end.midFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.end.midFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/end/end_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/end/end_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.end.midFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/end/end_0.png",
            "user-pb/lit-pb/end/end_2.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.end.midFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
          "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_2.png"
        ],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.end.mixedInputs",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_1.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.end.mixedInputs",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/characters/char1_0.png",
            "user-pb/lit-pb/end/end_1.png",
            "user-pb/lit-pb/end/end_2.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [
            "user-pb/lit-pb/characters/char1_0.png",
            "user-pb/lit-pb/end/end_e4de9adb10f197cd553b011440c25c4c.png",
            "user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png"
          ],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.end.mixedInputs",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_1.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_2.png"
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_1.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_2.png"
        ],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_e4de9adb10f197cd553b011440c25c4c.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_e4de9adb10f197cd553b011440c25c4c.png",
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/end/end_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.endReference.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.endReference.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.endReference.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/endRef/end_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/endRef/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.endReference.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.endReference.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.endReference.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/endRef/end_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/endRef/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.endReference.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": "user-pb/lit-pb/endRef/end_0.png",
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": "user-pb/lit-pb/endRef/end_49e1dad481e94dfab7c9573a9a81d56a.png",
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.endReference.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_0.png",
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_0.png",
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_49e1dad481e94dfab7c9573a9a81d56a.png",
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.endReference.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.endReference.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.endReference.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.endReference.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": "not-base64!!!***",
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.lyingDataUrl",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.lyingDataUrl",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.lyingDataUrl",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromPropRefs.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.propsFromPropRefs.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.propsFromPropRefs.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromPropRefs.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromPropRefs.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": []
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromPropRefs.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromPropRefs.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_1.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromPropRefs.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.propsFromPropRefs.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.propsFromPropRefs.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromPropRefs.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromPropRefs.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromPropRefs.midFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.propsFromPropRefs.midFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.propsFromPropRefs.midFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromPropRefs.midFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromPropRefs.midFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromPropRefs.mixedInputs",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_1.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromPropRefs.mixedInputs",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_1.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_e4de9adb10f197cd553b011440c25c4c.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromStory.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.propsFromStory.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.propsFromStory.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromStory.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": []
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromStory.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
              "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": []
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromStory.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromStory.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": [
              "user-pb/lit-pb/props/prop1_0.png",
              "user-pb/lit-pb/props/prop1_1.jpg",
              "user-pb/lit-pb/props/prop1_2.png"
            ]
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": [
              "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
              "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
              "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png"
            ]
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromStory.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_1.jpg",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_1.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png"
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromStory.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.propsFromStory.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.propsFromStory.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromStory.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": [
              "user-pb/lit-pb/props/prop1_0.png",
              "user-pb/lit-pb/props/prop1_2.png"
            ]
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromStory.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
              "not-base64!!!***",
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromStory.midFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.propsFromStory.midFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.propsFromStory.midFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/props/prop1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromStory.midFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": [
              "user-pb/lit-pb/props/prop1_0.png",
              "user-pb/lit-pb/props/prop1_2.png"
            ]
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromStory.midFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
              "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.propsFromStory.mixedInputs",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_1.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.propsFromStory.mixedInputs",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/props/prop1_1.png",
              "user-pb/lit-pb/props/prop1_2.png"
            ]
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {
            "prop1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/props/prop1_e4de9adb10f197cd553b011440c25c4c.png",
              "user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png"
            ]
          },
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": true,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.propsFromStory.mixedInputs",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_1.png",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_1.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_2.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": [
          {
            "id": "prop1",
            "referenceImages": [
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_e4de9adb10f197cd553b011440c25c4c.png",
              "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png"
            ]
          }
        ],
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {
          "prop1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_e4de9adb10f197cd553b011440c25c4c.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/props/prop1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneImages.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.sceneImages.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.sceneImages.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/scenes/scene1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/scenes/scene1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneImages.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": []
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneImages.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": []
        },
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneImages.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/scenes/scene1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/scenes/scene1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneImages.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/scenes/scene1_0.png",
              "user-pb/lit-pb/scenes/scene1_1.jpg",
              "user-pb/lit-pb/scenes/scene1_2.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
              "user-pb/lit-pb/scenes/scene1_cb0501d6c1250017af030077e00e88b9.jpg",
              "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneImages.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_1.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_2.png"
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_1.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_2.png"
          ]
        },
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_cb0501d6c1250017af030077e00e88b9.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_cb0501d6c1250017af030077e00e88b9.jpg",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneImages.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.sceneImages.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.sceneImages.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneImages.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/scenes/scene1_0.png",
              "user-pb/lit-pb/scenes/scene1_2.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneImages.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
            "not-base64!!!***",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_2.png"
          ]
        },
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneImages.midFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.sceneImages.midFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.sceneImages.midFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/scenes/scene1_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/scenes/scene1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneImages.midFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/scenes/scene1_0.png",
              "user-pb/lit-pb/scenes/scene1_2.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneImages.midFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==",
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg=="
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_2.png"
          ]
        },
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneImages.mixedInputs",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_1.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneImages.mixedInputs",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/scenes/scene1_1.png",
              "user-pb/lit-pb/scenes/scene1_2.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/characters/char1_0.png",
              "user-pb/lit-pb/scenes/scene1_e4de9adb10f197cd553b011440c25c4c.png",
              "user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneImages.mixedInputs",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_1.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_2.png"
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_1.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_2.png"
          ]
        },
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_e4de9adb10f197cd553b011440c25c4c.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_e4de9adb10f197cd553b011440c25c4c.png",
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneReferences.allFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.sceneReferences.allFailure",
    path: "error",
    oldValue: null,
    newValue: "No se pudo guardar la imagen en el almacenamiento.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.sceneReferences.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/sceneRefs/scene1_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/sceneRefs/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneReferences.allFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneReferences.allFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {
          "1": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg=="
        }
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneReferences.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/sceneRefs/scene1_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/sceneRefs/scene1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.sceneReferences.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {
            "1": "user-pb/lit-pb/sceneRefs/scene1_0.png"
          }
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {
            "1": "user-pb/lit-pb/sceneRefs/scene1_49e1dad481e94dfab7c9573a9a81d56a.png"
          }
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneReferences.allSuccess",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_0.png"
        }
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_0.png"
        }
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_49e1dad481e94dfab7c9573a9a81d56a.png"
        }
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_49e1dad481e94dfab7c9573a9a81d56a.png"
        }
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.sceneReferences.decodeFailure",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.sceneReferences.decodeFailure",
    path: "error",
    oldValue: null,
    newValue: "La imagen no es base64 válido.",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.sceneReferences.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.sceneReferences.decodeFailure",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {
          "1": "not-base64!!!***"
        }
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.unsupportedBytes",
    path: "outcome",
    oldValue: "resolved",
    newValue: "rejected",
    reason:
      "G4 — un fallo de subida ahora RECHAZA la escritura lógica en vez de resolver con la categoría degradada.",
  },
  {
    case: "hook.unsupportedBytes",
    path: "error",
    oldValue: null,
    newValue: "El formato de la imagen no es compatible (se admiten PNG, JPEG y WebP).",
    reason:
      "G4/D8 — el rechazo expone un mensaje en español de la primitiva en vez de resolver en silencio.",
  },
  {
    case: "hook.unsupportedBytes",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      }
    ],
    newValue: [],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.unsupportedBytes",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.unsupportedBytes",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": null,
      "uploadedUrls": null
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "hook.upsertFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_1.jpg",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_2.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/jpeg",
        "path": "user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.upsertFailure",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png",
            "user-pb/lit-pb/cover/cover_1.jpg",
            "user-pb/lit-pb/cover/cover_2.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_49e1dad481e94dfab7c9573a9a81d56a.png",
            "user-pb/lit-pb/cover/cover_cb0501d6c1250017af030077e00e88b9.jpg",
            "user-pb/lit-pb/cover/cover_194bdb273fa55018b8e0e248714246a1.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.webpBytes",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/cover/cover_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/webp",
        "path": "user-pb/lit-pb/cover/cover_bd25bde9fc4427cd6f3babcb8f888fe6.webp",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "hook.webpBytes",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_0.png"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {},
          "coverPaths": [
            "user-pb/lit-pb/cover/cover_bd25bde9fc4427cd6f3babcb8f888fe6.webp"
          ],
          "coverReferencePath": null,
          "endPaths": [],
          "endReferencePath": null,
          "propImagePaths": {},
          "sceneImagePaths": {},
          "sceneReferenceModes": {},
          "sceneReferencePaths": {}
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "hook.webpBytes",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_0.png"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {},
        "coverOptions": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_bd25bde9fc4427cd6f3babcb8f888fe6.webp"
        ],
        "coverReferenceImage": null,
        "endOptions": [],
        "endReferenceImage": null,
        "propsReferenceImages": null,
        "sceneImageOptions": {},
        "sceneReferenceImages": {}
      },
      "uploadedUrls": {
        "characterSheetUrls": {},
        "coverReferenceUrl": null,
        "coverUrls": [
          "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/cover/cover_bd25bde9fc4427cd6f3babcb8f888fe6.webp"
        ],
        "endReferenceUrl": null,
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {},
        "sceneReferenceUrls": {}
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "liturgy.allFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/characters/char1.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/jpeg",
        "path": "liturgias/lit-pb/cuentacuentos/scenes/scene_1.jpg",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/cover/cover.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/end/end.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "liturgy.allFailure",
    path: "upserts",
    oldValue: [
      {
        "table": "liturgias"
      },
      {
        "elementStoryImageRefs": [
          {
            "characterSheetUrls": [
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg=="
            ],
            "coverImageUrl": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg==",
            "endImageUrl": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYPj/HwADAgH/OSkZvgAAAABJRU5ErkJggg==",
            "hasInlineImage": true,
            "sceneUrls": [
              "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
            ]
          }
        ],
        "table": "liturgia_elementos"
      }
    ],
    newValue: [
      {
        "table": "liturgias"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "liturgy.allFailure",
    path: "observed",
    oldValue: {
      "saveResult": {
        "success": true
      }
    },
    newValue: {
      "saveResult": {
        "error": "No se pudieron guardar las imágenes del cuento: No se pudo guardar la imagen en el almacenamiento.",
        "success": false
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "liturgy.allSuccess",
    path: "uploads",
    oldValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/characters/char1.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/jpeg",
        "path": "liturgias/lit-pb/cuentacuentos/scenes/scene_1.jpg",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/cover/cover.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/end/end.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/jpeg",
        "path": "liturgias/lit-pb/cuentacuentos/scenes/scene_1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/end/end_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "liturgy.allSuccess",
    path: "upserts",
    oldValue: [
      {
        "table": "liturgias"
      },
      {
        "elementStoryImageRefs": [
          {
            "characterSheetUrls": [
              "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/characters/char1.png"
            ],
            "coverImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/cover/cover.png",
            "endImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/end/end.png",
            "hasInlineImage": false,
            "sceneUrls": [
              "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/scenes/scene_1.jpg"
            ]
          }
        ],
        "table": "liturgia_elementos"
      }
    ],
    newValue: [
      {
        "table": "liturgias"
      },
      {
        "elementStoryImageRefs": [
          {
            "characterSheetUrls": [
              "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
            ],
            "coverImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/cover/cover_194bdb273fa55018b8e0e248714246a1.png",
            "endImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/end/end_e4de9adb10f197cd553b011440c25c4c.png",
            "hasInlineImage": false,
            "sceneUrls": [
              "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/scenes/scene_1_cb0501d6c1250017af030077e00e88b9.jpg"
            ]
          }
        ],
        "table": "liturgia_elementos"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "liturgy.decodeFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/jpeg",
        "path": "liturgias/lit-pb/cuentacuentos/scenes/scene_1.jpg",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/cover/cover.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/end/end.png",
        "upsert": true
      }
    ],
    newValue: [],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "liturgy.decodeFailure",
    path: "upserts",
    oldValue: [
      {
        "table": "liturgias"
      },
      {
        "elementStoryImageRefs": [
          {
            "characterSheetUrls": [
              "not-base64!!!***"
            ],
            "coverImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/cover/cover.png",
            "endImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/end/end.png",
            "hasInlineImage": false,
            "sceneUrls": [
              "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/scenes/scene_1.jpg"
            ]
          }
        ],
        "table": "liturgia_elementos"
      }
    ],
    newValue: [
      {
        "table": "liturgias"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "liturgy.decodeFailure",
    path: "observed",
    oldValue: {
      "saveResult": {
        "success": true
      }
    },
    newValue: {
      "saveResult": {
        "error": "No se pudieron guardar las imágenes del cuento: La imagen no es base64 válido.",
        "success": false
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "liturgy.midCategoryFailure",
    path: "uploads",
    oldValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/characters/char1.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/jpeg",
        "path": "liturgias/lit-pb/cuentacuentos/scenes/scene_1.jpg",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/cover/cover.png",
        "upsert": true
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/end/end.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "liturgia-images",
        "contentType": "image/png",
        "path": "liturgias/lit-pb/cuentacuentos/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "liturgia-images",
        "contentType": "image/jpeg",
        "path": "liturgias/lit-pb/cuentacuentos/scenes/scene_1_cb0501d6c1250017af030077e00e88b9.jpg",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "liturgy.midCategoryFailure",
    path: "upserts",
    oldValue: [
      {
        "table": "liturgias"
      },
      {
        "elementStoryImageRefs": [
          {
            "characterSheetUrls": [
              "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/characters/char1.png"
            ],
            "coverImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/cover/cover.png",
            "endImageUrl": "https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/end/end.png",
            "hasInlineImage": true,
            "sceneUrls": [
              "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
            ]
          }
        ],
        "table": "liturgia_elementos"
      }
    ],
    newValue: [
      {
        "table": "liturgias"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "liturgy.midCategoryFailure",
    path: "observed",
    oldValue: {
      "saveResult": {
        "success": true
      }
    },
    newValue: {
      "saveResult": {
        "error": "No se pudieron guardar las imágenes del cuento: No se pudo guardar la imagen en el almacenamiento.",
        "success": false
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
  {
    case: "roundTrip.combined",
    path: "uploads",
    oldValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/sceneRefs/scene1_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/coverRef/cover_0.png",
        "upsert": true
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/endRef/end_0.png",
        "upsert": true
      }
    ],
    newValue: [
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/sceneRefs/scene1_e4de9adb10f197cd553b011440c25c4c.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/coverRef/cover_2fbb398aa5d2614298905c0e19e2c0a3.png",
        "upsert": false
      },
      {
        "bucket": "cuentacuentos-drafts",
        "contentType": "image/png",
        "path": "user-pb/lit-pb/endRef/end_f384a400cb9cb293e55c3ed38764d2d3.png",
        "upsert": false
      }
    ],
    reason:
      "G2 — nombre por contenido (`_<hash32>`) y `upsert:false` en vez del nombre posicional `_<índice>`/`_selected` con `upsert:true`; el contentType pasa a salir de los magic bytes.",
  },
  {
    case: "roundTrip.combined",
    path: "upserts",
    oldValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_0.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": "user-pb/lit-pb/coverRef/cover_0.png",
          "endPaths": [],
          "endReferencePath": "user-pb/lit-pb/endRef/end_0.png",
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/scenes/scene1_0.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {
            "1": "user-pb/lit-pb/sceneRefs/scene1_0.png"
          }
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    newValue: [
      {
        "imagePaths": {
          "characterSheetPaths": {
            "char1": [
              "user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
            ]
          },
          "coverPaths": [],
          "coverReferencePath": "user-pb/lit-pb/coverRef/cover_2fbb398aa5d2614298905c0e19e2c0a3.png",
          "endPaths": [],
          "endReferencePath": "user-pb/lit-pb/endRef/end_f384a400cb9cb293e55c3ed38764d2d3.png",
          "propImagePaths": {},
          "sceneImagePaths": {
            "1": [
              "user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png"
            ]
          },
          "sceneReferenceModes": {},
          "sceneReferencePaths": {
            "1": "user-pb/lit-pb/sceneRefs/scene1_e4de9adb10f197cd553b011440c25c4c.png"
          }
        },
        "persistedJsonHasInlineImage": false,
        "table": "cuentacuentos_drafts"
      }
    ],
    reason:
      "G4 — la escritura lógica es fail-closed: un fallo que no sea 409 aborta ANTES del upsert, así que la categoría ya no se persiste acortada, vacía ni con base64; un 409 es éxito idempotente y sí persiste su path.",
  },
  {
    case: "roundTrip.combined",
    path: "observed",
    oldValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png"
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_0.png",
        "endOptions": [],
        "endReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_0.png",
        "propsReferenceImages": [],
        "sceneImageOptions": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_0.png"
          ]
        },
        "sceneReferenceImages": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_0.png"
        }
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png"
          ]
        },
        "coverReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_0.png",
        "coverUrls": [],
        "endReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_0.png",
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_0.png"
          ]
        },
        "sceneReferenceUrls": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_0.png"
        }
      }
    },
    newValue: {
      "stale": false,
      "swap": {
        "characterSheetOptions": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "coverOptions": [],
        "coverReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_2fbb398aa5d2614298905c0e19e2c0a3.png",
        "endOptions": [],
        "endReferenceImage": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_f384a400cb9cb293e55c3ed38764d2d3.png",
        "propsReferenceImages": [],
        "sceneImageOptions": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "sceneReferenceImages": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_e4de9adb10f197cd553b011440c25c4c.png"
        }
      },
      "uploadedUrls": {
        "characterSheetUrls": {
          "char1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_49e1dad481e94dfab7c9573a9a81d56a.png"
          ]
        },
        "coverReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/coverRef/cover_2fbb398aa5d2614298905c0e19e2c0a3.png",
        "coverUrls": [],
        "endReferenceUrl": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/endRef/end_f384a400cb9cb293e55c3ed38764d2d3.png",
        "endUrls": [],
        "propImageUrls": {},
        "sceneImageUrls": {
          "1": [
            "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/scenes/scene1_194bdb273fa55018b8e0e248714246a1.png"
          ]
        },
        "sceneReferenceUrls": {
          "1": "https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/sceneRefs/scene1_e4de9adb10f197cd553b011440c25c4c.png"
        }
      }
    },
    reason:
      "G4 — sin persistencia no hay swap de React ni URLs subidas; con éxito, las URLs y el estado pasan a apuntar al objeto direccionado por contenido.",
  },
];

/**
 * Invariantes que TODO `newValue` de `uploads` debe cumplir, verificadas sin
 * mirar la tabla de arriba. Devuelve la lista de violaciones.
 */
export function assertNewValueInvariants(
  caseId: string,
  path: string,
  newValue: unknown
): string[] {
  if (path !== 'uploads' || !Array.isArray(newValue)) return [];
  const violations: string[] = [];
  const EXT_FOR: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  for (const call of newValue as Array<Record<string, unknown>>) {
    const p = String(call.path ?? '');
    if (call.upsert !== false) {
      violations.push(`[${caseId}] ${p}: upsert debe ser false, es ${String(call.upsert)}`);
    }
    const m = p.match(/_([0-9a-f]{32})\.(png|jpg|webp)$/);
    if (!m) {
      violations.push(`[${caseId}] ${p}: el nombre no está direccionado por contenido`);
      continue;
    }
    if (/_\d+\.(png|jpg|webp)$/.test(p) || p.includes('_selected.')) {
      violations.push(`[${caseId}] ${p}: conserva la forma posicional`);
    }
    const ct = String(call.contentType ?? '');
    if (EXT_FOR[ct] !== m[2]) {
      violations.push(`[${caseId}] ${p}: extensión ${m[2]} no concuerda con ${ct}`);
    }
  }
  return violations;
}
