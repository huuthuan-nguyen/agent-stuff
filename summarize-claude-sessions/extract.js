#!/usr/bin/env node
// Extract compact session summaries from Claude Code JSONL logs.
// Output format (line-prefixed for easy parsing/grep):
//   =D= YYYYMMDD
//   =S= <shortId> branch=<branch> repo=<repo>
//   =U= user message (text content only, system reminders stripped)
//   =A= assistant text
//   =T= ToolName: key target (file_path | command | pattern | query)
//   =E= end of session
//
// Usage:
//   extract.js [--project-dir DIR] [--date YYYY-MM-DD] [--out FILE]
//   Defaults: project-dir = cwd; writes to stdout if no --out.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}

const projectDir = arg('--project-dir', process.cwd());
const filterDate = arg('--date', null); // YYYY-MM-DD
const outPath = arg('--out', null);
const maxLineLen = parseInt(arg('--max-line', '600'), 10);

if (!fs.existsSync(projectDir)) {
  console.error(`project-dir not found: ${projectDir}`);
  process.exit(1);
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function clean(s) {
  if (typeof s !== 'string') return '';
  // Strip slash-command wrappers and local-command caveats.
  s = s.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '');
  s = s.replace(/<command-name>[\s\S]*?<\/command-name>/g, '');
  s = s.replace(/<command-message>[\s\S]*?<\/command-message>/g, '');
  s = s.replace(/<command-args>[\s\S]*?<\/command-args>/g, '');
  // Strip injected system reminders.
  s = s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  // Collapse newlines and trim.
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function truncate(s) {
  if (!s) return '';
  if (s.length <= maxLineLen) return s;
  return s.slice(0, maxLineLen) + '…';
}

// Files that are session main logs (not sub-agent traces).
const allFiles = fs.readdirSync(projectDir)
  .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))
  .map(f => {
    const p = path.join(projectDir, f);
    const st = fs.statSync(p);
    return { path: p, mtime: st.mtime, name: f };
  });

// Group by date (mtime YYYYMMDD).
const byDate = new Map();
for (const f of allFiles) {
  const d = ymd(f.mtime);
  if (filterDate && d !== filterDate.replace(/-/g, '')) continue;
  if (!byDate.has(d)) byDate.set(d, []);
  byDate.get(d).push(f);
}

const dates = [...byDate.keys()].sort();
const out = [];

function summarizeSession(file) {
  const lines = fs.readFileSync(file.path, 'utf8').split('\n').filter(Boolean);
  let branch = '';
  let cwd = '';
  let sessionId = '';
  const events = []; // {kind, text}

  for (const raw of lines) {
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }
    if (obj.gitBranch && !branch) branch = obj.gitBranch;
    if (obj.cwd && !cwd) cwd = obj.cwd;
    if (obj.sessionId && !sessionId) sessionId = obj.sessionId;

    if (obj.type === 'user' && obj.message) {
      const c = obj.message.content;
      if (typeof c === 'string') {
        const t = clean(c);
        if (t) events.push({ kind: 'U', text: t });
      } else if (Array.isArray(c)) {
        // Skip tool_results and images. Keep human-typed text blocks.
        for (const block of c) {
          if (block && block.type === 'text' && block.text) {
            const t = clean(block.text);
            if (t) events.push({ kind: 'U', text: t });
          }
        }
      }
    } else if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
      for (const block of obj.message.content) {
        if (!block) continue;
        if (block.type === 'text' && block.text) {
          const t = clean(block.text);
          if (t) events.push({ kind: 'A', text: t });
        } else if (block.type === 'tool_use') {
          const inp = block.input || {};
          const target = inp.file_path || inp.command || inp.pattern || inp.query
            || inp.url || inp.notebook_path || inp.path || '';
          const text = `${block.name}: ${typeof target === 'string' ? target : JSON.stringify(target)}`;
          events.push({ kind: 'T', text });
        }
      }
    }
  }

  const repo = cwd ? path.basename(cwd) : '';
  const shortId = (sessionId || file.name.replace('.jsonl', '')).slice(0, 8);

  const sessOut = [];
  sessOut.push(`=S= ${shortId} branch=${branch || '?'} repo=${repo || '?'}`);
  for (const e of events) {
    sessOut.push(`=${e.kind}= ${truncate(e.text)}`);
  }
  sessOut.push('=E=');
  return { repo, sessOut };
}

for (const d of dates) {
  const files = byDate.get(d).sort((a, b) => a.mtime - b.mtime);
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
