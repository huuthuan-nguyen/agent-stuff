#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_AGENT_SKILLS_DIR="${PI_AGENT_SKILLS_DIR:-$HOME/.pi/agent/skills}"
PI_AGENT_PROMPTS_DIR="${PI_AGENT_PROMPTS_DIR:-$HOME/.pi/agent/prompts}"
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
CLAUDE_COMMANDS_DIR="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"

mkdir -p \
  "$PI_AGENT_SKILLS_DIR" \
  "$PI_AGENT_PROMPTS_DIR" \
  "$CLAUDE_SKILLS_DIR" \
  "$CLAUDE_COMMANDS_DIR"

initialize_submodules() {
  if [[ -f "$ROOT_DIR/.gitmodules" ]]; then
    git -C "$ROOT_DIR" submodule update --init --recursive
  fi
}

install_skill_to() {
  local skill_dir="$1"
  local destination_dir="$2"
  local name

  [[ -f "$skill_dir/SKILL.md" ]] || return 0

  name="$(basename "$skill_dir")"
  rm -rf "$destination_dir/$name"
  cp -R "$skill_dir" "$destination_dir/$name"
  printf 'Installed skill: %s\n' "$destination_dir/$name"
}

install_skill() {
  local skill_dir="$1"

  install_skill_to "$skill_dir" "$PI_AGENT_SKILLS_DIR"
  install_skill_to "$skill_dir" "$CLAUDE_SKILLS_DIR"
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

install_prompt_to() {
  local source_file="$1"
  local destination_file="$2"

  # Replace existing files or symlinks instead of following them.
  rm -f "$destination_file"
  cp "$source_file" "$destination_file"
  printf 'Installed prompt: %s\n' "$destination_file"
}

install_prompts() {
  local source_dir="$ROOT_DIR/prompts"
  local prompt_file name

  for prompt_file in "$source_dir"/*.md; do
    [[ -f "$prompt_file" ]] || continue

    name="$(basename "$prompt_file")"
    install_prompt_to "$prompt_file" "$PI_AGENT_PROMPTS_DIR/$name"
    install_prompt_to "$prompt_file" "$CLAUDE_COMMANDS_DIR/$name"
  done
}

initialize_submodules
install_skills
install_prompts
