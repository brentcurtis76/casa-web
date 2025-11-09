# La Mesa Abierta - Implementation Guide

## Project Overview

La Mesa Abierta is a monthly anonymous dinner matching system for Casa Community Church. Participants sign up as hosts or guests, and the system randomly assigns them to dinners with mystery guests and hosts.

### Key Features

- ✅ Anonymous matching system
- ✅ Dietary restrictions management
- ✅ WhatsApp & Email notifications
- ✅ Food assignment distribution
- ✅ Post-dinner photo sharing
- ✅ Testimonial collection
- ✅ Admin dashboard for management
- ✅ Emergency reassignment tools

---

## Phase 1: Database Setup ✅ COMPLETED

### What's Been Created

#### 1. Migration Files
- `/supabase/migrations/20241109_mesa_abierta_schema.sql` - Main database schema
- `/supabase/migrations/20241109_storage_policies.sql` - Storage bucket policies

#### 2. Database Tables (11 tables)
- `mesa_abierta_admin_roles` - Admin user permissions
- `mesa_abierta_months` - Monthly event tracking
- `mesa_abierta_participants` - User sign-ups
- `mesa_abierta_dietary_restrictions` - Dietary preferences/allergies
- `mesa_abierta_matches` - Dinner group assignments
- `mesa_abierta_assignments` - Individual food assignments
- `mesa_abierta_email_logs` - Email tracking
- `mesa_abierta_whatsapp_messages` - WhatsApp message tracking
- `mesa_abierta_photos` - Post-dinner photos
- `mesa_abierta_testimonials` - User feedback

#### 3. Enums (10 custom types)
All necessary enums for status tracking, roles, and categories

#### 4. Row Level Security (RLS)
Comprehensive security policies ensuring:
- Users only see their own data
- Hosts/Guests can see their dinner group info
- Admins have full access
- Public can view approved photos/testimonials

#### 5. TypeScript Types
Updated `/src/integrations/supabase/types.ts` with all new table types

---

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended for beginners)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy the contents of `/supabase/migrations/20241109_mesa_abierta_schema.sql`
5. Paste into the SQL editor
6. Click **Run** (bottom right)
7. Verify success (should see "Success. No rows returned")
8. Repeat for `/supabase/migrations/20241109_storage_policies.sql`

### Option 2: Supabase CLI (Recommended for developers)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push

# Or apply specific migration
supabase db execute --file supabase/migrations/20241109_mesa_abierta_schema.sql
supabase db execute --file supabase/migrations/20241109_storage_policies.sql
```

### Option 3: Direct psql Connection

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR_PASSWORD]@[YOUR_PROJECT_REF].supabase.co:5432/postgres"

# Run the migration
\i /path/to/supabase/migrations/20241109_mesa_abierta_schema.sql
\i /path/to/supabase/migrations/20241109_storage_policies.sql
```

---

## Storage Bucket Setup

### Manual Setup (Required)

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Settings:
   - Name: `mesa-abierta-photos`
   - Public: `false`
   - File size limit: `5 MB`
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`
4. Click **Save**
5. The storage policies will be applied automatically from the migration

**OR** run the storage policies SQL file after creating the bucket.

Full instructions: `/supabase/STORAGE_SETUP.md`

---

## Verification

After running migrations, verify in Supabase dashboard:

### Tables Created
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'mesa_abierta%'
ORDER BY table_name;
```

Should return 11 tables.

### Enums Created
```sql
SELECT typname
FROM pg_type
WHERE typname LIKE 'mesa_abierta%'
ORDER BY typname;
```

Should return 10 enums.

