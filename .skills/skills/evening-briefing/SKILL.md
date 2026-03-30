# Evening Briefing Skill

---
name: evening-briefing
description: >
  Nightly briefing that previews tomorrow's calendar, reviews the to-do list, and offers to send WhatsApp meeting confirmations in Spanish. Use this skill whenever Brent asks about "tonight's briefing", "evening briefing", "what's on tomorrow", "preview tomorrow", "nightly summary", "brief me for tomorrow", "end of day review", or `/evening-briefing`. Also triggers automatically as a scheduled task every evening at 7 PM (Sun–Thu). Do NOT use for morning briefings (use daily-briefing), route planning (use itinerary), or individual meeting confirmations (use meeting-confirmation).
---

## Purpose

This is Brent's end-of-day routine. Every evening Jake reviews what's coming up tomorrow so Brent can go into the next day prepared — no surprises. The briefing covers three things: tomorrow's calendar, the running to-do list, and proactive WhatsApp confirmations to anyone Brent is meeting with.

The tone is like a good executive assistant checking in at the end of the day: concise, organized, and action-oriented. Brent reads this on his phone via Telegram, so the format needs to be scannable on a small screen.

## When This Runs

- **Scheduled:** 7 PM Chile time, Sunday through Thursday
  - Sunday evening previews Monday
  - Friday and Saturday evenings are skipped (no briefing)
- **On demand:** Brent can trigger it anytime with the phrases listed above

## Dependencies

- `google-calendar` MCP or `gws_client.py` — fetch tomorrow's events
- `whatsapp_mcp` — send confirmation messages via Meta Business API
- Telegram (via `bridge.py` or `notify_brent_telegram`) — deliver the briefing
- `open-brain` / `db.py` — look up contacts (phone numbers, language, tags)
- `~/SecondBrain/todos.md` — the running to-do list

## Steps

### 1. Determine "Tomorrow"

Calculate tomorrow's date relative to when the skill runs. On Sunday evening, tomorrow = Monday. Use Chile timezone (CLT, UTC-3 / CLST, UTC-4 depending on DST).

### 2. Fetch Tomorrow's Calendar

Use `gws_client.fetch_calendar_events(tomorrow, tomorrow)` to pull all events for tomorrow.

For each event, extract:
- **Time** (start – end)
- **Title** (summary)
- **Location** — if present, include it. If the event has a Google Meet / Zoom / Teams link (check `conferenceData`, `hangoutLink`, or the location/description fields for URLs), mark it as "Online" and include the link
- **Attendees** — names and email addresses

Sort events chronologically.

### 3. Read the To-Do List

Read `~/SecondBrain/todos.md`. This is a simple markdown checklist. The format is:

```markdown
# To-Do List

## Priority
- [ ] High-priority item
- [ ] Another urgent item

## Normal
- [ ] Regular task
- [ ] Another task

## Done
- [x] Completed item (move here when done)
```

Filter to show only unchecked items (`- [ ]`). Group by Priority and Normal sections.

If the file doesn't exist yet, create it with the template above (empty sections).

### 4. Check Confirmation Status

Before offering to send WhatsApp confirmations, check whether confirmations have already been sent for tomorrow's meetings. Look up recent WhatsApp messages in the database (`db.get_whatsapp_history`) or check `open-brain` for logged confirmation events.

For each attendee in tomorrow's meetings:
- If a confirmation was already sent in the last 48 hours for this specific meeting → mark as "Already confirmed"
- If not → mark as "Pending confirmation"

### 5. Format the Telegram Message

Build a clean, phone-readable Telegram message. Use this structure:

```
Tonight's Briefing — [Day, Month Date]

TOMORROW'S CALENDAR

[If events exist:]
  09:00 – 10:00  Meeting with Juan Pérez
                  Online — meet.google.com/abc-xyz
  11:30 – 12:30  Coffee with María
                  Café Altura, Providencia
  15:00 – 16:00  Sprint review
                  Zoom — zoom.us/j/123456

[If no events:]
  No meetings tomorrow.
  Want to add anything to the calendar?

TO-DO LIST

[If items exist:]
  Priority:
  • Finish proposal for GENERA Phase 5
  • Review CASA deployment logs

  Normal:
  • Update pipeline docs
  • Order new headphones

[If empty:]
  To-do list is empty.
  Anything you want to add?

MEETING CONFIRMATIONS

[If there are attendees to confirm:]
  Ready to confirm:
  • Juan Pérez (09:00) — WhatsApp
  • María López (11:30) — WhatsApp

  Missing phone number:
  • Carlos Ruiz (15:00) — carlos@email.com
    Reply with his number to add him

  Already confirmed:
  • Ana Soto (16:00) — confirmed yesterday

  Want me to send confirmations?

[If no meetings with external attendees:]
  No confirmations needed tomorrow.
```

Important formatting notes:
- No markdown headers (Telegram renders them poorly) — use CAPS for section labels
- Use simple bullet points (•) not checkboxes
- Keep lines short — Telegram wraps awkwardly on long lines
- Include a blank line between sections for readability

### 6. Send the Telegram Message

