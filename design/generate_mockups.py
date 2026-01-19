#!/usr/bin/env python3
"""
CASA Graphics Mockup Generator
Filosofía: Silencio Sagrado - Minimalismo contemplativo con calidez
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math

# ============================================
# CASA BRAND COLORS
# ============================================
COLORS = {
    'black': (26, 26, 26),           # #1A1A1A
    'amber': (212, 168, 83),         # #D4A853
    'amber_light': (232, 201, 122),  # #E8C97A
    'amber_dark': (184, 146, 61),    # #B8923D
    'white': (247, 247, 247),        # #F7F7F7
    'cream': (250, 248, 245),        # Slightly warmer
    'charcoal': (51, 51, 51),        # #333333
    'gray_dark': (85, 85, 85),       # #555555
    'gray_medium': (138, 138, 138),  # #8A8A8A
    'gray_light': (229, 229, 229),   # #E5E5E5
}

# ============================================
# OUTPUT FORMATS
# ============================================
FORMATS = {
    'instagram_post': (1080, 1080),
    'instagram_story': (1080, 1920),
    'ppt_slide': (1024, 768),
    'facebook_post': (1200, 630),
}

# ============================================
# FONT PATHS (macOS system fonts as fallback)
# ============================================
def get_font(name, size):
    """Get font with fallbacks"""
    # Ensure minimum font size
    size = max(10, int(size))

    font_paths = {
        'serif': [
            '/System/Library/Fonts/Supplemental/Georgia.ttf',
            '/System/Library/Fonts/NewYork.ttf',
            '/System/Library/Fonts/Times New Roman.ttf',
        ],
        'sans': [
            '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/System/Library/Fonts/Supplemental/Helvetica.ttc',
        ],
        'light': [
            '/System/Library/Fonts/Supplemental/Georgia.ttf',
        ]
    }

    for path in font_paths.get(name, font_paths['sans']):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return ImageFont.load_default()


def draw_gradient_arc(draw, center, radius, start_angle, end_angle, color_start, color_end, width=2):
    """Draw a gradient arc"""
    steps = 50
    for i in range(steps):
        t = i / steps
        angle1 = start_angle + t * (end_angle - start_angle)
        angle2 = start_angle + (t + 1/steps) * (end_angle - start_angle)

        # Interpolate color
        r = int(color_start[0] + t * (color_end[0] - color_start[0]))
        g = int(color_start[1] + t * (color_end[1] - color_start[1]))
        b = int(color_start[2] + t * (color_end[2] - color_start[2]))

        # Calculate points
        x1 = center[0] + radius * math.cos(math.radians(angle1))
        y1 = center[1] + radius * math.sin(math.radians(angle1))
        x2 = center[0] + radius * math.cos(math.radians(angle2))
        y2 = center[1] + radius * math.sin(math.radians(angle2))

        draw.line([(x1, y1), (x2, y2)], fill=(r, g, b), width=width)


def draw_subtle_gradient(img, start_color, end_color, direction='vertical', opacity=0.15):
    """Draw a subtle gradient overlay"""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    width, height = img.size

    if direction == 'vertical':
        for y in range(height):
            t = y / height
            r = int(start_color[0] + t * (end_color[0] - start_color[0]))
            g = int(start_color[1] + t * (end_color[1] - start_color[1]))
            b = int(start_color[2] + t * (end_color[2] - start_color[2]))
            alpha = int(255 * opacity * (1 - t * 0.5))
            draw.line([(0, y), (width, y)], fill=(r, g, b, alpha))

    elif direction == 'diagonal':
        for i in range(width + height):
            t = i / (width + height)
            r = int(start_color[0] + t * (end_color[0] - start_color[0]))
            g = int(start_color[1] + t * (end_color[1] - start_color[1]))
            b = int(start_color[2] + t * (end_color[2] - start_color[2]))
            alpha = int(255 * opacity * (1 - t * 0.7))

            x1 = max(0, i - height)
            y1 = min(i, height)
            x2 = min(i, width)
            y2 = max(0, i - width)
            draw.line([(x1, y1), (x2, y2)], fill=(r, g, b, alpha))

    return Image.alpha_composite(img.convert('RGBA'), overlay)


def create_mesa_abierta_graphic(size, format_name):
    """
    Create La Mesa Abierta graphic

    Design concept:
    - Minimal, contemplative
    - Subtle amber gradient accent
    - Generous whitespace
    - Typography as focal point
    """
    width, height = size

    # Create base image with warm cream background
    img = Image.new('RGB', size, COLORS['cream'])
    draw = ImageDraw.Draw(img)

    # Convert to RGBA for gradient work
    img = img.convert('RGBA')

    # ============================================
    # SUBTLE GRADIENT ACCENT
    # Amber gradient emerging from bottom-left corner
    # ============================================
    gradient_overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(gradient_overlay)

    # Create radial-ish gradient from corner
    max_dist = math.sqrt(width**2 + height**2)
    corner = (0, height)  # Bottom-left

    for y in range(height):
        for x in range(width):
            dist = math.sqrt((x - corner[0])**2 + (y - corner[1])**2)
            t = dist / (max_dist * 0.4)  # Gradient reaches ~40% of diagonal

            if t < 1:
                alpha = int(30 * (1 - t)**2)  # Subtle fade
                grad_draw.point((x, y), fill=(*COLORS['amber_light'], alpha))

    img = Image.alpha_composite(img, gradient_overlay)
    draw = ImageDraw.Draw(img)

    # ============================================
    # DECORATIVE ELEMENT: Subtle arc
    # ============================================
    arc_radius = min(width, height) * 0.35
    arc_center = (width * 0.15, height * 0.85)

    # Draw subtle arc with gradient
    for i in range(30):
        t = i / 30
        alpha = int(40 * (1 - t))
        offset = i * 2
        draw.arc(
            [
                (arc_center[0] - arc_radius - offset, arc_center[1] - arc_radius - offset),
                (arc_center[0] + arc_radius + offset, arc_center[1] + arc_radius + offset)
            ],
            start=250, end=340,
            fill=(*COLORS['amber'], alpha),
            width=1
        )

    # ============================================
    # TYPOGRAPHY
    # ============================================

    # Calculate responsive sizes based on canvas
    scale = min(width, height) / 1080

    # Title: "La Mesa Abierta"
    title_size = int(72 * scale)
    title_font = get_font('serif', title_size)

    # Subtitle/tagline
    subtitle_size = int(24 * scale)
    subtitle_font = get_font('sans', subtitle_size)

    # Details
    detail_size = int(18 * scale)
    detail_font = get_font('sans', detail_size)

    # Small caps style for overline
    overline_size = int(12 * scale)
    overline_font = get_font('sans', overline_size)

    # ============================================
    # LAYOUT (varies by format)
    # ============================================

    if format_name == 'instagram_story':
        # Vertical layout - content in upper third
        title_y = height * 0.25
        content_x = width * 0.12
        align = 'left'
    elif format_name == 'ppt_slide':
        # Horizontal - asymmetric left
        title_y = height * 0.35
        content_x = width * 0.08
        align = 'left'
    elif format_name == 'facebook_post':
        # Wide format - center-left
        title_y = height * 0.35
        content_x = width * 0.08
        align = 'left'
    else:  # instagram_post (square)
        # Centered, slightly above middle
        title_y = height * 0.38
        content_x = width * 0.5
        align = 'center'

    # ============================================
    # DRAW TEXT ELEMENTS
    # ============================================

    # Overline: "COMUNIDAD ANGLICANA SAN ANDRÉS"
    overline_text = "COMUNIDAD ANGLICANA SAN ANDRÉS"
    if align == 'center':
        bbox = draw.textbbox((0, 0), overline_text, font=overline_font)
        text_width = bbox[2] - bbox[0]
        overline_x = (width - text_width) / 2
    else:
        overline_x = content_x

    draw.text(
        (overline_x, title_y - title_size * 0.8),
        overline_text,
        font=overline_font,
        fill=COLORS['gray_medium']
    )

    # Decorative line under overline
    line_y = title_y - title_size * 0.5
    line_width = int(40 * scale)
    if align == 'center':
        line_x = (width - line_width) / 2
    else:
        line_x = content_x

    draw.line(
        [(line_x, line_y), (line_x + line_width, line_y)],
        fill=COLORS['amber'],
        width=2
    )

    # Main Title: "La Mesa Abierta"
    title_text = "La Mesa\nAbierta"
    if align == 'center':
        # Draw each line centered
        lines = title_text.split('\n')
        current_y = title_y
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            text_width = bbox[2] - bbox[0]
            draw.text(
                ((width - text_width) / 2, current_y),
                line,
                font=title_font,
                fill=COLORS['black']
            )
            current_y += title_size * 1.1
        title_bottom = current_y
    else:
        draw.text(
            (content_x, title_y),
            title_text,
            font=title_font,
            fill=COLORS['black']
        )
        title_bottom = title_y + title_size * 2.2

    # Subtitle
    subtitle_text = "Almuerzo comunitario gratuito"
    subtitle_y = title_bottom + title_size * 0.3

    if align == 'center':
        bbox = draw.textbbox((0, 0), subtitle_text, font=subtitle_font)
        text_width = bbox[2] - bbox[0]
        subtitle_x = (width - text_width) / 2
    else:
        subtitle_x = content_x

    draw.text(
        (subtitle_x, subtitle_y),
        subtitle_text,
        font=subtitle_font,
        fill=COLORS['gray_dark']
    )

    # ============================================
    # EVENT DETAILS
    # ============================================
    details_y = subtitle_y + subtitle_size * 2.5

    details = [
        "Todos los domingos",
        "12:30 hrs",
        "Iglesia San Andrés, Providencia"
    ]

    # Small amber dot separator
    dot_radius = int(3 * scale)

    if align == 'center':
        # Center all details
        for i, detail in enumerate(details):
            bbox = draw.textbbox((0, 0), detail, font=detail_font)
            text_width = bbox[2] - bbox[0]
            detail_x = (width - text_width) / 2
            draw.text(
                (detail_x, details_y + i * detail_size * 1.8),
                detail,
                font=detail_font,
                fill=COLORS['gray_medium']
            )

            # Add dot between items (except last)
            if i < len(details) - 1:
                dot_y = details_y + (i + 0.5) * detail_size * 1.8 + detail_size * 0.5
                draw.ellipse(
                    [(width/2 - dot_radius, dot_y - dot_radius),
                     (width/2 + dot_radius, dot_y + dot_radius)],
                    fill=COLORS['amber']
                )
    else:
        for i, detail in enumerate(details):
            draw.text(
                (content_x, details_y + i * detail_size * 1.6),
                detail,
                font=detail_font,
                fill=COLORS['gray_medium']
            )

    # ============================================
    # TAGLINE AT BOTTOM
    # ============================================
    tagline = "Todos son bienvenidos a la mesa"
    tagline_font = get_font('serif', int(16 * scale))

    bbox = draw.textbbox((0, 0), tagline, font=tagline_font)
    text_width = bbox[2] - bbox[0]

    tagline_y = height - int(60 * scale)
    tagline_x = (width - text_width) / 2

    draw.text(
        (tagline_x, tagline_y),
        tagline,
        font=tagline_font,
        fill=COLORS['gray_medium']
    )

    # ============================================
    # LOGO PLACEHOLDER (small, bottom corner)
    # ============================================
    logo_size = int(50 * scale)
    logo_margin = int(30 * scale)

    # Simple "CASA" text as logo placeholder
    logo_font = get_font('serif', int(14 * scale))

    if format_name in ['instagram_story', 'ppt_slide', 'facebook_post']:
        # Bottom right for horizontal/vertical formats
        logo_x = width - logo_margin - logo_size
        logo_y = height - logo_margin - int(20 * scale)
    else:
        # Centered bottom for square
        logo_x = width - logo_margin - logo_size
        logo_y = height - logo_margin - int(20 * scale)

    # Draw small circle with "ca sa" inside
    circle_radius = int(25 * scale)
    circle_center = (logo_x + circle_radius, logo_y)

    draw.ellipse(
        [(circle_center[0] - circle_radius, circle_center[1] - circle_radius),
         (circle_center[0] + circle_radius, circle_center[1] + circle_radius)],
        outline=COLORS['black'],
        width=1
    )

    # "ca" and "sa" text
    ca_font = get_font('serif', int(10 * scale))
    draw.text((circle_center[0] - int(8*scale), circle_center[1] - int(10*scale)), "ca", font=ca_font, fill=COLORS['black'])
    draw.text((circle_center[0] - int(6*scale), circle_center[1] + int(2*scale)), "sa", font=ca_font, fill=COLORS['black'])

    return img.convert('RGB')


def main():
    """Generate all mockups for La Mesa Abierta"""

    output_dir = '/Users/brentcurtis76/Documents/CASA/casa-web/design/mockups'
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 50)
    print("CASA Graphics Mockup Generator")
    print("Evento: La Mesa Abierta")
    print("Filosofía: Silencio Sagrado")
    print("=" * 50)
    print()

    for format_name, size in FORMATS.items():
        print(f"Generando {format_name} ({size[0]}x{size[1]})...")

        img = create_mesa_abierta_graphic(size, format_name)

        output_path = os.path.join(output_dir, f"mesa_abierta_{format_name}.png")
        img.save(output_path, 'PNG', quality=95)

        print(f"  ✓ Guardado: {output_path}")

    print()
    print("=" * 50)
    print("Mockups generados exitosamente!")
    print(f"Ubicación: {output_dir}")
    print("=" * 50)


if __name__ == "__main__":
    main()
