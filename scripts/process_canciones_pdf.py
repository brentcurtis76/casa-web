#!/usr/bin/env python3
"""
Script para procesar el PDF de canciones CASA y generar repositorio.
PDF: 0. CANCIONES CASA 2025.pptx.pdf (1098 páginas, 74 canciones)

Este script identifica las 74 canciones únicas del índice y extrae su contenido.
"""

import fitz  # PyMuPDF
import json
import re
import os
from pathlib import Path
from datetime import datetime

# Lista oficial de canciones del índice (74 canciones)
SONGS_INDEX = [
    ("El espíritu", 2),
    ("Canta la esperanza", 11),
    ("Tu modo", 25),
    ("Capitán", 55),
    ("Oh criaturas del Señor", 69),
    ("Danza conmigo", 76),
    ("Abba Padre", 89),
    ("Ahora y para siempre", 110),
    ("Oh tu fidelidad", 117),
    ("Tu eres Dios", 130),
    ("Como la brisa", 146),
    ("Señor mi Dios", 163),
    ("Cristo te amamos", 173),
    ("Sin miedo", 188),
    ("La noche pasó", 209),
    ("Ven, Espíritu de Dios", 224),
    ("Tu amor y tu bondad", 226),
    ("Tu amor me asombra", 243),
    ("Brazos del Padre", 250),
    ("Sumérgeme", 263),
    ("No hay paredes", 284),
    ("Instrumento de tu paz", 305),
    ("En este lugar", 318),
    ("Pequeñas aclaraciones", 329),
    ("Como ama", 346),
    ("Quiero ver su amor", 370),
    ("Yo vengo a ofrecer mi corazón", 391),
    ("Siempre hay lugar", 405),
    ("Quiero respirar", 426),
    ("Cuídame", 447),
    ("Atráeme a ti", 472),
    ("Me guía Él", 489),
    ("Jardín", 508),
    ("Tenemos esperanza", 513),
    ("Fija tus ojos en Cristo", 555),
    ("Quiero andar cerca de ti", 572),
    ("Respirar", 581),
    ("Enséñame a volar", 590),
    ("Cante al Señor", 600),
    ("Océanos", 617),
    ("Ya no existe el miedo", 632),
    ("Sólo el amor", 655),
    ("Aún en medio del dolor", 670),
    ("Abre mis ojos", 692),
    ("Vamos celebrando", 698),
    ("El buen pastor", 727),
    ("Jesús es el Señor", 748),
    ("Jesús mi buen pastor", 776),
    ("El corazón de la alabanza", 798),
    ("Noël", 813),
    ("Venid fieles todos", 829),
    ("Oh Ven Emmanuel", 843),
    ("A ti me rindo", 854),
    ("Amor furioso", 863),
    ("Nada más", 874),
    ("Nueva vida", 886),
    ("En tí confío", 896),
    ("Sí, tu amor", 907),
    ("Inhala, exhala", 933),
    ("Abba", 959),
    ("Llévame a la cruz", 969),
    ("Honrar la vida", 985),
    ("Cuán dulce paz", 997),
    ("Sublime gracia", 1003),
    ("Fuente de Vida Eterna", 1027),
    ("Santo, Santo, Santo", 1034),
    ("Gloria cantemos", 1041),
    ("Gratitud", 1046),
    ("El Vacío", 1059),
    ("Santa la noche", 1064),
    ("Pequeña Aldea de Belén", 1075),
    ("María sabes qué", 1085),
    ("Aclaró", 1093),
]

