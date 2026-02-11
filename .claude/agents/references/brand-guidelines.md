# CASA Brand Guidelines

**Comunidad Anglicana San Andrés** — A progressive Anglican church community platform in Santiago, Chile

---

## Brand Foundation

### Identity
- **Full Name:** Comunidad Anglicana San Andrés
- **Abbreviation:** CASA
- **Tagline:** "Un espacio de amor, inclusión y esperanza"
- **Personality:** Cálida, Acogedora, Auténtica, Progresiva, Contemplativa
- **Core Values:** Inclusión, Amor Incondicional, Esperanza, Comunidad, Evolución
- **Voice & Tone:** Warm, inclusive, hopeful. "We speak as friends who accompany, not experts who instruct."

### Brand Characteristics
- Serves a diverse religious community including older members with varying technical literacy
- 11 distinct user roles with differentiated access and interface needs
- Accessibility is non-negotiable (WCAG AA minimum)
- Warm, contemplative aesthetic — never corporate, never playful
- All UI text must be in Spanish (es-CL)
- 55 shadcn/ui components available for implementation
- Presentation system is the core feature (multi-window, projector-optimized)

---

## Logo Guidelines

### Design Structure
- **Composition:** Circular design with elegant serif typography
  - "SAN ANDRÉS" arched at top
  - "COMUNIDAD ANGLICANA" arched at bottom
  - "ca sa" in 2×2 grid in center (uppercase, elegant serif)

### Logo Variations
| Variation | Usage | Requirements |
|-----------|-------|--------------|
| Dark Logo | Light backgrounds, white paper, light UI | #1A1A1A on white or light grounds |
| Light Logo | Dark backgrounds, dark UI sections | #F7F7F7 on dark grounds |
| Monochrome White | Dark overlays, bottom of images | White only, solid fill |
| Monochrome Black | Light overlays, minimal backgrounds | Black only, solid fill |

### Clear Space & Sizing
- **Clear Space:** Minimum equal to the height of the central letter 'a' on all sides
- **Minimum Size (Digital):** 40px diameter
- **Minimum Size (Print):** 15mm diameter
- **Recommended Sizes:** 48px, 64px, 80px, 120px (digital); 20mm, 30mm, 50mm (print)

### Logo Do's & Don'ts

**Always:**
- Maintain the circular composition
- Use provided color variations only
- Ensure sufficient clear space
- Place on contrasting backgrounds

**Never:**
- Distort, stretch, or skew the logo
- Rotate the logo
- Change colors (except white/dark variations)
- Add effects (shadows, gradients, outlines)
- Apply to low-contrast backgrounds
- Use without clear space
- Separate or rearrange elements
- Add ornaments or decorative elements

---

## Color Palette

### Primary Colors

| Role | Hex | CSS Variable | Name | Usage |
|------|-----|--------------|------|-------|
| Primary Text & Structure | `#1A1A1A` | `--casa-primary` | Negro Principal | Main text, headers, footer, primary backgrounds, primary CTAs |
| Accent & Highlight | `#D4A853` | `--casa-accent` | Ámbar Acento | CTAs, highlights, decorative elements, active icons, selected states |
| Light Background | `#F7F7F7` | `--casa-light` | Blanco Cálido | Section backgrounds, cards, content areas, light UI surfaces |

### Secondary & Neutral Colors

| Hex | Tailwind Token | CSS Variable | Name | Usage |
|-----|-----------------|--------------|------|-------|
| `#333333` | `casa-700` | `--casa-secondary` | Carbón | Secondary text, subtle headings, secondary UI elements |
| `#555555` | `casa-600` | `--casa-tertiary` | Gris Oscuro | Tertiary text, disabled button text, muted labels |
| `#8A8A8A` | `casa-500` | `--casa-muted` | Gris Medio | Placeholders, disabled states, borders, icon accents |
| `#E5E5E5` | `casa-200` | `--casa-border` | Gris Claro | Borders, separators, dividers, inactive state backgrounds |
| `#EFEFEF` | `casa-100` | — | Gris Muy Claro | Subtle borders, alternate row backgrounds, faint dividers |

### Amber Accent Variations

| Hex | Tailwind Token | CSS Variable | Name | Usage |
|-----|-----------------|--------------|------|-------|
| `#E8C97A` | `amber-200` | `--casa-accent-light` | Ámbar Claro | Subtle highlights, selected states, light badges, hover overlays |
| `#D4A853` | `amber-500` | `--casa-accent` | Ámbar Principal | Primary accent, CTA buttons, focus states, decorative elements |
| `#B8923D` | `amber-700` | `--casa-accent-dark` | Ámbar Oscuro | Hover states for accent elements, active tabs, pressed buttons |

### Semantic Colors (Exceptions to Primary Palette)

These colors are the **only exception** to the primary palette rules. Use them exclusively for status communication:

| Hex | Usage | Tailwind Class | Meaning |
|-----|-------|-----------------|---------|
| `#10B981` | Success states, confirmations, approved actions | `bg-green-600` | Success, completed, active status |
| `#EF4444` | Error states, validation failures, destructive actions | `bg-red-600` | Error, failure, delete, remove |
| `#F59E0B` | Warning states, caution, attention-needed | `bg-amber-500` | Warning, pending, attention required |
| `#3B82F6` | Info states, notifications, informational messages | `bg-blue-500` | Information, help, additional details |

### Color Accessibility & Usage Rules

**Typography:**
- `#1A1A1A` (Negro Principal) or `#333333` (Carbón) for all body text — minimum 4.5:1 contrast ratio
- `#555555` (Gris Oscuro) only for tertiary text on light backgrounds — verify 3:1 minimum contrast
- Never use `#8A8A8A` or lighter for text (except placeholders)

**Interactive Elements:**
- Accent buttons: `#D4A853` background with `#1A1A1A` or `#F7F7F7` text depending on context
- Focus states: `#1A1A1A` border OR `#D4A853` outline (3px minimum width)
- Disabled states: `#E5E5E5` background with `#8A8A8A` text (no interactivity affordance)

