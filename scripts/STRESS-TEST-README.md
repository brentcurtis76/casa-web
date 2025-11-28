# Mesa Abierta Stress Test Guide

## Quick Start

1. Open Supabase SQL Editor
2. Run `mesa-abierta-stress-test.sql` sections one at a time
3. Use the admin UI to run matching after each scenario
4. Use verification queries to check results

## Test Scenarios

| # | Scenario | Hosts | Guests | Expected Result |
|---|----------|-------|--------|-----------------|
| 1 | Capacity overflow | 3 (cap ~15) | 25 (~33 people) | Some guests on waitlist |
| 2 | Too many hosts | 10 | 8 | Most hosts waitlisted, 1-2 dinners |
| 3 | All +1s | 5 (all +1) | 15 (all +1) | Tests +1 math, some waitlist |
| 4 | Small group | 1 | 2 (no +1s) | 3-person dinner (exception) |
| 5 | Perfect fit | 2 (cap 5) | 10 solo | 2 dinners, 6 people each |

## How to Run Each Scenario

### Step 1: Create Test Month (once)
```sql
-- Run the first INSERT statement to create test month
-- Month ID: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
```

### Step 2: Run a Scenario
Copy and run ONE scenario block at a time:
- Each scenario starts with cleanup (DELETE statements)
- Then creates participants (DO $$ block)
- Then has a verification query

### Step 3: Run Matching
1. Go to Mesa Abierta Admin in the app
2. Select the test month "February 2025"
3. Click "Ejecutar Matching"
4. Check the Cenas tab

### Step 4: Verify Results
Run the verification queries at the bottom of the SQL file:
- Check match results
- Check participant statuses
- Verify minimum 5 people rule

### Step 5: Reset for Next Test
The next scenario's cleanup block will reset everything

## What to Look For

### Minimum 5 People Rule
- Most dinners should have 5+ people
- Only ONE dinner can have <5 (the "leftover" exception)
- Hosts without enough guests go to waitlist

### Capacity Limits
- Guests beyond capacity go to waitlist
- Host's +1 reduces their guest capacity by 1

### Even Distribution
- Guests should be spread across hosts
- Not all dumped into first available host

## Cleanup When Done

Uncomment and run the cleanup section at the end to remove the test month.

## Edge Cases Covered

- ✅ More guests than capacity
- ✅ More hosts than needed
- ✅ All participants have +1s
- ✅ Tiny group (3 people)
- ✅ Perfect fit (exact capacity)
- ✅ Dietary restrictions preserved
- ✅ Minimum 5 people enforced
- ✅ Leftover dinner exception
