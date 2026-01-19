# CASA Presentation System - Technical Specification

## Executive Summary

This document outlines the architecture for a web-based presentation system (similar to ProPresenter) integrated into the CASA website. The system enables real-time liturgy presentation with a dual-window interface: a Presenter View (control panel) and an Output View (projector display).

---

## 1. Information Gathered from Existing System

### 1.1 Existing Liturgy Builder

**Location:** `src/components/liturgia-builder/`

**Key Files:**
- [ConstructorLiturgias.tsx](src/components/liturgia-builder/ConstructorLiturgias.tsx) - Main orchestrator (43KB)
- [UniversalSlide.tsx](src/components/liturgia-builder/UniversalSlide.tsx) - Unified slide renderer
- [VistaPrevia.tsx](src/components/liturgia-builder/VistaPrevia.tsx) - Preview with drag-and-drop
- [ExportPanel.tsx](src/components/liturgia-builder/ExportPanel.tsx) - Export functionality

**Element Editors (18 total):**
- `editors/OracionEditor.tsx` - Prayers (invocation, repentance, gratitude)
- `editors/CancionSelector.tsx` - Song selection with tempo filtering
- `editors/LecturaBiblicaEditor.tsx` - Bible readings
- `editors/CuentacuentoEditor.tsx` - Children's stories
- `editors/ElementoFijoEditor.tsx` - Fixed elements (Lord's Prayer, Peace, Communion, etc.)
- `Portadas.tsx` - Cover pages
- `Anuncios.tsx` - Announcements

### 1.2 Slide Types Currently Supported

From [src/types/shared/slide.ts](src/types/shared/slide.ts):

```typescript
type SlideType =
  | 'song-title'           // Song title slide
  | 'song-lyrics'          // Song lyrics
  | 'prayer-leader'        // Prayer - leader's part
  | 'prayer-response'      // Prayer - congregation response
  | 'prayer-full'          // Complete prayer (leader + response)
  | 'reading'              // Bible reading
  | 'creed'                // Creed
  | 'announcement'         // Text announcement
  | 'announcement-image'   // Image announcement
  | 'blessing'             // Blessing
  | 'title'                // Section title
  | 'blank'                // Blank/transition slide
```

### 1.3 Data Structures

#### Liturgy Context
```typescript
interface LiturgyContext {
  id: string;
  date: Date;
  title: string;                    // Reflection title
  readings: LiturgyReading[];       // Bible readings
  summary: string;                  // Theme summary
  celebrant?: string;               // Celebrant name
  preacher?: string;                // Preacher name
  createdAt: string;
  updatedAt: string;
}
```

#### Liturgy Element
```typescript
interface LiturgyElement {
  id: string;
  type: LiturgyElementType;         // 18 types (portada, oracion, cancion, etc.)
  order: number;                    // Position in service
  title: string;
  status: LiturgyElementStatus;     // pending | in_progress | completed | skipped
  slides?: SlideGroup;              // Generated slides
  config?: Record<string, unknown>; // Element-specific config
  sourceId?: string;                // ID of selected song/prayer/etc.
  customContent?: string;           // Manual content
  editedSlides?: SlideGroup;        // Per-liturgy edited slides
}
```

#### Individual Slide
```typescript
interface Slide {
  id: string;
  type: SlideType;
  content: {
    primary: string;              // Main text
    secondary?: string;           // Secondary text (congregation response)
    subtitle?: string;            // Optional subtitle
    imageUrl?: string;            // Image for image-based slides
  };
  style: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor: string;
    primaryFont?: string;
    secondaryFont?: string;
  };
  metadata: {
    sourceComponent: string;      // Component that generated slide
    sourceId: string;             // Source element ID
    order: number;                // Order within group
    groupTotal: number;           // Total slides in group
    batchId?: string;             // Graphics batch ID
  };
}
```

### 1.4 18-Element Liturgy Order

From [src/types/shared/liturgy.ts](src/types/shared/liturgy.ts):

1. **portada-principal** - Main Cover
2. **oracion-invocacion** - Invocation Prayer
3. **cancion-invocacion** - First Song (fast tempo)
4. **oracion-arrepentimiento** - Repentance Prayer
5. **cancion-arrepentimiento** - Second Song (medium tempo)
6. **oracion-gratitud** - Gratitude Prayer
7. **cancion-gratitud** - Third Song (slow tempo)
8. **lectura-biblica** - Bible Reading
9. **cuentacuentos** - Children's Story (optional)
10. **portada-reflexion** - Reflection Cover
11. **padre-nuestro** - Lord's Prayer (fixed)
12. **paz** - The Peace (fixed)
13. **santa-cena** - Communion (fixed)
14. **accion-gracias** - Thanksgiving (fixed)
15. **cancion-santa-cena** - Fourth Song (slow tempo)
16. **ofrenda** - Offering (fixed)
17. **anuncios** - Announcements (optional)
18. **bendicion** - Final Blessing (fixed)

### 1.5 Database Schema

**Tables (Supabase):**
- `liturgias` - Master liturgy records
  - id, fecha, titulo, resumen, celebrante, predicador
  - estado (borrador | en-progreso | listo | archivado)
  - porcentaje_completado, portada_imagen_url, portadas_config
  - created_by, created_at, updated_at

- `liturgia_elementos` - Individual elements per liturgy
  - id, liturgia_id, tipo, orden, titulo, slides (JSONB)
  - source_id, status, config, custom_content, edited_slides

- `liturgia_lecturas` - Bible readings
  - id, liturgia_id, cita, texto, version, orden

### 1.6 Tech Stack

- **Framework:** Vite 5.4.1 + React 18.3.1 (NOT Next.js)
- **Routing:** React Router 6.26.2
- **Styling:** Tailwind CSS 3.4.11 with custom CASA theme
- **UI Components:** shadcn/ui (56+ components via Radix UI)
- **State Management:** TanStack React Query 5.56.2
- **Database:** Supabase 2.49.4 (PostgreSQL with RLS)
- **Export:** pptxgenjs 4.0.1, jspdf 4.0.0
- **Animations:** Framer Motion 12.6.2
- **Drag & Drop:** @dnd-kit/core 6.3.1

### 1.7 Brand Kit

From [src/lib/brand-kit.ts](src/lib/brand-kit.ts):

```typescript
CASA_BRAND = {
  colors: {
    primary: { black: '#1A1A1A', amber: '#D4A853', white: '#F7F7F7' },
    secondary: { carbon: '#333333', grayDark: '#555555', grayMedium: '#8A8A8A', grayLight: '#E5E5E5' }
  },
  fonts: { heading: 'Merriweather', body: 'Montserrat' },
  slide: { width: 1024, height: 768, aspectRatio: '4:3', padding: 48 }
}
```

### 1.8 Existing Slide Rendering

**UniversalSlide.tsx** renders all slide types with:
- Consistent branding (fonts, colors, logo placement)
- Scale parameter for preview vs. full-size
- Different layouts per slide type (portada, lyrics, prayers, etc.)
- Support for images, text styling, separators

**slideRenderer.tsx** converts slides to images using:
- html2canvas for DOM-to-PNG conversion
- Off-screen rendering for accurate export
- 1024x768 dimensions (4:3)

### 1.9 Authentication

- Supabase Auth with email/password
- `AuthContext` provides user, profile, session
- Row-Level Security (RLS) on all tables
- No specific "presenter" role exists yet

---

## 2. Proposed Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CASA Website                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐          ┌──────────────────┐             │
│  │  Presenter View  │◄────────►│   Output View    │             │
│  │  (Control Panel) │  Sync    │   (Projector)    │             │
│  │   /presenter     │          │   /output        │             │
│  └────────┬─────────┘          └────────┬─────────┘             │
│           │                             │                        │
│           ▼                             ▼                        │
│  ┌─────────────────────────────────────────────────┐            │
│  │           Real-time Sync Layer                   │            │
│  │        (BroadcastChannel + Supabase)            │            │
│  └─────────────────────────────────────────────────┘            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Presentation State                  │            │
│  │  - Current slide index                          │            │
│  │  - Active liturgy                               │            │
│  │  - Lower-third messages                         │            │
│  │  - Timer/clock                                  │            │
│  └─────────────────────────────────────────────────┘            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │            Existing Liturgy Data                 │            │
│  │         (Supabase: liturgias, etc.)             │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Real-time Synchronization Strategy

**Primary:** BroadcastChannel API (same-origin, same browser)
- Zero latency
- No server required
- Works offline
- Perfect for laptop + second window to projector

**Fallback:** Supabase Realtime (cross-device)
- For scenarios where presenter and output are on different machines
- Uses Supabase's existing real-time subscriptions
- Slightly higher latency but works anywhere

### 2.3 Routes

| Route | Purpose |
|-------|---------|
| `/presenter` | Control panel for the presenter |
| `/output` | Clean fullscreen output for projector |
| `/presenter/:liturgyId` | Open specific liturgy in presenter |

---

## 3. Component Architecture

### 3.1 Presenter View (`/presenter`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTER CONTROL PANEL                                             │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌───────────────────────────────────────────────────┐│
│ │ Service     │ │  Current Slide (large preview)                    ││
│ │ Navigator   │ │                                                   ││
│ │             │ │  ┌─────────────────────────────────────────────┐  ││
│ │ • Portada   │ │  │                                             │  ││
│ │ ○ Invocación│ │  │         [CURRENT SLIDE PREVIEW]             │  ││
│ │ ○ Canción 1 │ │  │                                             │  ││
│ │ ○ ...       │ │  └─────────────────────────────────────────────┘  ││
│ │             │ │                                                   ││
│ │             │ │  Presenter Notes:                                 ││
│ │             │ │  "Remember to pause after first verse..."         ││
│ └─────────────┘ └───────────────────────────────────────────────────┘│
│ ┌───────────────────────────────────────────────────────────────────┐│
│ │  Slide Strip (horizontal scroll of current element's slides)      ││
│ │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                 ││
│ │  │  1  │ │ *2* │ │  3  │ │  4  │ │  5  │ │  6  │                 ││
│ │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                 ││
│ └───────────────────────────────────────────────────────────────────┘│
│ ┌───────────────────────────────────────────────────────────────────┐│
│ │  Next Element Preview          │  Controls                        ││
│ │  ┌─────────────────────────┐   │  [◄ Prev] [Go Live] [Next ►]    ││
│ │  │  Oración Invocación     │   │  [📢 Lower Third]  [⬛ Black]    ││
│ │  │  (3 slides)             │   │  [⏱ Timer]        [🔗 Output]   ││
│ │  └─────────────────────────┘   │                                  ││
│ └───────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Output View (`/output`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                                                                      │
│                                                                      │
│                    [FULLSCREEN SLIDE CONTENT]                        │
│                                                                      │
│                                                                      │
│                                                                      │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  LOWER THIRD ANNOUNCEMENT (animated slide-up)                    │ │
│ │  "Por favor mover auto patente XY-1234"                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Component Breakdown

```
src/
├── components/
│   └── presentation/
│       ├── PresenterView.tsx           # Main presenter control panel
│       ├── OutputView.tsx              # Fullscreen projector output
│       ├── ServiceNavigator.tsx        # Left sidebar service outline
│       ├── SlideStrip.tsx              # Horizontal slide thumbnails
│       ├── SlidePreview.tsx            # Large current slide preview
│       ├── NextElementPreview.tsx      # Preview of upcoming element
│       ├── PresenterControls.tsx       # Navigation & action buttons
│       ├── LowerThirdManager.tsx       # Create/send announcements
│       ├── LowerThirdDisplay.tsx       # Animated lower-third overlay
│       ├── OutputSlide.tsx             # Fullscreen slide renderer
│       ├── TimerClock.tsx              # Service timer/clock display
│       └── LiturgySelectorModal.tsx    # Select liturgy to present
│
├── hooks/
│   └── presentation/
│       ├── usePresentationSync.ts      # BroadcastChannel sync logic
│       ├── usePresentationState.ts     # State management
│       ├── useKeyboardShortcuts.ts     # Keyboard navigation
│       └── useFullscreen.ts            # Fullscreen API wrapper
│
├── lib/
│   └── presentation/
│       ├── syncChannel.ts              # BroadcastChannel abstraction
│       ├── presentationService.ts      # Load/flatten liturgy slides
│       └── types.ts                    # Presentation-specific types
│
└── pages/
    ├── PresenterPage.tsx               # /presenter route
    └── OutputPage.tsx                  # /output route
```

---

## 4. Data Flow

### 4.1 Loading a Liturgy for Presentation

```
1. User opens /presenter
2. LiturgySelectorModal shows list of ready liturgies
3. User selects a liturgy
4. presentationService.loadForPresentation(liturgyId):
   - Calls liturgyService.loadLiturgy(id)
   - Flattens all elements into sequential slide array
   - Creates element-to-slide index mapping
   - Returns PresentationData
5. State initialized with slide 0
```

### 4.2 Real-time Sync Message Types

```typescript
type SyncMessage =
  | { type: 'SLIDE_CHANGE'; slideIndex: number; elementIndex: number }
  | { type: 'GO_LIVE'; slideIndex: number }
  | { type: 'GO_BLACK' }
  | { type: 'SHOW_LOWER_THIRD'; message: string; duration?: number }
  | { type: 'HIDE_LOWER_THIRD' }
  | { type: 'LITURGY_LOADED'; liturgyId: string }
  | { type: 'REQUEST_STATE' }  // Output requests current state from presenter
  | { type: 'STATE_SYNC'; state: PresentationState };
```

### 4.3 State Structure

```typescript
interface PresentationState {
  liturgyId: string | null;
  liturgyTitle: string;

  // Flattened slides from all elements
  slides: Slide[];

  // Element boundaries for navigation
  elements: {
    id: string;
    type: LiturgyElementType;
    title: string;
    startSlideIndex: number;
    endSlideIndex: number;
    slideCount: number;
  }[];

  // Current position
  currentSlideIndex: number;
  currentElementIndex: number;

  // Display state
  isLive: boolean;           // Whether output is showing content
  isBlack: boolean;          // Black screen mode

  // Lower third
  lowerThird: {
    visible: boolean;
    message: string;
    expiresAt?: number;
  };
}
```

---

## 5. Key Features

### 5.1 MVP Features (Phase 1)

1. **Load Ready Liturgy**
   - Select from list of liturgies with status='ready'
   - Flatten all elements into presentation sequence

2. **Presenter View**
   - Service outline (element list with indicators)
   - Current slide large preview
   - Slide strip for current element
   - Next element preview
   - Basic controls (prev/next/go live/black)

3. **Output View**
   - Fullscreen slide display
   - Uses existing UniversalSlide component
   - Responds to presenter commands

4. **Real-time Sync**
   - BroadcastChannel for same-browser windows
   - Instant slide changes

5. **Keyboard Shortcuts**
   - Arrow keys: navigate slides
   - Space: advance
   - B: black screen
   - Escape: exit fullscreen

### 5.2 Phase 2 Enhancements

1. **Lower-Third Announcements**
   - Quick message input
   - Preset templates ("Move car...", "Welcome...")
   - Auto-dismiss timer
   - Animated slide-up/slide-down

2. **Presenter Notes**
   - Per-element notes visible only to presenter
   - Stored in element config

3. **Service Timer**
   - Elapsed time
   - Target end time
   - Per-element timing suggestions

4. **Cross-Device Sync (Supabase Realtime)**
   - For tablet-as-controller scenarios
   - Fallback when BroadcastChannel unavailable

### 5.3 Phase 3 (Future)

1. **Multi-Output Support**
   - Different content on different outputs
   - Stage display vs. main display

2. **Media Support**
   - Video playback
   - Background loops

3. **Quick Edit**
   - Minor text corrections during service
   - Temporary slide modifications

---

## 6. Integration with Existing Code

### 6.1 Reuse UniversalSlide

The existing `UniversalSlide` component handles all slide type rendering. For the output view:

```tsx
// OutputView.tsx
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';

<UniversalSlide
  slide={currentSlide}
  scale={calculateFullscreenScale()}  // Fill projector
  showIndicator={false}               // No slide numbers on output
/>
```

### 6.2 Reuse liturgyService

Load liturgies using existing service:

```typescript
import { loadLiturgy, listLiturgies } from '@/lib/liturgia/liturgyService';

// Get ready liturgies
const liturgies = await listLiturgies();
const readyLiturgies = liturgies.filter(l => l.estado === 'listo');

// Load selected liturgy
const { liturgy } = await loadLiturgy(selectedId);
```

### 6.3 Reuse Brand Kit

All presentation styling uses CASA_BRAND:

```typescript
import { CASA_BRAND } from '@/lib/brand-kit';

// Output background matches slides
backgroundColor: CASA_BRAND.colors.primary.white

// Lower-third uses brand amber
accentColor: CASA_BRAND.colors.primary.amber
```

### 6.4 Authentication

Use existing AuthContext for presenter access:

```typescript
import { useAuth } from '@/components/auth/AuthContext';

const { user, loading } = useAuth();
if (!user) return <Navigate to="/login" />;
```

---

## 7. New Database Requirements

### 7.1 Optional: Presentation Sessions Table

For cross-device sync and logging:

```sql
CREATE TABLE presentation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  liturgy_id UUID REFERENCES liturgias(id),
  presenter_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  current_slide_index INT DEFAULT 0,
  is_live BOOLEAN DEFAULT false,
  metadata JSONB,
  CONSTRAINT fk_liturgia FOREIGN KEY (liturgy_id) REFERENCES liturgias(id) ON DELETE CASCADE
);

-- RLS
ALTER TABLE presentation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presenters can manage their sessions"
  ON presentation_sessions
  FOR ALL
  USING (presenter_id = auth.uid());
```

### 7.2 Optional: Lower-Third Messages Table

For preset announcements:

```sql
CREATE TABLE lower_third_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(50),  -- 'vehicle', 'welcome', 'general'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Implementation Phases

### Phase 1: MVP Core

**Goal:** Working dual-window presentation system

**Tasks:**
1. Create `src/components/presentation/` directory structure
2. Implement `usePresentationSync` hook with BroadcastChannel
3. Build `PresenterView` with:
   - Liturgy selector
   - Service navigator (element list)
   - Current slide preview
   - Slide strip
   - Basic controls
4. Build `OutputView` with:
   - Fullscreen slide display
   - Sync listener
5. Add routes to `App.tsx`
6. Add keyboard navigation
7. Test with real liturgy data

**Files to Create:**
- `src/pages/PresenterPage.tsx`
- `src/pages/OutputPage.tsx`
- `src/components/presentation/PresenterView.tsx`
- `src/components/presentation/OutputView.tsx`
- `src/components/presentation/ServiceNavigator.tsx`
- `src/components/presentation/SlideStrip.tsx`
- `src/components/presentation/SlidePreview.tsx`
- `src/components/presentation/PresenterControls.tsx`
- `src/components/presentation/LiturgySelectorModal.tsx`
- `src/hooks/presentation/usePresentationSync.ts`
- `src/hooks/presentation/usePresentationState.ts`
- `src/hooks/presentation/useKeyboardShortcuts.ts`
- `src/hooks/presentation/useFullscreen.ts`
- `src/lib/presentation/syncChannel.ts`
- `src/lib/presentation/presentationService.ts`
- `src/lib/presentation/types.ts`

### Phase 2: Lower-Third & Polish

**Goal:** Professional announcement system

**Tasks:**
1. Build `LowerThirdManager` component
2. Build `LowerThirdDisplay` with animations
3. Add preset message management
4. Implement auto-dismiss timer
5. Add presenter notes display
6. Add service timer

**Files to Create:**
- `src/components/presentation/LowerThirdManager.tsx`
- `src/components/presentation/LowerThirdDisplay.tsx`
- `src/components/presentation/PresenterNotes.tsx`
- `src/components/presentation/TimerClock.tsx`

### Phase 3: Cross-Device & Advanced

**Goal:** Support multiple devices and advanced features

**Tasks:**
1. Add Supabase Realtime sync as fallback
2. Create presentation_sessions table
3. Add lower_third_presets table
4. Build admin UI for presets
5. Add multi-output support

---

## 9. Technical Considerations

### 9.1 Performance

- **Slide Thumbnails:** Generate once on liturgy load, cache in state
- **Fullscreen Scaling:** CSS transform for GPU acceleration
- **Animation:** Use Framer Motion (already in project)
- **Memory:** Only keep current + adjacent slides in DOM

### 9.2 Browser Support

- BroadcastChannel: Chrome 54+, Firefox 38+, Safari 15.4+, Edge 79+
- Fullscreen API: All modern browsers
- Fallback for older browsers: polling or WebSocket

### 9.3 Offline Capability

Once liturgy is loaded:
- All slides in memory
- BroadcastChannel works offline
- No network required for presentation

### 9.4 Security

- Presenter view requires authentication
- Output view: consider if public or auth-required
- RLS on any new tables
- No sensitive data in BroadcastChannel messages

---

## 10. User Workflow

### 10.1 Before Service

1. Open liturgy builder, complete liturgy (existing workflow)
2. Mark liturgy as "ready"

### 10.2 Starting Presentation

1. Navigate to `/presenter`
2. Log in if needed
3. Select liturgy from list
4. Click "Open Output Window" button
5. Drag output window to projector display
6. Make output fullscreen (F11 or button)
7. Return to presenter window

### 10.3 During Service

1. Navigate slides using:
   - Click on slide strip
   - Arrow keys
   - Click service navigator to jump to element
2. Press "Go Live" to show current slide on output
3. Press "Black" for transitions
4. Send lower-third announcements as needed

### 10.4 After Service

1. Close output window
2. Presenter view can be closed or used to start another service

---

## 11. Questions for Review

1. **Output Access:** Should `/output` require authentication, or be accessible to anyone with the URL? (Projector computers may not have credentials)

2. **Cross-Device Priority:** How important is tablet/phone control vs. laptop-only? This affects whether we need Supabase Realtime in MVP.

3. **Presenter Notes:** Should notes be stored per-element in the liturgy, or in a separate system?

4. **Lower-Third Presets:** Should these be admin-configurable, or hardcoded initially?

5. **Aspect Ratio:** Current slides are 4:3 (1024x768). Do we need 16:9 support for modern projectors?

---

## 12. Appendix: Type Definitions

### Full PresentationState

```typescript
// src/lib/presentation/types.ts

import type { Slide, SlideGroup } from '@/types/shared/slide';
import type { LiturgyElementType, Liturgy } from '@/types/shared/liturgy';

export interface FlattenedElement {
  id: string;
  type: LiturgyElementType;
  title: string;
  startSlideIndex: number;
  endSlideIndex: number;
  slideCount: number;
  notes?: string;
}

export interface PresentationData {
  liturgyId: string;
  liturgyTitle: string;
  liturgyDate: Date;
  slides: Slide[];
  elements: FlattenedElement[];
}

export interface PresentationState extends PresentationData {
  currentSlideIndex: number;
  currentElementIndex: number;
  isLive: boolean;
  isBlack: boolean;
  lowerThird: LowerThirdState;
}

export interface LowerThirdState {
  visible: boolean;
  message: string;
  duration?: number;  // ms, undefined = manual dismiss
}

export type SyncMessage =
  | { type: 'SLIDE_CHANGE'; slideIndex: number }
  | { type: 'GO_LIVE' }
  | { type: 'GO_BLACK'; black: boolean }
  | { type: 'SHOW_LOWER_THIRD'; message: string; duration?: number }
  | { type: 'HIDE_LOWER_THIRD' }
  | { type: 'LITURGY_LOADED'; data: PresentationData }
  | { type: 'REQUEST_STATE' }
  | { type: 'STATE_SYNC'; state: PresentationState };
```

---

*Document prepared for review before implementation begins.*