**Backgrounds:**
- Primary dark sections: `#1A1A1A` with `#F7F7F7` text only
- Light sections: `#F7F7F7` as default — use `#EFEFEF` for secondary sections
- Cards & contained elements: `#F7F7F7` background with `#E5E5E5` border (1px)

**Decorative Elements:**
- Section dividers: Thin line in `#E5E5E5` with centered dot in `#D4A853`
- Icons (active/emphasis): `#D4A853`
- Icons (secondary): `#8A8A8A`
- Icons (disabled): `#E5E5E5`

### Tailwind Configuration Reference

The project uses shadcn/ui CSS variable system with custom CASA grayscale:

```css
--casa-50: #F7F7F7
--casa-100: #EFEFEF
--casa-200: #DFDFDF
--casa-300: #CFCFCF
--casa-400: #BFBFBF
--casa-500: #8A8A8A
--casa-600: #555555
--casa-700: #333333
--casa-800: #222222
--casa-900: #111111
```

**Available Tailwind classes using CASA tokens:**
- `text-casa-{50,100,200,300,400,500,600,700,800,900}`
- `bg-casa-{50,100,200,300,400,500,600,700,800,900}`
- `border-casa-{50,100,200,300,400,500,600,700,800,900}`
- `from-casa-{}/to-casa-{}` (gradient utilities)

**Primary shadcn/ui CSS variables also available:**
- `--primary`: Maps to `#1A1A1A`
- `--accent`: Maps to `#D4A853`
- `--secondary`: Maps to `#F7F7F7`
- `--muted`: Maps to `#8A8A8A`
- `--destructive`: Maps to `#EF4444`

---

## Typography

### Font Stack

| Role | Font Family | Fallback | Usage |
|------|-------------|----------|-------|
| Display & Titles | Merriweather (serif) | Georgia, serif | H1, H2, featured quotes, warm/traditional elements |
| Body & Interface | Montserrat (sans-serif) | -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif | Body text, buttons, labels, interface text, H3+ |

### Type Hierarchy

| Level | Font | Weight | Size | Line Height | Letter Spacing | Usage | Tailwind Classes |
|-------|------|--------|------|-------------|-----------------|-------|-----------------|
| **H1** | Merriweather | Light (300) | 36px | 1.2 (43px) | 0.02em (0.7px) | Page titles, major headings, featured content | `font-serif font-light text-4xl tracking-wide` |
| **H2** | Merriweather | Light (300) | 28px | 1.3 (36px) | 0.015em (0.4px) | Section titles, subsection headings | `font-serif font-light text-2xl tracking-wide` |
| **H3** | Montserrat | SemiBold (600) | 18px | 1.4 (25px) | 0.01em (0.18px) | Component titles, card headings, navigation items | `font-mont font-semibold text-lg` |
| **H4** | Montserrat | SemiBold (600) | 16px | 1.5 (24px) | 0 | Subsection headings, form section labels | `font-mont font-semibold text-base` |
| **Body** | Montserrat | Regular (400) | 14-16px | 1.6 (22-26px) | 0.01em (0.14-0.16px) | Paragraph text, descriptions, body copy | `font-mont font-normal text-sm md:text-base leading-relaxed` |
| **Small** | Montserrat | Regular (400) | 13px | 1.5 (19.5px) | 0 | Secondary text, metadata, helper text | `font-mont font-normal text-xs md:text-sm` |
| **Caption** | Montserrat | Regular (400) | 11px | 1.4 (15px) | 0.02em (0.22px) | Image captions, form hints, timestamps, footnotes | `font-mont font-normal text-xs` |
| **Button** | Montserrat | SemiBold (600) | 14-16px | 1.5 | 0.01em | Button text, call-to-action text | `font-mont font-semibold text-sm md:text-base` |

### Typography Rules & Spacing

**Display Headings (H1, H2):**
- Use Merriweather Light with wide letter spacing
- Employ generous line height (1.2–1.3) for readability and elegance
- Create visual hierarchy through size variation, not weight
- Pair with warm background or contemplative context
- Margin bottom: 1.5rem (24px) to following paragraph

**Section Headings (H3, H4):**
- Use Montserrat SemiBold for interface clarity
- Margin bottom: 1rem (16px) to following content
- Margin top: 1.5rem (24px) from preceding section (for H3)

**Body Text:**
- Always 14–16px base size for readability (especially for older members)
- Line height minimum 1.6 (26px at 16px base) for comfortable reading
- Maximum line length: 65 characters (approximately 640px at 16px font size)
- Generous whitespace around paragraphs (1rem margin between)

**Form Labels:**
- Use Montserrat SemiBold 14px
- Place above input fields (not floating)
- Include asterisk (*) for required fields in error red or accent amber
- Margin bottom: 0.5rem (8px) from input field

**Placeholder Text:**
- Use Montserrat Regular 14px in `#8A8A8A` (Gris Medio)
- Never use placeholder as primary label
- Disappear on focus (standard behavior)

**Font-Weight Usage:**
- Light (300): Display headings only (H1, H2)
- Regular (400): Body text, captions, small text
- SemiBold (600): Headings (H3, H4), button text, emphasized interface text
- Bold (700): Rare; use for critical emphasis only (error messages, warnings)

### Tailwind Font Classes

```css
/* Montserrat stack (sans-serif) */
.font-mont = 'Mont', 'Montserrat', 'sans-serif'

/* Merriweather stack (serif) */
.font-serif = 'Merriweather', 'serif'

/* Font weights */
.font-light = 300
.font-normal = 400
.font-semibold = 600
.font-bold = 700
```

---

## Spacing & Layout

### Spacing Scale

The CASA platform uses an 8px base unit (consistent with Tailwind defaults):

