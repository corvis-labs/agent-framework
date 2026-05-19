# Quick Start Guide

## Installation

```bash
npm install -g agent-framework-cli
```

## Initialize Your Project

```bash
cd /path/to/your/project
acli init
```

`acli init` prompts you to choose which AI editor platforms to target, then sets up all required directories:

```
Which AI editor platforms would you like to target? (checkbox)

  ◉ GitHub Copilot / VS Code  (.github/agents/)
  ◉ Open Plugins standard     (.agents/plugins/)
  ○ Cursor AI                 (.cursor/rules/)
  ○ Claude Code               (AGENTS.md)
  ○ Windsurf                  (.windsurf/rules/)
```

You can also pass platforms non-interactively:

```bash
acli init --platforms copilot cursor open-plugins
```

### What gets created

Depending on selected platforms:

```
.github/agents/       ← GitHub Copilot agent files
.github/skills/       ← reusable skills
.github/prompts/      ← 16 slash command prompt files
.cursor/rules/        ← Cursor .mdc rule files      (if cursor selected)
.windsurf/rules/      ← Windsurf .md rule files     (if windsurf selected)
AGENTS.md             ← Claude Code registry        (if claude selected)
.agents/plugins/      ← Open Plugins packages       (if open-plugins selected)
.specify/             ← spec-kit working directory
.agent-framework.json ← framework config (stores your platform choices)
```

## Install Dependencies

Run this once after `acli init` to install spec-kit, beads, and platform extensions:

```bash
acli setup
```

## Install Additional Agents

All 5 agents are installed automatically during `acli init`. To reinstall or add to a new platform:

```bash
acli install orchestrator
acli install architect
```

Each `acli install` emits agent files to all platforms listed in `.agent-framework.json`.

## Use in Your AI Editor

### GitHub Copilot

Open Copilot Chat and use slash commands:

```
/acli.run Build a REST API for user management
```

### Cursor

Agents are loaded automatically as rules. Reference them in chat:

```
@architect help me design the data layer for this feature
```

### Claude Code

`AGENTS.md` is loaded automatically. Claude sees all agents and their instructions on every session.

### Windsurf

Agents are active via `.windsurf/rules/` — no extra configuration needed.

---

## Full Lifecycle (any platform)

| Step | Command |
|---|---|
| Set up project constitution | `/acli.constitution` |
| Author a feature spec | `/acli.specify <feature>` |
| Resolve ambiguities | `/acli.clarify` |
| Generate implementation plan | `/acli.plan` |
| Create quality checklists | `/acli.checklist` |
| Break into tasks | `/acli.tasks` |
| Validate consistency | `/acli.analyze` |
| Implement with review loop | `/acli.implement` |

Or run the complete workflow in one command:

```
/acli.run Build a user authentication system with OAuth support
```

---

## Utility Commands

```
/acli.debug <description>   ← structured debugging
/acli.critique              ← code review
/acli.respond               ← address review feedback
/acli.finish                ← prepare branch for merge
/acli.onboard               ← bootstrap an existing codebase
```

---

## Extension Ecosystem

```bash
# See what is available
acli extensions list --available

# Install a known extension
acli extensions add brownfield

# Scaffold your own plugin
acli extensions create my-plugin
# Edit .agents/plugins/my-plugin/agents/my-plugin.agent.md
acli extensions pack my-plugin   # → my-plugin-v1.0.0.zip
```

---

## Agent Interaction

Agents are available as `@agent` mentions (Copilot, Cursor) or loaded automatically (Claude Code, Windsurf):

| Agent | Invocation |
|---|---|
| `@orchestrator` | Full lifecycle coordination |
| `@architect` | Specs, plans, ADRs |
| `@security` | OWASP, threat modeling |
| `@development` | TDD implementation |
| `@qa` | Code review, test coverage |


## Install Additional Agents

All 5 agents are installed automatically during `acli init`. To reinstall a specific agent:

```bash
acli install orchestrator
acli install architect
```

## Use in VS Code

Open GitHub Copilot Chat and start with one of these workflows:

### Full Lifecycle (recommended)

```
/acli.run Build a REST API for user management
```

This runs the complete 10-phase specification-driven workflow with human checkpoints.

### Onboard an Existing Project

```
/acli.onboard
```

Auto-discovers your tech stack, architecture, and conventions, then generates tailored constitution and quality standards.

### Individual Phases

```
/acli.constitution          -- set up project principles
/acli.specify <feature>     -- write the feature spec
/acli.clarify               -- resolve ambiguities
/acli.plan                  -- create technical plan
/acli.checklist             -- generate quality checklists
/acli.tasks                 -- create task list
/acli.analyze               -- validate consistency
/acli.implement             -- implement with review loop
```

### Utility Commands

```
/acli.debug <description>   -- structured debugging
/acli.critique              -- code review
/acli.respond               -- address review feedback
/acli.finish                -- prepare branch for merge
```

## Agent Interaction

Agents are available as `@agent` mentions in Copilot Chat:

```
@orchestrator start the full workflow for adding search functionality
@architect what are the edge cases for file upload?
@architect review this service layer design
@security check this auth implementation for OWASP issues
@development implement the next task from the task list
@qa run regression tests for the payment module
@qa review code quality standards compliance
```

## Configuration

View or edit settings:
```bash
acli config
```

Configuration is stored in `.agent-framework.json` at the project root.

## Updating

```bash
acli update                 # Update all agents, prompts, and skills
acli update orchestrator    # Update a specific agent
```

## Next Steps

- [README.md](README.md) -- full documentation
- [EXAMPLES.md](EXAMPLES.md) -- workflow examples
- [CONTRIBUTING.md](CONTRIBUTING.md) -- development guide
