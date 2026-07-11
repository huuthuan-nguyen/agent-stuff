#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_SKILLS_DIR="${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"
CLAUDE_COMMANDS_DIR="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"

mkdir -p "$AGENTS_SKILLS_DIR" "$CLAUDE_COMMANDS_DIR"

initialize_submodules() {
  if [[ -f "$ROOT_DIR/.gitmodules" ]]; then
    git -C "$ROOT_DIR" submodule update --init --recursive
  fi
}

install_skill() {
  local skill_dir="$1"
  local name

  [[ -f "$skill_dir/SKILL.md" ]] || return 0

  name="$(basename "$skill_dir")"
  rm -rf "$AGENTS_SKILLS_DIR/$name"
  cp -R "$skill_dir" "$AGENTS_SKILLS_DIR/$name"
  printf 'Installed skill: %s\n' "$AGENTS_SKILLS_DIR/$name"
}

install_skills() {
  local source_dir="$ROOT_DIR/skills"
  local entry skill_dir

  # Support skills stored directly in this repository.
  for entry in "$source_dir"/*; do
    [[ -d "$entry" ]] || continue
    install_skill "$entry"

    # A CLI submodule may publish one or more agent skills here.
    for skill_dir in "$entry/skills"/*; do
      [[ -d "$skill_dir" ]] || continue
      install_skill "$skill_dir"
    done
  done
}

install_prompts() {
  local source_dir="$ROOT_DIR/prompts"
  local prompt_dir name

  for prompt_dir in "$source_dir"/*; do
    [[ -d "$prompt_dir" ]] || continue
    [[ -f "$prompt_dir/SKILL.md" ]] || {
      printf 'Skipping %s: no SKILL.md found\n' "$prompt_dir" >&2
      continue
    }

    name="$(basename "$prompt_dir")"
    cp "$prompt_dir/SKILL.md" "$CLAUDE_COMMANDS_DIR/$name.md"
    printf 'Installed prompt: %s\n' "$CLAUDE_COMMANDS_DIR/$name.md"
  done
}

initialize_submodules
install_skills
install_prompts