| Unit | Value | Tailwind | Usage |
|------|-------|----------|-------|
| xs | 4px | `p-1`, `m-1` | Micro spacing, tight icon spacing |
| sm | 8px | `p-2`, `m-2` | Small spacing, button padding, input padding |
| md | 16px | `p-4`, `m-4` | Standard spacing, card padding, section margins |
| lg | 24px | `p-6`, `m-6` | Large spacing, major section breaks |
| xl | 32px | `p-8`, `m-8` | Extra large, page sections |
| 2xl | 48px | `p-12`, `m-12` | Major spacing, hero sections |
| 3xl | 64px | `p-16`, `m-16` | Full-width section separation |

### Grid & Container System

- **Max container width:** 1200px (large screens)
- **Padding (sides):** 16px (mobile), 24px (tablet), 32px (desktop)
- **Column gap:** 24px
- **Column count:** 12 (standard grid)
- **Breakpoints:** Follow Tailwind defaults (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px)

### Card & Component Spacing

- **Card padding:** 16–24px (use 16px for compact lists, 24px for feature cards)
- **Card border:** 1px solid `#E5E5E5` (Gris Claro)
- **Card border-radius:** 8px
- **Card shadow:** Optional light shadow (0 1px 3px rgba(0,0,0,0.1)) for depth
- **Card gap (internal):** 12px between stacked elements
- **Card margin (external):** 12px between cards in a grid

### Whitespace Philosophy

The CASA brand emphasizes **generous, contemplative whitespace:**
- Never crowd content
- Use margins > padding for breathing room
- Embrace empty space as part of the design
- Older community members appreciate uncluttered layouts
- Visual clarity prioritized over information density

### Layout Principles

**Page Sections:**
- Padding top/bottom: 48px (3xl) minimum for major sections
- Clear visual separation between sections
- Use subtle dividers (`1px #E5E5E5` line with centered `#D4A853` dot) between sections

**Content Columns:**
- Single column (mobile): 100% with 16px side padding
- Narrow column (tablet & desktop): 680px max for readability
- Wide content (tables, lists): Full width with left alignment
- Sidebar layouts: Main (680px) + sidebar (280px) with 24px gap

**Lists:**
- Item padding: 12px top/bottom, 16px left/right
- Item gap: 8px
- Divider: 1px `#E5E5E5` between items (optional for dark backgrounds)

---

## Component Patterns

### Button Styles

**Primary Button (Main CTA)**
- Background: `#1A1A1A` (Negro Principal)
- Text: `#F7F7F7` (Blanco Cálido)
- Border: None
- Border-radius: 8px
- Padding: 12px 24px (sm), 14px 28px (md), 16px 32px (lg)
- Font: Montserrat SemiBold 14-16px
- Hover: Background `#333333` (Carbón), slight shadow lift
- Active/Pressed: Background `#111111`, no shadow
- Focus: 3px `#D4A853` outline (2px offset)
- Disabled: Background `#E5E5E5`, text `#8A8A8A`, no cursor
- Tailwind: `btn-primary` or `bg-casa-900 text-casa-50 rounded-lg px-6 py-3 font-semibold hover:bg-casa-700 focus:outline-amber-500`

**Secondary Button (Alternative CTA)**
- Background: `#F7F7F7` (Blanco Cálido) or transparent
- Text: `#1A1A1A` (Negro Principal)
- Border: 1px `#E5E5E5` (Gris Claro)
- Border-radius: 8px
- Padding: 12px 24px (sm), 14px 28px (md), 16px 32px (lg)
- Font: Montserrat SemiBold 14-16px
- Hover: Background `#EFEFEF` (Gris Muy Claro), border `#DFDFDF`
- Active/Pressed: Background `#DFDFDF`, text `#333333`
- Focus: 3px `#D4A853` outline (2px offset)
- Disabled: Background `#EFEFEF`, text `#8A8A8A`, border `#E5E5E5`, no cursor
- Tailwind: `btn-secondary` or `bg-casa-50 border-casa-200 text-casa-900 rounded-lg px-6 py-3 font-semibold border hover:bg-casa-100`

**Accent Button (Highlight/Emphasis)**
- Background: `#D4A853` (Ámbar Acento)
- Text: `#1A1A1A` (Negro Principal)
- Border: None
- Border-radius: 9999px (rounded-full)
- Padding: 10px 20px (sm), 12px 24px (md), 14px 28px (lg)
- Font: Montserrat SemiBold 14-16px
- Hover: Background `#B8923D` (Ámbar Oscuro), text `#F7F7F7`
- Active/Pressed: Background `#9D7A2F`, text `#F7F7F7`
- Focus: 3px `#1A1A1A` outline (2px offset)
- Disabled: Background `#E8C97A`, text `#8A8A8A`, no cursor
- Tailwind: `btn-accent` or `bg-amber-500 text-casa-900 rounded-full px-6 py-3 font-semibold hover:bg-amber-700 hover:text-casa-50`

**Ghost/Text Button (Minimal, Secondary)**
- Background: Transparent
- Text: `#1A1A1A` (Negro Principal) or `#555555` (Gris Oscuro)
- Border: None
- Padding: 8px 12px (tight), 10px 16px (standard)
- Font: Montserrat Regular or SemiBold 14px
- Hover: Background `#F7F7F7` or `#EFEFEF`, text unchanged
- Active: Underline 2px `#D4A853`
- Focus: 3px `#D4A853` outline
- Disabled: Text `#8A8A8A`, no background
- Tailwind: `bg-transparent text-casa-900 hover:bg-casa-50 py-2 px-4`

**Button Size Specifications**
- Small: 14px font, 10px vertical padding, 16px horizontal padding
- Medium (default): 16px font, 12px vertical padding, 24px horizontal padding
- Large: 16px font, 14px vertical padding, 32px horizontal padding
- Icon buttons: 40px × 40px (small), 48px × 48px (medium), 56px × 56px (large)

**Button Interaction States**
- Hover: Always provide visual feedback (background shift, shadow, color change)
- Focus: 3px outline in accent or contrast color (2px offset from element)
- Active: Same styling as hover (or pressed state with reduced shadow)
- Disabled: 50% opacity OR gray background (`#E5E5E5`) with muted text (`#8A8A8A`)
- Loading: Show spinner icon, disable interaction, optional text change to "Cargando…"

