# 📧 Email Integration Setup Guide

Complete guide to set up SendGrid email notifications for La Mesa Abierta.

---

## ✅ What Was Built

- **Edge Function**: `send-mesa-notifications` - Sends assignment emails to all participants
- **Email Templates**: Beautiful HTML emails for hosts and guests with CASA branding
- **Admin Panel Integration**: "Enviar Notificaciones" button in Matching tab
- **Email Logging**: All sent emails are tracked in `mesa_abierta_email_logs` table

---

## 🚀 Setup Steps

### Step 1: Create SendGrid Account

1. Go to https://sendgrid.com/
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

### Step 2: Create API Key

1. Log in to SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name: `CASA La Mesa Abierta`
5. Permissions: **Full Access** (or at least **Mail Send**)
6. Copy the API key (you'll only see it once!)

### Step 3: Verify Sender Email

**Important**: SendGrid requires you to verify the email address you'll send from.

1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in the form:
   - **From Name**: CASA - La Mesa Abierta
   - **From Email**: sanandres@iach.cl (or noreply@casa.cl if you have that domain)
   - Address, City, etc.
4. Check your email for verification link
5. Click the link to verify

### Step 4: Configure Supabase Secrets

Set these environment variables in your Supabase project:

```bash
cd ~/Documents/CASA/casa-web

# Set SendGrid API key
supabase secrets set SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Set sender email (must be verified in SendGrid)
supabase secrets set SENDGRID_FROM_EMAIL=sanandres@iach.cl

# Set sender name
supabase secrets set SENDGRID_FROM_NAME="CASA - La Mesa Abierta"
```

### Step 5: Deploy the Edge Function

```bash
cd ~/Documents/CASA/casa-web

# Deploy the function
supabase functions deploy send-mesa-notifications

# You should see:
# Deploying function send-mesa-notifications (script size: XXX KB)
# Deployed function send-mesa-notifications with version XXX
```

### Step 6: Test the Function

1. Make sure you have completed matching for a month
2. Open admin panel: http://localhost:8080/mesa-abierta/admin
3. Select the matched month
4. Go to "Matching" tab
5. Scroll down - you should see "Enviar Notificaciones" card
6. Click "Enviar Notificaciones por Email"
7. Wait for confirmation toast

---

## 📧 Email Templates

### Host Email
**Subject**: Tu asignación como Anfitrión - La Mesa Abierta

**Content**:
- Welcome message with host name
- Dinner date and time
- Complete guest list with:
  - Guest names
  - Plus-ones (if any)
  - Food assignments
- Next steps instructions

**Example**:
```
¡Hola María!

Gracias por ofrecerte como anfitrión para La Mesa Abierta.
Te hemos asignado 5 invitados para tu cena.

Fecha: viernes, 13 de diciembre de 2024
Hora: 19:00:00

Tus invitados:
- Juan Pérez - Plato Principal
- Ana González (+1: Carlos) - Ensalada
- Luis Martínez - Bebidas
- Carmen López - Postre
- Roberto Silva

Próximos pasos:
- Los invitados recibirán tu dirección y teléfono
- Prepara tu hogar para recibir a tus invitados
- Revisa las restricciones alimentarias indicadas
```

### Guest Email
**Subject**: Tu asignación como Invitado - La Mesa Abierta

**Content**:
- Welcome message with guest name
- Host name
- Host address and phone
- Dinner date and time
- Food assignment (if applicable)
- Next steps instructions

**Example**:
```
¡Hola Juan!

Te hemos asignado a una cena con María Rodríguez.

Detalles de la Cena:
Fecha: viernes, 13 de diciembre de 2024
Hora: 19:00:00
Dirección: Av. Vicente Pérez Rosales 1765, La Reina
Contacto del Anfitrión: +56 9 4162 3577
Tu contribución: Plato Principal

Próximos pasos:
- Confirma tu asistencia con el anfitrión
- Prepara tu contribución para la cena
- ¡Ven con una actitud abierta para conocer gente nueva!
```

---

## 🧪 Testing

### Test with Mock Data

```sql
-- 1. Reset month to 'matched' status
UPDATE mesa_abierta_months
SET status = 'matched'
WHERE month_date = '2024-12-01';

-- 2. Verify participants have emails
SELECT
  p.id,
  u.email,
  p.role_preference,
  p.assigned_role
FROM mesa_abierta_participants p
JOIN auth.users u ON u.id = p.user_id
WHERE p.month_id = (
  SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01'
);
```

### Test API Directly (Optional)

```bash
# Get your month ID
MONTH_ID="986b9d3b-df9b-43d7-944c-ef50e7ad726e"

# Get your anon key from Supabase dashboard
ANON_KEY="your-anon-key"

# Test the function
curl -X POST https://mulsqxfhxxdsadxsljss.supabase.co/functions/v1/send-mesa-notifications \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"monthId\":\"$MONTH_ID\"}"
```

---

## 📊 Monitoring

### Check Email Logs

```sql
-- View all sent emails
SELECT
  el.recipient_email,
  el.email_type,
  el.status,
  el.sent_at,
  el.sendgrid_message_id
FROM mesa_abierta_email_logs el
ORDER BY el.sent_at DESC
LIMIT 20;
```

### Check SendGrid Dashboard

1. Go to https://app.sendgrid.com/
2. Navigate to **Activity** → **Email Activity**
3. See delivery status, opens, clicks, bounces

---

## ⚠️ Troubleshooting

### Error: "SendGrid API key not configured"

**Solution**: Make sure you've set the secrets correctly:
```bash
supabase secrets list  # Check if secrets exist
supabase secrets set SENDGRID_API_KEY=your-key  # Set again if needed
```

### Error: "Month must be in 'matched' status"

**Solution**: You can only send notifications after running matching. Check month status:
```sql
SELECT status FROM mesa_abierta_months WHERE month_date = '2024-12-01';
```

### Emails not arriving

**Possible causes**:
1. **Sender not verified** - Verify sender email in SendGrid
2. **Spam folder** - Check recipient spam folder
3. **Invalid email addresses** - Check mock users have valid emails
4. **SendGrid quota** - Free tier: 100 emails/day

**Check SendGrid logs**:
1. Go to SendGrid dashboard
2. **Activity** → **Email Activity**
3. Search for recipient email
4. View delivery status and error messages

### Error: "Failed to send email"

**Check the error details** in Supabase Edge Function logs:
1. Go to Supabase Dashboard
2. **Edge Functions** → `send-mesa-notifications`
3. Click **Logs**
4. Look for detailed error messages

---

## 🎨 Customizing Email Templates

### Edit Host Email

File: `supabase/functions/send-mesa-notifications/index.ts`

Find the `sendHostEmail` function (around line 120) and modify the HTML template.

### Edit Guest Email

Find the `sendGuestEmail` function (around line 175) and modify the HTML template.

### After editing:

```bash
# Redeploy the function
supabase functions deploy send-mesa-notifications
```

---

## 🔒 Security Notes

1. **API Keys**: Never commit `SENDGRID_API_KEY` to git - use Supabase secrets
2. **Email Addresses**: Validate all email addresses before sending
3. **Rate Limiting**: SendGrid free tier has 100 emails/day limit
4. **Unsubscribe**: Consider adding unsubscribe links (future enhancement)

---

## 📈 Future Enhancements

- [ ] Add reminder emails (7 days before, 1 day before)
- [ ] Include calendar invite (.ics file)
- [ ] Add unsubscribe functionality
- [ ] Support custom email templates per event
- [ ] Add retry logic for failed emails
- [ ] Send WhatsApp notifications (Twilio integration)

---

## ✅ Checklist

- [ ] Created SendGrid account
- [ ] Generated API key
- [ ] Verified sender email
- [ ] Set Supabase secrets
- [ ] Deployed Edge Function
- [ ] Tested email sending
- [ ] Checked email delivery in SendGrid dashboard
- [ ] Verified emails look good in inbox

---

**Status**: Email integration is ready for testing!

**Next Step**: Get a SendGrid API key and deploy the function to test email sending.
