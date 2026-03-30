# Itinerary Generation Skill

## Triggers

### Trigger Phrases
- "plan my route" / "route for today"
- "make me an itinerary" / "build my itinerary"
- "optimal route" / "best route between"
- "how long between meetings" / "travel time between [A] and [B]"
- "travel schedule" / "commute plan"
- "how do I get between [place A] and [place B]" (when part of a multi-stop schedule)
- "plan my day" (when calendar events have locations)
- User provides a list of addresses/meetings with times

### When NOT to Trigger
- User wants to **confirm or send a message** about a meeting → use **meeting-confirmation** skill
- User wants a full morning overview (calendar + email + todos) → use **daily-briefing** skill
- User asks a simple one-way "how long to drive to [place]" without a multi-stop schedule → answer directly with google-maps MCP; no need to invoke this skill
- User wants to **add** a meeting to their calendar → handle directly with google-calendar MCP

### Priority
This skill is for **multi-stop travel planning** with calculated routes and buffer times. Single-stop directions can be answered directly without invoking this skill. "Confirm meeting" requests go to **meeting-confirmation**, not here.

## MCP Dependencies
- `google-calendar` — fetch today's calendar events with locations
- `google-maps` (`@modelcontextprotocol/server-google-maps`) — geocoding, distance matrix, directions, travel time
- `open-brain` — look up contact addresses, save generated itinerary

## Steps

### 1. Gather Inputs
- If the user provides explicit stops/times, use those directly.
- If the user says "plan my day" or similar, fetch today's calendar events that have a `location` field via `google-calendar`.
- For any location that looks like a contact name (not an address), look it up in `open-brain` before geocoding.
- If any location is ambiguous, ask the user to clarify before proceeding. Never assume.

### 2. Geocode All Locations
- Use Google Maps MCP to geocode each address into lat/lng coordinates.
- Confirm each resolved address with the user if there is any ambiguity.

### 3. Determine Transport Mode
- Default: **driving**.
- If the user has not specified a mode, note the default and offer to recalculate for walking or transit.

### 4. Calculate Travel Times
- Use the Google Maps Distance Matrix to get travel time and distance between all sequential stops (in fixed-order schedules) or all pairs (if optimizing order).

### 5. Optimize Order (if times are not fixed)
- If the user's stops have no fixed start times, suggest the sequence that minimizes total travel time.
- If meeting times are fixed, keep the order and calculate travel time between sequential stops.
- Flag any leg where the available transit window is shorter than the calculated travel time + 15 min buffer.

### 6. Apply Buffer Time
- Add a **15-minute buffer** between arrival and meeting start at each stop.
- This buffer is configurable — if the user specifies a different buffer, use that value throughout.

### 7. Format Output

Use this exact structure:

```
## Itinerary — [Weekday, Day Month Year]

[HH:MM] Depart [Location A]
  → [X min drive] ([distance, km or m])
[HH:MM] Arrive [Location B] (15 min buffer)
[HH:MM] Meeting: [Title] at [Location B]
  Duration: [X min]
[HH:MM] Depart [Location B]
  → [X min drive] ([distance])
[HH:MM] Arrive [Location C] (15 min buffer)
[HH:MM] Meeting: [Title] at [Location C]
  Duration: [X min]
...

Total travel time: [X hr Y min]
Total distance: [X km]
```

- All times in **CLT (Chile Standard Time, UTC-3)**.
- Keep output to one screen — if the schedule is long, omit blank lines between legs.

### 8. Weather Note (optional)
- If any stop appears to be an outdoor venue, check current weather conditions if a weather tool is available and append a one-line note below that stop.

### 9. Save to Open Brain
- Save the final itinerary to Open Brain with:
  - `tags: ['itinerary', '<YYYY-MM-DD>', 'travel']`
  - Title: `Itinerary — [Date]`
  - Body: the formatted schedule from Step 7.

## Fallback Behavior
- If `google-maps` MCP is unavailable, generate the schedule without travel times and add this note at the top:
  > ⚠ Google Maps unavailable — travel times not calculated.
- If `open-brain` save fails, display the itinerary to the user and note that saving failed.

## Rules
- Never assume a location — verify with the user or calendar data.
- Never fabricate travel times. Only report what the Maps MCP returns.
- Always confirm the transport mode before finalizing.
- Output must be scannable — avoid prose paragraphs in the schedule block.
