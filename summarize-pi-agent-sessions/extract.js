#!/usr/bin/env node
// Extract compact session summaries from pi-agent JSONL logs.
// pi-agent stores sessions under ~/.pi/agent/sessions/<encoded-cwd>/<TIMESTAMP>_<uuid>.jsonl
// where the filename leading "YYYY-MM-DDTHH-MM-SS-mmmZ" encodes the start time.
//
// Output format (identical to summarize-claude-sessions for tool reuse):
//   =D= YYYYMMDD
//   =S= <8charId> branch=<branch> repo=<repo>
//   =U= user message text
//   =A= assistant text (thinking blocks dropped)
//   =T= ToolName: key target (command | path | pattern | query)
//   =E= end of session
//
// Usage:
//   extract.js [--sessions-dir DIR] [--project NAME] [--date YYYY-MM-DD] [--out FILE]
//   Defaults: sessions-dir = ~/.pi/agent/sessions; all projects; all dates; stdout.

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}

const sessionsDir = arg('--sessions-dir', path.join(os.homedir(), '.pi/agent/sessions'));
const projectFilter = arg('--project', null);
const filterDate = arg('--date', null); // YYYY-MM-DD
const outPath = arg('--out', null);
const maxLineLen = parseInt(arg('--max-line', '600'), 10);

if (!fs.existsSync(sessionsDir)) {
  console.error(`sessions-dir not found: ${sessionsDir}`);
  process.exit(1);
}

function clean(s) {
  if (typeof s !== 'string') return '';
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function truncate(s) {
  if (!s) return '';
  if (s.length <= maxLineLen) return s;
  return s.slice(0, maxLineLen) + '…';
}

// Date from filename: 2026-05-01T19-44-37-075Z_<uuid>.jsonl → 20260501
function dateFromFilename(name) {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

// Walk all session files (one level deep: <sessions-dir>/<project>/*.jsonl)
const allFiles = [];
for (const projDir of fs.readdirSync(sessionsDir)) {
  if (projectFilter && projDir !== projectFilter) continue;
  const fullProj = path.join(sessionsDir, projDir);
  if (!fs.statSync(fullProj).isDirectory()) continue;
  for (const f of fs.readdirSync(fullProj)) {
    if (!f.endsWith('.jsonl')) continue;
    const date = dateFromFilename(f);
    if (!date) continue;
    if (filterDate && date !== filterDate.replace(/-/g, '')) continue;
    allFiles.push({
      path: path.join(fullProj, f),
      name: f,
      date,
      project: projDir,
    });
  }
}

// Group by date
const byDate = new Map();
for (const f of allFiles) {
  if (!byDate.has(f.date)) byDate.set(f.date, []);
  byDate.get(f.date).push(f);
}

const dates = [...byDate.keys()].sort();
const out = [];

function summarizeSession(file) {
  const lines = fs.readFileSync(file.path, 'utf8').split('\n').filter(Boolean);
  let cwd = '';
  let sessionId = '';
  const events = [];

  for (const raw of lines) {
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }

    if (obj.type === 'session') {
      cwd = obj.cwd || cwd;
      sessionId = obj.id || sessionId;
      continue;
    }

    if (obj.type !== 'message' || !obj.message) continue;
    const msg = obj.message;
    const role = msg.role;

    if (role === 'user' && Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b && b.type === 'text' && b.text) {
          const t = clean(b.text);
          if (t) events.push({ kind: 'U', text: t });
        }
      }
    } else if (role === 'assistant' && Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (!b) continue;
        if (b.type === 'text' && b.text) {
          const t = clean(b.text);
          if (t) events.push({ kind: 'A', text: t });
        } else if (b.type === 'toolCall') {
          const a = b.arguments || {};
          const target = a.command || a.path || a.file_path || a.pattern
            || a.query || a.url || a.cmd || '';
          const text = `${b.name || 'tool'}: ${typeof target === 'string' ? target : JSON.stringify(target)}`;
          events.push({ kind: 'T', text });
        }
        // skip 'thinking' and 'image' blocks
      }
    }
    // skip role === 'toolResult' (output noise)
  }

  const repo = cwd ? path.basename(cwd) : (file.project.replace(/^-+/, '').replace(/-+$/, '').replace(/-/g, '/').split('/').pop() || '?');
  const shortId = (sessionId || file.name.replace('.jsonl', '')).slice(0, 8);

  const sessOut = [];
  // pi-agent has no git branch in the log; emit '?' so format stays identical
  sessOut.push(`=S= ${shortId} branch=? repo=${repo}`);
  for (const e of events) {
    sessOut.push(`=${e.kind}= ${truncate(e.text)}`);
  }
  sessOut.push('=E=');
  return { repo, sessOut };
}

for (const d of dates) {
  const files = byDate.get(d).sort((a, b) => a.name.localeCompare(b.name));
  out.push(`=D= ${d}`);
  for (const f of files) {
    const { sessOut } = summarizeSession(f);
    out.push(...sessOut);
  }
}

const result = out.join('\n') + '\n';
if (outPath) {
  fs.writeFileSync(outPath, result);
  console.error(`wrote ${result.length} bytes to ${outPath}`);
} else {
  process.stdout.write(result);
}
