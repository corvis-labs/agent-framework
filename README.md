# Agent Framework CLI

[![npm version](https://img.shields.io/npm/v/agent-framework-cli.svg?style=flat-square)](https://www.npmjs.com/package/agent-framework-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square)](https://www.typescriptlang.org/)

## Specification-driven agents for every AI editor — one command, all platforms.

`agent-framework-cli` installs a governed engineering workflow into your project and emits the right agent files for whichever AI editor you use: GitHub Copilot, Cursor, Claude Code, Windsurf, or any [Open Plugins](https://open-plugins.com)-compatible tool.

---

## One command. All platforms.

```bash
npm install -g agent-framework-cli
acli setup
```

`acli setup` asks two questions (project type + memory backend), installs all dependencies, and scaffolds your project. Open your AI editor and start:

```
/acli.run Build a user authentication system with OAuth support
```

---

## Platform Support

`acli init` asks which editors you target. Agents are emitted to all selected destinations automatically.

| Platform | Output location | Format |
|---|---|---|
| **GitHub Copilot** | `.github/agents/{name}.agent.md` | VS Code agent frontmatter |
| **Cursor** | `.cursor/rules/{name}.mdc` | YAML frontmatter + `alwaysApply` |
| **Claude Code** | `AGENTS.md` | Aggregated markdown sections |
| **Windsurf** | `.windsurf/rules/{name}.md` | YAML frontmatter + `trigger` |
| **Open Plugins** | `.agents/plugins/agent-framework/agents/{name}.agent.md` | Open Plugins spec |

> Every `acli install` / `acli remove` writes to all configured platforms and keeps the Open Plugins manifest (`.plugin/plugin.json`) in sync.

---

## The Power Stack

| Tool | What it does |
|------|---|
| **spec-kit** | Spec-driven development — keeps every feature grounded in structured requirements |
| **Fleet** | Multi-agent orchestration — architect, security, dev, and QA run in the right order |
| **Superpowers Bridge** | Connects your editor to TDD enforcement, brainstorming, and structured code review |
| **Beads** *(optional)* | Semantic memory — architecture decisions and task state survive every session |
| **Open Plugins** | Canonical extension format — share and install custom plugins across any conformant tool |

---

## Why bother?

AI coding assistants write code fast but without discipline. Left unchecked:

- Features get built from vague prompts instead of structured specs
- Architecture drifts because every session starts fresh
- Tests get skipped, security gets overlooked, reviews get bypassed

Agent Framework wraps your AI editor in a **governed engineering workflow** — spec before code, review before merge, memory that persists.

---

## The Lifecycle

Run `/acli.run <feature>` — the orchestrator drives everything. You only step in at three approval gates.

| # | Phase | What happens |
|---|---|---|
| 1 | **Specify** | Constitution + feature spec authored |
| 2 | **Clarify** | Ambiguities resolved before any planning |
| 3 | **Plan** | Architecture decisions + implementation plan |
| 4 | **Checklist** | Security, a11y, and performance gates generated |
| 5 | **Tasks** | Prioritised, dependency-ordered task breakdown |
| | 🚦 **Gate 1** | *You approve the plan before any code is written* |
| 6 | **Analyze** | Cross-artifact consistency validated |
| | 🚦 **Gate 2** | *You confirm everything is aligned* |
| 7 | **Review** | Cross-model plan review |
| 8 | **Implement** | Dev + QA loop — up to 5 iterations before escalation |
| 9 | **Verify** | Full test suite + acceptance criteria checked |
| 10 | **Finish** | Branch cleanup, merge readiness confirmed |
| | 🚦 **Gate 3** | *You give final approval before merge* |

---

## 5 Agents, 1 Team

| Agent | Job |
|---|---|
| `orchestrator` | Routes work, enforces gates, runs tasks in parallel |
| `architect` | Writes specs, plans, ADRs — tech-agnostic and rigorous |
| `security` | OWASP checklists, threat modeling, vulnerability review |
| `development` | TDD implementation, plan-conformant, hands off cleanly |
| `qa` | Code review, test coverage, acceptance validation |

---

## Slash Commands

**Everyday:**

| Command | What it does |
|---|---|
| `/acli.run <feature>` | Full lifecycle start to finish |
| `/acli.onboard` | Analyse and bootstrap an existing codebase |
| `/acli.implement` | Jump straight to implementation |

**Spec & Planning:**

| Command | What it does |
|---|---|
| `/acli.constitution` | Define your project principles & architecture boundaries |
| `/acli.specify` | Author a structured feature spec with acceptance criteria |
| `/acli.plan` | Generate implementation plan + architecture decision records |
| `/acli.tasks` | Break the plan into prioritised, dependency-ordered tasks |
| `/acli.checklist` | Generate security, a11y, and performance quality gates |

**Review & Ship:**

| Command | What it does |
|---|---|
| `/acli.critique` | Spec-aligned code review with severity ratings |
| `/acli.debug` | Structured root-cause analysis |
| `/acli.finish` | Branch cleanup and merge readiness check |

---

## Agency Roster

Install any of 140+ community-built agents from the [Agency roster](https://github.com/msitarzewski/agency-agents) — organized across engineering, design, marketing, product, and more.

```bash
# Browse all available agents by division
acli agency list

# Narrow to a specific division
acli agency list --division engineering

# Search by keyword
acli agency search "data engineer"
acli agency search "frontend"

# Install by slug or keyword
acli agency install engineering-frontend-developer
acli agency install frontend-developer          # matches by keyword
acli agency install engineering/frontend-developer  # division-scoped

# Force overwrite an existing install
acli agency install engineering-frontend-developer --force
```

Agents are installed to all platforms in `.agent-framework.json` and the index is cached locally for 24 hours. Use `--refresh` to fetch the latest roster.

| Platform | Output path |
|---|---|
| GitHub Copilot | `.github/agents/{slug}.agent.md` |
| Cursor | `.cursor/rules/{slug}.mdc` |
| Claude Code | `.claude/agents/{slug}.md` |
| Windsurf | `.windsurf/rules/{slug}.md` |
| Open Plugins | `.agents/plugins/agency-agents/agents/{slug}.agent.md` |

---

## Extension Ecosystem

Extend the framework with additional agents, skills, and rules via the `acli extensions` command.

```bash
# See what is installed and what is available
acli extensions list --available

# Install a known extension
acli extensions add brownfield          # speckit brownfield onboarding
acli extensions add fleet               # multi-agent fleet orchestration

# Install any custom open-plugins package
acli extensions add my-plugin --from https://example.com/my-plugin.zip --ecosystem open-plugins

# Build and share your own plugin
acli extensions create my-plugin       # scaffold structure + starter agent + skill
acli extensions pack my-plugin         # zip for distribution
```

### Supported extension ecosystems

| Ecosystem | Install mechanism | Discovery |
|---|---|---|
| **speckit** | `specify extension add` CLI | spec-kit extension registry |
| **open-plugins** | Download + extract zip | `.agents/plugins/*/plugin.json` manifest |

---

## Workspace Layout

```
.github/
  agents/         ← GitHub Copilot agent definitions
  skills/         ← reusable skills
  prompts/        ← slash commands
.cursor/
  rules/          ← Cursor rule files (.mdc)
.windsurf/
  rules/          ← Windsurf rule files (.md)
.agents/
  plugins/        ← Open Plugins packages (manifest + agents/skills/rules)
AGENTS.md         ← Claude Code agent registry (auto-generated)
.specify/
  memory/         ← constitution, architecture, quality standards
  specs/          ← specs, plans, checklists, tasks
.beads/           ← persistent memory (if beads-based memory selected)
.agent-framework.json  ← framework config (platforms, agents, dependencies)
```

---

## CLI Reference

| Command | Description |
|---|---|
| `acli setup [--check]` | Install dependencies + scaffold project (interactive) |
| `acli init [--platforms …]` | Initialise framework, select target platforms |
| `acli install <agent>` | Install a framework agent to all configured platforms |
| `acli remove <agent>` | Remove an agent from all configured platforms |
| `acli list agents\|skills` | List available or installed agents/skills |
| `acli update [agent]` | Re-emit agents to all configured platforms |
| `acli config` | View or modify framework configuration |
| `acli agency install <name>` | Install a community agent from the Agency roster |
| `acli agency list [--division]` | Browse 140+ community agents by division |
| `acli agency search <query>` | Search community agents by keyword |
| `acli extensions list` | List installed extensions |
| `acli extensions add <name>` | Install an extension |
| `acli extensions remove <name>` | Remove an extension |
| `acli extensions create <name>` | Scaffold a new custom plugin |
| `acli extensions pack <name>` | Package a plugin as a distributable zip |

---

## Requirements

- Node.js >= 18
- Python >= 3.8 (for spec-kit)
- One or more supported AI editors: GitHub Copilot (VS Code), Cursor, Claude Code, or Windsurf

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.


## Supercharge your agentic development — stop fiddling with agent config and start shipping.

`agent-framework-cli` sets up everything you need to follow a perfect SDLC lifecycle with GitHub Copilot, in one command. Spec → Plan → Implement → Review → Ship, with quality gates and persistent memory baked in.

---

## One command. Full setup.

```bash
npm install -g agent-framework-cli
acli setup
```

That's it. `acli setup` asks you two quick questions, installs all dependencies, and scaffolds your project. Open Copilot Chat and go:

```
/acli.run Build a user authentication system with OAuth support
```

---

## The Power Stack

Agent Framework wires together four best-in-class tools so you don't have to:

| Tool | What it does for you |
|------|----------------------|
| **spec-kit** | Spec-driven development engine — keeps every feature grounded in structured requirements, not vibes |
| **Fleet** | Multi-agent orchestration — runs architect, security, dev, and QA agents in the right order with the right context |
| **Superpowers Bridge** | Connects Copilot to brainstorming, TDD enforcement, and structured code review workflows |
| **Beads** *(optional)* | Semantic memory across sessions — your architecture decisions, ADRs, and task state survive every conversation |

> Choose **Git-based memory** (zero extra tooling, context in plain files) or **Beads-based memory** (advanced semantic search + chunking). `acli setup` asks you at install time.

---

## Why bother?

AI coding assistants write code fast but without discipline. Left unchecked:

- Features get built from vague prompts instead of structured specs
- Architecture drifts because every session starts fresh
- Tests get skipped, security gets overlooked, reviews get bypassed
- Nobody knows *why* a decision was made two weeks ago

Agent Framework wraps Copilot in a **governed engineering workflow** — spec before code, review before merge, memory that persists.

---

## The Lifecycle

Run `/acli.run <feature>` — the orchestrator drives everything. You only step in at three approval gates.

| # | Phase | What happens |
|---|-------|-------------|
| 1 | **Specify** | Constitution + feature spec authored |
| 2 | **Clarify** | Ambiguities resolved before a line of planning |
| 3 | **Plan** | Architecture decisions + implementation plan |
| 4 | **Checklist** | Security, a11y, and performance gates generated |
| 5 | **Tasks** | Prioritised, dependency-ordered task breakdown |
| | 🚦 **Gate 1** | *You approve the plan before any code is written* |
| 6 | **Analyze** | Cross-artifact consistency validated (spec ↔ plan ↔ tasks) |
| | 🚦 **Gate 2** | *You confirm everything is aligned* |
| 7 | **Review** | Cross-model plan review |
| 8 | **Implement** | Dev + QA loop — up to 5 iterations before escalation |
| 9 | **Verify** | Full test suite + acceptance criteria checked |
| 10 | **Finish** | Branch cleanup, merge readiness confirmed |
| | 🚦 **Gate 3** | *You give final approval before merge* |

---

## 5 Agents, 1 Team

| Agent | Job |
|-------|-----|
| `orchestrator` | Routes work, enforces gates, runs tasks in parallel |
| `architect` | Writes specs, plans, ADRs — tech-agnostic and rigorous |
| `security` | OWASP checklists, threat modeling, vulnerability review |
| `development` | TDD implementation, plan-conformant, hands off cleanly |
| `qa` | Code review, test coverage, acceptance validation |

---

## Slash Commands

**Everyday:**

| Command | What it does |
|---------|-------------|
| `/acli.run <feature>` | Full lifecycle start to finish |
| `/acli.onboard` | Analyse and bootstrap an existing codebase |
| `/acli.implement` | Jump straight to implementation |

**Spec & Planning:**

| Command | What it does |
|---------|-------------|
| `/acli.constitution` | Define your project principles & architecture boundaries |
| `/acli.specify` | Author a structured feature spec with acceptance criteria |
| `/acli.plan` | Generate implementation plan + architecture decision records |
| `/acli.tasks` | Break the plan into prioritised, dependency-ordered tasks |
| `/acli.checklist` | Generate security, a11y, and performance quality gates |

**Review & Ship:**

| Command | What it does |
|---------|-------------|
| `/acli.critique` | Spec-aligned code review with severity ratings |
| `/acli.debug` | Structured root-cause analysis |
| `/acli.finish` | Branch cleanup and merge readiness check |

---

## Brownfield? No problem.

`/acli.onboard` auto-scans your existing codebase, generates a tailored constitution + reference architecture, and gets you into the lifecycle without starting from scratch.

---

## Workspace Layout

```
.github/
  agents/    ← agent definitions
  skills/    ← reusable skills
  prompts/   ← slash commands
.specify/
  memory/    ← constitution, architecture, quality standards
  specs/     ← specs, plans, checklists, tasks
.beads/      ← persistent memory (if beads-based memory selected)
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `acli setup [--check]` | Install dependencies + scaffold project (interactive) |
| `acli install <agent>` | Install a specific agent |
| `acli remove <agent>` | Remove an installed agent |
| `acli list agents\|skills` | List available agents or skills |
| `acli update [agent]` | Update agents, prompts, and skills |
| `acli config` | View or modify framework configuration |

---

## Requirements

- Node.js >= 18
- VS Code + GitHub Copilot Chat
- Python >= 3.8 (for spec-kit)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.

