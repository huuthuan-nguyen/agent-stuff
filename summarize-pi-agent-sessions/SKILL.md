---
name: summarize-pi-agent-sessions
description: Use when the user asks to summarize pi-agent / pi / qwen / alibaba agent sessions, distill ~/.pi/agent/sessions/ JSONL logs into per-day markdown notes, or build a brain/diary entry for non-Claude agent runs. Output format matches summarize-claude-sessions so notes from both tools can sit side-by-side.
---

# Summarize pi-agent Sessions

## Overview

Distills the JSONL conversation logs the **pi-agent** CLI keeps under `~/.pi/agent/sessions/<encoded-cwd>/<TIMESTAMP>_<uuid>.jsonl` into one concise markdown file per day, written to `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` (e.g. `2026/May/06/20260506_agent-web.md`).

Output uses the **same `Issue → Research → Root cause → User feedback → Fix` template, same line-prefixed extraction format, and same `YYYY/Mon/DD/` folder layout** as `summarize-claude-sessions`, so notes from Claude Code and pi-agent sessions live side-by-side in the brain directory and grep the same way.

The month segment is the 3-letter English abbreviation (`Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`).

## When to Use

- User mentions "pi-agent", "pi sessions", "qwen sessions", "alibaba agent", or points at `~/.pi/agent/sessions/`.
- User wants to summarize work done with a non-Claude agent and merge into the same brain notes.

**Don't use** for Claude Code sessions — those live under `~/.claude/projects/` and have a different schema. Use `summarize-claude-sessions` for those.

## Format Differences vs. Claude Code

| Aspect | Claude Code | pi-agent |
|---|---|---|
| Top-level event | one row per turn, `type: "user" \| "assistant"` | one row per turn, `type: "session" \| "model_change" \| "thinking_level_change" \| "message"` |
| Role location | top-level `type` | `message.role` (`user` / `assistant` / `toolResult`) |
| Tool calls | `content[].type === "tool_use"` | `content[].type === "toolCall"` (camelCase) |
| Tool result | `type: "user"` with `tool_result` block | top-level message with `role: "toolResult"` |
| File-path arg | `input.file_path` | `arguments.path` (sometimes `file_path`) |
| Bash arg | `input.command` | `arguments.command` |
| Thinking | not in log | inline `content[].type === "thinking"` (dropped from summary) |
| Branch | `gitBranch` field on every row | not recorded — emitted as `?` |
| Date source | file mtime | filename prefix `YYYY-MM-DDT…` (more reliable) |

The extraction script normalises these into the same `=D= / =S= / =U= / =A= / =T= / =E=` line format.

## ⚠️ macOS TCC Note

`/Users/dt/.pi/` is often blocked by macOS TCC (Transparency, Consent, Control) for Claude Code's process — reads return `Operation not permitted` even with sandbox disabled. If the script fails with that error:

1. Ask the user to grant Claude Code "Full Disk Access" (System Settings → Privacy & Security → Full Disk Access), **OR**
2. Have the user `cp -R ~/.pi/agent/sessions /tmp/pi-sessions` and pass `--sessions-dir /tmp/pi-sessions`.

Don't silently drop the dates that fail — surface the access issue so the user can fix it.

## Workflow

1. **Resolve sessions dir.** Default `~/.pi/agent/sessions/`. Override with `--sessions-dir`.
2. **Optionally narrow project.** pi-agent layout is `<sessions-dir>/<encoded-project>/`. Pass `--project --Users-dt-code-agent-web--` to filter.
3. **Resolve output dir.** Read `BRAIN_OUTDIR` from `<skill-dir>/.env` (i.e. `~/.claude/skills/summarize-pi-agent-sessions/.env`). If `.env` is missing or has no `BRAIN_OUTDIR`, fall back to `/Users/dt/code/vsee/devutils/brain/` (same default as the Claude Code skill).
4. **For each date** (or just `--date YYYY-MM-DD`): run the script, read its compact output, convert the month to its 3-letter abbreviation, `mkdir -p <outdir>/YYYY/Mon/DD`, then write `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` using the standard template.
5. **For many dates**, dispatch parallel general-purpose agents — one per date.
6. **Coexistence:** if `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` already exists for the same repo (e.g. Claude Code wrote one earlier), the agent should *append* a `## (pi-agent) Session …` section rather than overwrite, so both agents' work for the same day is captured in one file. If the repos differ, write a separate file in the same dated folder.

