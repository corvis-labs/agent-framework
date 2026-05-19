# Contributing to Agent Framework

Thank you for your interest in contributing! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Run tests and linters
6. Submit a pull request

## Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run linter
npm run lint
```

## Project Structure

## Project Structure

```
agent-framework/
├── src/
│   ├── cli.ts                  # CLI entry point (Commander program)
│   ├── commands/               # CLI command handlers
│   │   ├── init.ts             # acli init — platform selection, project scaffolding
│   │   ├── install.ts          # acli install — emit agent to all platforms
│   │   ├── remove.ts           # acli remove — remove from all platforms
│   │   ├── list.ts             # acli list agents|skills
│   │   ├── update.ts           # acli update — re-emit to all platforms
│   │   ├── setup.ts            # acli setup — dep install + speckit/beads init
│   │   ├── config.ts           # acli config
│   │   └── extensions.ts       # acli extensions list|add|remove|create|pack
│   ├── core/                   # Core framework classes
│   │   ├── Agent.ts            # Abstract Agent base class + TargetPlatform type
│   │   ├── AgentManager.ts     # File-based agent lifecycle manager
│   │   ├── PlatformEmitter.ts  # Writes agent files to platform-specific paths
│   │   └── PluginGenerator.ts  # Maintains Open Plugins .plugin/plugin.json manifest
│   └── agents/                 # Pre-built agent implementations
│       ├── index.ts
│       ├── architect/
│       ├── development/
│       ├── orchestrator/
│       ├── qa/
│       └── security/
├── templates/                  # Agent and skill templates
│   ├── agent.template.md
│   ├── skill.template.md
│   ├── prompts/                # Slash command prompt files
│   ├── skills/                 # Bundled skill files
│   └── beads/                  # Beads checklist templates
└── tests/                      # Test files
```

## Adding a New Pre-built Agent

1. Create a directory under `src/agents/<name>/`
2. Extend the `Agent` base class
3. Implement `generateAgentFile()` and `getInstructions()`
4. Export in `src/agents/index.ts`
5. Add tests and update documentation

```typescript
import { Agent, AgentMetadata, AgentConfig } from '../../core/Agent';

export class MyAgent extends Agent {
  constructor() {
    const metadata: AgentMetadata = {
      name: 'my-agent',
      displayName: 'My Agent',
      description: 'Description of what this agent does',
      version: '1.0.0',
      tags: ['tag1', 'tag2'],
    };
    super(metadata, {});
  }

  generateAgentFile(): string {
    return `${this.generateFrontmatter()}${this.getInstructions()}`;
  }

  getInstructions(): string {
    return `# My Agent\n\n...`;
  }
}
```

The base class `generateForPlatform(platform)` dispatches to the right generator for each `TargetPlatform`. Override `generateCursorRule()`, `generateWindsurfRule()`, or `generateClaudeSection()` if you need platform-specific output.

## Adding a New Platform

1. Add the value to the `TargetPlatform` union in `src/core/Agent.ts`
2. Add a `case` in `Agent.generateForPlatform()` and `platformDestPath()` in `PlatformEmitter.ts`
3. Add directory creation in `ensurePlatformDirs()` in `PlatformEmitter.ts`
4. Add the platform to `ALL_PLATFORMS` in `src/commands/init.ts`
5. Map the platform to a `specify --integration` value in `setup.ts`

## Building a Custom Plugin

Use the CLI to scaffold:

```bash
acli extensions create my-plugin --description "..." --author "You"
# Edit .agents/plugins/my-plugin/agents/my-plugin.agent.md
acli extensions pack my-plugin   # → my-plugin-v1.0.0.zip
```

See [EXAMPLES.md](EXAMPLES.md) for a full walkthrough.

## Code Style

- Use TypeScript
- Follow ESLint rules
- Format with Prettier
- Write descriptive commit messages
- Add JSDoc comments for public APIs

## Testing

- Write unit tests for new features
- Ensure all tests pass
- Maintain or improve code coverage
- Test CLI commands manually

## Documentation

- Update README.md for new features
- Add inline code comments
- Document breaking changes
- Update CHANGELOG.md

## Pull Request Process

1. Update documentation
2. Add tests for new features
3. Ensure CI passes
4. Request review from maintainers
5. Address review feedback
6. Squash commits if requested

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Questions?

Open an issue or discussion for:
- Feature requests
- Bug reports
- Design discussions
- General questions

Thank you for contributing!
