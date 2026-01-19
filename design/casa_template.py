#!/usr/bin/env python3
"""
CASA Graphics Template Generator
Replica el diseño de Canva para generar gráficos de eventos

Layouts específicos por formato:
- PPT 4:3: Logo centrado, líneas ámbar, título izquierda, ilustración derecha
- IG Story: Sin logo, título grande arriba, iconos ámbar, ilustración abajo
- IG Post: (pendiente diseño)
- Facebook: (pendiente diseño)
"""

from PIL import Image, ImageDraw, ImageFont
import os

# ============================================
# CONFIGURACIÓN DE RUTAS
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE_DIR, 'fonts')
ICONS_DIR = os.path.join(BASE_DIR, 'icons')
LOGO_PATH = os.path.join(BASE_DIR, '..', 'public', 'lovable-uploads', '47301834-0831-465c-ae5e-47a978038312.png')

# ============================================
# COLORES BRAND (RGB)
# ============================================
COLORS = {
    'black': (26, 26, 26),           # #1A1A1A
    'amber': (212, 168, 83),         # #D4A853
    'white': (255, 255, 255),        # #FFFFFF
    'gray_light': (229, 229, 229),   # #E5E5E5
    'gray_illustration': (220, 220, 220),  # Para ilustración muy sutil
}

# ============================================
# FORMATOS DE SALIDA
# ============================================
FORMATS = {
    'ppt_4_3': (1024, 768),
    'instagram_post': (1080, 1080),
    'instagram_story': (1080, 1920),
    'facebook_post': (1200, 630),
}

# ============================================
# FUNCIONES DE FUENTE
# ============================================
def get_montserrat(size, weight='regular'):
    """Obtener fuente Montserrat"""
    if weight == 'light':
        font_path = os.path.join(FONTS_DIR, 'Montserrat-Light.ttf')
    else:
        font_path = os.path.join(FONTS_DIR, 'Montserrat.ttf')

    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    # Fallback
    return ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', size)

def get_merriweather(size, italic=False):
    """Obtener fuente Merriweather"""
    if italic:
        font_path = os.path.join(FONTS_DIR, 'Merriweather-Italic.ttf')
    else:
        font_path = os.path.join(FONTS_DIR, 'Merriweather-Regular.ttf')

    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    # Fallback
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf', size)


