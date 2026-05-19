# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.5.0] - 2026-05-19

### Added
- **OpenCode platform support** — new `'opencode'` target in `TargetPlatform`. Agents are emitted to `.opencode/agents/{name}.md` with YAML frontmatter (`description`, `mode`, optional `model`, and a `permission` block auto-derived from the agent's `tools` array). Write tools map to `edit: allow`; `run_in_terminal` maps to `bash: allow`; all others default to `deny`.
- **`AgentConfig.openCodeMode?: 'primary' | 'subagent' | 'all'`** — controls the OpenCode `mode` frontmatter field (defaults to `'subagent'`).
- **`Agent.generateOpenCodeAgent()`** — protected method for OpenCode output generation.
- **`acli init` platform list** now includes OpenCode with path hint `.opencode/agents/`.
- **`agency` command** handles `'opencode'` platform — writes `.opencode/agents/{slug}.md` with `description` + `mode: subagent` frontmatter.
- **`PlatformEmitter`** — `platformDestPath`, `skillDestPath`, and `ensurePlatformDirs` all handle `'opencode'`. Skills resolve to the shared `.agents/skills/` path (same as copilot/cursor/OpenCode's vercel-labs/skills convention).

## [3.4.0] - 2026-05-19

### Added
- **`PromptOptimizer`** (`src/core/PromptOptimizer.ts`) — utility class for reducing agent system-prompt token count. Passes: strip emoji from headings, remove boilerplate Identity/Communication sections, collapse blank lines. Exposes `estimateTokens(text)` and `report(original, compressed)`. Typical savings: 15–25%.
- **`AgentConfig.compact?: boolean`** — when `true`, all generated platform output is automatically passed through `PromptOptimizer.compress()`. Set per-agent in config; no code changes elsewhere needed.
- **`Agent.buildSpecKitBlock(options)`** — protected base-class method that generates the Spec-Kit workflow integration block from structured options (files, fallback, commands, extraSections). Replaces the copy-pasted block that previously appeared verbatim in all five agents.
- **`templates/skills/security-owasp-checklist.skill.md`** — new on-demand skill containing the full OWASP-aligned security test coverage checklist (10 categories, 45+ items) and severity classification table. Loaded only when the user runs `/acli.checklist`, not on every turn.
- **Tool restrictions per agent** — each agent's `AgentConfig` now declares a `tools` allowlist scoped to its role: QA and Security are read-only; Architect excludes terminal; Backend and Frontend include `run_in_terminal`.
- **`security-owasp-checklist` added to `SKILLS`** install list in `install.ts` — copied to `.github/skills/` during `acli install`.

### Changed
- All five built-in agents (Architect, Backend, Frontend, QA, Security) now call `buildSpecKitBlock()` instead of embedding a near-identical Spec-Kit preamble inline. Single source of truth; ~120–180 tokens removed per agent from the duplicated block.
- `SecurityAgent` — inline severity classification scale and 10-item security test coverage checklist removed from system prompt. Both now live in `security-owasp-checklist.skill.md` and are referenced via `/acli.checklist`.
- `PromptOptimizer` exported from `src/agents/index.ts` for programmatic use.
- `SecurityAgent` metadata declares `dependencies: ['security-owasp-checklist']`.

## [3.3.0] - 2026-05-19

### Added
- **`@frontend` agent** — Frontend Developer, powered by `engineering-frontend-developer` from the Agency community roster. Specialises in React/Vue/Angular, Core Web Vitals, and WCAG 2.1 AA accessibility.
- **`@backend` agent** — Backend Architect, powered by `engineering-backend-architect`. Covers scalable system design, database architecture, API development, and cloud infrastructure.

### Changed
- **`@architect`** — now powered by `engineering-software-architect`: domain-driven design, ADR templates, C4-model communication, and trade-off analysis. Retains full Spec-Kit upstream workflow (CONSTITUTION → SPECIFY → CLARIFY → PLAN → TASKS).
- **`@qa`** — now powered by `engineering-code-reviewer`: 🔴/🟡/💭 priority markers, structured review comment format, spec alignment validation.
- **`@security`** — now powered by `engineering-security-engineer`: STRIDE threat modeling, CVSS severity classification, 4-phase security workflow, OWASP Top 10 + CWE Top 25 coverage.
- All agents updated to direct agent-to-agent handoffs (architect ↔ frontend/backend ↔ qa/security).

### Removed
- **`@orchestrator` agent** — removed; workflow phases are now coordinated directly via Spec-Kit slash commands and agent handoffs.
- **`@development` agent** — replaced by `@frontend` and `@backend`.

## [3.2.0] - 2026-05-19

### Added
- **`acli agency install <name>`** — install any agent from the [Agency community roster](https://github.com/msitarzewski/agency-agents) directly into all configured platforms
- **`acli agency list [--division <name>]`** — browse 140+ community agents grouped by division
- **`acli agency search <query>`** — search agents by keyword across all divisions
- Platform-aware output for all five targets (Copilot, Cursor, Claude Code, Windsurf, Open Plugins)
- 24-hour OS-level index cache to avoid GitHub API rate limits; refresh with `--refresh`

## [3.1.0] - 2026-05-19

### Added
- **`vercel-labs/skills` compatibility** — skills are now emitted to platform-specific paths recognised by `npx skills list` / `npx skills update` with no additional configuration:
  - GitHub Copilot, Cursor, Open Plugins → `.agents/skills/{name}/SKILL.md`
  - Claude Code → `.claude/skills/{name}/SKILL.md`
  - Windsurf → `.windsurf/skills/{name}/SKILL.md`
- **`PlatformEmitter.skillDestPath()`** — returns the correct `npx skills` destination for any `TargetPlatform`
- **`PlatformEmitter.emitSkill()`** — writes a SKILL.md to all unique platform paths, with deduplication
- **`setup.ts: installBundledSkills()`** — copies all bundled `templates/skills/*.skill.md` to platform paths during `acli setup`; `npx skills list` will show them automatically
- **`acli extensions add <github-shorthand>`** — GitHub shorthands (`owner/repo`), GitHub/GitLab URLs, and `skills.sh` URLs are automatically routed to `npx skills add` instead of the zip downloader
- **`acli extensions create --with-skill`** — the scaffolded SKILL.md is also emitted to `npx skills` compatible paths immediately after creation
- `ensurePlatformDirs` now creates skills directories for all platforms on init

## [3.0.0] - 2026-05-19

### Breaking Changes
- **Multi-platform output by default** — `acli init` now prompts for target platforms and emits agent files to all selected destinations. Existing single-platform setups continue to work; re-running `acli init --force` will add the new platform files.
- **`AgentManager` constructor signature changed** — now accepts `platforms: TargetPlatform[]` and `frameworkVersion` parameters. Direct API consumers must update instantiation calls.
- **`setupSpecKit` signature changed** — accepts optional `platforms: TargetPlatform[]` to select the correct `specify --integration` value. Callers that relied on the positional `spinner` argument must update.

### Added
- **Multi-platform agent deployment** — agents are now emitted to all configured target platforms simultaneously:
  - `copilot` → `.github/agents/{name}.agent.md`
  - `cursor` → `.cursor/rules/{name}.mdc` (YAML frontmatter + `alwaysApply: false`)
  - `claude` → `AGENTS.md` (aggregated, one `## Heading` section per agent)
  - `windsurf` → `.windsurf/rules/{name}.md` (YAML frontmatter + `trigger: always_on`)
  - `open-plugins` → `.agents/plugins/agent-framework/agents/{name}.agent.md`
- **Open Plugins standard support** — full conformance with the [open-plugins.com](https://open-plugins.com) specification. Auto-generates `.plugin/plugin.json` manifest after every `acli install` / `acli remove`; discoverable by Cursor Directory, Claude Code, and other conformant tools.
- **`TargetPlatform` type** — exported from `src/core/Agent.ts`; values: `'copilot' | 'cursor' | 'claude' | 'windsurf' | 'open-plugins'`
- **`PlatformEmitter`** (`src/core/PlatformEmitter.ts`) — new module that resolves platform-specific output paths and writes agent files; exports `platformDestPath`, `emitAgent`, `emitAgentsClaude`, `ensurePlatformDirs`
- **`PluginGenerator`** (`src/core/PluginGenerator.ts`) — new module that creates and maintains the Open Plugins `.plugin/plugin.json` manifest after each install/remove operation
- **`acli extensions` command group** — full extension lifecycle management across both ecosystems:
  - `acli extensions list [--available] [--ecosystem speckit|open-plugins]`
  - `acli extensions add <name> [--from <url>] [--ecosystem …] [--force]`
  - `acli extensions remove <name> [--yes]`
  - `acli extensions create <name>` — scaffold a new custom open-plugins plugin with starter agent and skill
  - `acli extensions pack <name>` — package a plugin as a distributable zip for sharing
- **Platform-aware `specify --integration`** — `setupSpecKit()` now maps `TargetPlatform` to the correct spec-kit integration flag (`copilot`, `cursor`, `claude`, `windsurf`) instead of hardcoding `copilot`
- **`gray-matter` dependency** — used for standards-compliant YAML frontmatter generation across all platform outputs
- **`@modelcontextprotocol/sdk` dependency** — MCP SDK wired in for future MCP server generation support
- **Custom plugin authoring workflow** — `acli extensions create` scaffolds a complete open-plugins structure (`.plugin/plugin.json`, `agents/`, `skills/`, `rules/`); `acli extensions pack` produces a distributable zip compatible with `acli extensions add --from <url>`
- **`--platforms` option on `acli init`** — non-interactive platform selection for CI/scripted environments

### Changed
- **`AgentManager`** — completely rewritten to use `PlatformEmitter` and `PluginGenerator`; `installAgent()` now returns `Map<TargetPlatform, string>` (platform → written path); `listInstalled()` falls back to open-plugins directory when Copilot directory is absent
- **`Agent.generateForPlatform(platform)`** — new dispatch method in base class; `generateCursorRule()` and `generateWindsurfRule()` use `gray-matter` for frontmatter generation
- **`acli init`** — interactive platform selection (checkbox, defaults: `copilot` + `open-plugins`); persists `platforms` array to `.agent-framework.json`; calls `ensurePlatformDirs` for all selected platforms
- **`acli install`** — reads `config.platforms` and passes it to `AgentManager`; success output now shows per-platform destination paths
- **`acli remove`** — reads `config.platforms` and passes it to `AgentManager`; removes agent files from all platforms
- **`acli list`** — reads `config.platforms` from config; consistent with multi-platform `AgentManager`
- **`acli update`** — reads `config.platforms` from config; re-emits agents to all configured platforms on update
- **`acli setup`** — reads `config.platforms` from `.agent-framework.json` before running `specify init` so the correct `--integration` flag is used

### Security
- `acli extensions add --from <url>`: validates HTTPS-only URLs before download; rejects `http://` and non-URL strings
- Extension names validated against `/^[a-zA-Z0-9_-]+$/` before interpolation into shell commands to prevent command injection


### Breaking Changes
- **Command namespace simplified** — all `/acli.beads.xxx` commands renamed to `/acli.xxx` (e.g., `/acli.beads.constitution` → `/acli.constitution`)
- **Agents consolidated from 7 to 5** — `requirements` + `architecture` merged into `architect`; `quality` + `testing` merged into `qa`
- **Removed core modules** — `AgentMemory.ts`, `BeadsWorkflow.ts`, `LearningTemplates.ts` removed; memory management delegated to beads CLI (`bd`)
- **Removed redundant templates/skills** — 5 speckit skills and 6 beads templates removed; replaced by spec-kit bundled templates and beads workflow
- **Python mandatory** — spec-kit requires Python; `acli setup` exits with error if Python is not installed
- **Go dependency removed** — beads installs via brew or npm only; Go is no longer required
- **Enterprise tone** — all agent instructions and CLI output use formal professional language; emojis removed throughout
- **Config schema v2** — `.agent-framework.json` now includes `dependencies`, `enterprise`, and `promptsDir` fields

### Added
- **Setup command** — `acli setup` checks and installs all dependencies (spec-kit, beads, plugins) separately from `acli init`
- **Superpowers integration** — `acli init` installs 13 superpowers skills (TDD, systematic debugging, brainstorming, code review, git worktrees, etc.) as `.skill.md` files in `.github/skills/superpowers/`
- **Beads integration** — `acli init` runs `bd init` if beads CLI is available; graceful degradation with warning if not installed
- **Spec-kit plugins** — `acli setup` installs brownfield, fleet, and superpowers-bridge plugins via `specify plugin install`
- **Spec-kit directory structure** — `acli init` creates `.specify/templates/` and `.specify/specs/` directories for specification-driven development
- **8 new slash commands** — `/acli.run` (fleet lifecycle), `/acli.clarify`, `/acli.checklist`, `/acli.debug`, `/acli.critique`, `/acli.respond`, `/acli.finish`, `/acli.onboard`
- **Windows compatibility** — `where` vs `which` detection, npm beads fallback (no brew on Windows), pip without `--user` on Windows
- **Auto-install all agents** — `acli init` now installs all 5 built-in agents automatically

### Changed
- **5 agents total** — orchestrator, architect (requirements + architecture), security, development, qa (code review + testing)
- **Architect Agent** — combines spec-kit SDD phases (constitution, specify, clarify) with architecture design (patterns, ADRs, technical decisions)
- **QA Agent** — combines code quality review workflow with test generation and execution
- **Orchestrator Agent** — fleet-style 10-phase lifecycle with 3 mandatory human gates; agents array updated to `['architect', 'security', 'development', 'qa']`
- **Development Agent** — single qa handoff replaces separate quality and testing handoffs
- **Security Agent** — handoff to qa instead of quality
- **install.ts** — `BEADS_PROMPTS` → `PROMPTS`, `SPECKIT_SKILLS` → `SKILLS`, reduced skills list to 3 essential skills
- **init.ts** — complete rewrite with v2 config, dependency tracking, auto-agent-install, superpowers skills, beads initialization
- **setup.ts** — extracted from init.ts as shared setup module (~200 lines); handles spec-kit, beads, and plugin installation
- **list.ts / config.ts** — removed emojis from all output
- **package.json** — removed `boxen` dependency, updated keywords, added `types` field, added `prepare` script

### Removed
- **Migration command** — `acli migrate` and `src/commands/migrate.ts` removed
- **Old agent directories** — `requirements/`, `architecture/`, `quality/`, `testing/` deleted after merge
- **Go dependency** — `checkGo()` function and Go installer removed from setup
- **Dead code** — `getPrebuiltAgent`, `listPrebuiltAgentNames` from `agents/index.ts`; `validate()` and legacy config fields from `Agent.ts`
- **ITERATIVE_DEVELOPMENT.md** — content merged into README.md

## [1.0.10] - 2026-03-14

### Changed
- **Language-agnostic agent instructions** — all 6 specialist agents (Security, Architecture, Requirements, Quality, Testing, Development) now defer all language-specific configuration (linting rules, test commands, coverage targets, scanning tools, code patterns) to per-project `.specify/memory/quality-standards.md` and `.specify/memory/reference-architecture.md` rather than embedding hardcoded assumptions; agents fail fast and ask for these documents if they are missing
- **Security Agent** — removed hardcoded JavaScript/Python scanning commands and helmet.js configuration; agent now reads security scanning tools and header middleware from `quality-standards.md`
- **Architecture Agent** — replaced 4 TypeScript design pattern implementations with concise prose descriptions; pattern selection deferred to project architecture documents
- **Requirements Agent** — removed BeadsWorkflow TypeScript API call examples and workflow step code blocks; process guidance now expressed as plain language steps
- **Quality Agent** — removed 6 before/after JavaScript/TypeScript code pair examples and hardcoded tool commands; agent now reads linting and quality tooling from `quality-standards.md`
- **Testing Agent** — removed full Jest/Supertest/Playwright example test implementations; test framework and conventions now loaded from `quality-standards.md` and `testing-plan.md`
- **Development Agent** — removed Express/React/Prisma boilerplate code generation examples; implementation patterns deferred to `reference-architecture.md`

### Performance
- **~1,360 lines removed** from embedded agent instructions across all 6 agents, reducing per-invocation token consumption by approximately 6,000–7,000 tokens per full pipeline run
- Previous release (`1.0.9`) had already removed ~996 lines of example interactions; combined total across both releases: **~2,356 lines removed**

## [1.0.9] - 2026-03-14

### Added
- **Feature-Specific Folder Organization** — BEADS+ workflow now organizes all documents in feature-specific folders using pattern `.specify/specs/{ID}-{slug}/` (e.g., `001-user-auth/`, `002-api-integration/`) for better isolation and parallel feature development
- **Automatic Git Branch Creation** — `/acli.beads.specify` command now automatically creates a git branch with pattern `feature/{ID}-{slug}` for each new feature specification; graceful fallback if git is unavailable
- **Sequential Feature ID Generation** — Features are assigned sequential IDs starting from 001, automatically incrementing based on existing feature folders
- **Feature-Aware Document Paths** — All BEADS+ commands (`/acli.beads.plan`, `/acli.beads.tasks`, `/acli.beads.analyze`, `/acli.beads.implement`) updated to automatically identify and use feature-specific folder structure
- **Memory Summarization** — `getHandoverWithSummary()` method automatically summarizes large or old handovers to reduce context window usage; summaries are cached and preserve critical information (high-priority issues, test failures) while truncating low-priority details
- **Automatic Learning Extraction from Git** — `extractLearningsFromGit()` method scans commit history for fix/bug/security commits and automatically creates learnings with proper categorization, tags, and severity based on commit messages and changed files
- **Memory Pruning & Deduplication** — `pruneMemory()` method with three strategies: merge similar learnings (≥50% tag overlap), remove ineffective learnings (<30% success rate after ≥5 applications), and archive old learnings (>1 year); includes dry-run mode for safe preview
- **Learning Templates** — 13 pre-built templates for common issues (SQL injection, XSS, N+1 queries, flaky tests, memory leaks, etc.) in `LearningTemplates.ts`; `saveLearningFromTemplate()` method creates consistent learnings with variable substitution
- **Memory Features Usage Examples** — comprehensive example file (`examples/memory-features-usage.ts`) demonstrating all new memory system features with real-world scenarios
- **Enhanced Documentation** — updated `MEMORY_SYSTEM.md` with detailed documentation for all new features, usage examples, and best practices

### Changed
- **BEADS+ Workflow Organization** — All BEADS+ commands now work with feature-specific folder structure instead of flat file organization; each feature gets its own isolated folder for spec, plan, tasks, and testing-plan documents
- **Specify Command** — `/acli.beads.specify` now generates feature folder, assigns sequential ID, and creates git branch before writing spec document; includes feature metadata in spec.md frontmatter
- **Plan Command** — `/acli.beads.plan` loads spec from feature folder and writes plan.md to same folder; identifies correct feature automatically or accepts user specification
- **Tasks Command** — `/acli.beads.tasks` generates tasks.md in feature-specific folder with feature ID metadata header
- **Analyze Command** — `/acli.beads.analyze` validates consistency across all documents within a feature folder; analysis report includes feature identification
- **Implement Command** — `/acli.beads.implement` executes tasks from feature-specific folder with full feature context; pre-flight checks identify correct feature folder

### Fixed
- **Unicode character compilation errors** — replaced box-drawing characters (─, ┌, └) with ASCII equivalents (-, +) in all agent instruction strings
- **Emoji character compilation errors** — replaced emoji markers with ASCII text equivalents ([DONE], [FAIL], [TEST], >>, [TASK], [DOC]) in handoff blocks across all 7 agents
- **Template string syntax errors** — escaped triple backticks (\`\`\`) inside template strings to prevent premature template closure
- All agent files (OrchestratorAgent, ArchitectureAgent, DevelopmentAgent, TestingAgent, CodeQualityAgent, RequirementGatheringAgent, SecurityAgent) now compile successfully without TypeScript errors

## [1.0.8] - 2026-03-14

### Added
- **Testing Plan document** (`testing-plan.md`) — `/acli.beads.plan` (step 8) now creates `.specify/specs/###-feature-name/testing-plan.md` with unit/integration/E2E test suites mapped to user stories, coverage targets, test data requirements, test run commands, and a **Manual Testing Steps** section for the human to verify the feature end-to-end
- **Manual Testing Steps in every handoff block** — all 7 agents now end every handoff with a rich `✅ WHAT WAS DONE / 🧪 MANUAL CHECK FOR YOU / 🔀 HAND OFF TO` block; development and testing agents include step-by-step manual test instructions the human can follow before the next agent takes over
- **Manual Testing Steps section in handover template** — `templates/beads/handover.template.md` now includes `## Manual Testing Steps` with setup commands, numbered steps, expected results, and failure symptoms

### Changed
- `TestingAgent` Project Context now loads `.specify/specs/###-feature-name/testing-plan.md` before writing any tests; if it doesn't exist, the agent asks @architecture to create it via `/acli.beads.plan`
- Orchestrator inline handoff examples updated to the richer block format including work summary and human check steps
- Phase 4 (PLAN) deliverables updated to reflect the four documents now produced: `plan.md`, `reference-architecture.md`, `quality-standards.md`, `testing-plan.md`



### Added
- `/acli.onboard` slash command prompt — reverse-engineers an existing project into three foundational BEADS+ documents: `constitution.md`, `reference-architecture.md`, and `quality-standards.md`
- `speckit-onboard.skill.md` skill — methodology guide for the onboarding process, including exploration strategy, inference rules, and update vs. create semantics
- **Reference Architecture document** (`reference-architecture.md`) — `/acli.beads.plan` now creates `.specify/memory/reference-architecture.md` alongside `plan.md`; serves as the canonical architecture reference for all agents and all future features
- **Quality Standards document** (`quality-standards.md`) — `/acli.beads.plan` and `/acli.onboard` now create `.specify/memory/quality-standards.md` with language/framework-specific linting rules, test standards, error handling patterns, and performance targets derived from the actual tech stack
- **Handover Protocol** — all 7 agents (orchestrator, requirements, architecture, development, quality, security, testing) now include explicit instructions to create a `.specify/handovers/YYYY-MM-DD-{from}-to-{target}.md` document before every handoff, using the existing `templates/beads/handover.template.md`
- **Project Context loading** — all 7 agents now include a mandatory "Project Context" section instructing them to load `constitution.md`, `reference-architecture.md`, and `quality-standards.md` (where applicable) before starting any task, and to flag conflicts before proceeding

### Changed
- `/acli.beads.plan` execution steps expanded from 6 to 8: steps 6 and 7 produce `reference-architecture.md` and `quality-standards.md` respectively
- `CodeQualityAgent` now mandates loading `.specify/memory/quality-standards.md` at the start of every review; every rule in that document is enforced
- `TestingAgent` now loads `quality-standards.md` for test framework, coverage thresholds, and run commands
- `install.ts`: `acli.onboard.prompt.md` added to `BEADS_PROMPTS`; `speckit-onboard.skill.md` added to `SPECKIT_SKILLS`

## [1.0.6] - 2026-03-14

### Fixed
- `handoffs` frontmatter attribute now serializes as objects with `label`, `agent`, `prompt`, and optional `send` fields per VS Code agent spec
- Added `HandoffConfig` interface to `Agent.ts`
- Updated YAML serializer to correctly render object arrays as YAML block mappings
- Orchestrator agent now has `handoffs` declared (was missing), enabling VS Code to present handoff buttons
- All sub-agents now include `orchestrator` as a handoff target so control can return after each phase
- Replaced `invokeAgent()` pseudocode in orchestrator instructions with real handoff protocol

## [1.0.5] - 2025-07-15

### Added
- 7 speckit skill files in `templates/skills/` (speckit-constitution, speckit-specify, speckit-plan, speckit-tasks, speckit-analyze, speckit-checklist, speckit-implement) — auto-discovered by VS Code from `.github/skills/`
- `installSpeckitSkills()` function; Speckit skills are now installed automatically alongside BEADS+ prompts
- `/acli.create.agent` slash command prompt — interactively scaffolds a new `.agent.md` file in `.github/agents/`
- `/acli.create.skill` slash command prompt — interactively scaffolds a new `.skill.md` file in `.github/skills/`

### Changed
- Prompt install path changed from `.github/copilot/` to `.github/prompts/` (correct VS Code discovery path)
- `acli create agent` and `acli create skill` CLI commands replaced by `/acli.create.agent` and `/acli.create.skill` Copilot Chat slash commands
- Skills are no longer listed in `tools` arrays — they are auto-discovered by VS Code and referenced by name in agent instructions

### Removed
- `acli create <type>` CLI command and `src/commands/create.ts` module

## [1.0.4] - 2025-07-09

### Added
- BEADS+ slash commands installed to `.github/copilot/` via `acli install` — enables `/acli.beads.*` commands in Copilot Chat
- `installBeadsPrompts()` function in `src/commands/install.ts`
- Six prompt templates: `beads.constitution`, `beads.specify`, `beads.plan`, `beads.tasks`, `beads.analyze`, `beads.implement`
- `acli create agent` command to scaffold new `.agent.md` files
- `acli create skill` command to scaffold new `.skill.md` files

### Changed
- Agent config format changed to flat `.agent.md` files in `.github/agents/`
- `acli init` now sets up full `.github/` directory structure (agents, prompts, skills)

## [1.0.3] - 2025-07-05

### Added
- `acli run` command — runs the full BEADS+ orchestrated workflow for a given project goal
- `acli status` command — summarizes current workflow artifact state

### Changed
- OrchestratorAgent now reads agent configs from `.github/agents/` directory

## [1.0.2] - 2025-06-30

### Added
- `acli init` command — bootstraps `.github/agents/` with default agent configs

### Changed
- Agent memory and handover documents now stored under `.github/memory/`

## [1.0.1] - 2025-06-25

### Fixed
- `acli install` command now correctly resolves template paths relative to the npm package
- RequirementGatheringAgent handoff data passing to ArchitectureAgent

## [1.0.0] - 2026-03-13

### Initial Release - BEADS+ SpecKit Integrated Framework 🎉

Complete agent framework with integrated [BEADS+ SpecKit](https://github.com/jmanhype/speckit) workflow and Pivotal Labs practices.

#### Core Workflow Components
- **BeadsWorkflow Class**: TypeScript implementation of 8-phase BEADS+ workflow
  - Constitution management
  - Technology-agnostic specification generation
  - Technical planning
  - Task list generation with dependencies
  - Consistency analysis across artifacts
  - Priority-based delivery (P0-P3)

#### Agent Memory & Handover System 🧠
- **AgentMemory Class**: File-based memory system for persistent learning
  - Handover document creation and retrieval
  - Learning storage and smart querying
  - Dual format storage (JSON for machines, Markdown for humans)
  - Index files for efficient lookup
  - Success rate tracking for learnings
  
- **Handover Documents**: Structured context passing between agents
  - Development → Quality → Testing → Development feedback loop
  - Includes: files changed, decisions, issues, action items, context, learnings
  - Maintains full iteration history
  - Prevents context loss between agent transitions
  
- **Learning System**: Institutional knowledge accumulation
  - Automatically saves quality issues (critical/high severity)
  - Automatically saves test failures with resolutions
  - Automatically saves successful patterns
  - Loads relevant learnings before each task
  - Categories: security, performance, quality, testing, architecture, other
  - Severity levels: critical, high, medium, low
  - Tags for smart retrieval
  - Code examples (before/after)
  - Apply count and success rate tracking

- **Templates**:
  - `handover.template.md` - Structured handover document format
  - `learning.template.md` - Learning entry format with metrics

- **Storage**: `.specify/memory/` directory
  - `handovers/` - Agent handover documents
  - `learnings/` - Knowledge base of patterns and resolutions

#### Iterative Development Loop 🔄
- **Development → Quality → Testing** feedback cycle
  - Max 5 iterations per task
  - Quality review after every development cycle
  - Comprehensive testing with 100% pass requirement
  - Feedback handovers guide next iteration
  - Learnings captured from each cycle
  - Context maintained across all iterations

#### BEADS+ CLI Commands
- `acli beads constitution` - Create project constitution
- `acli beads specify` - Generate technology-agnostic feature specs
- `acli beads clarify` - Ask clarifying questions (max 3)
- `acli beads plan` - Create technical implementation plan
- `acli beads checklist` - Generate quality checklists
- `acli beads tasks` - Create executable task list
- `acli beads analyze` - Validate spec ↔ plan ↔ tasks consistency
- `acli beads implement` - Start implementation with TDD
- `acli beads workflow` - Execute full 8-phase workflow
- `acli beads status` - Check workflow status

#### Templates (9 new templates)
- `constitution.template.md` - Project principles and constraints
- `spec.template.md` - Technology-agnostic feature specification
- `plan.template.md` - Technical implementation plan with ADRs
- `tasks.template.md` - Executable task list with dependencies
- `checklist-security.template.md` - OWASP Top 10, authentication, encryption
- `checklist-accessibility.template.md` - WCAG 2.1 Level AA compliance
- `checklist-performance.template.md` - Core Web Vitals, API targets
- `handover.template.md` - Handover document structure for agent coordination
- `learning.template.md` - Learning entry format with tracking metrics

#### Updated Agents
- **Requirements Agent (v1.0.0)**: Complete BEADS+ integration
  - Constitution, Specify, Clarify phases
  - Technology-agnostic validation (enforced)
  - P0-P3 prioritization (Pivotal Labs)
  - Max 3 clarifying questions per round
  
- **Orchestrator Agent (v1.0.0)**: Full workflow orchestration with memory integration
  - 8-phase BEADS+ workflow coordination
  - Quality gate enforcement at every phase
  - 100% test pass requirement (mandatory)
  - Consistency validation before implementation
  - Phase-by-phase or full workflow execution
  - **Iterative development loop** (Dev → Quality → Test with max 5 iterations)
  - **Handover document creation** at each agent transition
  - **Learning system integration** (auto-save issues, auto-load relevant learnings)
  - **Context maintenance** across all iterations
  - **Success tracking** for applied learnings

#### Documentation
- `BEADS_WORKFLOW.md` - Complete BEADS+ workflow guide
  - All 8 phases explained in detail
  - Quality gates and test requirements
  - CLI commands and examples
  - Best practices (DO's and DON'Ts)
  - Agent integration guide
  - Complete end-to-end example

- `ITERATIVE_DEVELOPMENT.md` - Iterative development loop guide
  - Dev → Quality → Test feedback cycle
  - How iterations work
  - Benefits and metrics
  - Best practices
  - Comparison with traditional approaches
  - Complete examples

- `MEMORY_SYSTEM.md` - Agent memory and handover documentation
  - Handover document system
  - Learning system architecture
  - Storage format and structure
  - API reference (AgentMemory class)
  - Complete usage examples
  - Best practices for memory and handovers
  - Metrics and tracking

### Changed
- **Directory Structure**: Updated to GitHub standard
  - Agents now in `.github/agents/` (was `.vscode/agents/`)
  - Skills now in `.github/skills/` (was `.copilot/skills/`)
  - Follows GitHub directory conventions
  - All documentation and examples updated

- **Requirements Agent**: Now uses BEADS+ methodology
  - Technology-agnostic requirement enforced
  - Pivotal Labs user story format
  - P0 (Must Have) → P1 (Should Have) → P2 (Nice to Have) → P3 (Won't Have)
  
- **Orchestrator Agent**: Enhanced with BEADS+ orchestration
  - Manages complete workflow from constitution to deployment
  - Enforces quality gates
  - Validates consistency before implementation
  - Coordinates all 7 agents

### Quality Gates
- ✅ Constitution aligns with project goals
- ✅ Specifications are 100% technology-agnostic (no frameworks/libraries)
- ✅ All clarifying questions resolved
- ✅ Plan aligns with spec + constitution
- ✅ All checklists completed
- ✅ Tasks are dependency-ordered with tests defined
- ✅ Analyze validates consistency (no gaps, no conflicts)
- ✅ **100% tests pass** at task/story/feature levels (NO EXCEPTIONS)

### Methodology
- **Specification-Driven Development**: WHAT/WHY before HOW
- **Technology-Agnostic Specs**: No framework/library/tool names in specs
- **Incremental Delivery**: P0 (MVP) → P1 → P2 → P3
- **Test-Driven Development**: Tests required at task level
- **Quality at Every Phase**: 8 quality gates enforced
- **Pivotal Labs Practices**: User stories, IPM planning, TDD

### Pre-built Agents (7 Total)
1. **Requirements Agent**: BEADS+ specification-driven requirements
2. **Architecture Agent**: System design, patterns, and ADRs
3. **Security Agent**: Vulnerability detection and OWASP compliance
4. **Development Agent**: Code implementation and features
5. **Testing Agent**: Test generation and coverage
6. **Quality Agent**: Code quality and maintainability
7. **Orchestrator Agent**: Multi-agent workflow coordination

### CLI Commands
- `init` - Initialize agent framework in project
- `create` - Create custom agents and skills
- `list` - List available agents and skills
- `install` - Install pre-built agents
- `remove` - Remove agents from project
- `update` - Update agents to latest version
- `config` - Configure framework settings
- `beads <phase>` - Execute BEADS+ SpecKit workflow phases

### Framework Features
- TypeScript-based extensible architecture
- Agent and Skill base classes
- AgentManager for lifecycle management
- Template system for agents, skills, and BEADS+ documents
- VS Code + GitHub Copilot integration
- 8-phase BEADS+ workflow with quality gates
- Configuration management system
- Comprehensive documentation
- MIT License

## [Unreleased]

### Planned
- Agent marketplace
- Remote agent installation
- Agent versioning system
- More pre-built agents
- Agent testing framework
- VS Code extension
- Web-based agent editor
- Agent analytics and monitoring
- Multi-language support
- Agent composition and chaining
