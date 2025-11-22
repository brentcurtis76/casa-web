# La Mesa Abierta - Launch Guide & Admin Manual

## 📋 Pre-Launch Checklist

### 1. System Configuration
- [x] Email notifications configured (Resend API)
- [x] WhatsApp integration ready (Twilio sandbox)
- [x] Matching algorithm tested
- [x] Email templates finalized (black/white with logo)
- [x] Duplicate signup prevention enabled

### 2. Database Setup
- [ ] Create first month in admin dashboard
- [ ] Set registration deadline (recommend: Monday before dinner, 11:59 PM)
- [ ] Set dinner date (recommend: Friday evening)
- [ ] Confirm month status is "open"

### 3. Communication Prep
- [ ] Announce La Mesa Abierta to congregation
- [ ] Share website link: casasandiago.cl/#mesa-abierta
- [ ] Explain the concept: anonymous dinner matching
- [ ] Encourage both hosts and guests to sign up

---

## 🎯 Monthly Workflow

### Week 1-2: Registration Period

**Admin Tasks:**
1. **Create New Month** (if not already created)
   - Go to Admin Dashboard → La Mesa Abierta
   - Click "Crear Nuevo Mes"
   - Set dinner date (typically last Friday of month)
   - Set registration deadline (Monday before dinner, 11:59 PM)
   - Set status: "open"

2. **Monitor Signups**
   - Check participant count daily
   - Monitor host/guest ratio (ideal: 1 host per 3-5 guests)
   - If too many guests, recruit more hosts
   - If too many hosts, recruit more guests

**Key Metrics to Watch:**
- Total participants
- Number of hosts
- Number of guests (including plus-ones)
- Ideal ratio: 1 host : 3-5 guests

---

### Registration Closes (Monday before dinner)

**Deadline:**
- Automatic cutoff at registration deadline
- No more signups accepted after this time

---

### Monday Morning: Matching & Notifications

**Step 1: Run Matching Algorithm**
1. Go to Admin Dashboard → La Mesa Abierta
2. Find the month with status "open"
3. Click "Ver Detalles"
4. Review participants list
5. Click "**Ejecutar Algoritmo de Emparejamiento**"
6. Wait for confirmation (typically 5-10 seconds)
7. Status changes to "matched"

**What the Algorithm Does:**
- Assigns 3-5 guests to each host
- Distributes food assignments evenly:
  - Main courses
  - Salads
  - Drinks
  - Desserts
- Respects dietary restrictions
- Handles plus-ones properly
- Keeps assignments anonymous

**Step 2: Send Email Notifications**
1. After matching completes, click "**Enviar Notificaciones por Email**"
2. System sends:
   - Host emails with anonymous guest list + food assignments
   - Guest emails with host address + their food assignment
3. Check email logs to confirm delivery

**Email Content:**
- **Hosts receive:**
  - Number of guests assigned
  - Date, time
  - Anonymous guest list: "Invitado 1 (+1 acompañante): Bebidas"
  - Food assignments for each guest
  - Reminder to prepare for guests

- **Guests receive:**
  - Host address (but NOT name)
  - Date, time
  - Their food assignment with person count: "Bebestibles para 5 personas"
  - Reminder that identities are secret until arrival

**Optional: Send WhatsApp Notifications**
- Only if participants opted in
- Click "Enviar Mensajes de WhatsApp" button
- Same content as emails, plain text format

---

### Friday: Dinner Night

**No Admin Action Required**
- Participants attend their assigned dinners
- Hosts reveal identities when guests arrive
- Everyone enjoys community and food

---

### After Dinner: Feedback (Optional)

**Future Feature:**
- Collect testimonials
- Ask for ratings
- Get feedback for improvements

---

## 🔧 Common Admin Tasks

### Creating a New Month

```
Dashboard → La Mesa Abierta → Crear Nuevo Mes
```

**Fields:**
- **Dinner Date:** Friday evening (e.g., December 13, 2024)
- **Dinner Time:** Default "19:00" (7 PM)
- **Registration Deadline:** Monday before dinner, 23:59
- **Status:** "open" (to accept signups)

### Viewing Participants

```
Dashboard → La Mesa Abierta → [Month] → Ver Detalles
```

**You'll see:**
- Total participants
- Host/guest breakdown
- Plus-ones count
- Dietary restrictions
- Phone numbers (for WhatsApp)
- Email addresses

### Canceling a Participant

```
Dashboard → Participants List → [Participant] → Cancel
```

**Note:** Do this BEFORE running matching algorithm.

### Re-running Matching

If you need to re-match (before sending notifications):
1. Change month status back to "open"
2. Click "Ejecutar Algoritmo de Emparejamiento" again
3. Previous matches will be overwritten

**WARNING:** Don't re-run after sending notifications!

---

## 📊 Monitoring & Troubleshooting

### Check Email Logs

```sql
SELECT
  created_at,
  recipient_email,
  email_type,
  status,
  subject
FROM mesa_abierta_email_logs
WHERE month_id = 'MONTH_ID'
ORDER BY created_at DESC;
```

**Statuses:**
- `sent` - Email delivered successfully
- `failed` - Email delivery failed

