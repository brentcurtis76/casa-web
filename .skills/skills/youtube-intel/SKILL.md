---
name: youtube-intel
description: >
  Daily YouTube intelligence scanner that monitors AI/dev channels for new videos,
  extracts transcripts, and critically analyzes whether anything is genuinely useful
  for Brent's pipeline, memory system, or workflow. Use this skill when the user asks
  about new YouTube content, wants to check channels for updates, mentions "youtube intel",
  "any new videos", "check my channels", "youtube digest", "what are the AI channels saying",
  or when generating the daily briefing. Also trigger when the user references any of the
  monitored channels (Nate Herk, MetalSole, Nate B Jones, AI Code King, AI Labs, Chase H AI,
  RAmjad). This skill should run daily as part of the morning briefing pipeline.
---

# YouTube Intel Scanner

Monitors a curated list of AI/dev YouTube channels, extracts transcripts from new videos, and critically filters for insights that would genuinely improve Brent's systems — the Jake Pipeline, Open Brain memory, multi-vendor LLM routing, or day-to-day workflow.

The key word is **critically**. Most YouTube content is hype, rehashed tutorials, or clickbait. This skill's job is to cut through the noise and surface only the 5-10% that contains genuinely actionable intelligence.

## Monitored Channels

| Handle | Focus |
|--------|-------|
| @nateherk | AI coding workflows, Claude Code |
| @MetalSole | AI dev tools, automation |
| @NateBJones | Claude Code, agentic coding |
| @AICodeKing | AI-assisted development |
| @AILABS-393 | AI engineering, research |
| @Chase-H-AI | AI workflows, productivity |
| @RAmjad | AI platforms, Replit CEO |

## How It Works

### Automated Daily Run (via scheduled task)

The script `scripts/youtube_intel.py` handles everything autonomously:

1. **Fetch recent videos** — uses `yt-dlp` to list videos from each channel published in the last 48 hours
2. **Skip already-analyzed** — checks `~/SecondBrain/data/youtube-intel/analyzed.json` to avoid re-processing
3. **Extract transcripts** — uses `youtube-transcript-api` to pull auto-generated captions
4. **Critical analysis** — sends each transcript to Haiku with strict relevance criteria (see below)
5. **Save findings** — writes actionable findings to `~/SecondBrain/data/youtube-intel/findings.json`
6. **Daily briefing picks it up** — the morning briefing reads the latest findings

### On-Demand Run

When Brent asks to check channels manually:

1. Run the script: `cd ~/SecondBrain && python .skills/skills/youtube-intel/scripts/youtube_intel.py`
2. Read the latest findings from `~/SecondBrain/data/youtube-intel/findings.json`
3. Present only the findings rated "high" or "medium" relevance
4. Include the video link for each finding
5. Ask Brent: "Want to implement any of these?"
6. If yes, post bridge tasks (see "Act on Findings" below)

### Integration with Daily Briefing

The daily briefing should include a "YouTube Intel" section **only if there are new findings** from the last 24 hours. If there's nothing worth surfacing, skip the section entirely — don't pad the briefing with filler.

Format for daily briefing:
```
### YouTube Intel
- [Video Title](link) — Channel Name
  Key insight: [1-2 sentence summary of what's actionable]
  Relevant to: [pipeline / memory / workflow / routing]

Want to implement any of these?
```

### Act on Findings

After presenting findings (whether in the daily briefing or on-demand), ask Brent if he wants to implement any of them. If he says yes:

1. For each selected finding, create a bridge task:
   - **Title**: "Implement YouTube insight: [short description of the technique/pattern]"
   - **Prompt**: Include the full context — what the video demonstrated, the specific technique to implement, which system it affects (pipeline, memory, routing, workflow), and what files are likely involved
   - **Project**: Route based on `relevant_to` — pipeline/memory/routing improvements go to `project='life'` (SecondBrain), project-specific insights go to `'genera'` or `'casa'`
2. Post via `bridge_post_task` and follow up with `bridge_wait_for_task`
3. Report the result back to Brent

## Critical Analysis Criteria

When analyzing a transcript, apply these filters ruthlessly:

### INCLUDE (high relevance) — specific techniques or patterns that could directly improve:
- **Pipeline work**: Multi-agent orchestration patterns, agent prompt engineering, task decomposition strategies, code review automation, CI/CD with AI
- **Memory work**: RAG improvements, vector search optimization, context window management, memory persistence patterns, pgvector techniques
- **LLM routing**: Multi-vendor strategies, model selection heuristics, fallback patterns, cost optimization, latency reduction
- **Workflow**: Claude Code tips that would save real time, MCP server patterns, automation techniques, VS Code integration improvements

### EXCLUDE (noise) — skip entirely, do not mention:
- Generic "how to use ChatGPT" content
- Product announcements without technical depth
- Tutorials covering basics Brent already knows (Next.js setup, basic Supabase, etc.)
- Hype videos ("AI will replace all developers!")
- Content that's just a rehash of documentation
- Videos under 3 minutes (usually shorts/teasers with no substance)

### Relevance Rating
- **high**: Contains a specific technique, pattern, or tool that could be implemented in Brent's systems within a week
- **medium**: Contains an interesting concept worth keeping in mind but not immediately actionable
- **low**: Marginally relevant — only include in weekly digest, not daily briefing
- **none**: Skip entirely

## Dependencies

- `yt-dlp` — for listing channel videos (`pip install yt-dlp`)
- `youtube-transcript-api` — for transcript extraction (`pip install youtube-transcript-api`)
- `llm_clients.py` — for Haiku analysis (already in SecondBrain)

## Data Storage

All data lives in `~/SecondBrain/data/youtube-intel/`:
- `analyzed.json` — set of video IDs already processed (prevents re-analysis)
- `findings.json` — latest findings with relevance ratings, summaries, and links
- `transcripts/` — raw transcripts cached for reference (auto-pruned after 30 days)

## Adding/Removing Channels

To modify the channel list, edit the `CHANNELS` list in `scripts/youtube_intel.py`. No other files need to change.
