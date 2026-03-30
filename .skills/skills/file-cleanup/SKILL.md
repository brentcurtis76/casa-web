# Skill: File Cleanup

## Trigger

### Trigger Phrases
- "clean up files" / "file cleanup"
- "organize downloads" / "my downloads are a mess"
- "tidy my desktop" / "clear my desktop"
- "what junk files do I have"
- "sort my files" / "clean up my downloads"
- `/file-cleanup`

### When NOT to Trigger
- User wants to organize code or project files in GENERA or CASA → use **genera-project** or **casa-project** skill; `~/SecondBrain` is never touched by this skill
- User asks about a specific file or document (not a bulk cleanup request) → answer directly without running a full scan
- User wants to **delete** files explicitly → this skill never deletes, only moves; handle deletions manually
- User is asking about file structure inside a project directory → use project-specific skills

### Priority
This skill scans `~/Downloads`, `~/Desktop`, and top-level `~/Documents` only. It never touches `~/SecondBrain` or any project directory. For project-level file organization, use the relevant project skill.

## Required MCP Tools
- `filesystem` (`@modelcontextprotocol/server-filesystem`) — list, read, move files

## Steps

### 1. Scan Directories

Use the filesystem MCP to list files in:
- `~/Downloads`
- `~/Desktop`
- `~/Documents` (top-level only — do NOT recurse into subdirectories)

Skip:
- Hidden files and directories (names starting with `.`)
- `~/SecondBrain` entirely
- Directories — only process files

### 2. Categorize Files

For each file, determine its category by extension:

| Category | Extensions | Target |
|---|---|---|
| Images | `.jpg` `.jpeg` `.png` `.gif` `.heic` `.webp` `.svg` | `~/Pictures/Sorted/[YYYY-MM]` |
| Documents | `.pdf` `.docx` `.xlsx` `.pptx` `.txt` `.md` | `~/Documents/Sorted/[YYYY-MM]` |
| Archives | `.zip` `.tar.gz` `.dmg` `.pkg` `.iso` | `~/Documents/Installers/` (or flag for deletion) |
| Code | `.py` `.js` `.ts` `.json` `.yaml` `.yml` `.sh` `.rb` | `~/Documents/Code-Scraps/` |
| Videos | `.mp4` `.mov` `.avi` `.mkv` | `~/Movies/Sorted/[YYYY-MM]` |
| Other | anything else | Flag for manual review |

Use the file's last modified date to determine `[YYYY-MM]` for sorted destinations.

### 3. Detect Flags

For each file, note:
- **Age:** older than 30 days → higher cleanup priority (mark with `*`)
- **Size:** larger than 100 MB → flag prominently
- **Duplicates:** same filename found in multiple scanned locations → note both paths

### 4. Present Cleanup Proposal

Format the proposal exactly like this:

```
## File Cleanup Proposal — [Today's Date]

### Downloads ([X] files, [X.X] GB)
- Move [N] PDFs → ~/Documents/Sorted/2026-03/
- Move [N] images → ~/Pictures/Sorted/2026-03/
- [N] DMGs ([X] GB total) — flag for deletion after install
- ⚠ Duplicate: report.xlsx (also found on ~/Desktop)
- ⚠ Large file: bigvideo.mp4 (1.2 GB)

### Desktop ([X] files)
- Move [N] screenshots → ~/Pictures/Sorted/2026-03/
- Move [N] documents → ~/Documents/Sorted/2026-03/

### Documents Top-Level ([X] files)
- Move [N] stray files → appropriate sorted folders

### Manual Review
- [N] files with unrecognized extensions — list them

---
Total: [X] files to move, estimated [X.X] GB reorganized.

Approve all moves? Reply: yes / no / [edit specific item]
```

**NEVER move or delete anything without explicit user approval.**

### 5. Wait for User Approval

- If user says **yes** or **approve**: proceed with all moves.
- If user says **no**: do nothing, summarize what was skipped.
- If user edits (e.g. "skip the DMGs"): adjust the plan and confirm again before executing.

### 6. Execute Moves

For each approved move:
1. Use filesystem MCP to create the target directory if it does not exist.
2. Move the file using filesystem MCP tools.
3. Track successes and failures.

**Never delete files** — only move them. If a file cannot be moved, log the error and continue.

### 7. Report Results

After execution, report:

```
## Cleanup Complete

- [X] files moved
- [X.X] GB reorganized
- [X] files skipped / errors:
  - [filename]: [reason]
```

### 8. Save Summary to Open Brain

Save a cleanup summary record with:
- **Title:** `File Cleanup — [YYYY-MM-DD]`
- **Content:** the full results report (files moved, skipped, errors)
- **Tags:** `['file-cleanup', '[YYYY-MM]', 'maintenance']`

## Rules

- **NEVER delete files** — only propose moves. Deletion is manual.
- **NEVER move hidden files** (names starting with `.`).
- **NEVER touch `~/SecondBrain`** — it is managed separately.
- **Only top-level `~/Documents`** — do not recurse into subdirectories.
- **Always get explicit approval** before any file system changes.
- If the filesystem MCP is unavailable, present the full analysis as a text report and instruct the user to perform moves manually.