## Extraction Script

`extract.js` (in this skill dir). Flags:

| Flag | Default | Purpose |
|---|---|---|
| `--sessions-dir DIR` | `~/.pi/agent/sessions` | pi-agent log root |
| `--project NAME` | all | Filter to one encoded-project subdir |
| `--date YYYY-MM-DD` | all | Filter by date (parsed from filename prefix) |
| `--out FILE` | stdout | Write to file instead of stdout |
| `--max-line N` | 600 | Truncate any single line over N chars |

Output line prefixes (identical to `summarize-claude-sessions`):

```
=D= 20260501
=S= <8charId> branch=? repo=<basename of cwd>
=U= user message text
=A= assistant text  (thinking blocks intentionally dropped)
=T= ToolName: <command | path | pattern | query>
=E=
```

## Markdown Template

Same as the Claude Code skill, with a `(pi-agent)` marker so the source agent is obvious in mixed-day files:

```markdown
# YYYY-MM-DD — <repo>

## (pi-agent) Session <shortId>

**Issue:** <user's request>
**Research:** <files explored, searches run>
**Root cause:** <if applicable>
**User feedback / confirmation:** <corrections, redirects, approvals>
**Fix:** <files changed + brief description; pi-agent doesn't record commits, so list edits only>

---
```

Notes specific to pi-agent:
- **No commit hashes** — pi-agent doesn't track git. Just list the files edited.
- **No branch** — omit the `(branch: …)` suffix that the Claude Code template uses.
- **Model info** — if model_change events show a notable model (e.g., `alibaba/qwen3.5-plus`), mention once at the top of the session block; otherwise skip.

## Quick Reference

```bash
# One project, one date, write to brain dir
node ~/.claude/skills/summarize-pi-agent-sessions/extract.js \
  --project --Users-dt-code-agent-web-- \
  --date 2026-05-01 \
  --out /tmp/pi-sessions-20260501.txt
mkdir -p /Users/dt/code/vsee/devutils/brain/2026/May/01
# ...then read /tmp/pi-sessions-20260501.txt and Write to
# /Users/dt/code/vsee/devutils/brain/2026/May/01/20260501_agent-web.md

# All projects, list session counts per day
node ~/.claude/skills/summarize-pi-agent-sessions/extract.js \
  | grep -E '^=D=|^=S=' \
  | awk '/^=D=/{d=$2;next} /^=S=/{c[d]++} END{for(d in c)print d, c[d]}'
```

## Common Mistakes

- **Reading raw JSONL.** Don't — pi-agent files include full `toolResult` payloads (file contents, diff blocks) that dominate size. Always go through `extract.js`.
- **Trying `mtime` for date.** pi-agent's filename prefix is the authoritative timestamp; mtime drifts when the agent appends. Script already uses the filename.
- **Including `thinking` blocks.** They're agent internal reasoning, not part of the user-facing trace. Script drops them — don't add them back.
- **Overwriting Claude Code's same-day file.** If both agents worked on the same repo on the same day, append a `## (pi-agent) Session …` block to the existing `<outdir>/YYYY/Mon/DD/YYYYMMDD_<repo>.md` file instead of overwriting.
- **Falling back to numeric month folders.** Path is `<outdir>/YYYY/Mon/DD/` (e.g. `May`, not `05`). Don't write to `YYYY/MM/DD/` — that's the old layout.
- **Forgetting the TCC permission issue.** If reads fail with `Operation not permitted`, surface it; don't pretend the day is empty.