### Check WhatsApp Logs

```sql
SELECT
  created_at,
  recipient_phone,
  message_type,
  status,
  twilio_message_sid
FROM mesa_abierta_whatsapp_messages
WHERE month_id = 'MONTH_ID'
ORDER BY created_at DESC;
```

### View Matches

```sql
SELECT
  m.id,
  m.dinner_date,
  m.dinner_time,
  hp.id as host_participant_id,
  (SELECT COUNT(*) FROM mesa_abierta_assignments WHERE match_id = m.id) as guest_count
FROM mesa_abierta_matches m
JOIN mesa_abierta_participants hp ON m.host_participant_id = hp.id
WHERE m.month_id = 'MONTH_ID';
```

---

## ⚠️ Common Issues & Solutions

### "Not Enough Hosts"

**Problem:** Too many guests, not enough hosts to accommodate.

**Solution:**
1. Recruit more hosts before deadline
2. Send personal invitations to reliable members
3. Consider extending deadline by a few days

### "Matching Algorithm Failed"

**Problem:** Error during matching process.

**Possible Causes:**
- No hosts available
- All hosts at capacity
- Database connection issue

**Solution:**
1. Check participant list has at least 1 host
2. Verify hosts have reasonable max_guests (3-8)
3. Check browser console for errors
4. Contact tech support if issue persists

### "Guest Received Wrong Food Assignment"

**Problem:** Email shows incorrect food assignment.

**Solution:**
- This shouldn't happen with current system
- Check assignments table in database
- If error persists, manually correct and resend email

### "Participant Didn't Receive Email"

**Problem:** Email not delivered.

**Check:**
1. Email logs table - was it sent?
2. Spam folder - sometimes filtered
3. Email address correct in user profile?

**Solution:**
1. Resend manually from admin dashboard
2. Or send via personal email as backup

---

## 📧 Email Service (Resend)

### Current Limits
- **Free Tier:** 3,000 emails/month
- **Rate Limit:** 2 emails/second (function handles this automatically)

### Cost Estimates
For 30 participants:
- 30 emails × 1 month = 30 emails
- Well within free tier
- No cost expected

### Monitoring
Check Resend dashboard: https://resend.com/dashboard

---

## 📱 WhatsApp Service (Twilio)

### Current Setup
- **Sandbox Mode** (Free for testing)
- Users must join sandbox first
- Shows "from Twilio" branding

### For Production
Need WhatsApp Business API:
- Cost: ~$1.15/month (number) + $0.019/message
- For 30 participants: ~$2/month total
- See WHATSAPP_SETUP.md for details

---

## 🎨 Branding & Design

### Email Template
- Black and white design
- CASA logo at top
- Professional, clean layout
- Mobile-responsive

### Key Elements
- Anonymous guest listings for hosts
- Person counts for food assignments
- Clear next steps
- Mystery reminder for guests

---

## 📝 Best Practices

### 1. Communication
- Announce La Mesa Abierta 2 weeks before registration deadline
- Send reminders 1 week before deadline
- Follow up with non-responders

### 2. Timing
- **Best Dinner Date:** Last Friday of the month
- **Best Registration Deadline:** Monday before dinner
- Gives hosts time to prepare, guests time to buy food

### 3. Host/Guest Balance
- Aim for 1 host per 3-5 guests
- 3 guests = intimate dinner
- 5 guests = lively gathering
- More than 6 = getting crowded

### 4. Food Assignments
- System distributes automatically
- Ensures variety at each table
- Respects dietary restrictions
- Guests know quantity needed

### 5. Anonymity
- NEVER share guest names with hosts before dinner
- NEVER share host names with guests
- Mystery is key to the experience

---

## 🚀 Launch Day Checklist

**2 Weeks Before:**
- [ ] Create month in admin dashboard
- [ ] Announce to congregation
- [ ] Share website link

**1 Week Before Deadline:**
- [ ] Check signup numbers
- [ ] Recruit hosts/guests if needed
- [ ] Send reminder to congregation

**Monday Morning (Matching Day):**
- [ ] Run matching algorithm
- [ ] Review matches for any issues
- [ ] Send email notifications
- [ ] (Optional) Send WhatsApp notifications
- [ ] Verify all emails sent successfully

**Friday (Dinner Day):**
- [ ] Pray for good connections
- [ ] Enjoy knowing community is happening

**After Dinner:**
- [ ] Collect feedback (future feature)
- [ ] Plan next month
- [ ] Celebrate successful event

---

## 📞 Support

**Technical Issues:**
- Check console logs in browser
- Review database for errors
- Contact: brentcurtis76@gmail.com / +56 9 4162 3577

**Participant Questions:**
- Email: sanandres@iach.cl
- Phone: +56 9 4162 3577

---

## 🎉 Success Metrics

**Good First Month:**
- 15-30 participants
- 3-6 hosts
- 80%+ attendance rate
- Positive feedback

**Growing Months:**
- 30-50 participants
- 6-10 hosts
- New faces each month
- Word-of-mouth growth

---

**System is ready for launch! 🚀**

Last Updated: January 11, 2025
