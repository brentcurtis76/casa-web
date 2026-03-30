# Financial Weekly Report Skill

## Trigger

### Trigger Phrases
- "weekly financial report" / "weekly finances"
- "expense report" / "show my expenses"
- "financial summary" / "financial overview"
- "how much did I spend this week/month"
- "this week's spending" / "spending summary"
- "what have I spent on [category]"
- `/financial-report`

### When NOT to Trigger
- User has a **receipt photo** or is describing a specific purchase to log → use **receipt-expense** skill first, then run this report if needed
- User says "add expense", "log this receipt", or "expense this" → use **receipt-expense** skill
- User wants a morning briefing that incidentally mentions finances → use **daily-briefing** skill

### Priority
This skill **reads and aggregates** expense data that was written by the **receipt-expense** skill. If the user wants to **add** an expense, use receipt-expense first. This skill generates periodic reports — not individual expense entries.

## Required MCP Dependencies
- `open-brain` (Supabase) — query expense and income memories
- `filesystem` — write Excel/CSV report to disk

## Steps

### 1. Determine Date Range
- Default: past 7 days (today - 6 days through today)
- If the user specifies a range (e.g., "this month", "last week", "March 1–7"), use that instead
- Set `start_date` and `end_date` in ISO format (YYYY-MM-DD)

### 2. Query Open Brain for Expenses
Use `open-brain` to search for memories tagged `expense` created within the date range.

- Query by tag: `expense`
- Filter by created date between `start_date` and `end_date`
- Also query by tag: `income` for the same period

Each expense record body (JSON) contains fields from the receipt-expense skill:
```json
{
  "vendor": "...",
  "date": "YYYY-MM-DD",
  "amount": 12500,
  "currency": "CLP",
  "category": "food",
  "items": [...],
  "payment_method": "..."
}
```

If no records are found for the period, say clearly:
> "No expense records found in Open Brain for [start_date] to [end_date]. Have you logged any receipts with the receipt-expense skill?"
Then stop — do not show empty tables.

### 3. Query Previous Week for Comparison
Query the same tags for the 7-day period immediately before `start_date` (prior week).
This enables week-over-week comparison. If no prior data exists, skip the "vs Last Week" column.

### 4. Group and Calculate

**Expense categories** (matching receipt-expense skill):
`food`, `transport`, `office`, `utilities`, `accommodation`, `entertainment`, `health`, `other`

For the current period, calculate per category:
- Count of transactions
- Total amount (CLP)
- % change vs previous week (if prior data available): `((curr - prev) / prev) * 100`

For the full period, calculate:
- **Total Expenses** = sum of all expense amounts
- **Total Income** = sum of all income amounts (0 if none)
- **Net** = Total Income - Total Expenses

**Anomaly flags** — check each expense record:
- Single expense > 100,000 CLP → flag as "Large transaction"
- Any category with spend 2x higher than previous week → flag as "Unusual category spike"

Collect all anomalies into a list. If none, note "None".

### 5. Format On-Screen Summary

Output this exact format (with real numbers substituted):

```
## Financial Weekly Report — [start_date] to [end_date]

### Expenses by Category
| Category      | Count | Total (CLP) | vs Last Week |
|---------------|-------|-------------|--------------|
| Food          | 5     | $45,000     | +12%         |
| Transport     | 3     | $22,000     | -5%          |
| Office        | 1     | $8,500      | —            |
| ...           |       |             |              |

### Summary
Total Expenses: $XXX,XXX CLP
Total Income:   $XX,XXX CLP
Net:            $XX,XXX CLP

### Anomalies
- [Vendor, date]: $XXX,XXX CLP — Large transaction
- Transport: $44,000 vs $22,000 last week — Unusual category spike
(or "None")
```

**Formatting rules:**
- Currency: format with thousands separator (e.g., `$45,000`)
- % change: `+12%`, `-5%`, or `—` if no prior data
- Omit categories with zero transactions (do not show empty rows)
- Keep the summary concise — full detail goes in the Excel file

### 6. Generate Excel Report

Check if `openpyxl` is available:
```bash
python3 -c "import openpyxl" 2>/dev/null && echo "available" || echo "unavailable"
```

**If available**, generate an `.xlsx` file at:
`~/SecondBrain/reports/financial-weekly-[end_date].xlsx`

Structure the workbook with two sheets:

**Sheet 1: Summary**
- Row 1: Report title and date range
- Row 3+: Category summary table (Category, Count, Total CLP, vs Last Week)
- Below table: Total Expenses, Total Income, Net rows (bold)
- Anomalies section at bottom

**Sheet 2: Transactions**
- Headers: Date, Vendor, Category, Amount (CLP), Payment Method, Notes
- One row per expense record, sorted by date ascending
- Auto-sized columns

Apply basic styling:
- Header rows: bold, light blue fill (`DDEEFF`)
- Alternating row shading on Transactions sheet (light gray `F5F5F5` on even rows)
- Right-align numeric columns

Use `filesystem` MCP to write the file. Ensure the `~/SecondBrain/reports/` directory exists first.

**If openpyxl is unavailable**, generate a CSV at the same path with `.csv` extension and note:
> "openpyxl not installed — saved as CSV instead. Install with: `pip3.12 install openpyxl --break-system-packages`"

### 7. Save Report Summary to Open Brain

After generating the file, save a summary note to `open-brain`:
- Title: `Financial Report: [start_date] to [end_date]`
- Tags: `["financial-report", "weekly", "[start_date]", "[end_date]"]`
- Body: the full on-screen summary text plus the file path

### 8. Confirm to User

Reply with:
> "Report saved to `~/SecondBrain/reports/financial-weekly-[end_date].xlsx`"
> "Summary also saved to Open Brain."

## Notes

- **Currency default:** CLP (Chilean Pesos). If a record has a different currency, include it as-is in the transactions sheet and note it in the summary.
- **The receipt-expense skill writes the data this skill reads.** If the user hasn't been logging receipts, this skill will find nothing.
- **Do not ask for confirmation** before generating the report — just run it and report results.
- **Date parsing:** if the user says "this week", treat Mon–Sun as the week. "Last week" = the prior Mon–Sun. "This month" = month-to-date.
- If Open Brain queries fail or return errors, report the error clearly and stop.
