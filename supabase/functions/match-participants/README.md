# 🍽️ Match Participants Edge Function

## Overview

This Supabase Edge Function implements the **matching algorithm** for La Mesa Abierta. It randomly assigns guests to host homes for monthly dinners while balancing group sizes, dietary restrictions, and food assignments.

## Purpose

The matching algorithm:
- ✅ Pairs guests with hosts for dinner groups
- ✅ Balances group sizes (6-10 people per dinner)
- ✅ Distributes food assignments (salad, drinks, dessert)
- ✅ Considers dietary restrictions for better grouping
- ✅ Preserves mystery by randomizing assignments
- ✅ Handles plus-ones correctly

## How It Works

### Algorithm Steps

1. **Validation** - Checks month exists and is in 'open' status
2. **Fetch Participants** - Gets all pending participants with dietary restrictions
3. **Separate Roles** - Splits into hosts and guests
4. **Balance Host Ratio** - Converts excess hosts to guests for optimal group sizes (NEW!)
5. **Calculate Capacity** - Ensures there's enough host capacity for all guests
6. **Randomization** - Shuffles guests to preserve mystery
7. **Dietary Sorting** - Sorts guests by dietary complexity for even distribution
8. **Assignment** - Assigns guests to hosts based on capacity
9. **Food Distribution** - Assigns salad, drinks, dessert to guests
10. **Database Updates** - Creates matches and assignments
11. **Status Update** - Marks month as 'matched' and participants as 'confirmed'

### Dietary Restriction Scoring

The algorithm scores dietary restrictions to distribute complex diets evenly:
- **Allergies** = 10 points (highest priority)
- **Preferences** = 1 point

Guests with higher scores (more complex diets) are assigned first to ensure even distribution across dinner groups.

### Food Assignment Logic

Each dinner group gets:
- **At least 2 guests** → Main course
- **Remaining guests** → Salad, drinks, or dessert

The algorithm calculates main courses needed as: `Math.max(2, Math.ceil(numGuests / 3))`

Example for 6 guests:
- 2 guests → Main course
- 4 guests → Salad, drinks, dessert (cycling)

All food assignments are shuffled to randomize who gets what.

### Historical Match Avoidance (NEW!)

The algorithm now tracks previous dinner matches to avoid repeat pairings:
- **Looks back 6 months** of historical matches
- **Builds connection history** of who has dined together
- **Prioritizes new connections** when assigning guests to hosts
- **Novelty scoring system**:
  - +10 points if guest has NOT dined with host before
  - -10 points if guest HAS dined with host before
  - -1 point for each guest in the group they've dined with before

This ensures participants meet new people each month instead of the same faces!

### Smart Host Balancing (NEW!)

The algorithm automatically balances host/guest ratios for optimal dinner group sizes:
- **Target**: 7 people per dinner (1 host + 6 guests)
- **Calculation**: `optimalHosts = ceil(totalPeople / 7)`

**What happens with excess hosts:**
1. System calculates total participants (including plus-ones)
2. Determines optimal number of hosts needed
3. If too many hosts volunteered:
   - Randomly selects needed hosts
   - Converts excess hosts to guests for this month
   - Preserves their `role_preference = 'host'` for future months
   - Updates their `assigned_role = 'guest'` for this event

**Examples:**
- 3 hosts + 12 guests (15 total) → Uses all 3 hosts ✓
- 8 hosts + 12 guests (20 total) → Uses 3 hosts, converts 5 to guests ✓
- 10 hosts + 5 guests (15 total) → Uses 2 hosts, converts 8 to guests ✓

**Benefits:**
- ✅ Balanced group sizes (6-10 people)
- ✅ Better dinner experiences
- ✅ Fair rotation (different people host each month)
- ✅ Prevents tiny groups with too many hosts

## Request Format

**Method**: `POST`

**Headers**:
```
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

**Body**:
```json
{
  "monthId": "uuid-of-month-event"
}
```

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "Matching completado exitosamente",
  "results": {
    "totalMatches": 8,
    "totalParticipants": 48,
    "hostsUsed": 8,
    "hostsConverted": 2,
    "guestsAssigned": 40,
    "guestsUnassigned": 0,
    "newConnectionsCreated": true,
    "matchDetails": [
      {
        "matchNumber": 1,
        "hostId": "uuid-host-1",
        "guestCount": 5
      },
      ...
    ]
  }
}
```

