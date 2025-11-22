# WhatsApp Integration Setup Guide

This guide will help you set up Twilio WhatsApp integration for La Mesa Abierta notifications.

## Prerequisites

- Twilio account (free trial available)
- Access to Supabase project dashboard
- Admin access to configure secrets

---

## Step 1: Create Twilio Account

1. Go to [Twilio.com](https://www.twilio.com/try-twilio)
2. Sign up for a free account
3. Verify your phone number
4. Complete the onboarding wizard

**Free Trial Limits:**
- $15 USD trial credit
- Can send messages to verified numbers only
- WhatsApp sandbox available for testing

---

## Step 2: Get Your Twilio Credentials

### Account SID and Auth Token

1. Go to [Twilio Console](https://console.twilio.com/)
2. On the dashboard, find:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal)
3. Copy both values - you'll need them later

### WhatsApp Sandbox Number

Twilio provides a sandbox WhatsApp number for testing:

1. In Twilio Console, navigate to **Messaging** > **Try it out** > **Send a WhatsApp message**
2. You'll see your sandbox number (format: `whatsapp:+14155238886`)
3. To test, send the join code from your phone to this number
4. Example: Send `join <your-code>` to `+1 415 523 8886` via WhatsApp

**Important:** For production use, you'll need to apply for a Twilio WhatsApp Business Profile (see Step 6).

---

## Step 3: Configure Supabase Secrets

You need to add three environment variables to your Supabase project:

### Using Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Edge Functions**
3. Scroll to **Secrets**
4. Add the following secrets:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Using Supabase CLI:

```bash
# Navigate to your project
cd /Users/brentcurtis76/Documents/CASA/casa-web

# Set Twilio secrets
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here
supabase secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**Security Note:** Never commit these credentials to Git. They should only exist in Supabase secrets.

---

## Step 4: Verify Edge Function Deployment

The WhatsApp Edge Function should already be deployed. Verify:

```bash
cd /Users/brentcurtis76/Documents/CASA/casa-web
supabase functions list
```

You should see `send-mesa-whatsapp` in the list.

If not deployed, run:

```bash
supabase functions deploy send-mesa-whatsapp
```

---

## Step 5: Test WhatsApp Integration

### Testing with Sandbox (Free)

1. **Join the sandbox** from your phone:
   - Send `join <your-code>` to `+1 415 523 8886` via WhatsApp
   - You'll receive a confirmation message

2. **Update a test participant** with your phone number:
   ```sql
   UPDATE mesa_abierta_participants
   SET
     phone_number = '+56912345678',  -- Your phone number with country code
     whatsapp_enabled = true
   WHERE user_id = 'YOUR_USER_ID';
   ```

3. **Run the matching algorithm** in the admin dashboard

4. **Send WhatsApp notifications** by clicking the "Enviar Mensajes de WhatsApp" button

5. **Check your phone** - you should receive a WhatsApp message!

### Expected Message Format

**For Hosts:**
```
🏠 LA MESA ABIERTA
¡Hola [Name]!

Gracias por ofrecerte como anfitrión. Te hemos asignado 3 invitados para tu cena.

📅 Fecha: [date]
⏰ Hora: [time]

👥 Tus invitados:
• Guest 1 - Plato Principal
• Guest 2 (+1: Juan) - Ensalada
• Guest 3 - Bebidas

📋 Próximos pasos:
• Los invitados recibirán tu dirección y teléfono
• Prepara tu hogar para recibir a tus invitados
• Revisa las restricciones alimentarias indicadas

¡Que disfrutes de una hermosa velada llena de comunidad y conexión!

_CASA - Comunidad de Amor, Servicio y Adoración_
```

**For Guests:**
```
🍽️ LA MESA ABIERTA
¡Hola [Name]!

Te hemos asignado a una cena con [Host Name].

📅 Fecha: [date]
⏰ Hora: [time]
📍 Dirección: [address]
📞 Contacto: [phone]

🍽️ Tu contribución: Plato Principal

📋 Próximos pasos:
• Confirma tu asistencia con el anfitrión
• Prepara tu contribución para la cena
• ¡Ven con una actitud abierta para conocer gente nueva!

¡Esperamos que disfrutes de una hermosa velada llena de comunidad y conexión!

_CASA - Comunidad de Amor, Servicio y Adoración_
```

---

## Step 6: Production Setup (WhatsApp Business)

For production use with real participants, you need to apply for WhatsApp Business API access:

### Requirements:
- Registered business
- Business verification with Meta/Facebook
- WhatsApp Business Profile approval
- Domain verification

### Process:

1. **Apply for WhatsApp Business API** in Twilio Console:
   - Navigate to **Messaging** > **WhatsApp** > **Senders**
   - Click **Request access**

2. **Provide business information:**
   - Legal business name
   - Business address
   - Business website
   - Business description

3. **Verify your business** with Meta:
   - May require business documents
   - Tax ID or registration documents
   - Can take 1-2 weeks for approval

4. **Create message templates:**
   - WhatsApp requires pre-approved templates for certain messages
   - Template approval can take 24-48 hours
   - See Twilio documentation for template creation

5. **Update phone number:**
   - Once approved, you'll get a dedicated WhatsApp number
   - Update the `TWILIO_WHATSAPP_NUMBER` secret with your new number

---

## Step 7: Phone Number Formatting

The Edge Function automatically formats phone numbers for WhatsApp:

- Adds `whatsapp:` prefix
- Adds `+` if missing
- Defaults to Chile country code (`+56`) if no country code provided

### Examples:
```
User input: "912345678"
Formatted:  "whatsapp:+56912345678"

User input: "+56912345678"
Formatted:  "whatsapp:+56912345678"

User input: "+14155551234"
Formatted:  "whatsapp:+14155551234"
```

**For international participants:** Make sure they include their country code when signing up.

---

## Monitoring & Logs

### View WhatsApp Message Logs

Check the database table for sent messages:

```sql
SELECT
  m.created_at,
  m.message_type,
  m.recipient_phone,
  m.status,
  m.twilio_message_sid
FROM mesa_abierta_whatsapp_messages m
ORDER BY m.created_at DESC;
```

### View Twilio Logs

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Monitor** > **Logs** > **Messaging**
3. Filter by WhatsApp messages
4. Check delivery status, errors, and timestamps

### Edge Function Logs

Check Supabase Edge Function logs:

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on `send-mesa-whatsapp`
4. View **Logs** tab for execution details

---

## Rate Limits

### Twilio WhatsApp Limits:

**Sandbox (Free Trial):**
- Limited to verified numbers only
- No strict rate limit but throttled for abuse

**Production:**
- Initial limit: 1,000 messages per 24 hours
- Can request increase based on usage
- Tier-based pricing

### Function Rate Limiting:

The Edge Function includes rate limiting:
- 500ms delay between each message (2 messages/second)
- Conservative to stay within Twilio limits
- Prevents API throttling

---

## Troubleshooting

### Error: "Twilio credentials not configured"

**Solution:** Make sure you've set the Supabase secrets (Step 3)

```bash
supabase secrets list
```

Should show:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_NUMBER

---

### Error: "Phone number not verified"

**Solution (Sandbox):** Make sure the recipient has joined your sandbox by sending the join code.

**Solution (Production):** This shouldn't happen in production. Check that you're using an approved WhatsApp number.

---

### No messages received

**Check:**
1. Phone number format includes country code
2. `whatsapp_enabled = true` in database
3. Recipient joined sandbox (if testing)
4. Check Twilio logs for delivery status

**Debug query:**
```sql
SELECT
  p.phone_number,
  p.whatsapp_enabled,
  m.status,
  m.twilio_message_sid
FROM mesa_abierta_participants p
LEFT JOIN mesa_abierta_whatsapp_messages m ON m.participant_id = p.id
WHERE p.id = 'PARTICIPANT_ID';
```

---

### Database function error

**Error:** `function get_users_by_ids not found`

**Solution:** Run the migration:

```bash
cd /Users/brentcurtis76/Documents/CASA/casa-web
supabase db push
```

Or manually via SQL editor:
```sql
-- Run the contents of:
-- supabase/migrations/20250111_get_users_by_ids_function.sql
```

---

## Costs

### Twilio Pricing (as of 2024):

**WhatsApp Business API:**
- Inbound messages: Free
- Outbound messages: Varies by country
  - Chile: ~$0.019 per message
  - US: ~$0.0042 per message
- User-initiated conversations: Free for 24 hours

**Free Trial:**
- $15 USD credit
- Enough for ~750-800 messages

### Recommendations:

For Casa Community Church:
- Start with sandbox for testing (free)
- Estimate monthly usage: ~20-30 participants × 4 messages = 80-120 messages/month
- Monthly cost: ~$1.50-$2.50 USD
- Apply for production when ready to launch

---

## Best Practices

1. **Test thoroughly in sandbox** before going to production
2. **Only send to opted-in users** (respects `whatsapp_enabled` flag)
3. **Keep messages concise** - WhatsApp favors brief, clear communication
4. **Monitor delivery rates** - Check Twilio logs regularly
5. **Have email fallback** - Not all users will opt-in to WhatsApp
6. **Respect opt-outs** - Users can disable WhatsApp anytime in their profile

---

## Support & Resources

- **Twilio WhatsApp Docs:** https://www.twilio.com/docs/whatsapp
- **Twilio Console:** https://console.twilio.com/
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **La Mesa Abierta Docs:** See `LA_MESA_ABIERTA_README.md`

---

**Setup Complete!** 🎉

You're now ready to send WhatsApp notifications to La Mesa Abierta participants.
