#!/usr/bin/env python3
"""
CASA Graphics Generator
Generador completo de piezas gráficas para eventos de CASA

Combina:
- Template base (casa_template.py)
- Generación de ilustraciones con Gemini (gemini_illustration_prompt.py)
"""

import os
import sys
from PIL import Image
import argparse

# Importar módulos locales
from casa_template import create_event_graphic, FORMATS
from gemini_illustration_prompt import (
    generate_illustration,
    generate_illustration_prompt,
    list_event_types,
    EVENT_PROMPTS
)

# ============================================
# CONFIGURACIÓN
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
ILLUSTRATIONS_DIR = os.path.join(BASE_DIR, 'illustrations')


def generate_complete_graphic(
    title: str,
    date: str,
    time: str,
    location: str,
    event_type: str = 'generic',
    formats: list = None,
    use_cached_illustration: bool = True,
    custom_illustration_path: str = None,
    output_prefix: str = 'event'
) -> dict:
    """
    Genera gráficos completos para un evento

    Args:
        title: Título del evento
        date: Fecha del evento
        time: Hora del evento
        location: Ubicación del evento
        event_type: Tipo de evento para la ilustración
        formats: Lista de formatos a generar (default: todos)
        use_cached_illustration: Usar ilustración cacheada si existe
        custom_illustration_path: Ruta a ilustración personalizada
        output_prefix: Prefijo para los archivos de salida

    Returns:
        dict con rutas de los archivos generados
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ILLUSTRATIONS_DIR, exist_ok=True)

    # Determinar formatos a generar
    if formats is None:
        formats = list(FORMATS.keys())

    # Obtener o generar ilustración
    illustration_path = None

    if custom_illustration_path and os.path.exists(custom_illustration_path):
        illustration_path = custom_illustration_path
        print(f"Usando ilustración personalizada: {illustration_path}")

    elif event_type in EVENT_PROMPTS:
        cached_path = os.path.join(ILLUSTRATIONS_DIR, f'{event_type}_illustration.png')

        if use_cached_illustration and os.path.exists(cached_path):
            illustration_path = cached_path
            print(f"Usando ilustración cacheada: {cached_path}")
        else:
            # Verificar si tenemos API key para generar
            if os.environ.get('GEMINI_API_KEY'):
                print(f"Generando ilustración para '{event_type}'...")
                try:
                    generate_illustration(
                        event_type=event_type,
                        output_path=cached_path
                    )
                    illustration_path = cached_path
                except Exception as e:
                    print(f"⚠ No se pudo generar ilustración: {e}")
                    print("  Continuando sin ilustración...")
            else:
                print("⚠ GEMINI_API_KEY no configurada - generando sin ilustración")

    # Generar gráficos para cada formato
    results = {}

    for format_name in formats:
        if format_name not in FORMATS:
            print(f"⚠ Formato desconocido: {format_name}")
            continue

        output_path = os.path.join(
            OUTPUT_DIR,
            f'{output_prefix}_{format_name}.png'
        )

        print(f"Generando {format_name}...")

        img = create_event_graphic(
            title=title,
            date=date,
            time=time,
            location=location,
            illustration_path=illustration_path,
            format_name=format_name,
            output_path=output_path
        )

        results[format_name] = output_path

    return results


def interactive_mode():
    """Modo interactivo para generar gráficos"""
    print("=" * 50)
    print("CASA Graphics Generator - Modo Interactivo")
    print("=" * 50)
    print()

    # Mostrar tipos de evento
    print("Tipos de evento disponibles:")
    for i, event_type in enumerate(EVENT_PROMPTS.keys(), 1):
        print(f"  {i}. {event_type}")
    print()

    # Obtener datos del evento
    title = input("Título del evento (ej: La Mesa Abierta): ").strip()
    if not title:
        title = "Evento CASA"

    date = input("Fecha (ej: Viernes 9 de Enero): ").strip()
    if not date:
        date = "Próximamente"

    time = input("Hora (ej: 19:00 hrs): ").strip()
    if not time:
        time = ""

    location = input("Ubicación: ").strip()
    if not location:
        location = "Iglesia San Andrés"

    event_type = input("Tipo de evento (default: generic): ").strip()
    if not event_type or event_type not in EVENT_PROMPTS:
        event_type = "generic"

    print()
    print("Generando gráficos...")
    print()

    # Generar slug para nombre de archivo
    slug = title.lower().replace(' ', '_').replace('\n', '_')[:20]

    results = generate_complete_graphic(
        title=title,
        date=date,
        time=time,
        location=location,
        event_type=event_type,
        output_prefix=slug
    )

    print()
    print("=" * 50)
    print("Gráficos generados:")
    for format_name, path in results.items():
        print(f"  - {format_name}: {path}")
    print("=" * 50)


def main():
    """Punto de entrada principal"""
    parser = argparse.ArgumentParser(
        description='CASA Graphics Generator'
    )

    parser.add_argument(
        '--interactive', '-i',
        action='store_true',
        help='Modo interactivo'
    )

    parser.add_argument(
        '--title', '-t',
        type=str,
        help='Título del evento'
    )

    parser.add_argument(
        '--date', '-d',
        type=str,
        help='Fecha del evento'
    )

    parser.add_argument(
        '--time',
        type=str,
        default='',
        help='Hora del evento'
    )

    parser.add_argument(
        '--location', '-l',
        type=str,
        default='Iglesia San Andrés',
        help='Ubicación del evento'
    )

    parser.add_argument(
        '--event-type', '-e',
        type=str,
        default='generic',
        choices=list(EVENT_PROMPTS.keys()),
        help='Tipo de evento para la ilustración'
    )

    parser.add_argument(
        '--format', '-f',
        type=str,
        choices=list(FORMATS.keys()),
        help='Formato específico a generar'
    )

    parser.add_argument(
        '--output-prefix', '-o',
        type=str,
        default='event',
        help='Prefijo para archivos de salida'
    )

    parser.add_argument(
        '--illustration',
        type=str,
        help='Ruta a ilustración personalizada'
    )

    parser.add_argument(
        '--list-types',
        action='store_true',
        help='Listar tipos de evento disponibles'
    )

    parser.add_argument(
        '--show-prompt',
        type=str,
        metavar='EVENT_TYPE',
        help='Mostrar prompt de ilustración para un tipo de evento'
    )

    args = parser.parse_args()

    # Listar tipos de evento
    if args.list_types:
        list_event_types()
        return

    # Mostrar prompt
    if args.show_prompt:
        print(generate_illustration_prompt(args.show_prompt))
        return

    # Modo interactivo
    if args.interactive:
        interactive_mode()
        return

    # Modo comando
    if not args.title:
        parser.print_help()
        print("\nEjemplo:")
        print('  python casa_graphics_generator.py -t "La Mesa\\nAbierta" -d "Viernes 9 de Enero" --time "19:00 hrs" -e mesa_abierta')
        return

    formats = [args.format] if args.format else None

    results = generate_complete_graphic(
        title=args.title,
        date=args.date or "Próximamente",
        time=args.time,
        location=args.location,
        event_type=args.event_type,
        formats=formats,
        custom_illustration_path=args.illustration,
        output_prefix=args.output_prefix
    )

    print("\nGráficos generados:")
    for format_name, path in results.items():
        print(f"  - {format_name}: {path}")


if __name__ == "__main__":
    main()
