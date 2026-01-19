# CASA Presentation System - Implementation Plan

## Overview

Build a web-based presentation system (like ProPresenter) for CASA. Dual-window interface: Presenter View (laptop control panel) + Output View (projector in separate browser window).

---

## Definition of Done

The project is complete when ALL items below are checked:

### Phase 1: Core MVP

**Routes**
- [ ] `/presenter` route loads PresenterPage
- [ ] `/output` route loads OutputPage  
- [ ] Routes registered in App.tsx

**Presenter View**
- [ ] Liturgy selector modal lists available liturgies from Supabase
- [ ] Selecting a liturgy loads all slides into state
- [ ] Service navigator shows all liturgy elements with titles
- [ ] Clicking navigator element jumps to its first slide
- [ ] Large current slide preview displays correctly
- [ ] Slide strip shows thumbnail previews
- [ ] Current slide highlighted in strip
- [ ] Clicking thumbnail navigates to that slide
- [ ] "Open Output Window" button spawns `/output` window
- [ ] "Go Live" button starts showing slides on output
- [ ] "Black" button toggles output to black

**Output View**
- [ ] Shows current slide fullscreen
- [ ] Responds to presenter commands in real-time
- [ ] Can enter browser fullscreen (F11 or button)
- [ ] Shows black when presenter hits "Black"
- [ ] Reconnects if presenter refreshes

**Sync**
- [ ] BroadcastChannel connects both windows
- [ ] Slide changes sync immediately
- [ ] Go Live/Black state syncs
- [ ] Output requests state on load
- [ ] Works offline after liturgy load

**Keyboard**
- [ ] Right Arrow / Space / PageDown = Next slide
- [ ] Left Arrow / PageUp = Previous slide  
- [ ] Home = First slide
- [ ] End = Last slide
- [ ] B = Toggle black
- [ ] F = Toggle output fullscreen

**Slides**
- [ ] UniversalSlide renders all 12 slide types
- [ ] Slides scale properly (preview, strip, fullscreen)
- [ ] Brand colors/fonts correct

### Phase 2: Lower-Thirds

- [ ] Quick-input field in presenter for messages
- [ ] "Send" displays lower-third on output
- [ ] Lower-third animates in with Framer Motion
- [ ] Auto-dismiss with configurable timer (default 10s)
- [ ] Manual dismiss button
- [ ] Appears over current slide
- [ ] Preset templates: "Mover auto patente ___", "Llamada urgente para ___"

### Phase 2: Polish

- [ ] Presenter notes area shows current element notes
- [ ] Current time displays in presenter
- [ ] Service timer (elapsed since "Go Live")

### Technical

- [ ] TypeScript compiles without errors
- [ ] No ESLint errors
- [ ] Uses existing UniversalSlide component
- [ ] Uses existing Supabase client
- [ ] Uses existing shadcn/ui components
- [ ] Uses existing Tailwind/brand colors

---

## Tech Stack

- **Framework:** Vite 5.4.1 + React 18.3.1
- **Routing:** React Router 6.26.2
- **Styling:** Tailwind CSS 3.4.11
- **UI:** shadcn/ui (56+ components)
- **State:** TanStack React Query 5.56.2
- **Database:** Supabase 2.49.4
- **Animations:** Framer Motion 12.6.2

---

## Key Existing Files

```
src/components/liturgia-builder/UniversalSlide.tsx  # USE THIS for rendering
src/types/shared/slide.ts                           # Slide types
src/types/shared/liturgy.ts                         # Liturgy types
src/lib/brand-kit.ts                                # Colors, fonts
src/lib/supabase.ts                                 # Supabase client
```

---

## Database

**Tables:**
- `liturgias` - id, fecha, titulo, estado, etc.
- `liturgia_elementos` - slides stored as JSONB in `slides` column

---

## Slide Types (12)

```typescript
type SlideType =
  | 'song-title' | 'song-lyrics' | 'prayer-leader' | 'prayer-response'
  | 'prayer-full' | 'reading' | 'creed' | 'announcement'
  | 'announcement-image' | 'blessing' | 'title' | 'blank'
```