### Form Elements

**Input Fields (Text, Email, Password, Number)**
- Background: `#FFFFFF` (white) or `#F7F7F7` (light)
- Border: 1px `#E5E5E5` (Gris Claro)
- Border-radius: 6px (smaller than cards for visual distinction)
- Padding: 10px 12px (14px font), 12px 16px (16px font)
- Font: Montserrat Regular 14-16px, `#1A1A1A` text
- Placeholder: `#8A8A8A` (Gris Medio)
- Focus border: 2px `#D4A853` (Ámbar Acento), transition 150ms
- Error border: 2px `#EF4444` (red)
- Success border: 2px `#10B981` (green)
- Disabled: Background `#EFEFEF`, border `#E5E5E5`, text `#8A8A8A`, no cursor
- Tailwind: `px-4 py-2 rounded-md border border-casa-200 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200`

**Text Areas**
- Same as input fields but with 4px padding top/bottom, minimum 120px height
- Resize: Vertical only (never horizontal)
- Font: Montserrat Regular, monospace acceptable for code input
- Line-height: 1.6 (relaxed reading)

**Select/Dropdown**
- Background: `#FFFFFF` or `#F7F7F7`
- Border: 1px `#E5E5E5`
- Border-radius: 6px
- Padding: 10px 12px (with 32px right padding for dropdown arrow)
- Font: Montserrat Regular 14-16px
- Arrow icon: `#1A1A1A` or `#555555`
- Open state: Border `#D4A853`, dropdown shadow (0 10px 20px rgba(0,0,0,0.1))
- Focus: Same as input fields

**Checkboxes & Radio Buttons**
- Size: 18px × 18px (minimum touch target 44px including label)
- Default: Border 1px `#E5E5E5`, background transparent
- Checked: Background `#D4A853` (Ámbar), checkmark white or `#1A1A1A`
- Focus: 2px `#D4A853` outline (3px offset)
- Disabled: Border `#E5E5E5`, background `#EFEFEF`, opacity 50%
- Label padding: 8px left of checkbox/radio

**Form Labels**
- Font: Montserrat SemiBold 14px, `#1A1A1A`
- Position: Above input field (not floating, not inside)
- Margin-bottom: 8px from field
- Required indicator: Asterisk (*) in `#EF4444` (red) or `#D4A853` (amber)
- Help text: Montserrat Regular 12px, `#555555`, 4px margin-top

**Form Validation Messages**
- Error: `#EF4444` (red), Montserrat Regular 12px, 4px margin-top, icon (⚠️ or ✗)
- Success: `#10B981` (green), Montserrat Regular 12px, 4px margin-top, icon (✓)
- Warning: `#F59E0B` (amber), Montserrat Regular 12px, 4px margin-top, icon (!)
- Info: `#3B82F6` (blue), Montserrat Regular 12px, 4px margin-top, icon (ℹ)

**Form Layout**
- Single column (mobile): 100% width with 16px padding
- Multi-column (desktop): 2-3 columns with 16px gap
- Related fields: Group in 12px margin container, visual border optional
- Field spacing: 16px between distinct field groups
- Section headings: Montserrat SemiBold 16px, 12px margin-bottom

### Navigation

**Primary Navigation (Header)**
- Background: `#1A1A1A` (Negro Principal) or `#F7F7F7` (light variant)
- Height: 64px (desktop), 56px (mobile)
- Logo placement: Left side, 16px padding (32px desktop)
- Logo size: 40px (mobile), 48px (desktop)
- Text: Montserrat SemiBold 14-16px
- Text color (dark nav): `#F7F7F7`
- Text color (light nav): `#1A1A1A`
- Active nav item: `#D4A853` (Ámbar Acento) background or underline
- Hover nav item: Background `#333333` (dark nav) or `#EFEFEF` (light nav)
- Link spacing: 16px horizontal padding per item
- Mobile menu: Hamburger icon (24px), full-screen overlay on open

**Breadcrumb Navigation**
- Background: Transparent or `#F7F7F7`
- Text: Montserrat Regular 13px, `#555555`
- Separator: "/" or ">" in `#8A8A8A`
- Current page: Montserrat SemiBold 13px, `#1A1A1A`
- Link hover: Color `#D4A853`
- Padding: 8px 0 (vertical), 0 12px per item

**Sidebar Navigation (if used)**
- Background: `#F7F7F7` or `#1A1A1A`
- Width: 280px (desktop), hidden/drawer (mobile)
- Item padding: 12px 16px
- Item font: Montserrat Regular 14px
- Active item: Background `#E8C97A` (light amber), text `#1A1A1A`, left border 4px `#D4A853`
- Hover item: Background `#EFEFEF` (light nav) or `#333333` (dark nav)
- Group heading: Montserrat SemiBold 12px, uppercase, `#8A8A8A`, 12px margin-top
- Icon + text spacing: 12px

**Pagination**
- Background: Transparent or `#F7F7F7`
- Button size: 40px × 40px (touch-friendly)
- Button styling: Secondary button style (border + light background)
- Active page: Primary button style (`#1A1A1A` background, white text)
- Disabled arrows: `#E5E5E5` background, `#8A8A8A` text
- Text size: Montserrat Regular 14px
- Spacing between buttons: 8px

### Tables

**Table Structure**
- Background: Alternating `#FFFFFF` (rows) and `#F7F7F7` (rows) for clarity
- Header background: `#1A1A1A` (dark) or `#F7F7F7` (light)
- Header text: `#F7F7F7` (if dark header) or `#1A1A1A` (if light header)
- Header font: Montserrat SemiBold 14px
- Cell padding: 12px 16px (vertical 12px, horizontal 16px)
- Row height: 48px (minimum, with padding)
- Cell border: Bottom only, 1px `#E5E5E5`
- Row hover: Background `#F7F7F7` or `#EFEFEF` (subtle highlight)

