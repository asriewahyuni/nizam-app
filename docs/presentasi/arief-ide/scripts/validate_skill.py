#!/usr/bin/env python3
"""Validate .agents/skills/*/SKILL.md files.

Checks:
  1. SKILL.md exists in each skill directory
  2. File starts with YAML frontmatter (--- ... ---)
  3. Frontmatter is valid YAML
  4. Required fields present: name, description
  5. `name` matches the parent directory name
  6. `allowed-tools` (if present) uses recognized tool names
  7. `triggers` (if present) uses valid values (user, model)
  8. `model` (if present) uses a recognized model name
  9. `subagent` (if present) is boolean
 10. Body (prompt content) is non-empty after frontmatter

Exit code: 0 if all skills valid, 1 if any validation fails.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("::error::PyYAML not installed. Run: pip install pyyaml")
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = REPO_ROOT / ".agents" / "skills"

VALID_TOOLS = {
    "read", "edit", "grep", "glob", "exec",
    "web_search", "webfetch", "ask_user_question",
    "browser_preview", "close_browser_preview",
    "write", "notebook_edit", "notebook_read",
    "todo_write", "run_subagent", "read_subagent",
    "write_to_process", "kill_shell", "get_output",
    "request_scope", "skill", "mcp_call_tool",
    "mcp_list_servers", "mcp_list_tools", "mcp_read_resource",
    "find_file_by_name",
}

VALID_TRIGGERS = {"user", "model"}

VALID_MODELS = {
    "opus", "sonnet", "swe", "codex",
    "haiku", "glmlong", "glmhigh", "glm",
}

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)\Z", re.DOTALL)


def error(path: Path, msg: str) -> None:
    rel = path.relative_to(REPO_ROOT) if path.is_absolute() else path
    print(f"::error file={rel}::{msg}")

def warn(path: Path, msg: str) -> None:
    rel = path.relative_to(REPO_ROOT) if path.is_absolute() else path
    print(f"::warning file={rel}::{msg}")

def ok(path: Path, msg: str) -> None:
    rel = path.relative_to(REPO_ROOT) if path.is_absolute() else path
    print(f"::notice file={rel}::{msg}")


def validate_skill(skill_dir: Path) -> bool:
    """Validate a single skill directory. Returns True if valid."""
    skill_md = skill_dir / "SKILL.md"
    valid = True

    if not skill_md.exists():
        error(skill_md, "SKILL.md not found in skill directory")
        return False

    text = skill_md.read_text(encoding="utf-8")

    # 1. Frontmatter present
    match = FRONTMATTER_RE.match(text)
    if not match:
        error(skill_md, "Missing YAML frontmatter (must start with '---')")
        return False

    fm_raw, body = match.group(1), match.group(2)

    # 2. Valid YAML
    try:
        fm = yaml.safe_load(fm_raw)
    except yaml.YAMLError as e:
        error(skill_md, f"Invalid YAML frontmatter: {e}")
        return False

    if not isinstance(fm, dict):
        error(skill_md, "Frontmatter must be a YAML mapping")
        return False

    # 3. Required fields
    for field in ("name", "description"):
        if field not in fm:
            error(skill_md, f"Missing required field: '{field}'")
            valid = False
        elif not isinstance(fm[field], str) or not fm[field].strip():
            error(skill_md, f"Field '{field}' must be a non-empty string")
            valid = False

    # 4. name matches directory
    name = fm.get("name")
    if isinstance(name, str) and name != skill_dir.name:
        error(skill_md, f"'name' ({name}) does not match directory name ({skill_dir.name})")
        valid = False

    # 5. allowed-tools
    allowed_tools = fm.get("allowed-tools")
    if allowed_tools is not None:
        if not isinstance(allowed_tools, list):
            error(skill_md, "'allowed-tools' must be a list")
            valid = False
        else:
            for tool in allowed_tools:
                if not isinstance(tool, str):
                    error(skill_md, f"'allowed-tools' entry must be string: {tool!r}")
                    valid = False
                    continue
                if tool.startswith("mcp__"):
                    if tool.count("__") < 2:
                        warn(skill_md, f"MCP tool name looks malformed: {tool}")
                    continue
                if tool not in VALID_TOOLS:
                    warn(skill_md, f"Unrecognized tool in 'allowed-tools': {tool}")

    # 6. triggers
    triggers = fm.get("triggers")
    if triggers is not None:
        if not isinstance(triggers, list):
            error(skill_md, "'triggers' must be a list")
            valid = False
        else:
            for t in triggers:
                if t not in VALID_TRIGGERS:
                    error(skill_md, f"Invalid trigger value: {t!r} (valid: {sorted(VALID_TRIGGERS)})")
                    valid = False

    # 7. model
    model = fm.get("model")
    if model is not None:
        if not isinstance(model, str):
            error(skill_md, "'model' must be a string")
            valid = False
        elif model not in VALID_MODELS:
            warn(skill_md, f"Unrecognized model: {model!r} (known: {sorted(VALID_MODELS)})")

    # 8. subagent
    subagent = fm.get("subagent")
    if subagent is not None and not isinstance(subagent, bool):
        error(skill_md, "'subagent' must be a boolean")
        valid = False

    # 9. agent must be string if present
    agent = fm.get("agent")
    if agent is not None and not isinstance(agent, str):
        error(skill_md, "'agent' must be a string")
        valid = False

    # 10. permissions structure
    perms = fm.get("permissions")
    if perms is not None:
        if not isinstance(perms, dict):
            error(skill_md, "'permissions' must be a mapping")
            valid = False
        else:
            for key in perms:
                if key not in {"allow", "deny", "ask"}:
                    warn(skill_md, f"Unknown permissions key: {key!r}")

    # 11. Non-empty body
    if not body.strip():
        error(skill_md, "Skill body (prompt content) is empty after frontmatter")
        valid = False

    # 12. argument-hint must be string if present
    hint = fm.get("argument-hint")
    if hint is not None and not isinstance(hint, str):
        error(skill_md, "'argument-hint' must be a string")
        valid = False

    if valid:
        ok(skill_md, f"Skill '{fm.get('name', skill_dir.name)}' is valid")
    return valid


def main() -> int:
    if not SKILLS_ROOT.exists():
        print(f"::error::Skills root not found: {SKILLS_ROOT}")
        return 1

    skill_dirs = sorted(p for p in SKILLS_ROOT.iterdir() if p.is_dir())
    if not skill_dirs:
        print(f"::warning::No skill directories found under {SKILLS_ROOT}")
        return 0

    all_valid = True
    for skill_dir in skill_dirs:
        if not validate_skill(skill_dir):
            all_valid = False

    print()
    if all_valid:
        print(f"::notice::All {len(skill_dirs)} skill(s) valid")
        print(f"PASS: {len(skill_dirs)} skill(s) validated successfully")
        return 0
    print(f"::error::Validation failed for one or more skills")
    print(f"FAIL: validation errors above")
    return 1


if __name__ == "__main__":
    sys.exit(main())
