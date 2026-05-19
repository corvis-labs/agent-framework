# Examples

## Full Lifecycle: Build a Feature

This example walks through the complete specification-driven workflow for adding a search feature.

### 1. Start the workflow

```
/acli.run Add full-text search to the product catalog with filters and pagination
```

The orchestrator guides you through all 10 phases automatically. At each human gate, you review the artifacts and approve or request revisions.

### 2. What gets created

```
.specify/
  memory/
    constitution.md
    reference-architecture.md
    quality-standards.md
  specs/
    001-product-search/
      spec.md
      plan.md
      tasks.md
      analysis.md
      checklists/
        security.md
        accessibility.md
        performance.md
```

### 3. Implementation loop

For each task, the orchestrator runs:
1. `@development` implements the task
2. `@qa` reviews via `/acli.critique`
3. `@qa` runs tests
4. If issues found: `/acli.respond` to fix, then re-review
5. If clean: mark done, next task

---

## Multi-Platform Setup

Target all editors at once:

```bash
acli init --platforms copilot cursor claude windsurf open-plugins
```

After init, every `acli install` emits to all platforms:

```
.github/agents/architect.agent.md          ← Copilot
.cursor/rules/architect.mdc                ← Cursor
.windsurf/rules/architect.md               ← Windsurf
.agents/plugins/agent-framework/agents/    ← Open Plugins
AGENTS.md                                  ← Claude Code (aggregated)
```

To add a new platform later without reinitialising:

```bash
# Edit .agent-framework.json — add "cursor" to "platforms" array
acli update   # re-emits all agents to new + existing platforms
```

---

## Custom Plugin: Domain-Specific Agent

Build a plugin for a specific domain (e.g., database migrations):

```bash
acli extensions create db-migrations \
  --description "Agent and skill for database migration workflows" \
  --author "Your Name" \
  --with-agent \
  --with-skill
```

This scaffolds:

```
.agents/plugins/db-migrations/
  .plugin/plugin.json
  agents/db-migrations.agent.md    ← edit with your migration expertise
  skills/db-migrations/SKILL.md    ← edit with step-by-step guidance
  rules/                           ← add platform rules here
```

Edit the agent file and add domain knowledge, then share it:

```bash
acli extensions pack db-migrations
# → db-migrations-v1.0.0.zip

# Team member installs it:
acli extensions add db-migrations --from https://yourhost.com/db-migrations-v1.0.0.zip
```

---

## Onboarding an Existing Project

```
/acli.onboard
```

The brownfield onboarding scans your codebase and produces:
- Constitution with principles derived from your actual code
- Reference architecture mapping your real directory structure
- Quality standards extracted from your linter/test config

---

## Debugging a Bug

```
/acli.debug Users get a 500 error when uploading files larger than 10MB
```

The debug workflow:
1. Captures the symptom precisely
2. Forms ranked hypotheses
3. Tests each systematically
4. Implements minimal fix with test coverage
5. Suggests prevention measures

---

## Code Review

```
/acli.critique src/services/payment.ts src/services/auth.ts
```

Produces a structured review checking:
- Spec alignment (does it match what was specified?)
- Plan conformance (correct architecture layer?)
- Constitution compliance (follows project principles?)
- Security (OWASP Top 10)
- Test coverage

---

## Branch Completion

```
/acli.finish squash
```

Runs pre-completion checklist, cleans up debug artifacts, drafts conventional commit messages, and recommends merge strategy.

---

## Creating a Custom Agent

```
/acli.create.agent
```

Interactive prompts guide you through:
- Agent name and description
- Tools and agent references
- Handoff configuration
- Instructions template

The result is a `.agent.md` file emitted to all configured platforms.

---

## Using Individual Phases

### Constitution

```
/acli.constitution
```

Creates the project constitution — the single source of truth for how the project is built.

### Specification

```
/acli.specify Add OAuth2 login with Google and GitHub providers
```