### Error Response (500)

```json
{
  "success": false,
  "error": "Error message",
  "stack": "Error stack trace (development only)"
}
```

## Error Handling

The function validates:
- ✅ Month ID is provided
- ✅ Month exists in database
- ✅ Month status is 'open' (not already matched)
- ✅ Participants exist and are 'pending'
- ✅ At least one host and one guest available
- ✅ Sufficient host capacity for all guests

Common errors:
- `"Se requiere el ID del mes"` - Missing monthId parameter
- `"Mes no encontrado"` - Invalid month ID
- `"El mes ya fue procesado"` - Month already matched
- `"No hay participantes pendientes"` - No participants to match
- `"No hay anfitriones disponibles"` - No hosts signed up
- `"Insuficiente capacidad de anfitriones"` - Not enough host capacity

## Database Changes

The function performs these operations:

### mesa_abierta_matches (INSERT)
Creates one record per dinner group:
```sql
{
  month_id: uuid,
  host_participant_id: uuid,
  dinner_date: date,
  dinner_time: time,
  guest_count: integer
}
```

### mesa_abierta_assignments (INSERT)
Creates one record per guest:
```sql
{
  match_id: uuid,
  guest_participant_id: uuid,
  food_assignment: 'salad' | 'drinks' | 'dessert'
}
```

### mesa_abierta_participants (UPDATE)
Updates all matched participants:
```sql
{
  status: 'confirmed',
  assigned_role: 'host' | 'guest'
}
```

### mesa_abierta_months (UPDATE)
Updates month status:
```sql
{
  status: 'matched'
}
```

## Capacity Calculation

**Host Capacity**:
```
host_max_guests (default: 5, range: 3-10)
- 1 if host.has_plus_one (reserves space for host's +1)
```

**Guest Size**:
```
1 person if !has_plus_one
2 people if has_plus_one
```

**Example**:
- Host with `host_max_guests = 6` and no plus-one → can accommodate 6 guests
- Host with `host_max_guests = 6` and plus-one → can accommodate 5 guests
- Guest with plus-one counts as 2 people toward capacity

## Usage from Admin Panel

```typescript
// Call from admin dashboard
const response = await supabase.functions.invoke('match-participants', {
  body: { monthId: selectedMonthId }
});

if (response.data?.success) {
  console.log('Matching successful!', response.data.results);
} else {
  console.error('Matching failed:', response.data?.error);
}
```

## Testing Locally

### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login
```

### Run Locally
```bash
# Start Supabase local dev
supabase start

# Serve functions locally
supabase functions serve match-participants --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/match-participants \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"monthId":"uuid-here"}'
```

## Deployment

```bash
# Deploy to Supabase
supabase functions deploy match-participants

# Set environment secrets (if needed)
supabase secrets set SUPABASE_URL=your-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

## Logs and Debugging

View logs in Supabase dashboard:
1. Go to **Edge Functions** → **match-participants**
2. Click **Logs** tab
3. Filter by date/time

Console output includes:
- `Iniciando matching para el mes: {monthId}`
- `Total participantes: {count}`
- `Anfitriones: {hosts}, Invitados: {guests}`
- `Capacidad total de anfitriones: {capacity}`
- `Anfitrión {id}: {count} invitados asignados`
- `✅ Matching completado exitosamente`

## Security

- ✅ **JWT Verification**: Enabled in `config.toml` (requires authenticated user)
- ✅ **Service Role Key**: Uses service role to bypass RLS for matching operations
- ✅ **Admin-Only Trigger**: Should only be called from admin panel (verify in client code)

## Future Enhancements

- [ ] Add email notifications after matching
- [ ] Support manual reassignments
- [ ] Add waitlist handling when capacity is insufficient
- [ ] Implement "recurring participants" auto-signup
- [ ] Add metrics/analytics tracking
- [ ] Support for custom dinner times per match
- [x] ~~Historical match avoidance~~ ✅ COMPLETED
- [x] ~~Guests bring main courses~~ ✅ COMPLETED
- [x] ~~Smart host balancing~~ ✅ COMPLETED

---

**Created**: November 2024
**Last Updated**: January 2025
**Status**: Production Ready ✅
