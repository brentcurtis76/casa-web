#!/usr/bin/env python3
"""
CASA Illustration Generator - Google AI Integration
Genera ilustraciones estilo blueprint/línea para gráficos de eventos

Usa google.genai (nuevo SDK) para generación de imágenes con Imagen 3
"""

import os
from PIL import Image
import io
import base64

# ============================================
# CONFIGURACIÓN
# ============================================
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# Estilo base para todas las ilustraciones
BASE_STYLE_PROMPT = """
Create an abstract, artistic line drawing illustration.

CRITICAL REQUIREMENTS:
- ABSOLUTELY NO TEXT of any kind in the image
- NO labels, NO annotations, NO captions, NO metadata
- The image must be PURELY VISUAL with ZERO written words

ARTISTIC STYLE - Very Important:
- Abstract and suggestive, NOT literal or realistic
- Loose, gestural lines that SUGGEST the subject rather than depicting it precisely
- Think: quick artistic sketch, not technical drawing
- Lines should be expressive and fluid, like a single continuous stroke
- Minimalist: use the FEWEST lines possible to evoke the concept
- Style inspiration: Matisse line drawings, Picasso single-line art, Japanese sumi-e
- The viewer should FEEL the subject, not see an exact representation
- Embrace negative space - what you DON'T draw is as important as what you draw
- Lines: Medium gray (#888888), varying thickness for artistic expression
- Background: Solid white
- NO detailed objects, NO realistic proportions, NO technical precision
"""

# ============================================
# PROMPTS POR TIPO DE EVENTO
# ============================================
EVENT_PROMPTS = {
    "mesa_abierta": """
    Subject: The FEELING of gathering around a table

    DO NOT draw a literal table with chairs. Instead, evoke:
    - Circular or curved lines suggesting togetherness
    - Abstract shapes that hint at gathering, communion, sharing
    - Perhaps overlapping circles suggesting plates or people
    - A single continuous line that flows and connects
    - The warmth of breaking bread together

    Think of it as: "What does community feel like?" not "What does a table look like?"

    Style: Like a quick sketch an artist would make to capture the ESSENCE of a dinner gathering in just a few strokes.
    """,

    "culto_dominical": """
    Subject: Sacred worship space
    Elements to include:
    - Simple altar or communion table
    - Cross element (subtle, not dominant)
    - Candles (2-3)
    - Open book suggesting liturgy
    - Architectural arches or window suggestion

    The illustration should evoke reverence and sacred gathering.
    """,

    "estudio_biblico": """
    Subject: Contemplative study scene
    Elements to include:
    - Open book (Bible)
    - Reading lamp or candle
    - Coffee cup or tea
    - Notebook with pen
    - Perhaps glasses
    - Cozy, intimate setting

    The illustration should evoke learning, reflection, and community discussion.
    """,

    "retiro": """
    Subject: Nature retreat setting
    Elements to include:
    - Mountain or hill silhouettes
    - Simple trees (perhaps 2-3)
    - Path or trail
    - Sun or moon suggestion
    - Birds in flight (simple lines)

    The illustration should evoke peace, nature, and spiritual journey.
    """,

    "navidad": """
    Subject: Nativity / Christmas scene
    Elements to include:
    - Simple stable structure
    - Star above
    - Manger suggestion
    - Perhaps shepherds or wise men silhouettes
    - Minimal decorative elements

    The illustration should evoke the sacred simplicity of Christmas.
    """,

    "cuaresma": """
    Subject: Lenten contemplation
    Elements to include:
    - Cross (central but not overwhelming)
    - Crown of thorns (subtle)
    - Desert landscape suggestion
    - Sparse vegetation
    - Path leading forward

    The illustration should evoke reflection, journey, and preparation.
    """,

    "pascua": """
    Subject: Easter resurrection
    Elements to include:
    - Empty tomb (stone rolled away)
    - Sunrise rays
    - Lilies or spring flowers
    - Garden setting
    - Light breaking through

    The illustration should evoke hope, renewal, and joy.
    """,

    "bautismo": """
    Subject: Baptism scene
    Elements to include:
    - Water (waves or river)
    - Shell (baptismal symbol)
    - Dove descending
    - Light rays from above
    - Simple font or basin

    The illustration should evoke new life and sacred ritual.
    """,

    "comunidad": """
    Subject: Community gathering
    Elements to include:
    - Circle of simple human figures
    - Joined hands suggestion
    - Central focal point (cross, candle, or table)
    - Inclusive, welcoming arrangement
    - Unity and connection

    The illustration should evoke belonging and togetherness.
    """,

    "musica": """
    Subject: Sacred music
    Elements to include:
    - Musical notes floating
    - Simple instrument (guitar, piano keys, or organ pipes)
    - Sound waves
    - Perhaps choir silhouettes
    - Hymnal or sheet music

    The illustration should evoke worship through music.
    """,

    "oracion": """
    Subject: Prayer and meditation
    Elements to include:
    - Praying hands
    - Candle flame
    - Rosary or prayer beads
    - Kneeling figure silhouette
    - Ascending elements (smoke, light)

    The illustration should evoke contemplation and connection with the divine.
    """,

    "generic": """
    Subject: Anglican church symbol
    Elements to include:
    - Canterbury cross or Celtic cross
    - Architectural church elements
    - Candles
    - Simple floral elements
    - Open doors (welcoming)

    The illustration should evoke the Anglican tradition with warmth.
    """
}


