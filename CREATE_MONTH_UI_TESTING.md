# Create Month UI - Testing Guide

## What Was Added

A new "Create Month" feature in the La Mesa Abierta admin dashboard that allows admins to create new dinner months through a user-friendly dialog interface instead of using SQL commands.

## Files Modified/Created

1. **CreateMonthDialog.tsx** (NEW)
   - Location: `/src/components/mesa-abierta/CreateMonthDialog.tsx`
   - Full-featured dialog with form validation
   - Date/time pickers for dinner and registration deadline
   - Status selector
   - Automatic insertion into Supabase

2. **MesaAbiertaAdmin.tsx** (MODIFIED)
   - Added import for `CreateMonthDialog`
   - Added `showCreateMonth` state variable
   - "Crear Nuevo Mes" button in header
   - Dialog integration with success callback

## How to Test

### 1. Access Admin Dashboard

```
URL: http://localhost:8081/mesa-abierta/admin
```

**Prerequisites:**
- Must be logged in
- User must have admin role in `mesa_abierta_admin_roles` table

### 2. Click "Crear Nuevo Mes" Button

- Look for the button in the top right of the admin panel
- It has a calendar icon and says "Crear Nuevo Mes"

### 3. Fill Out the Form

**Dinner Date:**
- Click the date input
- Select a future Friday (recommended: last Friday of month)
- Example: December 27, 2024

**Dinner Time:**
- Defaults to 19:00 (7:00 PM)
- Can change if needed

**Registration Deadline:**
- Click the datetime input
- Select a date/time BEFORE the dinner date
- Recommended: Monday before dinner, 23:59
- Example: December 23, 2024 at 23:59

**Status:**
- Defaults to "Abierto" (open)
- This allows participants to sign up immediately
- Options:
  - Abierto (open) - Accepts signups
  - Cerrado (closed) - No signups
  - Emparejado (matched) - Matching complete

### 4. Submit the Form

- Click "Crear Mes" button
- Should see success toast notification
- Dialog closes automatically
- New month appears in the months list

### 5. Verify Creation

**In Admin UI:**
- New month should appear in the dropdown/list
- Check that the date, time, and status are correct

**In Database (Optional):**
```sql
SELECT * FROM mesa_abierta_months
ORDER BY created_at DESC
LIMIT 1;
```

## Form Validation

The form validates:

1. **Required Fields:**
   - Dinner date (required)
   - Dinner time (required, defaults to 19:00)
   - Registration deadline (required)

2. **Date Logic:**
   - Registration deadline MUST be before dinner date
   - If not, shows error: "La fecha límite de inscripción debe ser antes de la fecha de la cena"

3. **Status:**
   - Always has a value (defaults to "open")

## Expected Behavior

### Success Case:
1. Click button → Dialog opens
2. Fill form with valid data
3. Click "Crear Mes"
4. See success toast: "Mes creado exitosamente"
5. Dialog closes
6. `fetchMonths()` called automatically
7. New month appears in list
8. Can immediately view participants for new month

### Error Cases:

**Missing Required Field:**
- Browser shows built-in validation message
- Form won't submit

**Invalid Date Logic:**
- Toast error: "La fecha límite de inscripción debe ser antes de la fecha de la cena"
- Form won't submit

**Database Error:**
- Toast error: "Error al crear el mes"
- Check console for detailed error
- Dialog stays open so user can retry

## Technical Details

### Component Structure:

```typescript
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Crear Nuevo Mes</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>

    <form onSubmit={handleSubmit}>
      <Input type="date" />       // Dinner date
      <Input type="time" />       // Dinner time
      <Input type="datetime-local" />  // Registration deadline
      <Select>                    // Status
        <SelectItem value="open">Abierto</SelectItem>
        <SelectItem value="closed">Cerrado</SelectItem>
        <SelectItem value="matched">Emparejado</SelectItem>
      </Select>

      <DialogFooter>
        <Button variant="outline">Cancelar</Button>
        <Button type="submit">Crear Mes</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### Database Insert:

```typescript
await supabase.from("mesa_abierta_months").insert({
  dinner_date: formData.dinnerDate,      // YYYY-MM-DD
  dinner_time: formData.dinnerTime,      // HH:MM (19:00)
  registration_deadline: formData.registrationDeadline,  // ISO timestamp
  status: formData.status,               // 'open', 'closed', 'matched'
});
```

### State Management:

```typescript
// In MesaAbiertaAdmin.tsx
const [showCreateMonth, setShowCreateMonth] = useState(false);

// Open dialog
<Button onClick={() => setShowCreateMonth(true)}>
  Crear Nuevo Mes
</Button>

// Dialog props
<CreateMonthDialog
  open={showCreateMonth}
  onClose={() => setShowCreateMonth(false)}
  onSuccess={() => {
    setShowCreateMonth(false);
    fetchMonths();  // Refresh the months list
  }}
/>
```

## Common Issues & Solutions

### Issue: Button Not Visible
**Solution:** Ensure you're logged in and have admin privileges in `mesa_abierta_admin_roles`

### Issue: Dialog Won't Open
**Solution:** Check browser console for JavaScript errors. Verify imports are correct.

### Issue: Can't Submit Form
**Solution:**
1. Check all required fields are filled
2. Verify registration deadline is before dinner date
3. Check console for validation errors

### Issue: Database Error on Submit
**Solution:**
1. Check Supabase connection
2. Verify table `mesa_abierta_months` exists
3. Check user has insert permissions
4. Review console logs for detailed error

### Issue: Month Not Appearing After Creation
**Solution:**
1. Check if `fetchMonths()` is being called
2. Verify month was actually inserted in database
3. Check month list sorting/filtering

## Next Steps After Testing

Once this works:
1. Admins can create months via UI
2. Set status to "open" to accept signups
3. Announce to congregation
4. Monitor signups through admin dashboard
5. Run matching algorithm when ready
6. Send email notifications

## Success Criteria

✅ "Crear Nuevo Mes" button visible in admin header
✅ Button opens dialog with form
✅ All form fields render correctly
✅ Form validation works (required fields, date logic)
✅ Submit creates record in database
✅ Success toast appears
✅ Dialog closes automatically
✅ New month appears in admin list
✅ Can immediately select and view new month
✅ No console errors
✅ Responsive on mobile/tablet

---

**Status:** Ready for testing
**Testing URL:** http://localhost:8081/mesa-abierta/admin
**Required Role:** mesa_abierta_admin_roles entry for user

