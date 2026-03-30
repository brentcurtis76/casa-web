# Daily Briefing Skill

## Trigger

### Trigger Phrases
- "morning briefing" / "daily briefing"
- "what's on today" / "what do I have today" / "what's happening today"
- "start my day" / "morning roundup" / "brief me"
- `/daily-briefing`

### When NOT to Trigger
- User asks specifically about GENERA status or a GENERA task → use **genera-project** skill (daily-briefing includes only a one-line health summary; for detailed GENERA queries use the dedicated skill)
- User asks specifically about CASA status or a CASA task → use **casa-project** skill
- User wants a weekly expense or financial report → use **financial-weekly-report** skill
- User wants route or travel planning → use **itinerary** skill
- User wants to confirm or send a meeting message → use **meeting-confirmation** skill

### Priority
This is the broadest "overview" skill — comprehensive morning roundup of calendar, email, project health, and todos. For any narrow, project-specific, or task-specific query, defer to the dedicated skill.

## Required Dependencies
- `supabase-genera` — GENERA project health
- `supabase-casa` — CASA project health
- `open-brain` — todos and notes

## Steps

### 1. Calendar
- Run via bash using `gws_client.py`:
  ```bash
  python3.12 -c "
  import sys; sys.path.insert(0, '$HOME/SecondBrain/adapters/google')
  from gws_client import fetch_calendar_events_today, fetch_calendar_events
  import json, datetime
  today = datetime.date.today()
  tomorrow = today + datetime.timedelta(days=1)
  today_events = fetch_calendar_events_today()
  tomorrow_events = fetch_calendar_events(tomorrow.isoformat(), tomorrow.isoformat())
  print(json.dumps({'today': today_events, 'tomorrow': tomorrow_events}, indent=2))
  "
  ```
- List events with: time, title, location if present

### 2. Email Highlights
- Fetch unread emails via `gws_client.fetch_emails()`:
  ```bash
  python3.12 -c "
  import sys; sys.path.insert(0, '$HOME/SecondBrain/adapters/google')
  from gws_client import fetch_emails
  import json
  emails = fetch_emails(query='in:inbox is:unread', max_results=20)
  print(json.dumps(emails, indent=2))
  "
  ```
- Identify high-priority or action-required emails
- Summarize: sender, subject, one-line summary, any required action

### 3. Project Health
- Query `supabase-genera` for GENERA recent error logs or failed jobs (last 24h)
- Query `supabase-casa` for CASA recent error logs or failed jobs (last 24h)
- Check for recent deployments (last 24h)
- If no errors: "GENERA healthy"
- If errors found: list error count, most recent error message

### 4. Open Brain Todos
- Query `open-brain` Supabase `memories` table for action items
- Filter for memories where `metadata` contains tags: `todo`, `action-item`, or `urgent`
- Exclude memories where `metadata` contains tag `completed`
- Example query: `SELECT * FROM memories WHERE metadata @> '{"tags": ["todo"]}' OR metadata @> '{"tags": ["action-item"]}' OR metadata @> '{"tags": ["urgent"]}'` — then filter out any with `completed` tag
- List up to 5 action items

### 5. YouTube Intel
- Read `~/SecondBrain/data/youtube-intel/findings.json`
- **New findings:** Filter for findings from the last 24 hours with relevance "high" or "medium" AND status "new"
- **Pending items:** Also check for any findings with status "planned" (plan written but not yet executed) — surface these as "Pending implementation" so they don't get lost
- **Recently implemented:** Note any findings with status "implemented" in the last 24 hours as completed wins
- If no new findings AND no pending items, skip this section entirely — do not pad the briefing
- If there are findings, include video title as a link, channel name, and the key insight
- After presenting findings, ask Brent: "Want to implement any of these?"
- If he says yes (or picks specific ones), for EACH selected finding post a `bridge_post_task` that invokes the **implement-finding** skill:
  - Title: "Plan implementation: [key_insight short summary]"
  - Prompt: "Read the implement-finding skill at ~/SecondBrain/.skills/skills/implement-finding/SKILL.md. Then plan and execute implementation for this finding from ~/SecondBrain/data/youtube-intel/findings.json:\n\nVideo ID: [video_id]\nTitle: [title]\nChannel: [channel]\nKey Insight: [key_insight]\nRelevant To: [relevant_to]\n\nFollow the skill steps: research the codebase, produce a scoped plan in ~/SecondBrain/data/youtube-intel/plans/[video_id].md, then execute the pipeline task."
  - Project: Determine from `relevant_to` — "pipeline"/"memory"/"routing" → project='life', project-specific → 'genera' or 'casa'
  - Always follow up with `bridge_wait_for_task`
- This hand-off keeps the briefing's context window lean — the implement-finding skill runs in its own fresh session

### 6. Format Output
Produce a clean morning briefing in this structure:

```
## Morning Briefing — [Day, Date]

### Calendar
[Today's events or "No events today"]
[Tomorrow preview: first 2 events]

### Email Highlights
[Up to 3 priority emails with action items]

### Project Health
GENERA: [healthy / N errors]
CASA: [healthy / N errors]

### YouTube Intel
[Only if new findings or pending items exist]

**New:**
- [Video Title](link) — Channel Name
  Key insight: [1-2 sentence summary]

**Pending implementation:**
- [Finding title] — plan ready, awaiting execution

**Recently shipped:**
- [Finding title] — implemented [date]

**Want to implement any of these?** [Ask Brent — if yes, post a bridge task via implement-finding skill]

### Action Items
[Up to 5 todos due today or overdue]
```

## Notes
- Keep output concise — one screen max
- If a MCP tool is unavailable, skip that section and note it
- Times should be in CLT (Chile Time, UTC-3)
