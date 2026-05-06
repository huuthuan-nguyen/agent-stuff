---
name: summarize-claude-sessions
description: Use when the user asks to summarize Claude Code sessions, build a session log / diary / brain dump, write per-day session summaries to markdown, or distill the .jsonl conversation history under ~/.claude/projects/ into trackable notes
---

# Summarize Claude Code Sessions

## Overview

Distills the JSONL conversation logs Claude Code keeps under `~/.claude/projects/<encoded-cwd>/` into one concise markdown file per day, written to `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` (e.g. `2026/May/06/20260506_vc-api-emr.md`), focused on **issue → research → root cause → user feedback → fix**.

The month segment is the 3-letter English abbreviation (`Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`) — file-system-friendly and easier to skim than `01..12`.

Direct reads of these JSONL files burn enormous tokens (a single session can be 1–2 MB; tool results dominate). This skill ships an extraction script (`extract.js`) that strips tool results, system reminders, and command wrappers, leaving only user prompts, assistant prose, and tool-use call signatures — typically a 95%+ size reduction.

## When to Use

- User asks to "summarize sessions", "create session brain dump", "log what we did", "tracing for later".
- User points at `~/.claude/projects/<dir>/` or the cwd is already that directory.
- User wants per-day markdown grouped by repo for retrospectives or knowledge-base.

**Don't use** for one-off "what did we just do?" recaps inside a single live session — just answer from context.

## Workflow

1. **Resolve the project dir.** If cwd is already under `~/.claude/projects/`, use it. Otherwise ask which repo or pass `--project-dir`.
2. **Resolve the output dir.** Read `BRAIN_OUTDIR` from `<skill-dir>/.env` (i.e. `~/.claude/skills/summarize-claude-sessions/.env`). If `.env` is missing or has no `BRAIN_OUTDIR`, fall back to `/Users/dt/code/vsee/devutils/brain/` and ask the user to confirm. The user can pass an explicit path to override.
3. **List dates.** Run the script without `--date` first, or use `stat` / `ls` to enumerate dates that have main session files (ignore `agent-*.jsonl` — sub-agent traces).
4. **For each date, extract → summarize → write one MD file.**
   - Run `node extract.js --project-dir <dir> --date YYYY-MM-DD --out /tmp/sessions-YYYYMMDD.txt`.
   - Read `/tmp/sessions-YYYYMMDD.txt` (compact, line-prefixed).
   - Convert the month number to its 3-letter abbreviation (`05` → `May`).
   - Create the dated folder if it doesn't exist: `mkdir -p <outdir>/YYYY/Mon/DD`.
   - Write `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` using the template below. The Write tool creates parent dirs only sometimes — run `mkdir -p` first to be safe.
5. **For large date sets (4+ days), dispatch parallel general-purpose agents** — one per date — each running the script on its own date and writing its own MD file. Token cost stays bounded because each agent only reads the extracted text, not the raw JSONL.
6. **Skip trivial sessions** ("hey", `/clear`, login errors) with a one-line note. Don't pad.

## Extraction Script

`extract.js` (in this skill dir). Flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `--project-dir DIR` | cwd | Claude Code project log dir |
| `--date YYYY-MM-DD` | all | Filter to one date (by file mtime) |
| `--out FILE` | stdout | Write to file instead of stdout |
| `--max-line N` | 600 | Truncate any single line over N chars |

**Output line prefixes:**

```
=D= 20260416           # date header
=S= <8charId> branch=<branch> repo=<repo>
=U= user message (system-reminder / slash-command wrappers stripped)
=A= assistant text
=T= ToolName: <file_path | command | pattern | query>
=E=                    # end of session
```

`agent-*.jsonl` (sub-agent traces) are excluded automatically — they would duplicate work the parent session already records.

## Markdown Template

One `## Session` block per session. Keep total file under ~250 lines per day; longer is fine if the day genuinely had multiple substantive sessions (e.g., a 4-session sprint day).

```markdown
# YYYY-MM-DD — <repo>

## Session <shortId> (branch: <branch>)

**Issue:** <user's actual request / bug report — first 1-2 user prompts that frame the work>

**Research:** <what the agent explored — key files read, searches run, things ruled out>

**Root cause:** <what was actually wrong, if a debugging session; omit otherwise>

**User feedback / confirmation:** <corrections ("no, do X instead"), redirects, approvals of unusual choices>

**Fix:** <list of files changed + one-line description per file; include commit hash and PR # if mentioned in assistant text>

---
```

## Quick Reference

```bash
# One date, extract then write summary into dated folder
node ~/.claude/skills/summarize-claude-sessions/extract.js \
  --project-dir ~/.claude/projects/-Users-dt-code-vsee-vc-api-emr \
  --date 2026-05-05 \
  --out /tmp/sessions-20260505.txt
mkdir -p /Users/dt/code/vsee/devutils/brain/2026/May/05
# ...then read /tmp/sessions-20260505.txt and Write to
# /Users/dt/code/vsee/devutils/brain/2026/May/05/20260505_vc-api-emr.md

# All dates, list session counts per day
node ~/.claude/skills/summarize-claude-sessions/extract.js \
  --project-dir ~/.claude/projects/-Users-dt-code-vsee-vc-api-emr \
  | grep -E '^=D=|^=S=' | awk '/^=D=/{d=$2;next} /^=S=/{c[d]++} END{for(d in c)print d, c[d]}'
```

## Common Mistakes

- **Reading the raw JSONL with Read.** Don't — files are 200 KB to 2 MB and 95%+ is tool-result noise. Always go through `extract.js`.
- **Including `agent-*.jsonl` traces.** Already filtered out by the script. Don't add them back manually.
- **Padding trivial sessions.** A "hey" session gets one line, not a full template block.
- **Inventing a root cause when none was found.** Omit the field if the session wasn't a debug.
- **Forgetting the repo in the filename.** Filename is `YYYYMMDD_<repo>.md`, where `<repo>` = basename of session `cwd` (the script reports it on the `=S=` line).
- **Dropping the dated folder structure.** Path is `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` (month is the 3-letter abbrev, e.g. `May`) — don't write straight into `<outdir>/`, and don't fall back to `<outdir>/YYYY/MM/DD/`. Always `mkdir -p` the dated folder before Write.
- **Over-summarizing.** The user wants enough to *trace back* later — preserve specific file paths, commit hashes, PR numbers, and concrete findings. The script already strips the bulk; don't strip more.
