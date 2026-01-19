# Send Mesa Notifications Edge Function

Sends email notifications to hosts and guests after La Mesa Abierta matching is complete.

## Features

- **Host Emails**: Receive list of guests, dietary restrictions, and food assignments
- **Guest Emails**: Receive host contact info, address, dinner details, and their food assignment
- **Email Logging**: All sent emails are logged in `mesa_abierta_email_logs` table
- **Beautiful HTML Templates**: Professional email design with CASA branding
- **Powered by Resend**: 3,000 emails/month FREE

## Setup

### 1. Get Resend API Key

1. Sign up for Resend: https://resend.com/
2. Create an API key (no credit card required for free tier)
3. Free tier includes: 3,000 emails/month (100/day)

### 2. Configure Environment Variables

Set these secrets in your Supabase project:

```bash
# Required: Your Resend API key
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx

# Optional: Custom sender email (requires domain verification in Resend)
# If not set, uses onboarding@resend.dev (works out of the box)
supabase secrets set FROM_EMAIL=noreply@casa.cl

# Optional: Sender name
supabase secrets set FROM_NAME="CASA - La Mesa Abierta"
```

**Note**: You can use `onboarding@resend.dev` for testing without domain verification!

### 3. Deploy the Function

```bash
cd ~/Documents/CASA/casa-web
supabase functions deploy send-mesa-notifications
```

## Usage

### From Admin Panel

After running the matching algorithm, click the "Enviar Notificaciones" button.

### Via API

```typescript
const { data, error } = await supabase.functions.invoke('send-mesa-notifications', {
  body: { monthId: 'your-month-uuid' }
});
```

## Request Format

```json
{
  "monthId": "986b9d3b-df9b-43d7-944c-ef50e7ad726e"
}
```

## Response Format

### Success

```json
{
  "success": true,
  "message": "Notifications sent successfully",
  "results": {
    "emailsSent": 12,
    "emailsFailed": 0,
    "totalMatches": 2
  }
}
```

### Error

```json
{
  "success": false,
  "error": "Month must be in 'matched' status to send notifications"
}
```

## Email Templates

### Host Email
- Subject: "Tu asignación como Anfitrión - La Mesa Abierta"
- Includes: Guest list, food assignments, dinner date/time

### Guest Email
- Subject: "Tu asignación como Invitado - La Mesa Abierta"
- Includes: Host contact info, address, food assignment, dinner date/time

## Testing

### Quick Test with Resend's Test Email

```bash
# Test the function with a mock month
curl -X POST https://your-project.supabase.co/functions/v1/send-mesa-notifications \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"monthId":"986b9d3b-df9b-43d7-944c-ef50e7ad726e"}'
```

## Email Logs

All emails are logged in the `mesa_abierta_email_logs` table with:
- Recipient email
- Resend message ID
- Timestamp
- Status (sent/failed)

## Troubleshooting

**"Resend API key not configured"**
- Make sure you've set the `RESEND_API_KEY` secret

**"Month must be in 'matched' status"**
- Notifications can only be sent after matching is complete
- Check the month status in the admin panel

**Emails not arriving**
- Check Resend dashboard: https://resend.com/emails
- Verify sender email if using custom domain
- Check spam folder

**Rate limit exceeded**
- Free tier: 100 emails/day, 3,000/month
- Upgrade to paid plan if needed

## Why Resend?

- ✅ **Free tier**: 3,000 emails/month (no credit card)
- ✅ **Simple API**: Clean, modern REST API
- ✅ **Test email**: Use `onboarding@resend.dev` without verification
- ✅ **Great dashboard**: Easy to monitor email delivery
- ✅ **Developer-friendly**: Built for developers

## Future Enhancements

- [ ] Add retry logic for failed emails
- [ ] Support custom email templates
- [ ] Add unsubscribe links
- [ ] Include calendar invite (.ics file)
- [ ] Add reminder emails (7 days before, 1 day before)
