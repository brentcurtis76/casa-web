/**
 * CASA Bible Passage Fetcher Edge Function
 * Obtiene pasajes bíblicos usando la API de Bolls.life
 * GRATUITA y con NVI (Nueva Versión Internacional)
 *
 * Documentación: https://bolls.life/api/
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Versiones de la Biblia en español disponibles en Bolls.life
const BIBLE_VERSIONS: Record<string, { id: string; name: string }> = {
  'NVI': {
    id: 'NVI',
    name: 'Nueva Versión Internacional'
  },
  'RV1960': {
    id: 'RV1960',
    name: 'Reina-Valera 1960'
  },
  'LBLA': {
    id: 'LBLA',
    name: 'La Biblia de las Américas'
  },
  'NTV': {
    id: 'NTV',
    name: 'Nueva Traducción Viviente'
  },
  'PDT': {
    id: 'PDT',
    name: 'Palabra de Dios para Todos'
  },
  'RVG': {
    id: 'RV2004',
    name: 'Reina Valera Gómez 2004'
  },
  'BTX': {
    id: 'BTX3',
    name: 'La Biblia Textual'
  },
};

// Mapeo de nombres de libros en español a IDs de Bolls.life
// Bolls.life usa IDs numéricos: 1-39 AT, 40-66 NT
const BOOK_IDS: Record<string, number> = {
  // Antiguo Testamento
  'genesis': 1, 'génesis': 1, 'gn': 1, 'gen': 1,
  'exodo': 2, 'éxodo': 2, 'ex': 2,
  'levitico': 3, 'levítico': 3, 'lv': 3, 'lev': 3,
  'numeros': 4, 'números': 4, 'nm': 4, 'num': 4,
  'deuteronomio': 5, 'dt': 5, 'deu': 5,
  'josue': 6, 'josué': 6, 'jos': 6,
  'jueces': 7, 'jue': 7,
  'rut': 8, 'rt': 8,
  '1 samuel': 9, '1samuel': 9, '1 sam': 9, '1sam': 9,
  '2 samuel': 10, '2samuel': 10, '2 sam': 10, '2sam': 10,
  '1 reyes': 11, '1reyes': 11, '1 re': 11, '1re': 11,
  '2 reyes': 12, '2reyes': 12, '2 re': 12, '2re': 12,
  '1 cronicas': 13, '1crónicas': 13, '1 cr': 13, '1cr': 13,
  '2 cronicas': 14, '2crónicas': 14, '2 cr': 14, '2cr': 14,
  'esdras': 15, 'esd': 15,
  'nehemias': 16, 'nehemías': 16, 'neh': 16,
  'ester': 17, 'est': 17,
  'job': 18,
  'salmos': 19, 'salmo': 19, 'sal': 19, 'sl': 19,
  'proverbios': 20, 'pr': 20, 'pro': 20,
  'eclesiastes': 21, 'eclesiastés': 21, 'ec': 21,
  'cantares': 22, 'cantar de los cantares': 22, 'cnt': 22,
  'isaias': 23, 'isaías': 23, 'is': 23,
  'jeremias': 24, 'jeremías': 24, 'jer': 24,
  'lamentaciones': 25, 'lam': 25,
  'ezequiel': 26, 'ez': 26,
  'daniel': 27, 'dn': 27, 'dan': 27,
  'oseas': 28, 'os': 28,
  'joel': 29, 'jl': 29,
  'amos': 30, 'amós': 30, 'am': 30,
  'abdias': 31, 'abdías': 31, 'abd': 31,
  'jonas': 32, 'jonás': 32, 'jon': 32,
  'miqueas': 33, 'mi': 33,
  'nahum': 34, 'nah': 34,
  'habacuc': 35, 'hab': 35,
  'sofonias': 36, 'sofonías': 36, 'sof': 36,
  'hageo': 37, 'hag': 37,
  'zacarias': 38, 'zacarías': 38, 'zac': 38,
  'malaquias': 39, 'malaquías': 39, 'mal': 39,

  // Nuevo Testamento
  'mateo': 40, 'mt': 40, 'mat': 40,
  'marcos': 41, 'mc': 41, 'mr': 41,
  'lucas': 42, 'lc': 42, 'luk': 42,
  'juan': 43, 'jn': 43, 'jhn': 43,
  'hechos': 44, 'hch': 44, 'hec': 44,
  'romanos': 45, 'ro': 45, 'rom': 45,
  '1 corintios': 46, '1corintios': 46, '1 cor': 46, '1cor': 46,
  '2 corintios': 47, '2corintios': 47, '2 cor': 47, '2cor': 47,
  'galatas': 48, 'gálatas': 48, 'ga': 48, 'gal': 48,
  'efesios': 49, 'ef': 49,
  'filipenses': 50, 'fil': 50, 'flp': 50,
  'colosenses': 51, 'col': 51,
  '1 tesalonicenses': 52, '1tesalonicenses': 52, '1 ts': 52, '1ts': 52,
  '2 tesalonicenses': 53, '2tesalonicenses': 53, '2 ts': 53, '2ts': 53,
  '1 timoteo': 54, '1timoteo': 54, '1 tim': 54, '1tim': 54,
  '2 timoteo': 55, '2timoteo': 55, '2 tim': 55, '2tim': 55,
  'tito': 56, 'tit': 56,
  'filemon': 57, 'filemón': 57, 'flm': 57,
  'hebreos': 58, 'heb': 58, 'he': 58,
  'santiago': 59, 'stg': 59,
  '1 pedro': 60, '1pedro': 60, '1 pe': 60, '1pe': 60,
  '2 pedro': 61, '2pedro': 61, '2 pe': 61, '2pe': 61,
  '1 juan': 62, '1juan': 62, '1 jn': 62, '1jn': 62,
  '2 juan': 63, '2juan': 63, '2 jn': 63, '2jn': 63,
  '3 juan': 64, '3juan': 64, '3 jn': 64, '3jn': 64,
  'judas': 65, 'jud': 65,
  'apocalipsis': 66, 'ap': 66, 'apoc': 66, 'rev': 66
};

// Nombres de libros para mostrar
const BOOK_NAMES: Record<number, string> = {
  1: 'Génesis', 2: 'Éxodo', 3: 'Levítico', 4: 'Números',
  5: 'Deuteronomio', 6: 'Josué', 7: 'Jueces', 8: 'Rut',
  9: '1 Samuel', 10: '2 Samuel', 11: '1 Reyes', 12: '2 Reyes',
  13: '1 Crónicas', 14: '2 Crónicas', 15: 'Esdras', 16: 'Nehemías',
  17: 'Ester', 18: 'Job', 19: 'Salmos', 20: 'Proverbios',
  21: 'Eclesiastés', 22: 'Cantares', 23: 'Isaías', 24: 'Jeremías',
  25: 'Lamentaciones', 26: 'Ezequiel', 27: 'Daniel', 28: 'Oseas',
  29: 'Joel', 30: 'Amós', 31: 'Abdías', 32: 'Jonás',
  33: 'Miqueas', 34: 'Nahúm', 35: 'Habacuc', 36: 'Sofonías',
  37: 'Hageo', 38: 'Zacarías', 39: 'Malaquías',
  40: 'Mateo', 41: 'Marcos', 42: 'Lucas', 43: 'Juan',
  44: 'Hechos', 45: 'Romanos', 46: '1 Corintios', 47: '2 Corintios',
  48: 'Gálatas', 49: 'Efesios', 50: 'Filipenses', 51: 'Colosenses',
  52: '1 Tesalonicenses', 53: '2 Tesalonicenses', 54: '1 Timoteo',
  55: '2 Timoteo', 56: 'Tito', 57: 'Filemón', 58: 'Hebreos',
  59: 'Santiago', 60: '1 Pedro', 61: '2 Pedro', 62: '1 Juan',
  63: '2 Juan', 64: '3 Juan', 65: 'Judas', 66: 'Apocalipsis'
};

/**
 * Parsea una referencia bíblica en español
 * Ejemplos: "Juan 3:16", "Juan 3:16-21", "Salmo 23", "1 Corintios 13:1-13"
 */