Creates a technology-agnostic spec with user stories, acceptance criteria, and P0–P3 priorities.

### Clarification

```
/acli.clarify
```

Identifies ambiguities in the spec and asks targeted questions (max 5) with suggested answers.

### Planning

```
/acli.plan
```

Creates the technical plan with file structure, ADRs, and testing strategy.

### Quality Checklists

```
/acli.checklist all
/acli.checklist security
```

Generates domain-specific checklists that become gates during implementation.

### Task Breakdown

```
/acli.tasks
```

Creates a dependency-ordered task list with test requirements for each task.

### Consistency Analysis

```
/acli.analyze
```

Cross-references spec, plan, and tasks to find gaps and conflicts.

### Implementation

```
/acli.implement
/acli.implement start from TASK-005
```

Implements tasks one at a time with the Dev -> Critique -> Test review loop.


### 2. What gets created

```
.specify/
  memory/
    constitution.md           -- project principles (created once)
    reference-architecture.md -- architecture reference
    quality-standards.md      -- quality rules
  specs/
    001-product-search/
      spec.md                 -- feature specification
      plan.md                 -- technical plan
      tasks.md                -- task list
      analysis.md             -- consistency analysis
      checklists/
        security.md
        accessibility.md
        performance.md
```

### 3. Implementation loop

For each task, the orchestrator runs:
1. `@development` implements the task
2. `@qa` reviews via `/acli.critique`
3. `@qa` runs tests
4. If issues found: `/acli.respond` to fix, then re-review
5. If clean: mark done, next task

## Onboarding an Existing Project

```
/acli.onboard
```

The brownfield onboarding scans your codebase and produces:
- Constitution with principles derived from your actual code
- Reference architecture mapping your real directory structure
- Quality standards extracted from your linter/test config

## Debugging a Bug

```
/acli.debug Users get a 500 error when uploading files larger than 10MB
```

The debug workflow:
1. Captures the symptom precisely
2. Forms ranked hypotheses
3. Tests each systematically
4. Implements minimal fix with test coverage
5. Suggests prevention measures

## Code Review

```
/acli.critique src/services/payment.ts src/services/auth.ts
```

Produces a structured review checking:
- Spec alignment (does it match what was specified?)
- Plan conformance (correct architecture layer?)
- Constitution compliance (follows project principles?)
- Security (OWASP Top 10 checks)
- Test coverage

## Branch Completion

```
/acli.finish squash
```

Runs pre-completion checklist, cleans up debug artifacts, drafts conventional commit messages, and recommends merge strategy.

## Creating a Custom Agent

```
/acli.create.agent
```

Interactive prompts guide you through:
- Agent name and description
- Platform target (VS Code or GitHub Copilot)
- Tools and agent references
- Handoff configuration
- Instructions template

The result is a `.agent.md` file in `.github/agents/`.

## Using Individual Phases

### Constitution (project setup)

```
/acli.constitution
```

Creates the project constitution -- the single source of truth for how the project is built. All agents respect it.

### Specification (what to build)

```
/acli.specify Add OAuth2 login with Google and GitHub providers
```

Creates a technology-agnostic spec with user stories, acceptance criteria, and P0-P3 priorities.

### Clarification (resolve unknowns)

```
/acli.clarify
```

Identifies ambiguities in the spec and asks targeted questions (max 5) with suggested answers.

### Planning (how to build)

```
/acli.plan
```

Creates the technical plan with file structure, ADRs, and testing strategy.

### Quality Checklists

```
/acli.checklist all
/acli.checklist security
```

Generates domain-specific checklists that become gates during implementation.

### Task Breakdown

```
/acli.tasks
```

Creates a dependency-ordered task list with test requirements for each task.

### Consistency Analysis

```
/acli.analyze
```

Cross-references spec, plan, and tasks to find gaps and conflicts.

### Implementation

```
/acli.implement
/acli.implement start from TASK-005
```

Implements tasks one at a time with the Dev -> Critique -> Test review loop.
