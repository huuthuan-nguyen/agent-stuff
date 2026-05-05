#!/usr/bin/env node
// Fetch an Asana task's details, comments, and attachments.
// Usage: node fetch-asana-task.js <asana-url-or-gid>
// Requires: ASANA_ACCESS_TOKEN — read from process env, or from a .env file in
// the skill directory or the current working directory (process env wins).
// PAT: https://app.asana.com/0/my-apps

const fs = require("node:fs");
const path = require("node:path");

const API = "https://app.asana.com/api/1.0";

function loadDotenv() {
  const candidates = [
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env"),
  ];
  for (const file of candidates) {
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      let key = line.slice(0, eq).trim();
      if (key.startsWith("export ")) key = key.slice(7).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
loadDotenv();

function extractTaskGid(input) {
  if (/^\d+$/.test(input)) return input;
  // New format: https://app.asana.com/1/<ws>/project/<p>/task/<id>?...
  let m = input.match(/\/task\/(\d+)/);
  if (m) return m[1];
  // Legacy format: https://app.asana.com/0/<project>/<task>
  m = input.match(/app\.asana\.com\/0\/\d+\/(\d+)/);
  if (m) return m[1];
  // Inbox-style: /0/<task>/<task>
  m = input.match(/\/(\d{10,})(?:[/?#]|$)/);
  if (m) return m[1];
  return null;
}

async function asanaGet(path, token, opts = {}) {
  const url = new URL(API + path);
  if (opts.optFields) url.searchParams.set("opt_fields", opts.optFields);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  const all = [];
  let next = url.toString();
  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Asana API ${res.status} on ${next}\n${body}`);
    }
    const json = await res.json();
    if (Array.isArray(json.data)) all.push(...json.data);
    else return json.data;
    if (json.next_page && json.next_page.uri) next = json.next_page.uri;
    else next = null;
  }
  return all;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function fmtSize(bytes) {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: fetch-asana-task.js <asana-url-or-gid>");
    process.exit(2);
  }
  const token = process.env.ASANA_ACCESS_TOKEN || process.env.ASANA_PAT;
  if (!token) {
    console.error("Missing ASANA_ACCESS_TOKEN env var. Create a PAT at https://app.asana.com/0/my-apps");
    process.exit(2);
  }
  const gid = extractTaskGid(arg);
  if (!gid) {
    console.error(`Could not extract task GID from: ${arg}`);
    process.exit(2);
  }

  const taskFields = [
    "name", "notes", "completed", "completed_at", "created_at", "modified_at",
    "due_on", "due_at", "start_on", "start_at",
    "assignee.name", "assignee.email",
    "followers.name",
    "projects.name",
    "parent.name", "parent.gid",
    "tags.name",
    "num_subtasks",
    "permalink_url",
    "workspace.name",
    "custom_fields.name", "custom_fields.display_value", "custom_fields.type",
    "memberships.section.name", "memberships.project.name",
    "resource_subtype",
  ].join(",");

  const storyFields = [
    "type", "resource_subtype", "created_at", "created_by.name",
    "text", "html_text", "is_pinned",
  ].join(",");

  const attachmentFields = [
    "name", "download_url", "view_url", "host", "size",
    "created_at", "resource_subtype", "parent.name",
  ].join(",");

  const [task, stories, attachments] = await Promise.all([
    asanaGet(`/tasks/${gid}`, token, { optFields: taskFields }),
    asanaGet(`/tasks/${gid}/stories`, token, { optFields: storyFields, limit: 100 }),
    asanaGet(`/tasks/${gid}/attachments`, token, { optFields: attachmentFields, limit: 100 }),
  ]);

  // Task
  console.log(`## Task`);
  console.log(`- name: ${task.name}`);
  console.log(`- gid: ${task.gid}`);
  console.log(`- permalink: ${task.permalink_url || "—"}`);
  console.log(`- workspace: ${task.workspace?.name || "—"}`);
  console.log(`- status: ${task.completed ? `completed at ${fmtDate(task.completed_at)}` : "open"}`);
  console.log(`- assignee: ${task.assignee ? `${task.assignee.name}${task.assignee.email ? ` <${task.assignee.email}>` : ""}` : "unassigned"}`);
  console.log(`- created: ${fmtDate(task.created_at)}`);
  console.log(`- modified: ${fmtDate(task.modified_at)}`);
  const due = task.due_at || task.due_on;
  console.log(`- due: ${due ? (task.due_at ? fmtDate(task.due_at) : task.due_on) : "—"}`);
  const start = task.start_at || task.start_on;
  if (start) console.log(`- start: ${task.start_at ? fmtDate(task.start_at) : task.start_on}`);
  console.log(`- projects: ${(task.projects || []).map(p => p.name).join(", ") || "—"}`);
  if (task.memberships?.length) {
    const m = task.memberships
      .map(x => `${x.project?.name || "?"}${x.section?.name ? ` / ${x.section.name}` : ""}`)
      .join("; ");
    console.log(`- memberships: ${m}`);
  }
  console.log(`- tags: ${(task.tags || []).map(t => t.name).join(", ") || "—"}`);
  console.log(`- followers: ${(task.followers || []).map(f => f.name).join(", ") || "—"}`);
  console.log(`- parent: ${task.parent ? `${task.parent.name} (${task.parent.gid})` : "—"}`);
  console.log(`- subtasks: ${task.num_subtasks ?? 0}`);
  if (task.custom_fields?.length) {
    console.log(`- custom fields:`);
    for (const cf of task.custom_fields) {
      if (cf.display_value == null || cf.display_value === "") continue;
      console.log(`  - ${cf.name}: ${cf.display_value}`);
    }
  }

  // Description
  console.log(`\n## Description`);
  console.log(task.notes && task.notes.trim() ? task.notes : "_(empty)_");

  // Comments
  const comments = (stories || []).filter(s => s.resource_subtype === "comment_added");
  const activity = (stories || []).filter(s => s.resource_subtype !== "comment_added");

  console.log(`\n## Comments (${comments.length})`);
  if (!comments.length) console.log("_(none)_");
  for (const c of comments) {
    console.log(`\n### ${c.created_by?.name || "unknown"} — ${fmtDate(c.created_at)}${c.is_pinned ? " [pinned]" : ""}`);
    console.log(c.text?.trim() || "_(empty)_");
  }

  // Activity (audit trail)
  console.log(`\n## Activity (${activity.length})`);
  if (!activity.length) console.log("_(none)_");
  for (const a of activity) {
    console.log(`- ${fmtDate(a.created_at)} — ${a.created_by?.name || "system"}: ${a.text || a.resource_subtype}`);
  }

  // Attachments
  console.log(`\n## Attachments (${(attachments || []).length})`);
  if (!attachments?.length) console.log("_(none)_");
  for (const a of attachments) {
    console.log(`- ${a.name} [${a.host || "?"}, ${fmtSize(a.size)}, ${fmtDate(a.created_at)}]`);
    if (a.view_url) console.log(`  view: ${a.view_url}`);
    if (a.download_url) console.log(`  download: ${a.download_url}`);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
