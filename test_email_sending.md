# 🧪 Test Email Sending

Quick guide to test the email notifications.

## Step 1: Prepare the Month

Make sure the month is in "matched" status:

```sql
-- Check current status
SELECT status FROM mesa_abierta_months WHERE month_date = '2024-12-01';

-- If status is 'open', run matching first in admin panel
-- If status is 'matched', you're ready!
```

## Step 2: Test in Admin Panel

1. **Refresh** the admin panel: http://localhost:8080/mesa-abierta/admin
2. **Select** "diciembre de 2024" month
3. **Go to** "Matching" tab
4. **Scroll down** - you should see "Enviar Notificaciones" section
5. **Click** "Enviar Notificaciones por Email" button
6. **Wait** for the success toast

## Step 3: Check Results

### In Admin Panel
You should see a toast like:
```
¡Éxito!
Notificaciones enviadas: 12 emails exitosos, 0 fallidos
```

### In Database
Check the email logs:

```sql
SELECT
  recipient_email,
  email_type,
  status,
  sent_at
FROM mesa_abierta_email_logs
ORDER BY sent_at DESC
LIMIT 10;
```

### In Resend Dashboard
1. Go to https://resend.com/emails
2. Log in with your account
3. See all sent emails and delivery status

## 📬 Test Emails

The mock test users have these emails (from the test data we created):

Check what emails will receive notifications:

```sql
SELECT
  u.email,
  p.role_preference,
  p.assigned_role
FROM mesa_abierta_participants p
JOIN auth.users u ON u.id = p.user_id
WHERE p.month_id = (
  SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01'
)
ORDER BY p.role_preference;
```

## 🎯 What to Expect

### Host Emails
- Subject: "Tu asignación como Anfitrión - La Mesa Abierta"
- Contains: Guest list, dinner date/time, food assignments

### Guest Emails
- Subject: "Tu asignación como Invitado - La Mesa Abierta"
- Contains: Host contact, address, dinner details, food assignment

## ⚠️ Troubleshooting

### Error: "Resend API key not configured"
```bash
# Set the API key again
supabase secrets set RESEND_API_KEY=re_5hB9PthG_5uGjwwhiaAVPZ1MoHSLTK2uv
```

### Error: "Month must be in 'matched' status"
```sql
-- Make sure matching was run
UPDATE mesa_abierta_months
SET status = 'matched'
WHERE month_date = '2024-12-01';
```

### Button not showing
- Refresh the page
- Make sure month status is "matched"
- Check browser console for errors

### Emails not arriving
- Check Resend dashboard: https://resend.com/emails
- Mock user emails might not be real - use your own email for testing
- Check spam folder

## 🔄 Test with Your Own Email

To test with a real email address:

```sql
-- Update one of the test users to use your email
UPDATE auth.users
SET email = 'your-email@gmail.com'
WHERE id IN (
  SELECT user_id FROM mesa_abierta_participants
  WHERE month_id = (SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01')
  LIMIT 1
);

-- Then send notifications again
```

## ✅ Success Criteria

- [ ] No errors in admin panel
- [ ] Toast shows "X emails exitosos, 0 fallidos"
- [ ] Email logs show status='sent'
- [ ] Emails visible in Resend dashboard
- [ ] Email content looks good (HTML formatting)

## 🎨 Customize Sender Email (Optional)

To use a custom domain email (e.g., sanandres@iach.cl):

1. Go to Resend Dashboard → **Domains**
2. Add your domain (iach.cl)
3. Add DNS records (they'll provide MX, TXT records)
4. Update the secret:

```bash
supabase secrets set FROM_EMAIL=sanandres@iach.cl
supabase functions deploy send-mesa-notifications
```

For now, `onboarding@resend.dev` works fine for testing!
