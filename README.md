# Agent Framework CLI

[![npm version](https://img.shields.io/npm/v/agent-framework-cli.svg?style=flat-square)](https://www.npmjs.com/package/agent-framework-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-Compatible-007ACC.svg?style=flat-square&logo=visual-studio-code)](https://code.visualstudio.com/)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-Ready-000000.svg?style=flat-square&logo=github)](https://github.com/features/copilot)

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