function parseReference(reference: string): { bookId: number; chapter: number; startVerse?: number; endVerse?: number } | null {
  const normalized = reference.trim().toLowerCase();

  // Regex para capturar: libro capítulo:versículos
  const patterns = [
    // Con rango de versículos: "Juan 3:16-21"
    /^(.+?)\s+(\d+):(\d+)-(\d+)$/,
    // Con versículo único: "Juan 3:16"
    /^(.+?)\s+(\d+):(\d+)$/,
    // Solo capítulo: "Salmo 23"
    /^(.+?)\s+(\d+)$/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = normalized.match(patterns[i]);
    if (match) {
      const bookName = match[1].trim();
      const chapter = parseInt(match[2], 10);

      // Buscar ID del libro
      const bookId = BOOK_IDS[bookName];
      if (!bookId) continue;

      if (i === 0) {
        // Rango de versículos
        return {
          bookId,
          chapter,
          startVerse: parseInt(match[3], 10),
          endVerse: parseInt(match[4], 10),
        };
      } else if (i === 1) {
        // Versículo único
        return {
          bookId,
          chapter,
          startVerse: parseInt(match[3], 10),
          endVerse: parseInt(match[3], 10),
        };
      } else {
        // Solo capítulo completo
        return { bookId, chapter };
      }
    }
  }

  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference, version = 'NVI' } = await req.json();

    if (!reference) {
      throw new Error('Se requiere una referencia bíblica');
    }

    console.log(`[fetch-bible-passage] Buscando: "${reference}" en ${version}`);

    // Parsear la referencia
    const parsed = parseReference(reference);
    if (!parsed) {
      throw new Error(`No se pudo interpretar la referencia: "${reference}". Usa formato como "Juan 3:16" o "Salmo 23"`);
    }

    // Obtener ID de la versión
    const bibleInfo = BIBLE_VERSIONS[version] || BIBLE_VERSIONS['NVI'];
    const translationId = bibleInfo.id;

    console.log(`[fetch-bible-passage] Parsed: bookId=${parsed.bookId} chapter=${parsed.chapter} verses=${parsed.startVerse || 'all'}-${parsed.endVerse || 'all'}`);

    // Llamar a la API de Bolls.life (GRATUITA)
    // Endpoint: https://bolls.life/get-text/{translation}/{book}/{chapter}/
    const apiUrl = `https://bolls.life/get-text/${translationId}/${parsed.bookId}/${parsed.chapter}/`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[fetch-bible-passage] Error de API:', response.status);

      if (response.status === 404) {
        throw new Error(`Capítulo no encontrado: "${reference}". Verifica que la cita sea correcta.`);
      }

      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('La API no retornó contenido para este capítulo');
    }

    // Extraer versículos
    // data es un array de { pk, verse, text }
    let verses = data;

    // Filtrar por rango si se especificó
    if (parsed.startVerse !== undefined && parsed.endVerse !== undefined) {
      verses = data.filter((v: { verse: number }) =>
        v.verse >= parsed.startVerse! && v.verse <= parsed.endVerse!
      );
    }

    if (verses.length === 0) {
      throw new Error('No se encontraron versículos en el rango especificado');
    }

    // Construir texto con números de versículo
    const text = verses
      .map((v: { verse: number; text: string }) => `${v.verse} ${v.text.trim()}`)
      .join(' ');

    // Construir referencia formateada
    const bookName = BOOK_NAMES[parsed.bookId] || `Libro ${parsed.bookId}`;
    let displayReference = `${bookName} ${parsed.chapter}`;
    if (parsed.startVerse !== undefined) {
      displayReference += `:${parsed.startVerse}`;
      if (parsed.endVerse !== undefined && parsed.endVerse !== parsed.startVerse) {
        displayReference += `-${parsed.endVerse}`;
      }
    }

    console.log(`[fetch-bible-passage] Texto obtenido: ${text.slice(0, 100)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        text,
        reference: displayReference,
        version: bibleInfo.name,
        versionCode: version,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[fetch-bible-passage] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error obteniendo el pasaje bíblico',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