def generate_illustration_prompt(event_type: str, custom_elements: str = None) -> str:
    """
    Genera el prompt completo para Gemini

    Args:
        event_type: Tipo de evento (mesa_abierta, culto_dominical, etc.)
        custom_elements: Elementos adicionales específicos del evento

    Returns:
        Prompt completo para la API de Gemini
    """
    # Obtener prompt base del tipo de evento
    event_prompt = EVENT_PROMPTS.get(event_type, EVENT_PROMPTS['generic'])

    # Construir prompt completo
    full_prompt = f"""
{BASE_STYLE_PROMPT}

{event_prompt}

Additional requirements:
- Output size: 800x600 pixels (will be scaled)
- The illustration will be placed on the RIGHT side of a graphic
- Leave more visual weight on the left side of the composition
- The final image will be made very transparent (15% opacity)
- Must work well when overlaid on a white/cream background
"""

    if custom_elements:
        full_prompt += f"""
Custom elements to incorporate:
{custom_elements}
"""

    return full_prompt


def generate_illustration(
    event_type: str,
    custom_elements: str = None,
    output_path: str = None
) -> Image.Image:
    """
    Genera una ilustración usando Google Imagen 3 API

    Args:
        event_type: Tipo de evento
        custom_elements: Elementos adicionales
        output_path: Ruta donde guardar la imagen

    Returns:
        PIL Image object
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable not set")

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ImportError("Instala google-genai: pip install google-genai")

    # Crear cliente
    client = genai.Client(api_key=GEMINI_API_KEY)

    # Generar prompt
    prompt = generate_illustration_prompt(event_type, custom_elements)

    # Llamar a la API de generación de imágenes (Imagen 4.0)
    try:
        response = client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=4,
                aspect_ratio="1:1",
            )
        )

        # Procesar respuesta - guardar las 4 opciones
        if response.generated_images:
            images = []

            if output_path:
                # Crear directorio si no existe
                output_dir = os.path.dirname(output_path) if os.path.dirname(output_path) else '.'
                os.makedirs(output_dir, exist_ok=True)

                # Obtener nombre base sin extensión
                base_name = os.path.splitext(output_path)[0]

                # Guardar cada imagen con sufijo _1, _2, _3, _4
                for i, gen_image in enumerate(response.generated_images, 1):
                    image_bytes = gen_image.image.image_bytes
                    image = Image.open(io.BytesIO(image_bytes))
                    images.append(image)

                    option_path = f"{base_name}_{i}.png"
                    image.save(option_path, 'PNG')
                    print(f"✓ Opción {i} guardada: {option_path}")

                print(f"\n📁 {len(images)} opciones generadas en: {output_dir}/")
            else:
                # Sin output_path, solo devolver la primera imagen
                image_bytes = response.generated_images[0].image.image_bytes
                images.append(Image.open(io.BytesIO(image_bytes)))

            return images[0]  # Devolver la primera para compatibilidad

    except Exception as e:
        # Fallback: intentar con gemini-2.0-flash si Imagen no está disponible
        print(f"Imagen 3 no disponible ({e}), intentando con Gemini Flash...")

        # Usar Gemini para descripción y crear placeholder
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=f"Describe brevemente en español una ilustración minimalista estilo blueprint para: {event_type}"
        )

        print(f"Descripción generada: {response.text[:200]}...")

        # Crear imagen placeholder gris
        placeholder = Image.new('RGBA', (800, 600), (220, 220, 220, 50))
        if output_path:
            os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
            placeholder.save(output_path, 'PNG')
            print(f"✓ Placeholder guardado: {output_path}")

        return placeholder

    raise Exception("No se pudo generar la imagen")


def list_event_types():
    """Lista todos los tipos de evento disponibles"""
    print("Tipos de evento disponibles:")
    print("-" * 40)
    for event_type in EVENT_PROMPTS.keys():
        print(f"  - {event_type}")
    print("-" * 40)


# ============================================
# TEST
# ============================================
if __name__ == "__main__":
    list_event_types()

    print("\nPara generar una ilustración:")
    print("  1. Exporta GEMINI_API_KEY='tu-api-key'")
    print("  2. Ejecuta: python gemini_illustration_prompt.py")
    print("\nEjemplo de prompt para 'mesa_abierta':")
    print("=" * 50)
    print(generate_illustration_prompt("mesa_abierta"))
