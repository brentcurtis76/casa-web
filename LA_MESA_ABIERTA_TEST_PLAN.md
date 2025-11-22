# La Mesa Abierta - Testing Checklist

## 🧪 Pre-Launch Testing

Test everything before your first real launch!

---

## ✅ Test 1: Public Homepage Section

**URL:** http://localhost:3000/#mesa-abierta

**Check:**
- [ ] Section loads without errors
- [ ] CASA logo displays correctly
- [ ] Next dinner date shows (if month exists)
- [ ] Registration deadline shows
- [ ] "Ser Anfitrión" and "Ser Invitado" buttons work
- [ ] Stats show correctly (participants, hosts needed, spots available)
- [ ] "Cómo Funciona" section displays
- [ ] Responsive on mobile

**Test Without Login:**
- [ ] Click "Ser Anfitrión" → Should prompt to log in
- [ ] Click "Ser Invitado" → Should prompt to log in

**Test With Login:**
- [ ] Click "Ser Anfitrión" → Opens signup form
- [ ] Click "Ser Invitado" → Opens signup form

---

## ✅ Test 2: Signup Flow

### Host Signup

1. **Step 1: Role Selection**
   - [ ] Select "Quiero ser anfitrión"
   - [ ] Warning message appears about role confirmation
   - [ ] "Siguiente" button enabled

2. **Step 2: Host Information**
   - [ ] Address field required
   - [ ] Max guests dropdown works (3-8 people)
   - [ ] Plus-one toggle works
   - [ ] Recurring toggle works
   - [ ] Can't proceed without address

3. **Step 3: Dietary Restrictions**
   - [ ] Can add dietary restrictions
   - [ ] Can add plus-one dietary restrictions (if enabled)
   - [ ] Can skip (no restrictions)

4. **Step 4: WhatsApp Opt-in**
   - [ ] Phone number field works
   - [ ] WhatsApp toggle works
   - [ ] Can proceed without phone

5. **Submit**
   - [ ] Success message appears
   - [ ] Dialog closes
   - [ ] Can't sign up again (duplicate prevention)

### Guest Signup

1. **Step 1: Role Selection**
   - [ ] Select "Quiero ser invitado"
   - [ ] "Siguiente" button enabled

2. **Step 2: Guest Options**
   - [ ] Shows checkmark (no additional info needed)
   - [ ] Plus-one toggle works
   - [ ] Recurring toggle works

3. **Step 3: Dietary Restrictions**
   - [ ] Works same as host

4. **Step 4: WhatsApp Opt-in**
   - [ ] Works same as host

5. **Submit**
   - [ ] Success message appears
   - [ ] Dialog closes
   - [ ] Can't sign up again

---

## ✅ Test 3: Admin Dashboard

**URL:** http://localhost:3000/admin (or your admin route)

### Create Month

1. [ ] Navigate to La Mesa Abierta section
2. [ ] Click "Crear Nuevo Mes"
3. [ ] Fill in:
   - Dinner date (future date)
   - Dinner time (19:00)
   - Registration deadline (before dinner date)
4. [ ] Status set to "open"
5. [ ] Month appears in list

### View Participants

1. [ ] Click "Ver Detalles" on month
2. [ ] Participants list shows:
   - Names
   - Roles (host/guest)
   - Dietary restrictions
   - Plus-ones
   - Phone numbers

### Run Matching Algorithm

**Setup:**
- Need at least 1 host
- Need at least 1 guest
- Both should be signed up for the same month

**Test:**
1. [ ] Click "Ejecutar Algoritmo de Emparejamiento"
2. [ ] Wait for confirmation
3. [ ] Check that status changed to "matched"
4. [ ] View matches in database or admin UI
5. [ ] Verify:
   - Each host has 1-5 guests assigned
   - Food assignments distributed
   - No guest assigned to multiple dinners

### Send Email Notifications

**Prerequisites:**
- Matching must be complete
- Test with your own email first!

**Test:**
1. [ ] Click "Enviar Notificaciones por Email"
2. [ ] Wait for confirmation
3. [ ] Check your inbox:

**Host Email Should Have:**
- [ ] CASA logo visible
- [ ] Black and white design
- [ ] Dinner date and time
- [ ] Anonymous guest list ("Invitado 1", "Invitado 2")
- [ ] Food assignments for each guest
- [ ] NO guest names visible

**Guest Email Should Have:**
- [ ] CASA logo visible
- [ ] Black and white design
- [ ] Dinner date and time
- [ ] Host address (but not name)
- [ ] Your food assignment with person count ("Bebestibles para 5 personas")
- [ ] NO host name visible
- [ ] NO other guest names visible

