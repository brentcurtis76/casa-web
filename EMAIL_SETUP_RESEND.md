# 📧 Email Integration Setup - Resend (FREE)

Quick setup guide for La Mesa Abierta email notifications using Resend.

---

## ✅ Why Resend?

- **FREE**: 3,000 emails/month (100/day) - No credit card required
- **Easy**: Works immediately with test email `onboarding@resend.dev`
- **Simple**: Modern API, no complicated setup
- **Reliable**: Built by developers for developers

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Sign Up for Resend

1. Go to https://resend.com/
2. Click "Start Building for Free"
3. Sign up with GitHub or email
4. **No credit card required!**

### Step 2: Create API Key

1. After logging in, go to **API Keys**
2. Click **Create API Key**
3. Name: `CASA La Mesa Abierta`
4. Permission: **Full Access** (or Sending access)
5. Click **Add**
6. **Copy the API key** (starts with `re_`)

### Step 3: Configure Supabase

```bash
cd ~/Documents/CASA/casa-web

# Set your Resend API key
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Use custom email (requires domain verification)
# Leave blank to use onboarding@resend.dev for testing
supabase secrets set FROM_EMAIL=onboarding@resend.dev
supabase secrets set FROM_NAME="CASA - La Mesa Abierta"
```

### Step 4: Deploy the Function

```bash
supabase functions deploy send-mesa-notifications
```

You should see:
```
Deploying function send-mesa-notifications...
Deployed function send-mesa-notifications successfully!
```

### Step 5: Test It!

1. Refresh admin panel: http://localhost:8080/mesa-abierta/admin
2. Make sure month status is "matched" (run matching if needed)
3. Scroll down to see "Enviar Notificaciones" card
4. Click **"Enviar Notificaciones por Email"**
5. Check toast notification for success/failure

---

## 📧 Email Preview

### What Hosts Receive:
```
Subject: Tu asignación como Anfitrión - La Mesa Abierta
From: CASA - La Mesa Abierta <onboarding@resend.dev>

¡Hola María!

Gracias por ofrecerte como anfitrión para La Mesa Abierta.
Te hemos asignado 5 invitados para tu cena.

Fecha: viernes, 13 de diciembre de 2024
Hora: 19:00

Tus invitados:
- Juan Pérez - Plato Principal
- Ana González (+1: Carlos) - Ensalada
- Luis Martínez - Bebidas
...
```

### What Guests Receive:
```
Subject: Tu asignación como Invitado - La Mesa Abierta
From: CASA - La Mesa Abierta <onboarding@resend.dev>

¡Hola Juan!

Te hemos asignado a una cena con María Rodríguez.

Detalles de la Cena:
Fecha: viernes, 13 de diciembre de 2024
Hora: 19:00
Dirección: Av. Vicente Pérez Rosales 1765
Contacto: +56 9 4162 3577
Tu contribución: Plato Principal
```

---

## 🎨 Using Your Own Domain (Optional)

Want emails to come from `noreply@casa.cl` instead of `onboarding@resend.dev`?

### Verify Your Domain in Resend

1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter: `casa.cl`
4. Add the DNS records Resend provides
5. Wait for verification (usually a few hours)
6. Update Supabase secret:

```bash
supabase secrets set FROM_EMAIL=noreply@casa.cl
supabase functions deploy send-mesa-notifications
```

---

## 🧪 Testing

### Test with Mock Data

Your mock test data already has 12 participants. Just:

1. Make sure month is in "matched" status
2. Click "Enviar Notificaciones"
3. Check Resend dashboard: https://resend.com/emails
4. View sent emails and delivery status

### Check Delivery

1. Go to Resend dashboard
2. Navigate to **Emails**
3. See all sent emails with:
   - ✅ Delivered
   - ⏱️ Pending
   - ❌ Failed

---

## 📊 Monitoring

### In Supabase (Email Logs Table)

```sql
SELECT
  recipient_email,
  email_type,
  status,
  sent_at
FROM mesa_abierta_email_logs
ORDER BY sent_at DESC;
```

### In Resend Dashboard

- View delivery status
- See open rates (if tracking enabled)
- Debug bounces and errors
- View email content

---

## ⚠️ Troubleshooting

### "Resend API key not configured"

```bash
# Check if secret exists
supabase secrets list

# Set it again
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
```

### Emails not arriving

1. **Check Resend dashboard** - Did it send?
2. **Check spam folder** - Might be filtered
3. **Verify email addresses** - Mock data uses test emails
4. **Check rate limits** - 100/day on free tier

### Button not showing

- Month must be in "matched" status
- Run matching algorithm first
- Refresh page after matching completes

---

## 💰 Pricing (If You Outgrow Free Tier)

**Free Tier**:
- 3,000 emails/month
- 100 emails/day
- Perfect for testing and small groups

**Pro Plan** ($20/month):
- 50,000 emails/month
- Unlimited emails/day
- Custom domains
- Priority support

For La Mesa Abierta with ~12 participants/month:
- Host email: 2 emails
- Guest emails: 10 emails
- **Total per event: 12 emails**
- Free tier supports **250 events/month**!

---

## ✅ Checklist

- [ ] Created Resend account (free)
- [ ] Generated API key
- [ ] Set `RESEND_API_KEY` in Supabase
- [ ] Deployed Edge Function
- [ ] Tested email sending from admin panel
- [ ] Verified emails arrived in Resend dashboard

---

## 🎯 Next Steps

Once email is working:

1. **Test with real email** - Change mock user emails to real ones
2. **Customize templates** - Edit HTML in `index.ts`
3. **Add your domain** - Use `noreply@casa.cl` (optional)
4. **Schedule reminders** - Build reminder emails (future)

---

**Status**: ✅ Email integration ready to deploy!

**Time to setup**: ~5 minutes

**Cost**: $0 (free forever for your use case)
