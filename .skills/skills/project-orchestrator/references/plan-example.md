# Example Orchestration Plan: GENERA Student Progress Tracking

**Project:** genera
**Created:** 2026-03-11T14:00:00Z
**Phases:** 4

---

## Phase 1: Database Schema — Student Progress
**Intent:** Create the `student_progress` table to store per-student, per-course progress metrics. Columns: id, student_id (FK → profiles), course_id (FK → courses), completion_percentage (numeric), last_activity_at (timestamptz), milestones_completed (jsonb), created_at, updated_at. Add RLS policies: students see only their own rows, docentes see rows for their courses, admins see all.
**Type:** code
**Validates:**
- Migration file exists in `supabase/migrations/`
- Table has correct columns and types
- RLS policies enforce role-based access
- No destructive changes to existing tables

## Phase 2: API Endpoints — Student Progress CRUD
**Intent:** Create server-side API routes for student progress. GET /api/student-progress (list, filtered by role), GET /api/student-progress/[id] (single record), POST /api/student-progress (create, docente/admin only), PATCH /api/student-progress/[id] (update completion, docente/admin only). Use getServerSideProps pattern consistent with existing pages. Include input validation and proper error responses.
**Type:** code
**Depends on:** Phase 1
**Validates:**
- Endpoint files exist in `pages/api/student-progress/`
- Endpoints reference the correct table name from Phase 1
- RBAC enforcement matches Phase 1's RLS policies
- Response shape is documented (the UI phase needs to know the exact JSON structure)

## Phase 3: UI Components — Progress Dashboard
**Intent:** Build a progress dashboard page at `/dashboard/progress` visible to docentes and admins. Show a table of students with progress bars, sortable by completion percentage and last activity. Use existing shadcn/ui table component pattern. Include loading states and empty states. Link from the existing dashboard sidebar navigation.
**Type:** code
**Depends on:** Phase 2
**Validates:**
- Page exists at `pages/dashboard/progress.tsx`
- Fetches from the correct API endpoints created in Phase 2
- Uses existing UI component patterns (shadcn/ui, existing layout)
- Sidebar navigation updated to include the new page
- Loading and empty states implemented

## Phase 4: Student Self-View — My Progress
**Intent:** Add a student-facing view at `/my-progress` showing the logged-in student's own progress across all enrolled courses. Reuse the progress visualization components from Phase 3 but filtered to the current user. Add milestone badges for completed milestones. Accessible from the student dashboard.
**Type:** code
**Depends on:** Phase 2, Phase 3
**Validates:**
- Page exists at `pages/my-progress.tsx`
- Only shows data for the logged-in student (no access to other students' data)
- Reuses components from Phase 3 rather than duplicating
- Student navigation updated
- Milestone badges render correctly for empty and populated states