def slugify(text):
    """Convierte texto a slug URL-friendly."""
    text = text.lower().strip()
    text = re.sub(r'[áàäâã]', 'a', text)
    text = re.sub(r'[éèëê]', 'e', text)
    text = re.sub(r'[íìïî]', 'i', text)
    text = re.sub(r'[óòöôõ]', 'o', text)
    text = re.sub(r'[úùüû]', 'u', text)
    text = re.sub(r'[ñ]', 'n', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text

def clean_text(text):
    """Limpia el texto extraído del PDF."""
    text = text.replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    lines = text.strip().split('\n')
    cleaned_lines = [line.strip() for line in lines if line.strip()]
    return '\n'.join(cleaned_lines)

def extract_song_content(doc, start_page, end_page, title):
    """
    Extrae el contenido de una canción entre dos páginas.
    La primera página es el título, las siguientes son versos.
    """
    verses = []

    for page_num in range(start_page, end_page):
        if page_num >= len(doc):
            break

        page = doc[page_num]
        text = clean_text(page.get_text())

        if not text:
            continue

        # Saltar la página de título (primera página)
        if page_num == start_page:
            continue

        # Cada página de letra es un "verso" (slide)
        if text and len(text) > 5:
            verses.append(text)

    return verses

def create_song_json(number, title, slug, start_page, end_page, verses):
    """Crea el objeto JSON de una canción."""
    song_id = f"{number:02d}-{slug}"

    verse_objects = []
    for i, verse_content in enumerate(verses):
        verse_type = 'verse'
        content_lower = verse_content.lower()

        # Detectar coros por palabras clave o repetición
        if any(word in content_lower for word in ['coro', 'chorus']):
            verse_type = 'chorus'

        verse_objects.append({
            'number': i + 1,
            'type': verse_type,
            'content': verse_content
        })

    return {
        'id': song_id,
        'number': number,
        'title': title,
        'slug': slug,
        'startPage': start_page,
        'endPage': end_page,
        'verses': verse_objects,
        'metadata': {
            'verseCount': len(verse_objects),
            'hasChorus': any(v['type'] == 'chorus' for v in verse_objects),
            'source': 'pdf',
            'extractedAt': datetime.now().isoformat()
        }
    }

def create_song_markdown(song_json):
    """Crea el archivo Markdown de una canción."""
    md = f"""---
id: {song_json['id']}
number: {song_json['number']}
title: {song_json['title']}
slug: {song_json['slug']}
---

# {song_json['title']}

"""
    for verse in song_json['verses']:
        verse_label = "Coro" if verse['type'] == 'chorus' else f"Verso {verse['number']}"
        md += f"## {verse_label}\n{verse['content']}\n\n"

    return md

def main():
    # Rutas
    base_dir = Path(__file__).parent.parent
    pdf_path = base_dir / "0. CANCIONES CASA 2025.pptx.pdf"
    output_dir = base_dir / "src" / "data" / "canciones"

    # Limpiar y crear directorios
    import shutil
    if output_dir.exists():
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "pdf-extracted").mkdir(exist_ok=True)
    (output_dir / "custom").mkdir(exist_ok=True)

    print("=" * 60)
    print("PROCESAMIENTO DE CANCIONES CASA")
    print("=" * 60)

    if not pdf_path.exists():
        print(f"ERROR: No se encontró el PDF en: {pdf_path}")
        return

    doc = fitz.open(str(pdf_path))
    print(f"PDF abierto: {len(doc)} páginas")
    print(f"Canciones a procesar: {len(SONGS_INDEX)}")
    print("-" * 60)

    all_songs = []

    for i, (title, start_page) in enumerate(SONGS_INDEX):
        # Determinar página final
        if i + 1 < len(SONGS_INDEX):
            end_page = SONGS_INDEX[i + 1][1]
        else:
            end_page = len(doc) + 1

        # Convertir a índice 0-based
        start_idx = start_page - 1
        end_idx = end_page - 1

        slug = slugify(title)
        number = i + 1

        # Extraer contenido
        verses = extract_song_content(doc, start_idx, end_idx, title)

        if not verses:
            print(f"  [{number:02d}] {title} - SIN CONTENIDO (páginas {start_page}-{end_page-1})")
            continue

        # Crear JSON
        song_json = create_song_json(number, title, slug, start_page, end_page - 1, verses)

        # Guardar JSON
        json_path = output_dir / "pdf-extracted" / f"{song_json['id']}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(song_json, f, ensure_ascii=False, indent=2)

        # Guardar Markdown
        md_path = output_dir / "pdf-extracted" / f"{song_json['id']}.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(create_song_markdown(song_json))

        all_songs.append({
            'id': song_json['id'],
            'number': song_json['number'],
            'title': song_json['title'],
            'slug': song_json['slug'],
            'verseCount': song_json['metadata']['verseCount']
        })

        print(f"  [{number:02d}] {title} - {len(verses)} slides")

    doc.close()

    # Crear índice general
    index_data = {
        'total': len(all_songs),
        'generatedAt': datetime.now().isoformat(),
        'source': '0. CANCIONES CASA 2025.pptx.pdf',
        'songs': all_songs
    }

    index_path = output_dir / "index.json"
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"✓ Repositorio creado con {len(all_songs)} canciones")
    print(f"✓ Archivos guardados en: {output_dir}")
    print("=" * 60)

if __name__ == '__main__':
    main()