---

## ✅ Test 4: Edge Cases

### Duplicate Signup Prevention

1. [ ] Sign up as host
2. [ ] Try to sign up again for same month
3. [ ] Should show error: "Ya estás inscrito"

### No Active Month

1. [ ] Set all months to status = 'closed'
2. [ ] Visit homepage
3. [ ] Should show "Próximamente" message

### Insufficient Hosts

1. [ ] Create month with 10 guests, 0 hosts
2. [ ] Try to run matching
3. [ ] Should show error about insufficient hosts

### Plus-One Handling

1. [ ] Sign up with plus-one enabled
2. [ ] Add plus-one name and dietary restrictions
3. [ ] Run matching
4. [ ] Check host email shows "(+1 acompañante)"
5. [ ] Verify person count includes plus-one

### Dietary Restrictions

1. [ ] Add vegetarian restriction
2. [ ] Run matching
3. [ ] Host should see this info
4. [ ] Guest food assignment should consider restriction

---

## ✅ Test 5: WhatsApp (Optional)

**Only if you set up Twilio:**

1. **Join Sandbox**
   - [ ] Send join code to Twilio number
   - [ ] Receive confirmation

2. **Update Participant**
   - [ ] Add your phone to test participant
   - [ ] Enable WhatsApp opt-in

3. **Send Messages**
   - [ ] Click "Enviar Mensajes de WhatsApp"
   - [ ] Receive message on your phone
   - [ ] Verify content matches email

---

## ✅ Test 6: Responsive Design

### Desktop (1920x1080)
- [ ] Homepage section looks good
- [ ] Signup form readable
- [ ] Admin dashboard functional

### Tablet (768x1024)
- [ ] Homepage section adapts
- [ ] Signup form usable
- [ ] Buttons accessible

### Mobile (375x667)
- [ ] Homepage section readable
- [ ] Signup form scrollable
- [ ] All buttons work
- [ ] No horizontal scroll

---

## ✅ Test 7: Database Integrity

Run these queries to verify data:

### Check Participants
```sql
SELECT
  user_id,
  month_id,
  role_preference,
  has_plus_one,
  status
FROM mesa_abierta_participants
WHERE month_id = 'YOUR_TEST_MONTH_ID';
```

### Check Matches
```sql
SELECT
  m.id,
  m.dinner_date,
  COUNT(a.id) as guest_count
FROM mesa_abierta_matches m
LEFT JOIN mesa_abierta_assignments a ON m.match_id = a.match_id
WHERE m.month_id = 'YOUR_TEST_MONTH_ID'
GROUP BY m.id, m.dinner_date;
```

### Check Food Assignments
```sql
SELECT
  food_assignment,
  COUNT(*) as count
FROM mesa_abierta_assignments a
JOIN mesa_abierta_matches m ON a.match_id = m.id
WHERE m.month_id = 'YOUR_TEST_MONTH_ID'
GROUP BY food_assignment;
```

**Expected:** Roughly equal distribution of main_course, salad, drinks, dessert

---

## ✅ Test 8: Error Handling

### Server Errors

1. [ ] Disconnect internet
2. [ ] Try to sign up
3. [ ] Should show error message

### Invalid Data

1. [ ] Try empty address as host
2. [ ] Should prevent submission

### Expired Registration

1. [ ] Set deadline to past date
2. [ ] Try to sign up
3. [ ] Should show registration closed

---

## 🎯 Final Launch Checklist

Before going live:

### System Ready
- [ ] All tests above passed
- [ ] Email notifications working
- [ ] Matching algorithm tested
- [ ] No console errors

### Content Ready
- [ ] First month created (status: open)
- [ ] Registration deadline set correctly
- [ ] Dinner date confirmed

### Communication Ready
- [ ] Announcement prepared
- [ ] Website link tested
- [ ] Instructions clear

### Admin Ready
- [ ] Admin knows how to run matching
- [ ] Admin knows how to send notifications
- [ ] Admin has this test plan
- [ ] Admin has launch guide

---

## 📊 Success Criteria

**Test is successful if:**
- ✅ Users can sign up without errors
- ✅ Matching algorithm completes
- ✅ Emails sent and received correctly
- ✅ Anonymity maintained (no names leaked)
- ✅ Food assignments distributed properly
- ✅ Person counts accurate
- ✅ No duplicate signups
- ✅ Mobile responsive

---

**Ready to launch! 🚀**

Test Date: ___________
Tested By: ___________
All Tests Passed: [ ]