**Table Columns**
- Text alignment: Left (default), center (numbers), right (amounts)
- Numeric columns: Right-aligned, monospace font optional
- Narrow columns: Minimum 60px width
- Wide columns: Maximum 400px (wrap text or truncate with tooltip)

**Sortable Headers**
- Cursor: Pointer on hover
- Indicator: Small arrow icon next to header text
- Up arrow: `#1A1A1A` or `#D4A853` (ascending)
- Down arrow: `#1A1A1A` or `#D4A853` (descending)
- No sort: `#8A8A8A` (muted)

**Interactive Rows**
- Selectable rows: Checkbox at row start (18px × 18px)
- Hover effect: Background color change (not row expansion)
- Click action: Highlight background `#E8C97A` (light amber, 10% opacity)
- Selected row: Background `#E8C97A` or border-left 4px `#D4A853`

**Table Responsive Design**
- Desktop (lg): Full table display
- Tablet (md): Horizontal scroll or reduced columns
- Mobile (sm): Card-based layout (1 item per "row" as card) OR stackable table
- Stacked table: Header above each cell, 2-column layout (label, value)

### Cards

**Standard Card**
- Background: `#F7F7F7` (Blanco Cálido)
- Border: 1px `#E5E5E5` (Gris Claro)
- Border-radius: 8px
- Padding: 16px (compact) to 24px (spacious)
- Shadow: Optional light shadow (0 1px 3px rgba(0,0,0,0.08))
- Margin: 12px between cards in grid

**Card Header (if present)**
- Font: Montserrat SemiBold 16-18px, `#1A1A1A`
- Padding: 16px 20px (or inherit card padding)
- Border-bottom: Optional 1px `#E5E5E5`
- Margin-bottom: 16px

**Card Body**
- Font: Montserrat Regular 14px, `#333333`
- Line-height: 1.6
- Paragraph spacing: 12px margin-bottom
- Nested elements: Maintain card padding rules

**Card Footer (if present)**
- Background: `#EFEFEF` (Gris Muy Claro)
- Border-top: 1px `#E5E5E5`
- Padding: 12px 16px (or inherit card padding)
- Content alignment: Right-aligned buttons/actions
- Height: 48px minimum

**Card Hover States**
- Shadow increase: 0 4px 12px rgba(0,0,0,0.1)
- Border color: `#DFDFDF` (optional)
- Background: No change (or 1% darker)
- Cursor: Pointer if card is clickable
- Transition: 200ms ease-in-out

**Interactive Cards (Clickable)**
- Treat as `<button>` for accessibility
- Include focus state: 3px `#D4A853` outline
- On click: Navigate or trigger action smoothly

### Feedback Components

**Alerts & Banners**

| Type | Background | Text | Border | Icon | Usage |
|------|-----------|------|--------|------|-------|
| **Success** | `#ECFDF5` (light green) | `#065F46` (dark green) | 1px `#10B981` | ✓ (green) | Confirmation, successful completion |
| **Error** | `#FEF2F2` (light red) | `#7F1D1D` (dark red) | 1px `#EF4444` | ⚠️ (red) | Validation errors, failures, critical issues |
| **Warning** | `#FFFBEB` (light amber) | `#78350F` (dark amber) | 1px `#F59E0B` | ! (amber) | Caution, pending actions, attention needed |
| **Info** | `#EFF6FF` (light blue) | `#1E40AF` (dark blue) | 1px `#3B82F6` | ℹ (blue) | Informational messages, tips, help |

- Alert padding: 16px (all sides)
- Alert border-radius: 8px
- Alert icon: 20px × 20px, 12px margin-right from text
- Alert font: Montserrat Regular 14px
- Alert heading: Montserrat SemiBold 15px (optional, margin-bottom 4px)
- Alert close button: Ghost button (transparent), 32px × 32px, top-right
- Full-width banner: 100% with 0 border-radius, centered text
- Dismissible: Include close (×) button, fade-out animation 300ms

**Toast Notifications**
- Position: Bottom-right corner (mobile: bottom-center)
- Max width: 360px (mobile: 90% with 16px margin)
- Padding: 16px 20px
- Border-radius: 8px
- Shadow: 0 10px 25px rgba(0,0,0,0.15)
- Font: Montserrat Regular 14px
- Animation: Slide in from bottom/right, 300ms ease-out
- Duration: 5 seconds (auto-dismiss), or 8 seconds for errors
- Stack: Maximum 3 toasts visible; older ones hidden

**Modals/Dialogs**
- Overlay: `rgba(0,0,0,0.5)` (50% opacity)
- Background: `#FFFFFF` or `#F7F7F7`
- Border-radius: 12px
- Padding: 24px (header: 20px, body: 24px, footer: 16px)
- Max width: 500px (sm), 640px (md), 800px (lg)
- Header font: Montserrat SemiBold 20px, `#1A1A1A`
- Body font: Montserrat Regular 14px, `#333333`
- Border-bottom (header): 1px `#E5E5E5`
- Close button: Ghost button (×) top-right, 32px × 32px
- Footer background: `#F7F7F7` (light), border-top 1px `#E5E5E5`
- Footer alignment: Right-aligned buttons (Cancel, Confirm/Action)
- Animation: Fade in overlay + scale up modal from center, 250ms

**Loading States**
- Spinner: 24px-32px circular SVG, `#D4A853` color, 2px stroke
- Skeleton screens: `#EFEFEF` background with 1px `#E5E5E5` border, 8px border-radius
- Pulse animation: Opacity fade 1.5s ease-in-out, infinite
- Placeholder lines: Match content height/width, 12px margin-bottom between lines
- Loading text: "Cargando…" (Montserrat Regular 14px, `#555555`)

**Empty States**
- Illustration: 120px × 120px centered, muted colors (grays/ambers)
- Heading: Montserrat SemiBold 18px, `#1A1A1A`
- Description: Montserrat Regular 14px, `#555555`, max 60 characters wide
- CTA: Primary or secondary button below description
- Padding: 48px top/bottom, full width container

