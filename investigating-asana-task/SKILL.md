---
name: investigating-asana-task
description: Use when the user pastes an Asana task URL (app.asana.com/.../task/<id>) or asks to investigate, summarize, or pull context from an Asana task — fetches task details, comments (stories), and attachments via the Asana REST API so you can investigate.
---

# Investigating an Asana Task

## Overview

When the user pastes an Asana task URL, run `fetch-asana-task.js` to pull the task body, full comment thread, and attachment list from the Asana API. Then read the output and investigate — the script gathers facts; you do the analysis.

## When to Use

- User pastes an `app.asana.com/.../task/<id>` URL
- User says "investigate this Asana task", "what's in this Asana ticket", "summarize this Asana task"
- You need context on an Asana task referenced in a conversation, commit, or PR

## Prerequisites

`ASANA_ACCESS_TOKEN` (a Personal Access Token from https://app.asana.com/0/my-apps). The script looks in this order:

1. Process env (`export ASANA_ACCESS_TOKEN=...`)
2. `~/.claude/skills/investigating-asana-task/.env` — recommended for persistence
3. `./.env` in the current working directory

`.env` format: `ASANA_ACCESS_TOKEN=2/...` (one per line, `#` comments allowed, optional `export` prefix and quotes). Process env wins over `.env`. If missing, ask the user to set it before running.

## How to Use

1. Run the script with the URL the user pasted:
   ```bash
   node ~/.claude/skills/investigating-asana-task/fetch-asana-task.js "<asana-url>"
   ```
   The script accepts either the new (`/1/<ws>/project/<p>/task/<id>`) or legacy (`/0/<p>/<id>`) URL formats, or a bare task GID.

2. Read the output — it prints task metadata (name, assignee, status, due date, projects, tags, custom fields, description), the full comment stream in chronological order, and the attachment list with download URLs.

3. Investigate. Look for:
   - **What is being asked?** Read the description and the most recent comments.
   - **Decisions and blockers** in the comment thread.
   - **Linked context** — PR/commit links, other Asana task links, attached files.
   - **Status drift** — completion state vs. what comments say.

4. Report back to the user with a concise summary and your investigation findings, plus follow-up questions or next steps. Cite comment authors and dates when quoting.

## Output Sections

The script prints, in order:
- `## Task` — name, permalink, assignee, status, dates, projects, tags, parent, custom fields
- `## Description` — `notes` field (plaintext)
- `## Comments` — every story of subtype `comment_added`, oldest first, with author and timestamp
- `## Activity` — non-comment stories (status changes, assignments) — useful for audit trail
- `## Attachments` — name, host, size, view URL, download URL

## Common Mistakes

- **Forgetting to investigate** — the script's job is to fetch; your job is to read and synthesize. Don't just dump the output back to the user.
- **Downloading attachments unprompted** — list them, but only fetch contents if the user asks or the investigation requires it. Asana download URLs are short-lived signed URLs.
- **Treating activity stories as comments** — only `resource_subtype: comment_added` stories are user-written comments. The rest is Asana's audit log.
