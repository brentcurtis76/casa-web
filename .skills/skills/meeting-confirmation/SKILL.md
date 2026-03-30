# Meeting Confirmation Skill

## Trigger

### Trigger Phrases
- "confirm meeting with [name]" / "send meeting confirmation"
- "confirm my meeting with [name]"
- "let [name] know about our meeting"
- "send a confirmation to [name]"
- "schedule meeting with [name]" (when intent is to send a confirmation message)
- `/meeting-confirmation`

### When NOT to Trigger
- User wants to plan travel routes or calculate drive times between meetings → use **itinerary** skill
- User asks what meetings they have today or this week → use **daily-briefing** or check calendar directly
- User wants to add an event to Google Calendar without sending a message → handle directly with google-calendar MCP
- User wants directions or travel time to a single location → use **itinerary** skill

### Priority
This skill drafts and sends a **confirmation message to a contact** about a specific meeting. If the user's focus is on getting *to* the meeting (route, timing, travel), use **itinerary** instead.

## Required MCP Dependencies
- `open-brain` — look up contact preferences
- `google-calendar` — check for scheduling conflicts
- `gmail` — draft/send email confirmation (if applicable)

## Steps

### 1. Gather Meeting Details
If not provided, ask for:
- **Contact name** (required)
- **Proposed date and time** (required)
- **Duration** (default: 1 hour)
- **Location** (optional — physical address, video link, or TBD)
- **Agenda** (optional — brief description)

### 2. Look Up Contact in Open Brain
Query `open-brain` for a note or contact record matching the contact name.
Extract:
- Preferred language (`es` or `en`, default `es` for CASA contacts)
- Preferred communication channel (`whatsapp`, `email`, `telegram`)
- Any notes about scheduling preferences

If contact not found in Open Brain: assume `email`, ask user for language preference.

### 3. Check Calendar for Conflicts
Query `google-calendar` for events at the proposed date/time (± 30 min buffer).
- If conflict found: report it and ask user if they want to proceed anyway or suggest alternatives
- If no conflict: proceed

### 4. Determine Language
- If contact is tagged as CASA or location is Chile/Latin America: use **Spanish**
- If contact has explicit language preference in Open Brain: use that
- Otherwise: use **English**
- User can override: "send in Spanish/English"

### 5. Draft Confirmation Message
Draft in the appropriate language and channel format.

**Email template (English):**
```
Subject: Meeting Confirmation — [Date]

Hi [Name],

Just confirming our meeting:
  Date:     [Day, Date]
  Time:     [Time] (CLT)
  Duration: [Duration]
  Location: [Location or "To be confirmed"]
  [Agenda: [brief description] — if provided]

Please let me know if you need to reschedule.

Best,
Brent
```

**Email template (Spanish):**
```
Asunto: Confirmación de reunión — [Fecha]

Hola [Nombre],

Te confirmo nuestra reunión:
  Fecha:    [Día, Fecha]
  Hora:     [Hora] (CLT)
  Duración: [Duración]
  Lugar:    [Lugar o "Por confirmar"]
  [Agenda: [descripción breve] — si se proporcionó]

Avísame si necesitas reprogramar.

Saludos,
Brent
```

### 6. Present Draft for Approval
Show the draft to the user:

```
Draft confirmation message:
---
[full message]
---

Send via [channel] to [contact]? (yes/no/edit)
```

**NEVER send without explicit "yes" confirmation from the user.**

### 7. Send (on approval)
- If `email`: use Gmail MCP to send the draft
- If `whatsapp` or `telegram`: output the message text for user to copy/paste, as direct sending is not available via MCP

### 8. Confirm
Reply: "Confirmation sent to [Name] via [channel]" or "Message ready to send — [paste above into WhatsApp]"

## Notes
- Never send any message without explicit user approval
- All times are CLT (UTC-3) unless user specifies otherwise
- If calendar has a conflict, always surface it before drafting
- Keep messages brief and professional