**Tooltips**
- Background: `#1A1A1A` (Negro Principal)
- Text: `#F7F7F7` (Blanco Cálido)
- Font: Montserrat Regular 12px
- Padding: 8px 12px
- Border-radius: 4px
- Arrow: 6px × 6px triangle pointing to trigger
- Shadow: 0 2px 8px rgba(0,0,0,0.15)
- Trigger: Hover (on desktop) or tap (on mobile)
- Animation: Fade in 150ms, delay 300ms
- Max width: 240px (wrap text)
- Position: Prefer top > right > bottom > left (auto-adjust if off-screen)

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance (Minimum Standard)

All CASA UI must meet or exceed Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. This is critical for a diverse community including older members.

### Color & Contrast

**Text Contrast Requirements:**
- Body text: 4.5:1 ratio (AAA standard recommended for large communities)
- Large text (18px+ or bold 14px+): 3:1 ratio minimum
- UI components (buttons, inputs): 3:1 ratio minimum
- Ensure contrast without relying on color alone (use borders, labels, icons)

**Verify with tools:**
- Use contrast checker before deployment
- Test combinations: Negro on Blanco, Ámbar on light backgrounds, white on dark backgrounds
- Semantic colors: Always ensure sufficient contrast (not red/green pair for colorblind users)

**Color should never be the only way to convey information:**
- Errors: Use text + icon + color
- Status: Use text + icon + badge + color
- Links: Use underline + color

### Keyboard Navigation

**Keyboard Access Required:**
- All interactive elements must be reachable via Tab key
- Tab order must be logical (left-to-right, top-to-bottom)
- Skip-to-content link visible on focus
- No keyboard trap (ability to exit any element with Tab/Shift+Tab)
- Form submission: Enter key in input, no JavaScript-only submission

**Focus Indicators:**
- Always visible, minimum 3px outline or border
- Contrast ratio 3:1 minimum from surrounding color
- Not removed in user agent stylesheets (no `outline: none`)
- Focus color: `#D4A853` (Ámbar Acento) on light backgrounds, `#F7F7F7` on dark

**Focus Management:**
- Modal open: Focus moves to modal
- Modal close: Focus returns to trigger button
- Dropdown open: Focus on first menu item
- Page navigation: Focus on page title or first content element

### Screen Reader Support

**ARIA Attributes:**
- Use semantic HTML first (`<button>`, `<nav>`, `<main>`, etc.)
- Label all form inputs with `<label>` elements
- Use `aria-label` for icon-only buttons: `<button aria-label="Cerrar menú">`
- Use `aria-describedby` for form field help text
- Use `aria-live="polite"` for notifications/toasts
- Use `aria-busy="true"` during loading
- Use `aria-selected`, `aria-expanded`, `aria-checked` for widget states

**Headings:**
- Use semantic `<h1>` through `<h6>` tags (not styled divs)
- Proper nesting: h1 > h2 > h3 (never skip levels)
- One `<h1>` per page (page title)
- Headings accurately describe section content

**Link Text:**
- Descriptive link text: "Leer más sobre comunidad" (not "Click aquí" or "Leer más")
- Avoid ambiguous links
- If link is icon-only, use `aria-label` or `aria-describedby`

**Images & Alt Text:**
- Decorative images: `alt=""` (empty)
- Meaningful images: Concise alt text (< 125 characters)
- Charts/graphs: Descriptive alt text or data table alternative
- Avoid "image of" in alt text (screen readers say this)