def draw_icon(draw, icon_type, x, y, size, color):
    """Dibuja iconos simples estilo línea"""
    line_width = max(2, size // 12)

    if icon_type == 'calendar':
        # Rectángulo del calendario
        draw.rectangle(
            [(x, y + size//5), (x + size, y + size)],
            outline=color, width=line_width
        )
        # Línea superior del calendario
        draw.line(
            [(x, y + size//3), (x + size, y + size//3)],
            fill=color, width=line_width
        )
        # Ganchos superiores
        draw.line([(x + size//4, y), (x + size//4, y + size//4)], fill=color, width=line_width)
        draw.line([(x + size*3//4, y), (x + size*3//4, y + size//4)], fill=color, width=line_width)
        # Grid interior
        for i in range(1, 3):
            # Líneas horizontales
            draw.line(
                [(x + size//8, y + size//3 + i * size//5),
                 (x + size - size//8, y + size//3 + i * size//5)],
                fill=color, width=1
            )
        for i in range(1, 4):
            # Líneas verticales
            draw.line(
                [(x + i * size//4, y + size//3 + size//10),
                 (x + i * size//4, y + size - size//10)],
                fill=color, width=1
            )

    elif icon_type == 'clock':
        # Círculo del reloj
        draw.ellipse(
            [(x, y), (x + size, y + size)],
            outline=color, width=line_width
        )
        # Centro
        center_x, center_y = x + size//2, y + size//2
        # Manecilla de hora (apuntando a las 12)
        draw.line(
            [(center_x, center_y), (center_x, y + size//4)],
            fill=color, width=line_width
        )
        # Manecilla de minutos (apuntando a las 3)
        draw.line(
            [(center_x, center_y), (x + size*3//4, center_y)],
            fill=color, width=line_width
        )

    elif icon_type == 'location':
        # Pin de ubicación
        center_x = x + size//2
        # Parte superior (círculo)
        draw.ellipse(
            [(x + size//4, y), (x + size*3//4, y + size//2)],
            outline=color, width=line_width
        )
        # Punto central
        draw.ellipse(
            [(center_x - size//8, y + size//6), (center_x + size//8, y + size//6 + size//4)],
            fill=color
        )
        # Punta inferior
        draw.polygon(
            [(x + size//4, y + size//3), (x + size*3//4, y + size//3), (center_x, y + size)],
            outline=color, width=line_width
        )


# ============================================
# FUNCIÓN DE TEXT WRAP
# ============================================
def wrap_text(text, font, max_width, draw):
    """
    Divide el texto en múltiples líneas para que no exceda max_width.
    Retorna una lista de líneas.
    """
    words = text.split(' ')
    lines = []
    current_line = []

    for word in words:
        # Probar agregar la palabra a la línea actual
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        text_width = bbox[2] - bbox[0]

        if text_width <= max_width:
            current_line.append(word)
        else:
            # La línea actual está completa, empezar una nueva
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]

    # Agregar la última línea
    if current_line:
        lines.append(' '.join(current_line))

    return lines


# ============================================
# LAYOUT: PPT 4:3 (Horizontal con logo y líneas)
# ============================================
def create_ppt_layout(img, draw, title, date, time, location, illustration_path, width, height, scale=1):
    """Layout para PPT/Slide 4:3 - Coordenadas exactas de Canva 1024x768, escaladas"""

    # Factor de escala (s) para multiplicar todas las coordenadas
    s = scale

    # Color ámbar exacto de Canva
    amber_canva = (184, 146, 61)  # #b8923d
    line_thickness = 4 * s  # Stroke weight de Canva

    # =============================================
    # ILUSTRACIÓN - DIBUJADA PRIMERO (detrás de todo)
    # =============================================
    # Original Canva: Width 336.2, Height 367, X 611, Y 194.7
    # Aumentado ~40%: Width 470, Height 513
    illust_width = 470
    illust_height = 513
    illust_x = 530  # Movido un poco a la izquierda para centrar mejor
    illust_y = 140  # Movido un poco arriba

    if illustration_path and os.path.exists(illustration_path):
        try:
            illustration = Image.open(illustration_path).convert('RGBA')
            # Redimensionar al nuevo tamaño * escala
            illustration = illustration.resize((illust_width * s, illust_height * s), Image.Resampling.LANCZOS)
            # Aplicar opacidad (15% para que sea muy sutil como en Canva)
            alpha = illustration.split()[3]
            alpha = alpha.point(lambda x: int(x * 0.15))
            illustration.putalpha(alpha)
            # Colocar en posición * escala
            img.paste(illustration, (illust_x * s, illust_y * s), illustration)
        except Exception as e:
            print(f"Warning: No se pudo cargar la ilustración: {e}")

    # LÍNEA ÁMBAR SUPERIOR IZQUIERDA
    # Start X 76.8 px - End X 425 px, Y 83.4 px
    draw.line(
        [(77 * s, 83 * s), (425 * s, 83 * s)],
        fill=amber_canva, width=line_thickness
    )

    # LÍNEA ÁMBAR SUPERIOR DERECHA
    # Start X 599 px - End X 947.2 px, Y 83.4 px
    draw.line(
        [(599 * s, 83 * s), (947 * s, 83 * s)],
        fill=amber_canva, width=line_thickness
    )

    # LÍNEA ÁMBAR INFERIOR
    # Start X 74.5 px - End X 947.2 px, Y 690.2 px
    draw.line(
        [(75 * s, 690 * s), (947 * s, 690 * s)],
        fill=amber_canva, width=line_thickness
    )

    # LOGO CASA
    # Width/Height 109.8 px, Position X 457.1, Y 33.6
    logo_size = 110 * s
    logo_x = 457 * s
    logo_y = 34 * s
    try:
        logo = Image.open(LOGO_PATH).convert('RGBA')
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        img.paste(logo, (logo_x, logo_y), logo)
    except Exception as e:
        print(f"Warning: No se pudo cargar el logo: {e}")

    # TÍTULO "La Mesa Abierta"
    # Montserrat tamaño 86 en Canva, ajustado a 115 para coincidir visualmente
    title_font = get_montserrat(115 * s, weight='light')
    title = title.replace('\\n', '\n')
    draw.text((59 * s, 151 * s), title, font=title_font, fill=COLORS['black'])

    # ÍCONO CALENDARIO
    # Width 39.3, Height 42.9, X 74.5, Y 440.4
    draw_icon(draw, 'calendar', 75 * s, 440 * s, 40 * s, amber_canva)

    # TEXTO FECHA - Merriweather 23 en Canva, ajustado a 31 para coincidir
    detail_font = get_merriweather(31 * s, italic=True)
    draw.text((129 * s, 444 * s), date, font=detail_font, fill=amber_canva)

    # ÍCONO HORA (reloj)
    # Width 39.3, Height 39.3, X 76.8, Y 498.7
    draw_icon(draw, 'clock', 77 * s, 499 * s, 39 * s, amber_canva)

    # TEXTO HORA - X 129, Y 500.2
    draw.text((129 * s, 500 * s), time, font=detail_font, fill=amber_canva)

    # ÍCONO UBICACIÓN
    # Width 39.3, Height 48.8, X 74.5, Y 550.6
    draw_icon(draw, 'location', 75 * s, 551 * s, 40 * s, amber_canva)

    # TEXTO UBICACIÓN - X 131, Y 556.5
    draw.text((131 * s, 557 * s), location, font=detail_font, fill=amber_canva)


# ============================================
# LAYOUT: Instagram Story (Vertical 9:16, sin logo ni líneas)
# ============================================
def create_ig_story_layout(img, draw, title, date, time, location, illustration_path, width, height):
    """Layout para Instagram Story 9:16 - Coordenadas exactas de Canva 1080x1920"""
    scale = width / 1080  # Base scale desde 1080px
    s = scale  # Alias corto

    # Color ámbar exacto de Canva
    amber_canva = (184, 146, 61)  # #b8923d

    # =============================================
    # ILUSTRACIÓN - DIBUJADA PRIMERO (detrás de todo)
    # =============================================
    # Original: Width 635.6, Height 693.7, X 198.7, Y 919.1
    # Aumentado 50%: Width 954, Height 1041
    if illustration_path and os.path.exists(illustration_path):
        try:
            illustration = Image.open(illustration_path).convert('RGBA')
            # 50% más grande que el original
            illust_width = int(954 * s)
            illust_height = int(1041 * s)
            illustration = illustration.resize((illust_width, illust_height), Image.Resampling.LANCZOS)
            # Aplicar opacidad 15%
            alpha = illustration.split()[3]
            alpha = alpha.point(lambda x: int(x * 0.15))
            illustration.putalpha(alpha)
            # Ajustar posición para centrar mejor con el nuevo tamaño
            illust_x = int(63 * s)  # Más a la izquierda
            illust_y = int(750 * s)  # Más arriba para compensar el tamaño
            img.paste(illustration, (illust_x, illust_y), illustration)
        except Exception as e:
            print(f"Warning: No se pudo cargar la ilustración: {e}")

    # TÍTULO - Montserrat Regular 175px, X 72.4, Y 286
    title_font = get_montserrat(int(175 * s), weight='regular')
    title = title.replace('\\n', '\n')
    # Dibujar línea por línea con espaciado mínimo
    title_lines = title.split('\n')
    title_y = int(286 * s)
    line_spacing = int(145 * s)  # Espaciado mínimo para 175px
    for line in title_lines:
        draw.text((int(72 * s), title_y), line, font=title_font, fill=COLORS['black'])
        title_y += line_spacing

    # DETALLES - Merriweather Regular 65px, color ámbar
    detail_font = get_merriweather(int(65 * s), italic=False)

    # ÍCONO CALENDARIO - Width 69, Height 75.4, X 72.4, Y 806.5
    draw_icon(draw, 'calendar', int(72 * s), int(807 * s), int(69 * s), amber_canva)
    # TEXTO FECHA - X 160.7, Y 798.4
    draw.text((int(161 * s), int(798 * s)), date, font=detail_font, fill=amber_canva)

    # ÍCONO HORA - Width 69, Height 69, X 72.4, Y 973.7
    draw_icon(draw, 'clock', int(72 * s), int(974 * s), int(69 * s), amber_canva)
    # TEXTO HORA - X 160.7, Y 960.1
    draw.text((int(161 * s), int(960 * s)), time, font=detail_font, fill=amber_canva)

    # ÍCONO UBICACIÓN - Width 69, Height 85.6, X 72.4, Y 1121.8
    draw_icon(draw, 'location', int(72 * s), int(1122 * s), int(69 * s), amber_canva)
    # TEXTO UBICACIÓN con wrap - X 160.7, Y 1121.8
    text_x = int(161 * s)
    text_y = int(1122 * s)
    max_text_width = int(850 * s)  # Ancho máximo antes de wrap
    location_lines = wrap_text(location, detail_font, max_text_width, draw)
    line_height = int(70 * s)
    for line in location_lines:
        draw.text((text_x, text_y), line, font=detail_font, fill=amber_canva)
        text_y += line_height


# ============================================
# LAYOUT: Instagram Post (Cuadrado 1:1)
# ============================================
def create_ig_post_layout(img, draw, title, date, time, location, illustration_path, width, height):
    """Layout para Instagram Post 1:1 - Coordenadas exactas de Canva 1080x1080"""
    scale = width / 1080  # Base scale desde 1080px
    s = scale  # Alias corto

    # Color ámbar exacto de Canva
    amber_canva = (184, 146, 61)  # #b8923d
    line_thickness = int(4 * s)

    # =============================================
    # ILUSTRACIÓN - DIBUJADA PRIMERO (detrás de todo)
    # =============================================
    # Original: Width 635.6, Height 693.7, X 396.6, Y 175.2
    # Aumentado 50%: Width 954, Height 1041
    if illustration_path and os.path.exists(illustration_path):
        try:
            illustration = Image.open(illustration_path).convert('RGBA')
            # 50% más grande que el original
            illust_width = int(954 * s)
            illust_height = int(1041 * s)
            illustration = illustration.resize((illust_width, illust_height), Image.Resampling.LANCZOS)
            # Aplicar opacidad 15%
            alpha = illustration.split()[3]
            alpha = alpha.point(lambda x: int(x * 0.15))
            illustration.putalpha(alpha)
            # Ajustar posición para el nuevo tamaño (más a la izquierda y arriba)
            illust_x = int(240 * s)
            illust_y = int(0 * s)
            img.paste(illustration, (illust_x, illust_y), illustration)
        except Exception as e:
            print(f"Warning: No se pudo cargar la ilustración: {e}")

    # LÍNEA ÁMBAR SUPERIOR (completa)
    # Start X 42, End X 1038, Y 109
    draw.line(
        [(int(42 * s), int(109 * s)), (int(1038 * s), int(109 * s))],
        fill=amber_canva, width=line_thickness
    )

    # LÍNEA ÁMBAR INFERIOR IZQUIERDA
    # Start X 41.5, End X 460.8, Y 940.2
    draw.line(
        [(int(42 * s), int(940 * s)), (int(461 * s), int(940 * s))],
        fill=amber_canva, width=line_thickness
    )

    # LÍNEA ÁMBAR INFERIOR DERECHA
    # Start X 612.9, End X 1032.2, Y 940.2
    draw.line(
        [(int(613 * s), int(940 * s)), (int(1032 * s), int(940 * s))],
        fill=amber_canva, width=line_thickness
    )

    # LOGO CASA (centrado abajo entre las líneas)
    # Width 86.5, Height 86.5, X 496.8, Y 900.7
    logo_size = int(87 * s)
    try:
        logo = Image.open(LOGO_PATH).convert('RGBA')
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        img.paste(logo, (int(497 * s), int(901 * s)), logo)
    except Exception as e:
        print(f"Warning: No se pudo cargar el logo: {e}")

    # TÍTULO "La Mesa Abierta"
    # Montserrat Regular 140 (ajustado para coincidir visualmente con Canva), X 42, Y 140.5
    title_font = get_montserrat(int(140 * s), weight='regular')
    title = title.replace('\\n', '\n')
    # Dibujar línea por línea con espaciado mínimo
    title_lines = title.split('\n')
    title_y = int(140 * s)
    line_spacing = int(115 * s)  # Mínimo, que casi se toquen
    for line in title_lines:
        draw.text((int(42 * s), title_y), line, font=title_font, fill=COLORS['black'])
        title_y += line_spacing

    # DETALLES - Merriweather Regular 47, color ámbar
    detail_font = get_merriweather(int(47 * s), italic=False)

    # ÍCONO CALENDARIO - Width 52.4, Height 57.2, X 42, Y 486.4
    draw_icon(draw, 'calendar', int(42 * s), int(486 * s), int(52 * s), amber_canva)
    # TEXTO FECHA - X 109.1, Y 480.3
    draw.text((int(109 * s), int(480 * s)), date, font=detail_font, fill=amber_canva)

    # ÍCONO HORA - Width 52.4, Height 52.4, X 42, Y 613.3
    draw_icon(draw, 'clock', int(42 * s), int(613 * s), int(52 * s), amber_canva)
    # TEXTO HORA - X 109.1, Y 603
    draw.text((int(109 * s), int(603 * s)), time, font=detail_font, fill=amber_canva)

    # ÍCONO UBICACIÓN - Width 52.4, Height 65, X 42, Y 725.8
    draw_icon(draw, 'location', int(42 * s), int(726 * s), int(52 * s), amber_canva)
    # TEXTO UBICACIÓN con wrap - X 109.1, Y 725.8
    text_x = int(109 * s)
    text_y = int(726 * s)
    max_text_width = int(500 * s)  # Ancho máximo antes de wrap
    location_lines = wrap_text(location, detail_font, max_text_width, draw)
    line_height = int(50 * s)
    for line in location_lines:
        draw.text((text_x, text_y), line, font=detail_font, fill=amber_canva)
        text_y += line_height


# ============================================
# LAYOUT: Facebook Post (Horizontal ancho, 1200x630)
# ============================================
def create_fb_post_layout(img, draw, title, date, time, location, illustration_path, width, height):
    """Layout para Facebook Post 1200x630 - Coordenadas exactas de Canva"""
    scale = width / 1200  # Base scale desde 1200px
    s = scale  # Alias corto

    # Color ámbar exacto de Canva
    amber_canva = (184, 146, 61)  # #b8923d
    line_thickness = int(4 * s)

    # =============================================
    # ILUSTRACIÓN - DIBUJADA PRIMERO (detrás de todo)
    # =============================================
    # Canva: Width 454.4, Height 495.9, X 94.6, Y 63
    # Aumentado 20% (antes 50%): Width 545, Height 595
    if illustration_path and os.path.exists(illustration_path):
        try:
            illustration = Image.open(illustration_path).convert('RGBA')
            # 20% más grande que el original (reducido de 50%)
            illust_width = int(545 * s)
            illust_height = int(595 * s)
            illustration = illustration.resize((illust_width, illust_height), Image.Resampling.LANCZOS)
            # Aplicar opacidad ~13% (15% menos que el 15% estándar)
            alpha = illustration.split()[3]
            alpha = alpha.point(lambda x: int(x * 0.13))
            illustration.putalpha(alpha)
            # Posición ajustada para el tamaño reducido
            illust_x = int(50 * s)
            illust_y = int(20 * s)
            img.paste(illustration, (illust_x, illust_y), illustration)
        except Exception as e:
            print(f"Warning: No se pudo cargar la ilustración: {e}")

    # LÍNEA ÁMBAR SUPERIOR
    # Canva: (63, 63) a (1137, 63)
    draw.line(
        [(int(63 * s), int(63 * s)), (int(1137 * s), int(63 * s))],
        fill=amber_canva, width=line_thickness
    )

    # LÍNEA ÁMBAR INFERIOR (más corta, deja espacio para logo)
    # Canva: (63, 560.4) a (1025.2, 560.4)
    draw.line(
        [(int(63 * s), int(560 * s)), (int(1025 * s), int(560 * s))],
        fill=amber_canva, width=line_thickness
    )

    # LOGO CASA (esquina inferior derecha)
    # Canva: Width 93.2, Height 93.2, X 1043.8, Y 512.3
    logo_size = int(93 * s)
    try:
        logo = Image.open(LOGO_PATH).convert('RGBA')
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        img.paste(logo, (int(1044 * s), int(512 * s)), logo)
    except Exception as e:
        print(f"Warning: No se pudo cargar el logo: {e}")

    # TÍTULO - Montserrat Regular 130px (reducido de 150)
    # Canva: X 63, Y 138.5
    title_font = get_montserrat(int(130 * s), weight='regular')
    title = title.replace('\\n', '\n')
    title_lines = title.split('\n')
    title_y = int(138 * s)
    line_spacing = int(125 * s)  # Espaciado para 150px
    for line in title_lines:
        draw.text((int(63 * s), title_y), line, font=title_font, fill=COLORS['black'])
        title_y += line_spacing

    # DETALLES - Merriweather Regular 34px, color ámbar
    detail_font = get_merriweather(int(34 * s), italic=False)
    icon_size = int(36 * s)

    # ÍCONO CALENDARIO - Width 36.1, Height 39.5, X 644.9, Y 174.1
    draw_icon(draw, 'calendar', int(645 * s), int(174 * s), icon_size, amber_canva)
    # TEXTO FECHA - X 691.2, Y 169.9
    draw.text((int(691 * s), int(170 * s)), date, font=detail_font, fill=amber_canva)

    # ÍCONO HORA - Width 36.1, Height 36.1, X 644.9, Y 261.7
    draw_icon(draw, 'clock', int(645 * s), int(262 * s), icon_size, amber_canva)
    # TEXTO HORA - X 691.2, Y 254.6
    draw.text((int(691 * s), int(255 * s)), time, font=detail_font, fill=amber_canva)

    # ÍCONO UBICACIÓN - Width 36.1, Height 44.9, X 644.9, Y 339.3
    draw_icon(draw, 'location', int(645 * s), int(339 * s), icon_size, amber_canva)
    # TEXTO UBICACIÓN con wrap - X 691.2, Y 339.3
    text_x = int(691 * s)
    text_y = int(339 * s)
    max_text_width = int(430 * s)  # Ancho máximo antes de wrap
    location_lines = wrap_text(location, detail_font, max_text_width, draw)
    line_height = int(38 * s)
    for line in location_lines:
        draw.text((text_x, text_y), line, font=detail_font, fill=amber_canva)
        text_y += line_height


# ============================================
# FUNCIÓN AUXILIAR: Agregar ilustración
# ============================================
def add_illustration(img, illustration_path, width, height,
                    position='right', opacity=0.15, max_width_pct=0.4, max_height_pct=0.5):
    """Agrega ilustración con posición y opacidad configurables"""
    try:
        illustration = Image.open(illustration_path).convert('RGBA')

        # Calcular tamaño máximo
        max_width = int(width * max_width_pct)
        max_height = int(height * max_height_pct)

        # Mantener aspect ratio
        illust_ratio = illustration.width / illustration.height
        if illust_ratio > max_width / max_height:
            new_width = max_width
            new_height = int(max_width / illust_ratio)
        else:
            new_height = max_height
            new_width = int(max_height * illust_ratio)

        illustration = illustration.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Aplicar opacidad
        alpha = illustration.split()[3]
        alpha = alpha.point(lambda x: int(x * opacity))
        illustration.putalpha(alpha)

        # Calcular posición
        margin = int(min(width, height) * 0.05)

        if position == 'right_edge':
            # Extender hasta el borde derecho (como en diseño Canva PPT/FB)
            illust_x = width - new_width + int(new_width * 0.2)  # Sale del borde derecho
            illust_y = (height - new_height) // 2
        elif position == 'bottom_right':
            # Esquina inferior derecha, sale de ambos bordes (como IG Post 1:1)
            illust_x = width - new_width + int(new_width * 0.15)  # Sale del borde derecho
            illust_y = height - new_height + int(new_height * 0.15)  # Sale del borde inferior
        elif position == 'bottom_full':
            # Parte inferior, centrado pero ancho, sale de bordes (como IG Story)
            illust_x = (width - new_width) // 2
            illust_y = height - new_height + int(new_height * 0.2)  # Sale del borde inferior
        elif position == 'right':
            illust_x = width - margin - new_width
            illust_y = (height - new_height) // 2
        elif position == 'bottom':
            illust_x = (width - new_width) // 2
            illust_y = height - new_height - margin
        elif position == 'bottom_edge':
            # Extender hasta el borde inferior
            illust_x = (width - new_width) // 2
            illust_y = height - new_height + int(new_height * 0.1)
        elif position == 'center':
            illust_x = (width - new_width) // 2
            illust_y = (height - new_height) // 2
        elif position == 'left':
            illust_x = margin
            illust_y = (height - new_height) // 2
        else:
            illust_x = margin
            illust_y = margin

        img.paste(illustration, (illust_x, illust_y), illustration)

    except Exception as e:
        print(f"Warning: No se pudo cargar la ilustración: {e}")


# ============================================
# FUNCIÓN PRINCIPAL DE TEMPLATE
# ============================================
def create_event_graphic(
    title: str,
    date: str,
    time: str,
    location: str,
    illustration_path: str = None,
    format_name: str = 'ppt_4_3',
    output_path: str = None,
    scale: int = 2
) -> Image.Image:
    """
    Crea un gráfico de evento siguiendo el template CASA

    Args:
        title: Título del evento (ej: "La Mesa Abierta")
        date: Fecha (ej: "Viernes 9 de Enero")
        time: Hora (ej: "19:00 hrs")
        location: Lugar (ej: "En diversas casas de la comunidad")
        illustration_path: Ruta a imagen de ilustración (opcional)
        format_name: Formato de salida (ppt_4_3, instagram_post, etc.)
        output_path: Ruta donde guardar la imagen
        scale: Factor de escala para alta resolución (default: 2 = 2x)

    Returns:
        PIL Image object
    """
    # Obtener dimensiones base
    base_width, base_height = FORMATS.get(format_name, FORMATS['ppt_4_3'])

    # Aplicar escala para alta resolución
    width = base_width * scale
    height = base_height * scale

    # Crear imagen base a alta resolución
    img = Image.new('RGB', (width, height), COLORS['white'])
    draw = ImageDraw.Draw(img)

    # Seleccionar layout según formato (pasamos scale para ajustar fuentes/elementos)
    if format_name == 'instagram_story':
        create_ig_story_layout(img, draw, title, date, time, location, illustration_path, width, height)
    elif format_name == 'instagram_post':
        create_ig_post_layout(img, draw, title, date, time, location, illustration_path, width, height)
    elif format_name == 'facebook_post':
        create_fb_post_layout(img, draw, title, date, time, location, illustration_path, width, height)
    else:  # ppt_4_3 y default
        create_ppt_layout(img, draw, title, date, time, location, illustration_path, width, height, scale)

    # Guardar si se especificó ruta
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path, 'PNG', quality=95)
        print(f"✓ Guardado: {output_path} ({width}x{height})")

    return img


# ============================================
# FUNCIÓN DE PRUEBA
# ============================================
def test_template():
    """Genera un gráfico de prueba con el template"""

    output_dir = os.path.join(BASE_DIR, 'output')
    os.makedirs(output_dir, exist_ok=True)

    # Datos de prueba
    illustration_path = os.path.join(BASE_DIR, 'illustrations', 'mesa_abierta_illustration.png')

    event_data = {
        'title': 'La Mesa\nAbierta',
        'date': 'Viernes 9 de Enero',
        'time': '19:00 hrs',
        'location': 'En diversas casas de la comunidad',
        'illustration_path': illustration_path if os.path.exists(illustration_path) else None,
    }

    print("=" * 50)
    print("CASA Template Generator - Test")
    print("=" * 50)

    # Generar en todos los formatos
    for format_name, (w, h) in FORMATS.items():
        output_path = os.path.join(output_dir, f'test_{format_name}.png')

        print(f"\nGenerando {format_name} ({w}x{h})...")

        create_event_graphic(
            **event_data,
            format_name=format_name,
            output_path=output_path
        )

    print("\n" + "=" * 50)
    print(f"Archivos generados en: {output_dir}")
    print("=" * 50)


if __name__ == "__main__":
    test_template()