---

## Brand Kit

```typescript
colors: {
  primary: { black: '#1A1A1A', amber: '#D4A853', white: '#F7F7F7' },
  secondary: { carbon: '#333333', grayDark: '#555555', grayMedium: '#8A8A8A', grayLight: '#E5E5E5' }
}
fonts: { heading: 'Merriweather', body: 'Montserrat' }
slide: { width: 1024, height: 768, aspectRatio: '4:3' }
```

---

## Architecture Decisions

1. `/output` does NOT require auth (projector computers)
2. Laptop-only control for MVP (no cross-device)
3. 4:3 aspect ratio only
4. Hardcoded lower-third presets initially

---

## Files to Create

```
src/pages/
  PresenterPage.tsx
  OutputPage.tsx

src/components/presentation/
  PresenterView.tsx
  OutputView.tsx
  ServiceNavigator.tsx
  SlideStrip.tsx
  SlidePreview.tsx
  PresenterControls.tsx
  LiturgySelectorModal.tsx
  LowerThirdManager.tsx
  LowerThirdDisplay.tsx
  PresenterNotes.tsx
  TimerClock.tsx

src/hooks/presentation/
  usePresentationSync.ts
  usePresentationState.ts
  useKeyboardShortcuts.ts
  useFullscreen.ts

src/lib/presentation/
  syncChannel.ts
  presentationService.ts
  types.ts
```

---

## Implementation Order

1. **Types** - `src/lib/presentation/types.ts`
2. **Sync** - `src/lib/presentation/syncChannel.ts` (BroadcastChannel)
3. **Service** - `src/lib/presentation/presentationService.ts` (load liturgy)
4. **Hooks** - All 4 hooks
5. **Output** - OutputView + OutputPage + route (simpler, test sync)
6. **Presenter** - All presenter components + PresenterPage + route
7. **Integration** - Test with real data
8. **Lower-thirds** - LowerThirdManager + LowerThirdDisplay
9. **Polish** - Notes, timer

---

## Type Definitions

```typescript
// src/lib/presentation/types.ts

import type { Slide } from '@/types/shared/slide';
import type { LiturgyElementType } from '@/types/shared/liturgy';

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

export interface PresentationState {
  data: PresentationData | null;
  currentSlideIndex: number;
  currentElementIndex: number;
  isLive: boolean;
  isBlack: boolean;
  lowerThird: LowerThirdState;
}

export interface LowerThirdState {
  visible: boolean;
  message: string;
  duration?: number;
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

export type SyncRole = 'presenter' | 'output';
```

---

## Sync Channel Starter

```typescript
// src/lib/presentation/syncChannel.ts

import type { SyncMessage } from './types';

const CHANNEL_NAME = 'casa-presentation';

export function createSyncChannel() {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const handlers = new Set<(msg: SyncMessage) => void>();

  channel.onmessage = (e: MessageEvent<SyncMessage>) => {
    handlers.forEach(h => h(e.data));
  };

  return {
    send: (msg: SyncMessage) => channel.postMessage(msg),
    subscribe: (handler: (msg: SyncMessage) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close: () => channel.close()
  };
}
```

---

## Critical Notes

1. **USE UniversalSlide** - Don't create new slide rendering
2. **Scale slides** - UniversalSlide has `scale` prop. Thumbnails ~0.15, preview ~0.5, output 1.0
3. **Flatten slides** - Liturgy elements contain SlideGroups, flatten into single array
4. **Handle empty states** - No liturgies, no slides, incomplete data
5. **Output window ref** - Store window reference to close from presenter
6. **Lower-third** - Absolute position, high z-index, Framer Motion AnimatePresence

---

## Verification

```bash
npx tsc --noEmit
npm run lint
npm run dev
```

Then test:
1. Go to `/presenter`
2. Select a liturgy
3. Click "Open Output Window"
4. Navigate with arrows
5. Press B for black
6. Send a lower-third