Send the formatted message to Brent via Telegram. Use `curl` to call the Telegram Bot API (same pattern as `bridge.py`'s `_send_telegram`). Do NOT use Python `requests` — it fails in background/launchd contexts on this Mac Mini.

### 7. Handle Brent's Response

After sending the briefing, Brent may respond via Telegram with instructions. Common responses and how to handle them:

**"Yes, send confirmations" / "confirm all" / "sí"**
→ Send WhatsApp messages to all pending attendees (see Step 8)

**"Confirm [name]" / "only confirm Juan"**
→ Send WhatsApp only to the specified person(s)

**"Add [task] to my to-do list"**
→ Append the item to `~/SecondBrain/todos.md` under the appropriate section
→ Reply confirming: "Added: [task]"

**"Add [event] tomorrow at [time]"**
→ Create a calendar event via `gws` and re-send an updated briefing summary
→ Reply confirming: "Added [event] at [time] tomorrow"

**"No" / "all good" / "thanks"**
→ Reply: "Got it. Have a good evening!"

### 8. Send WhatsApp Confirmations

When Brent approves sending confirmations, for each pending attendee:

1. **Look up the contact** in `db.search_contacts` using the attendee's name or email from the calendar event.

   **If the contact is found** with a phone number → proceed to step 2.

   **If the contact is found but has no phone number** → ask Brent on Telegram:
   "I have [Name] in the contacts but no phone number. Want to add one? Reply with the number and I'll save it and send the confirmation."
   When Brent replies with a number, save it to the contact via `db.update_contact(contact_id, phone=number)` and proceed.

   **If the contact is not found at all** → ask Brent on Telegram:
   "I don't have [Name] ([email]) in my contacts yet. To send a WhatsApp confirmation, reply with their phone number (with country code, e.g. +56912345678). I'll save them as a new contact."
   When Brent provides the number, create the contact via `db.add_contact(name=name, email=email, phone=number)` and proceed. If Brent also provides timezone info (e.g. "he's in Spain"), save that in the contact's `tags` field (e.g. "timezone:europe/madrid").

   This way the contacts database builds itself over time — each new person only needs to be added once, and from then on confirmations are automatic.

   Extract from the contact record:
   - Phone number
   - Time zone (check `tags` or `notes` for timezone info; default to CLT)
   - Name as they'd like to be addressed

2. **Convert meeting time to the recipient's local time.** This matters especially for contacts in Spain (CET/CEST, UTC+1/+2). If the contact has `spain` or `europe` in their tags/notes, convert accordingly. If no timezone info is available, use CLT.

3. **Compose the WhatsApp message** in Spanish:

   For in-person meetings:
   ```
   Hola [Nombre], soy Jake, el asistente virtual de Brent Curtis. Te estoy contactando para confirmar la reunión presencial que tienes en agenda con Brent mañana a las [hora en zona horaria del destinatario] en [lugar]. ¿Confirmas?
   ```

   For online meetings:
   ```
   Hola [Nombre], soy Jake, el asistente virtual de Brent Curtis. Te estoy contactando para confirmar la reunión online que tienes en agenda con Brent mañana a las [hora en zona horaria del destinatario]. Aquí tienes el enlace: [link]. ¿Confirmas?
   ```

   For meetings without location info:
   ```
   Hola [Nombre], soy Jake, el asistente virtual de Brent Curtis. Te estoy contactando para confirmar la reunión que tienes en agenda con Brent mañana a las [hora en zona horaria del destinatario]. ¿Confirmas?
   ```

4. **Send via `whatsapp_mcp`** (the `send_whatsapp` tool) or by calling `sender.send_whatsapp(phone, message)` directly.

5. **Log the confirmation** — record in `open-brain` that a confirmation was sent (so the next run doesn't re-send).

6. **Notify Brent** via Telegram: "Confirmation sent to [Name] for tomorrow at [time]"

### 9. Relay WhatsApp Replies and Rescheduling

When meeting attendees reply to the WhatsApp confirmation, the existing webhook in `jake2.py` receives the message and routes it through the WhatsApp adapter (`adapters/whatsapp/llm.py`). The adapter handles replies intelligently:

- **Confirmed** → Jake thanks them and notifies Brent on Telegram
- **Declined (no alternative given)** → Jake checks Brent's calendar for the next 4 business days, proposes 2-3 open slots to the contact, and notifies Brent that the meeting was declined
- **Declined with a suggested alternative** → Jake checks if the suggested time is free, then asks Brent for approval before confirming
- **Questions about the meeting** → Jake answers if possible, otherwise escalates to Brent

Jake can propose alternative times autonomously (low-risk), but never confirms a rescheduled meeting without Brent's explicit approval via the Telegram approval workflow. This keeps Brent in the loop while letting Jake handle the back-and-forth.

No additional rescheduling logic is needed in this skill — it's all handled by the WhatsApp adapter.

## The todos.md File

If `~/SecondBrain/todos.md` doesn't exist when the skill first runs, create it with this structure:

```markdown
# To-Do List

## Priority

## Normal

## Done
```

When adding items, append to the appropriate section. When marking items complete, move them from their current section to `## Done` and change `- [ ]` to `- [x]`.

The file is intentionally simple — it's a stepping stone until Google Tasks integration is wired up. Keep the format clean so it's easy to parse and easy for Brent to edit by hand if he wants.

## Notes

- All times displayed to Brent should be in CLT (Chile time)
- WhatsApp messages show times in the recipient's timezone
- If a MCP tool or dependency is unavailable, skip that section and note it in the briefing
- Never send WhatsApp confirmations without Brent's explicit approval
- The briefing should fit on one phone screen — be concise
- Brent's phone number for Telegram: uses TELEGRAM_CHAT_ID from env vars
- WhatsApp 24-hour window: confirmations can only be sent if the contact has messaged within the last 24 hours, OR if using a pre-approved template. If sending fails due to the care window, notify Brent so he can initiate the conversation manually