**Tables:**
- Use `<table>` structure: `<thead>`, `<tbody>`, `<tfoot>`
- Use `<th>` for header cells with `scope="col"` or `scope="row"`
- Complex tables: Use `<caption>` or `aria-describedby`
- Avoid merged cells when possible (accessible tables don't merge)

**Forms:**
- Every `<input>` paired with `<label>` using `for` attribute
- Error messages: Associate with input using `aria-describedby`
- Fieldset + legend for grouped inputs
- Placeholder is not a substitute for label

### Motion & Animation Accessibility

**Respect Prefers-Reduced-Motion:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- Disable animations for users who request reduced motion (accessibility setting)
- Never use flashing (> 3 flashes per second = seizure risk, WCAG violation)
- Use motion to enhance, not distract

### Mobile & Touch Accessibility

**Touch Targets:**
- Minimum 44px × 44px (touch-friendly for older users)
- 8px spacing between adjacent buttons (avoid mis-taps)
- Never rely on hover alone (touch devices have no hover)

**Text Size:**
- Minimum 14px base font size
- Support zoom/scaling to 200% without loss of functionality
- Responsive text: Use relative units (rem, em), not px
- Test readability at 200% magnification

**Input Types:**
- Use native input types for mobile optimization: `type="email"`, `type="tel"`, `type="date"`
- Native date pickers improve mobile usability
- Virtual keyboard optimization for field types

### Accessibility Testing Checklist

Before launch, verify:
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus visible on all interactive elements
- [ ] Color contrast 4.5:1 (text) or 3:1 (UI)
- [ ] Screen reader announces headings, labels, alerts
- [ ] All images have alt text or are marked decorative
- [ ] Forms are properly labeled
- [ ] No flashing or seizure-inducing animations
- [ ] Touch targets minimum 44px × 44px
- [ ] Zoom to 200% is supported
- [ ] Tested with NVDA (Windows) or VoiceOver (Mac)

---

## Animation & Motion

### Philosophy

CASA's animation philosophy: **Subtle, purposeful, and contemplative.** Animations enhance clarity and flow, never distract. Respect older community members and accessibility needs.

### Motion Principles

1. **Purposeful:** Every animation serves a function (feedback, clarity, flow guidance)
2. **Subtle:** Duration 200-400ms, not flashy or exaggerated
3. **Consistent:** Standardized ease curves and durations
4. **Responsive:** Respect `prefers-reduced-motion` setting
5. **Accessible:** No flashing, seizure risk mitigated

### Standard Durations

| Timing | Duration | Usage |
|--------|----------|-------|
| Instant | 0ms | State change (no transition) |
| Fast | 150ms | Icon appearance, subtle feedback |
| Standard | 250ms | Button press, modal open, fade |
| Moderate | 300ms | Slide in/out, expand/collapse |
| Slow | 400-500ms | Page transitions, major layout shifts |
| Very Slow | 800ms+ | Background loading, non-critical transitions |

### Easing Functions

```css
/* Tailwind ease classes */
ease-in:     cubic-bezier(0.4, 0, 1, 1)    /* Acceleration, exiting motion */
ease-out:    cubic-bezier(0, 0, 0.2, 1)    /* Deceleration, entering motion */
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)  /* Both, standard smooth */

/* Custom CASA eases (if using plain CSS) */
ease-casual:    cubic-bezier(0.25, 0.46, 0.45, 0.94)  /* Natural, friendly */
ease-contemplative: cubic-bezier(0.33, 0.66, 0.66, 1)  /* Slow, meditative */
```

**When to use:**
- `ease-in`: Objects leaving view
- `ease-out`: Objects entering view (preferred for UX)
- `ease-in-out`: Two-way transitions (expand/collapse)
- `linear`: Only for continuous rotations (spinners)

### Standard Animations

**Fade Transition** (250ms ease-in-out)
- Modal overlay, alert notifications, element appearance
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
transition: opacity 250ms ease-in-out;
```

**Slide In/Out** (300ms ease-out for entry, ease-in for exit)
- Dropdown menus, sidebars, toasts
```css
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
transition: transform 300ms ease-out, opacity 300ms ease-out;
```

**Scale Transition** (250ms ease-out)
- Modal opening, button press feedback, card hover
```css
@keyframes scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
transition: transform 250ms ease-out, opacity 250ms ease-out;
```

**Loading Spinner** (Continuous, respect prefers-reduced-motion)
- Infinite rotation, never disable via prefers-reduced-motion
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
animation: spin 1s linear infinite;

@media (prefers-reduced-motion: reduce) {
  animation: none;
  border: 3px solid #D4A853;
}
```

**Pulse Animation** (1.5s ease-in-out infinite)
- Skeleton screens, placeholder states
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
animation: pulse 1.5s ease-in-out infinite;

@media (prefers-reduced-motion: reduce) {
  animation: none;
  opacity: 0.5;
}
```

### Interaction Feedback Animations

**Button Press**
- Duration: 100ms
- Effect: Slight scale down (0.98), background color shift
- Purpose: Confirm click, provide tactile feedback

**Focus Ring**
- Duration: None (instant appearance, 150ms removal)
- Effect: 3px outline in `#D4A853`
- Purpose: Keyboard navigation visibility

**Form Input Focus**
- Duration: 200ms
- Effect: Border color change, shadow addition
- Purpose: Clear focus state, readability

**Hover Effects**
- Duration: 200ms
- Effect: Background color, shadow, slight scale up (1.02 max)
- Purpose: Show interactivity without overwhelming

### Page Transitions

**Page Load (if multi-page app):**
- Fade in header (200ms)
- Fade in content sections staggered (200-300ms, 50ms stagger)
- Bottom sections fade in slightly slower
- Purpose: Guide eye flow, reduce cognitive load

**Modal/Overlay Opening:**
- Overlay fade in (250ms)
- Modal scale in from center (250ms)
- Content inside modal fades in after modal appears (100ms delay)
- Purpose: Establish hierarchy, focus attention

### Animation Do's & Don'ts

**Do:**
- Use animations to enhance clarity and feedback
- Respect user's motion preferences (`prefers-reduced-motion`)
- Keep durations 150-400ms for most interactions
- Use ease-out for elements entering view
- Test animations on older devices (performance matters)

**Don't:**
- Animate without purpose
- Use durations > 500ms for standard interactions
- Flash or strobe effects (seizure risk)
- Autoplay heavy animations on page load
- Disable animations entirely without fallback
- Use animations on low-performance devices (check battery saver, low-end phones)

---

## Do's & Don'ts

### Brand Voice & Communication

**Do:**
- Speak warmly and as a friend ("Nos acompaña" not "Le acompaña")
- Use inclusive language that celebrates uniqueness
- Acknowledge vulnerability and authentic emotion
- Invite exploration without pressure ("Si desea explorar..." not "Debe explorar...")
- Use Spanish (es-CL) naturally, respecting Chilean dialect
- Show community connection and human moments
- Highlight values (inclusión, amor, esperanza, evolución)

**Don't:**
- Sound corporate, authoritative, or superior
- Use religious jargon without explanation
- Judge or exclude ("No somos para todos" is wrong; "Somos para todos" is right)
- Impose absolute truths or certainty
- Communicate from a position of expertise
- Use English or formal Spanish
- Ignore older community members in your tone
- Be playful or irreverent about faith matters

### Visual Design

**Do:**
- Maintain clear, warm hierarchy with generous whitespace
- Use Merriweather for warmth and elegance in display text
- Use Montserrat for clarity and accessibility in interface text
- Apply color intentionally: Negro for structure, Ámbar for warmth, Grays for hierarchy
- Respect color contrast (4.5:1 for text, 3:1 for UI)
- Use rounded corners (8px standard) for approachability
- Include warm, authentic community photography
- Test on older devices and at large text sizes (200% zoom)
- Employ generous padding and whitespace in layouts

**Don't:**
- Use cold, corporate color combinations
- Apply decorative effects to the logo
- Force maximum information density
- Ignore accessibility for aesthetic reasons
- Use harsh sans-serif without warmth
- Place text on low-contrast backgrounds
- Distort or stretch typography
- Assume all users are tech-savvy (simplicity over cleverness)
- Use unrelated stock photography (authenticity > polish)

### Button & CTA Design

**Do:**
- Use primary (dark) buttons for main actions
- Use accent (amber) buttons for emphasis and highlights
- Provide clear hover and focus states
- Use "Continuar", "Enviar", "Guardar" for common actions
- Make touch targets 44px minimum for older users
- Include appropriate icons when they clarify intent

**Don't:**
- Overuse the accent color (reserve for true CTAs)
- Create buttons that look disabled when active
- Rely on color alone for button meaning
- Use vague CTA text ("Click aquí" is bad; "Ver más sobre el evento" is good)
- Make buttons too small for touch interaction
- Apply conflicting hover states (confusing feedback)

### Form & Input Design

**Do:**
- Label every input clearly above the field
- Use native input types for mobile optimization
- Provide helpful placeholder or helper text
- Show validation feedback immediately
- Use required field indicator (*)
- Keep forms short and focused on task
- Use proper form structure (`<fieldset>`, `<legend>`)

**Don't:**
- Use placeholder as primary label
- Allow forms to span the entire screen width
- Hide required indicators
- Show only validation error without suggestion
- Use unusual input patterns
- Force confirmation pages unnecessarily
- Submit on blur or without explicit button click

### Accessibility

**Do:**
- Test keyboard navigation (Tab, Enter, Escape)
- Ensure all interactive elements are reachable
- Provide descriptive link text
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Include alt text for meaningful images
- Test with screen readers (VoiceOver, NVDA)
- Support zoom to 200% without breaking layout
- Respect `prefers-reduced-motion` setting

**Don't:**
- Rely on color alone to convey meaning
- Hide focus indicators
- Use images as the only content carrier
- Forget about older users and accessibility needs
- Create keyboard traps
- Use auto-playing audio or video
- Flash or strobe at high frequencies
- Assume all users can perceive motion or sound

### Animation & Motion

**Do:**
- Use animations to provide feedback and clarity
- Keep durations 200-300ms for standard interactions
- Use ease-out for elements entering view
- Test animations at different speeds and devices
- Provide reduced motion alternatives
- Use animations purposefully, not decoratively

**Don't:**
- Autoplay heavy animations on page load
- Use animations longer than 500ms without reason
- Create flashing or strobing effects
- Disable animations entirely for users
- Prioritize animation over accessibility
- Use animations on low-end devices without testing

### Content & Copy

**Do:**
- Use clear, scannable headings
- Break content into short paragraphs (3-4 sentences max)
- Use lists for related items
- Write in active voice ("Participe" not "Se puede participar")
- Be specific and concrete
- Use short words and simple sentences
- Include calls-to-action clearly

**Don't:**
- Use walls of text
- Write in passive voice
- Use ambiguous pronouns
- Jargon without explanation
- ALL CAPS for emphasis (use bold or color)
- Abbreviations without explanation (first use: full form + abbreviation)
- Assume users will read everything (structure for scanning)

### Component Usage

**Do:**
- Use consistent button styles across the platform
- Keep cards standardized in padding and borders
- Use tables for structured data, not layout
- Apply consistent spacing (8px grid system)
- Use color-coded feedback (success green, error red, warning amber, info blue)
- Maintain consistent icons across the platform

**Don't:**
- Mix button styles inconsistently
- Create custom component variations unnecessarily
- Use `<table>` for page layout
- Break the spacing grid arbitrarily
- Create new color meanings
- Use inconsistent icon styles
- Introduce new components without design approval

---

## Implementation Notes for UX Agent

### Component Library
CASA uses shadcn/ui with 55 available components. When designing or prototyping:
- Always reference the available component library
- Customize through Tailwind classes and CSS variables, not structural changes
- Maintain component consistency across the platform
- Document any custom variations

### Multi-Window Presentation System
The presentation system is a core feature supporting multi-window and projector-optimized displays:
- Design with large displays in mind (fonts, spacing)
- Test on wide aspect ratios
- Ensure readability from distance
- Support full-screen and windowed modes

### User Roles & Access
CASA supports 11 distinct user roles with different interface needs. When designing:
- Consider role-specific workflows
- Hide irrelevant options for non-applicable roles
- Provide role-appropriate documentation
- Test permission boundaries

### Spanish (es-CL) Localization
All UI text must be in Spanish (Chile dialect):
- Use "vosotros" forms sparingly (formal es-CL uses "ustedes")
- Respect Chilean vocabulary and spelling
- Use natural phrasing ("¿Cómo te llamai?" > "¿Cómo te llamas?" in informal context)
- Test text expansion (some languages need more space)

### Older User Accommodation
The community includes older members; ensure:
- Minimum 14px font size
- High contrast (4.5:1 minimum for text)
- Large touch targets (44px+ buttons)
- Simple, predictable navigation
- Consistent patterns across interface
- Test with magnification and screen readers

### Performance Considerations
- Animations respect `prefers-reduced-motion` for accessibility
- Lazy-load images in lists
- Minimize JavaScript for accessibility tree clarity
- Test on low-end devices for performance

---

## File Structure & Assets

### Expected Asset Locations
- **Logo files:** `/public/assets/logo/` (SVG primary, PNG fallbacks)
- **Icons:** `/public/assets/icons/` (24px, 32px, 48px variants)
- **Photos:** `/public/assets/photos/community/` (high-quality, authentic)
- **Brand colors:** Defined in `tailwind.config.ts` CSS variables

### Tailwind Configuration
The project's `tailwind.config.ts` includes:
- CASA color tokens (`casa-50` through `casa-900`)
- Montserrat and Merriweather font families
- Standard Tailwind plugins
- Custom spacing scale (8px base)

---

## References & Resources

- **Tailwind CSS:** https://tailwindcss.com/
- **shadcn/ui:** https://ui.shadcn.com/
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **Merriweather Font:** https://fonts.google.com/specimen/Merriweather
- **Montserrat Font:** https://fonts.google.com/specimen/Montserrat

---

**Last Updated:** 2026-02-09
**Status:** Active — Use as authoritative reference for all CASA UX design decisions
