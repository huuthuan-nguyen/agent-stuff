---
name: investigating-asana-task
description: Use when the user pastes an Asana task URL (app.asana.com/.../task/<id>), asks to investigate/summarize/pull context from an Asana task, or asks to post a comment on an Asana task — fetches task details, comments (stories), and attachments via the Asana REST API, and can also POST a new comment back to the task.
---

# Investigating an Asana Task

## Overview

`fetch-asana-task.js` has two modes against the Asana REST API:

- **Fetch (default):** pulls task body, full comment thread, and attachment list. Use this to investigate.
- **Comment (`--comment` / `--comment-file`):** POSTs a new comment to the task's story stream.

The script gathers/sends facts; you do the analysis and draft the comment text.

## When to Use

- User pastes an `app.asana.com/.../task/<id>` URL
- User says "investigate this Asana task", "what's in this Asana ticket", "summarize this Asana task"
- User asks to "comment on", "post a comment to", "reply to", or "update" an Asana task
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

## Posting a Comment

Posting writes to a shared work ticket — **always show the user the draft text first and wait for explicit approval** before running the command. Don't include secrets, internal credentials, or unrelated context.

Two ways to send the text:

```bash
# Short, single-line:
node ~/.claude/skills/investigating-asana-task/fetch-asana-task.js "<asana-url-or-gid>" --comment "Your message"

# Multi-line / contains quotes / long: write to a temp file and pass --comment-file
printf '%s\n' 'Line one' 'Line two' > /tmp/asana-comment.txt
node ~/.claude/skills/investigating-asana-task/fetch-asana-task.js "<asana-url-or-gid>" --comment-file /tmp/asana-comment.txt
```

The script POSTs to `/tasks/<gid>/stories` and prints the new story gid + created timestamp on success. Asana renders comment text as plaintext (with auto-linking of URLs) — don't bother with markdown.

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
