# Receipt / Expense Skill

## Trigger

### Trigger Phrases
- User uploads a receipt image/photo (with or without explicit words)
- "log this receipt" / "save this receipt"
- "expense this" / "log this expense" / "add this expense"
- "add expense" / "record this purchase"
- "log what I spent at [vendor]"

### When NOT to Trigger
- User asks "how much did I spend this week/month" or wants an aggregate summary → use **financial-weekly-report** skill (that skill reads what this skill writes)
- User asks about expenses in general without providing a specific receipt or single purchase → use **financial-weekly-report** skill
- No image is attached and user is not describing a specific single purchase to log

### Priority
This skill is for **logging individual expenses** — always requires a receipt photo or specific purchase details. For **periodic summaries or reports**, use **financial-weekly-report**.

## Required MCP Dependencies
- `open-brain` — write extracted expense data to Supabase

## Steps

### 1. Receive Image
- Accept the uploaded receipt image from the user
- If no image provided, ask: "Please upload a photo of the receipt"

### 2. Extract Data
From the receipt image, extract:
- **Vendor name** (restaurant, store, service, etc.)
- **Date** of purchase (use today if not visible)
- **Total amount** with currency (default CLP if ambiguous in Chile context)
- **Line items** if clearly legible (item name + price)
- **Payment method** if visible (cash, card, transfer)

### 3. Categorize
Assign one primary category:
- `food` — restaurants, cafes, groceries, delivery
- `transport` — taxi, Uber, metro, gas, parking
- `office` — supplies, software, equipment
- `utilities` — electricity, internet, phone
- `accommodation` — hotel, Airbnb
- `entertainment` — events, subscriptions
- `health` — medical, pharmacy
- `other` — anything else

### 4. Confirm with User
Present extracted data for review BEFORE saving:

```
Receipt extracted:
  Vendor:   [name]
  Date:     [date]
  Amount:   [total] [currency]
  Category: [category]
  Items:    [list or "not itemized"]
  Payment:  [method or "unknown"]

Save to Open Brain? (yes/no/edit)
```

Wait for explicit confirmation. If user says "edit", accept corrections.

### 5. Save to Open Brain
On confirmation, write a note to `open-brain` (Supabase) with:
- Title: `Expense: [Vendor] — [Date]`
- Tags: `["expense", "[category]", "[vendor-slug]"]`
- Body: structured JSON with all extracted fields
- Created: today's date

### 6. Confirm Save
Reply: "Saved: [Vendor] [Amount] ([Category]) — [Date]"

## Notes
- Never save without explicit user confirmation
- If extraction is unclear, flag uncertain fields and ask user to verify
- Currency: if no symbol visible, ask user to confirm before saving
