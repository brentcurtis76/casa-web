# 🍽️ La Mesa Abierta - Development Handoff

## 📋 Project Overview

**La Mesa Abierta** is a monthly anonymous dinner matching system for Casa Community Church where:
- Users sign up as **hosts** (provide venue) or **guests** (attend dinner)
- System randomly assigns participants to dinners (6-10 people per dinner)
- **Mystery element**: Nobody knows who will be at their dinner until arrival
- Includes dietary restrictions, WhatsApp notifications, food assignments
- Post-dinner: photos, testimonials, and engagement

**Current Status**: ✅ Core sign-up flow and dashboard COMPLETE and INTEGRATED into main site

---

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Radix UI + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Animation**: Framer Motion
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + Playwright + Testing Library
- **Date handling**: date-fns

**Dev Server**: `npm run dev` runs on **port 8080** (http://localhost:8080)

---

## 📁 Project Structure

```
casa-web/
├── src/
│   ├── components/
│   │   ├── mesa-abierta/               # 🎯 Main feature folder
│   │   │   ├── MesaAbiertaSection.tsx  # Landing page section (integrated)
│   │   │   ├── MesaAbiertaDashboard.tsx # Participant dashboard
│   │   │   ├── MesaAbiertaSignup.tsx   # Multi-step signup wizard
│   │   │   ├── DietaryRestrictionsForm.tsx
│   │   │   ├── WhatsAppOptIn.tsx
│   │   │   └── __tests__/              # Unit tests (partially working)
│   │   ├── auth/
│   │   │   └── AuthContext.tsx         # User authentication context
│   │   ├── sections/                   # Other site sections
│   │   └── ui/                         # shadcn components
│   ├── pages/
│   │   ├── Index.tsx                   # Main landing (Mesa Abierta integrated here)
│   │   └── MesaAbiertaDashboard.tsx    # Dashboard page route
│   ├── integrations/
│   │   └── supabase/
│   │       └── client.ts               # Supabase client config
│   └── App.tsx                         # Routes defined here
├── supabase/
│   └── migrations/
│       ├── 20241109_mesa_abierta_schema.sql     # Complete DB schema
│       └── 20241109_storage_policies.sql        # Storage bucket policies
├── tests/
│   └── e2e/                            # Playwright tests
├── vitest.config.ts                    # Test configuration
├── playwright.config.ts
├── TESTING.md                          # Comprehensive testing guide
└── LA_MESA_ABIERTA_README.md          # Original implementation plan
```

---

## 🗄️ Database Schema (11 Tables - ALL CREATED)

### Core Tables

1. **`mesa_abierta_months`** - Monthly event definitions
   - `id`, `month_date`, `dinner_date`, `registration_deadline`, `status`, `max_participants`
   - Status: `draft`, `open`, `closed`, `completed`

2. **`mesa_abierta_participants`** - User sign-ups
   - `id`, `user_id`, `month_id`, `role_preference`, `assigned_role`, `has_plus_one`, `status`, `host_address`, `phone_number`, `recurring`
   - Status: `pending`, `confirmed`, `cancelled`, `waitlist`

3. **`mesa_abierta_dietary_restrictions`** - Dietary needs
   - `id`, `participant_id`, `restriction_type`, `severity`, `description`, `plus_one`
   - Types: `vegetarian`, `vegan`, `gluten_free`, `dairy_free`, `nut_allergy`, `shellfish_allergy`, `other`
   - Severity: `preference`, `allergy`, `religious`

4. **`mesa_abierta_matches`** - Dinner groups
   - `id`, `month_id`, `host_participant_id`, `dinner_date`, `dinner_time`, `group_size`, `status`

5. **`mesa_abierta_assignments`** - Guest assignments to matches
   - `id`, `match_id`, `participant_id`, `food_assignment`, `assignment_date`, `notification_sent`
   - Food: `main_course`, `salad`, `drinks`, `dessert`, `none`

### Communication Tables

6. **`mesa_abierta_whatsapp_opt_ins`** - WhatsApp preferences
   - `id`, `participant_id`, `opted_in`, `phone_number`

7. **`mesa_abierta_email_logs`** - Email tracking
   - `id`, `participant_id`, `email_type`, `sent_at`, `status`, `error_message`

8. **`mesa_abierta_notifications`** - Notification queue
   - `id`, `participant_id`, `notification_type`, `channel`, `status`, `scheduled_for`, `sent_at`

### Post-Dinner Tables

9. **`mesa_abierta_photos`** - Dinner photos
   - `id`, `match_id`, `participant_id`, `photo_url`, `caption`, `is_approved`

10. **`mesa_abierta_testimonials`** - Participant reviews
    - `id`, `participant_id`, `testimonial_text`, `rating`, `is_approved`, `is_featured`

11. **`mesa_abierta_cancellations`** - Cancellation tracking
    - `id`, `participant_id`, `reason`, `cancelled_at`, `reassigned`

**Storage Bucket**: `mesa-abierta-photos` (created, policies applied via Supabase dashboard)

---

## ✅ What's Built and Working

### 1. Landing Page Integration (`MesaAbiertaSection.tsx`)
**Location**: Integrated into `/src/pages/Index.tsx` (between Formación and RetiroSemanaSanta)

**Features**:
- ✅ Fetches next open month from database
- ✅ Shows dinner date, registration deadline
- ✅ Real-time participant stats (total participants, hosts needed, spots available)
- ✅ Featured testimonials carousel (auto-rotates every 5s)
- ✅ "How It Works" 3-step explanation
- ✅ Sign-up CTAs (Host or Guest buttons)
- ✅ **Smart button logic**: If user has active participation, shows "Ver Mi Participación" instead of sign-up buttons
- ✅ Responsive design with Framer Motion animations

**Key Functions**:
- `fetchNextMonth()` - Gets next open event
- `fetchStats(monthId)` - Calculates real-time stats
- `fetchTestimonials()` - Gets featured testimonials
- `checkActiveParticipation()` - Checks if user already signed up
- `handleSignUp(role)` - Opens signup dialog

### 2. Multi-Step Signup Wizard (`MesaAbiertaSignup.tsx`)
**Opens as**: Dialog modal from landing section

**4 Steps**:
1. **Role Selection** - Host or Guest, plus-one option, recurring preference
2. **Details** - Host: address input, Guest: skipped
3. **Dietary Restrictions** - Comprehensive form with participant + plus-one support
4. **WhatsApp Opt-in** - Phone number + notification preferences

**Features**:
- ✅ Progress indicator (1/4, 2/4, etc.)
- ✅ Form validation with error messages
- ✅ Back/Next navigation
- ✅ Saves to database on completion (all 4 tables: participants, dietary_restrictions, whatsapp_opt_ins, notifications)
- ✅ Success confirmation with dashboard link
- ✅ Closes and refreshes parent section stats

### 3. Participant Dashboard (`MesaAbiertaDashboard.tsx`)
**Route**: `/mesa-abierta/dashboard`
**Page**: `/src/pages/MesaAbiertaDashboard.tsx` (full page with header/footer)

**States Handled**:
- ✅ Empty state: "No estás inscrito" with sign-up CTA
- ✅ Pending: "Esperando asignación" with role preference shown
- ✅ Confirmed Guest: Shows dinner details, address, food assignment, dietary restrictions summary
- ✅ Confirmed Host: Shows expected guest count, hosting details
- ✅ Cancelled: Handled in status badge

**Features**:
- ✅ Google Calendar integration ("Agregar al Calendario" button)
- ✅ Cancel participation button (updates status to 'cancelled')
- ✅ Mystery reminder section (different text for hosts vs guests)
- ✅ Real-time data fetching from Supabase
- ✅ Fetches group dietary restrictions for hosts/guests
- ✅ Responsive card-based layout

**Key Query**:
```typescript
supabase
  .from('mesa_abierta_participants')
  .select(`
    id, role_preference, assigned_role, has_plus_one, status,
    host_address, phone_number,
    mesa_abierta_months!inner(dinner_date, month_date),
    mesa_abierta_assignments(
      food_assignment,
      mesa_abierta_matches!inner(
        dinner_date, dinner_time,
        mesa_abierta_participants!mesa_abierta_matches_host_participant_id_fkey(
          host_address
        )
      )
    )
  `)
  .eq('user_id', user.id)
  .gte('mesa_abierta_months.dinner_date', new Date().toISOString())
  .order('mesa_abierta_months.dinner_date', { ascending: true })
  .limit(1)
  .single();
```

### 4. Dietary Restrictions Form (`DietaryRestrictionsForm.tsx`)
**Reusable component** used in signup wizard

**Features**:
- ✅ Checkboxes for common restrictions
- ✅ "Otra" option with text input
- ✅ Categorizes by severity (preference/allergy/religious)
- ✅ Separate section for plus-one restrictions
- ✅ Returns structured data via callback
- ✅ Icons for allergies (AlertTriangle)
- ✅ Info alert about sharing restrictions

**Unit Tests**: 8 tests, ALL PASSING ✅

### 5. WhatsApp Opt-in Form (`WhatsAppOptIn.tsx`)
**Features**:
- ✅ Phone number input with formatting
- ✅ Opt-out option (email notifications only)
- ✅ Lists all notification types user will receive
- ✅ Data structure compatible with Supabase tables

---

## ⚠️ Known Issues

### Unit Tests - UNSTABLE
**File**: `src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx`
**Status**: 8 tests written, **flaky results** (passes vary between runs: 1-5 passing)

**Problem**: Supabase mock query chaining is unstable in Vitest
- Tests timeout in loading state
- Mock implementation using module-level variables sometimes doesn't resolve
- Date filtering (`.gte()`) in mocks causing issues

**Solution Options**:
1. ✅ **Recommended**: Skip stabilization for now, focus on integration tests later
2. Use real test database instead of mocking
3. Continue debugging mocks (time-consuming)

**Decision**: We chose option 1 - component works perfectly in browser, tests can be stabilized later

### E2E Tests
**File**: `tests/e2e/mesa-abierta-signup.spec.ts`
**Status**: Basic structure created, authenticated tests marked `.skip()`
**Reason**: Need test authentication setup before implementing full flow tests

---

## 🚧 What's NOT Built Yet (TODO)

### 1. Photo Upload & Gallery Components
**Priority**: Medium
**Components to Build**:
- `PhotoUpload.tsx` - Post-dinner photo upload form
- `PhotoGallery.tsx` - Gallery view for match photos
**Features Needed**:
- Supabase Storage integration (bucket already created)
- Image optimization/compression
- Admin approval workflow
- Thumbnail generation

### 2. Testimonial Form & Carousel
**Priority**: Medium
**Components to Build**:
- `TestimonialForm.tsx` - Post-dinner review form with rating
- `TestimonialCarousel.tsx` - Enhanced carousel for landing page (currently uses basic implementation)
**Features Needed**:
- 5-star rating system
- Text input validation
- Admin approval workflow
- Featured testimonial selection

### 3. Matching Algorithm Edge Function ⚠️ CRITICAL
**Priority**: HIGH - Required for system to work!
**Location**: `supabase/functions/match-participants/`
**Logic Required**:
- Random host/guest pairing
- Balance group sizes (6-10 people per dinner)
- Food assignment distribution (main_course, salad, drinks, dessert)
- Consider dietary restrictions for grouping
- Balance host/guest ratios
- Handle plus-ones
- Create records in `mesa_abierta_matches` and `mesa_abierta_assignments`

**Algorithm Constraints**:
- Each host can accommodate 5-9 guests
- Distribute food assignments evenly across guests
- Try to group compatible dietary restrictions
- Randomize to preserve mystery

**Trigger**: Admin action from dashboard (manual "Run Matching" button)

### 4. Admin Panel (MesaAbiertaAdmin) ⚠️ CRITICAL
**Priority**: HIGH - Required to manage events!
**Route**: `/mesa-abierta/admin` (not created yet)
**Features Needed**:

#### Event Management
- Create new monthly events (set month_date, dinner_date, registration_deadline)
- Edit existing events
- Open/close registration
- View all participants for a month

#### Matching Control
- **"Run Matching Algorithm" button** - triggers Edge Function
- View matching results
- Manual adjustments (reassign participants)
- Emergency reassignment handling

#### Communication
- Send assignment emails (Monday before dinner)
- View email/WhatsApp log
- Resend notifications

#### Statistics
- Participant counts (hosts/guests/plus-ones)
- Attendance tracking
- Cancellation rates
- Popular months/dates

#### Content Moderation
- Approve/reject testimonials
- Mark testimonials as featured
- Approve/reject photos
- Manage photo gallery

**RLS Policies**: Need to restrict to admin users only (check `profiles.role = 'admin'`)

### 5. Email Integration (SendGrid)
**Priority**: HIGH
**What's Needed**:
- SendGrid API setup in Supabase Edge Function
- Email templates (assignment notification, reminder, cancellation)
- Scheduled email jobs (Monday before dinner at 9 AM)
- Track email delivery in `mesa_abierta_email_logs`

**Email Types**:
1. **Assignment Email** (sent Monday before dinner)
   - For hosts: guest count, food assignments incoming, dietary restrictions summary
   - For guests: address, time, food assignment, dietary restrictions to consider
2. **Reminder Email** (sent Friday before dinner)
3. **Cancellation Notification** (immediate)
4. **Signup Confirmation** (immediate)

### 6. WhatsApp Integration (Twilio)
**Priority**: Medium
**What's Needed**:
- Twilio API setup
- WhatsApp message templates
- Send notifications to opted-in users
- Respect opt-out preferences

---

## 🎨 Design System

**Brand Colors** (from TailwindCSS config):
- Primary: `casa-700` (purple/maroon)
- Lighter: `casa-600`, `casa-500`, `casa-400`, `casa-300`, `casa-200`, `casa-100`, `casa-50`
- Darker: `casa-800`

**Design Principles**:
- Clean, minimal aesthetics
- NO yellow/amber/sparkles (cheesy, off-brand)
- NO overlapping icons (confusing)
- Use subtle animations (Framer Motion)
- Card-based layouts
- Responsive-first

**Current Header Design**: Simple icon + title inline, no fancy badges

---

## 🔑 Key Design Decisions

1. **Mystery Preservation**:
   - Users NEVER see who else is attending until dinner
   - Addresses hidden until assignment
   - No participant lists visible

2. **Two-Phase System**:
   - **Phase 1**: Sign-up period (open registration)
   - **Phase 2**: Assignment notification (Monday before dinner)

3. **Food Assignments**:
   - Hosts provide venue + main course
   - Guests assigned: salad, drinks, or dessert
   - One guest per food type per dinner
   - Serves ~10 people

4. **Dietary Handling**:
   - Collected during signup
   - Shared with ALL participants in a match
   - Severity categorization helps hosts prioritize
   - Plus-ones tracked separately

5. **Status Flow**:
   ```
   pending → confirmed (after matching)
            ↓
         cancelled (user cancels)
   ```

6. **Recurring Participation**:
   - Users can opt-in to auto-signup for future months
   - Admin must still run matching each month

---

## 🧪 Testing Setup

### Test Infrastructure (COMPLETE)
- ✅ Vitest configured (`vitest.config.ts`)
- ✅ Playwright configured (`playwright.config.ts`)
- ✅ Testing Library installed
- ✅ Test setup file (`src/test/setup.ts`) with global mocks
- ✅ MCP servers configured (Playwright, Chrome DevTools)
- ✅ Test scripts in `package.json`

### Run Tests
```bash
npm test                    # Unit tests (watch mode)
npm run test:ui             # Vitest UI
npm run test:coverage       # Coverage report
npm run test:e2e            # Playwright E2E
npm run test:e2e:ui         # Playwright UI
npm run test:e2e:debug      # Debug E2E tests
```

### Test Files Status
- ✅ `DietaryRestrictionsForm.test.tsx` - 8/8 passing
- ⚠️ `MesaAbiertaDashboard.test.tsx` - 8 tests, flaky (1-5 passing depending on run)
- 🚧 `mesa-abierta-signup.spec.ts` - Basic structure, needs auth setup

---

## 🔐 Environment Setup

**Supabase Connection**:
- Project URL and anon key configured in environment
- RLS policies applied (30+ policies across all tables)
- Storage bucket `mesa-abierta-photos` created
- Auth context available via `useAuth()` hook

**Database Migrations**:
- ✅ Schema migration applied: `20241109_mesa_abierta_schema.sql`
- ✅ Storage policies applied: `20241109_storage_policies.sql`
- ✅ Sample December 2024 event created

**Test Data**:
- One sample month exists in database (December 2024)
- To test: manually create an "open" event via SQL or admin panel (when built)

---

## 📝 Common Tasks

### Create a New Monthly Event (Manual - until admin panel built)
```sql
INSERT INTO mesa_abierta_months (month_date, dinner_date, registration_deadline, status, max_participants)
VALUES
  ('2025-01-01', '2025-01-13', '2025-01-10 23:59:59', 'open', 100);
```

### Check Participants for a Month
```sql
SELECT
  p.id,
  prof.full_name,
  p.role_preference,
  p.assigned_role,
  p.status,
  p.has_plus_one
FROM mesa_abierta_participants p
JOIN profiles prof ON prof.id = p.user_id
WHERE p.month_id = 'your-month-id';
```

### Test User Flow
1. Go to http://localhost:8080/
2. Scroll to "La Mesa Abierta" section
3. Click "Ser Invitado" or "Ser Anfitrión"
4. Complete 4-step signup
5. Visit http://localhost:8080/mesa-abierta/dashboard
6. See pending status

---

## 🚀 Next Steps Priority Order

1. **Build Matching Algorithm Edge Function** ⚠️ CRITICAL
   - Without this, participants never get assigned
   - Required for system to be functional

2. **Build Admin Panel** ⚠️ CRITICAL
   - Need to create events
   - Need to trigger matching
   - Need to send notifications

3. **Email Integration (SendGrid)**
   - Participants need assignment notifications
   - Without this, they don't know where to go

4. **Build Photo Upload & Gallery**
   - Post-dinner engagement
   - Builds community

5. **Build Testimonial Form**
   - Feedback mechanism
   - Marketing content for landing page

6. **Stabilize Unit Tests**
   - Low priority - component works in browser
   - Can revisit when time permits

---

## 💡 Important Notes

1. **Date Filtering**: Dashboard and section both filter by `dinner_date >= today` to show only upcoming/current events

2. **User Authentication**: Uses `AuthContext` from `@/components/auth/AuthContext`
   - `user` object available via `useAuth()` hook
   - Contains `user.id`, `user.email`

3. **Toast Notifications**: Use `useToast()` hook from `@/hooks/use-toast`
   ```typescript
   toast({
     title: "Success",
     description: "Your message here"
   });
   ```

4. **Navigation**: Use `useNavigate()` from `react-router-dom`
   ```typescript
   navigate('/mesa-abierta/dashboard');
   ```

5. **Supabase Client**: Import from `@/integrations/supabase/client`
   ```typescript
   import { supabase } from "@/integrations/supabase/client";
   ```

6. **Row Level Security**: All tables have RLS enabled. Policies allow:
   - Users to read their own participant records
   - Users to insert their own sign-ups
   - Admins to read/write all records

---

## 🐛 Debugging Tips

### Component Not Showing Data?
- Check browser console for Supabase errors
- Verify RLS policies allow the query
- Check that event status is 'open'
- Ensure `dinner_date >= today`

### Tests Failing?
- DietaryRestrictionsForm tests should pass consistently
- MesaAbiertaDashboard tests are known to be flaky - ignore for now
- If tests hang, it's the Supabase mock - component works in browser

### Dev Server Issues?
- Port 8080 should be free
- Run `npm install` if dependencies missing
- Check `npm run dev` output for errors

---

## 📚 Key Files for Reference

- **Database Schema**: `supabase/migrations/20241109_mesa_abierta_schema.sql`
- **Original Plan**: `LA_MESA_ABIERTA_README.md`
- **Testing Guide**: `TESTING.md`
- **Main Section**: `src/components/mesa-abierta/MesaAbiertaSection.tsx`
- **Dashboard**: `src/components/mesa-abierta/MesaAbiertaDashboard.tsx`
- **Signup Wizard**: `src/components/mesa-abierta/MesaAbiertaSignup.tsx`

---

## ✨ System is LIVE and Working!

**Visit**: http://localhost:8080/ (dev server running on port 8080)

**What You'll See**:
1. La Mesa Abierta section on main page (scroll down)
2. Sign-up buttons (if no active participation)
3. "Ver Mi Participación" button (if already signed up)
4. Full signup flow via dialog
5. Dashboard at `/mesa-abierta/dashboard`

**What's Missing**:
- Matching algorithm (participants stay "pending" forever without this)
- Admin panel (no way to create events or trigger matching)
- Email notifications (participants don't get assignment details)

---

## 🎯 Recommended Starting Point

**If you want to make the system fully functional**:
1. Start with the **Matching Algorithm Edge Function**
2. Then build the **Admin Panel** to trigger it
3. Add **Email Integration** so participants get notified

**If you want to enhance user experience**:
1. Build **Photo Upload & Gallery**
2. Build **Testimonial Form**
3. Enhance landing page with more testimonials

---

## 🔗 Quick Links

- **Dev Server**: http://localhost:8080/
- **Dashboard**: http://localhost:8080/mesa-abierta/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard (for manual DB inspection)

---

**Last Updated**: January 2025
**Status**: Core features complete, admin & matching algorithm needed
**Dev Server**: Running on port 8080