### RLS Policies
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'mesa_abierta%'
ORDER BY tablename, policyname;
```

Should return 30+ policies.

### Sample Data
The migration includes a sample month for December 2024. Verify:

```sql
SELECT * FROM mesa_abierta_months;
```

---

## Next Steps

### Phase 2: Component Development (IN PROGRESS)

Now building the React components:

1. **MesaAbiertaSection** - Landing page section
2. **Sign-up Forms** - Host & Guest registration
3. **Dietary Restrictions Form** - Food preferences/allergies
4. **WhatsApp Opt-in** - Communication preferences
5. **User Dashboard** - View assignments

### Phase 3: Backend Functions (TODO)

1. Email integration (SendGrid)
2. WhatsApp integration (Twilio)
3. Matching algorithm
4. Notification scheduling

### Phase 4: Admin Tools (TODO)

1. Admin dashboard
2. Participant management
3. Email triggering
4. Photo/testimonial moderation

---

## Making Your First Admin

After running migrations, you'll need to create at least one admin user:

```sql
-- Replace with your actual user ID
-- Get your user ID from the Supabase Auth dashboard
INSERT INTO mesa_abierta_admin_roles (user_id, role)
VALUES (
  'YOUR_USER_ID_HERE',
  'super_admin'
);
```

To get your user ID:
1. Go to **Authentication** > **Users** in Supabase dashboard
2. Find your user
3. Copy the UUID from the "ID" column

---

## Environment Variables Needed

For full functionality, you'll need to set up:

### Supabase Dashboard Secrets

Navigate to **Settings** > **Vault** and add:

```
SENDGRID_API_KEY=your_sendgrid_key_here
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

These will be used by Edge Functions (coming in Phase 3).

---

## Database Schema Diagram

```
mesa_abierta_months (Monthly Events)
  ↓
mesa_abierta_participants (Sign-ups)
  ↓
  ├─ mesa_abierta_dietary_restrictions
  ├─ mesa_abierta_matches (Dinner Groups)
  │   ↓
  │   └─ mesa_abierta_assignments (Individual Assignments)
  ├─ mesa_abierta_photos
  └─ mesa_abierta_testimonials

mesa_abierta_admin_roles (Permissions)

Logging Tables:
- mesa_abierta_email_logs
- mesa_abierta_whatsapp_messages
```

---

## Troubleshooting

### Migration Fails - "Type already exists"

If re-running migrations:

```sql
-- Drop all Mesa Abierta types
DROP TYPE IF EXISTS mesa_abierta_month_status CASCADE;
DROP TYPE IF EXISTS mesa_abierta_role CASCADE;
-- ... (drop all enums)

-- Then re-run the migration
```

### RLS Policies Block Access

Test with RLS disabled (temporarily):

```sql
ALTER TABLE mesa_abierta_participants DISABLE ROW LEVEL SECURITY;
-- Test your queries
ALTER TABLE mesa_abierta_participants ENABLE ROW LEVEL SECURITY;
```

### Check if User is Admin

```sql
SELECT is_mesa_admin('YOUR_USER_ID');
```

Should return `true` if you're an admin.

---

## Development Workflow

### Testing Locally

1. Start Supabase locally:
```bash
supabase start
```

2. Apply migrations:
```bash
supabase db reset
```

3. Create test admin:
```sql
-- In local Supabase Studio
INSERT INTO mesa_abierta_admin_roles (user_id, role)
VALUES (auth.uid(), 'super_admin');
```

### Resetting Data

```sql
-- Delete all participants (cascades to related tables)
TRUNCATE mesa_abierta_participants CASCADE;

-- Or delete specific month
DELETE FROM mesa_abierta_months WHERE month_date = '2024-12-01';
```

---

## Support

For issues or questions:
- Check `/supabase/STORAGE_SETUP.md` for storage configuration
- Review migration files for table structure
- Check Supabase logs for errors

---

## Progress Tracker

- [x] Phase 1: Database Schema
  - [x] Tables created
  - [x] RLS policies
  - [x] Storage setup
  - [x] TypeScript types
- [ ] Phase 2: Core Components
  - [ ] Landing section
  - [ ] Sign-up forms
  - [ ] User dashboard
- [ ] Phase 3: Backend Functions
  - [ ] Email integration
  - [ ] WhatsApp integration
  - [ ] Matching algorithm
- [ ] Phase 4: Admin Tools
- [ ] Phase 5: Post-Dinner Features
- [ ] Phase 6: Testing & Launch

---

**Last Updated:** November 9, 2024
**Status:** Phase 1 Complete ✅, Phase 2 In Progress 🚧
