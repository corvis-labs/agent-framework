import matter from 'gray-matter';
import { PromptOptimizer } from './PromptOptimizer';

export interface HandoffConfig {
  label: string;
  agent: string;
  prompt: string;
  send?: boolean;
}

export interface AgentMetadata {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  dependencies?: string[];
}

/**
 * Target output platforms supported by the framework.
 * - copilot:      GitHub Copilot / VS Code (.github/agents/*.agent.md)
 * - cursor:       Cursor AI (.cursor/rules/*.mdc)
 * - claude:       Claude Code (AGENTS.md)
 * - windsurf:     Windsurf (.windsurf/rules/*.md)
 * - open-plugins: Open Plugins canonical structure (.agents/plugins/<name>/)
 */
export type TargetPlatform = 'copilot' | 'cursor' | 'claude' | 'windsurf' | 'open-plugins';

export interface AgentConfig {
  // Legacy platform selector — kept for backward compatibility.
  // Prefer 'targetPlatforms' for new multi-platform configs.
  platform?: 'vscode' | 'github-copilot';

  // Shared attributes (all platforms)
  tools?: string[];
  github?: any;

  // VS Code / Copilot only attributes
  agents?: string[];
  argumentHint?: string;
  userInvocable?: boolean;
  model?: string;
  handoffs?: HandoffConfig[];
  disableModelInvocation?: boolean;

  // github-copilot only attributes
  infer?: boolean;
  mcpServers?: string[];

  /**
   * When true, all generated output passes through PromptOptimizer.compress().
   * Strips emoji from headers, removes boilerplate Identity/Communication sections,
   * and collapses blank lines — typically saves 15–25% of tokens.
   */
  compact?: boolean;
}

export abstract class Agent {
  protected metadata: AgentMetadata;
  protected config: AgentConfig;

  constructor(metadata: AgentMetadata, config: AgentConfig = {}) {
    this.metadata = metadata;
    this.config = config;
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return this.metadata;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Generate the agent definition file content (.agent.md)
   */
  abstract generateAgentFile(): string;

  /**
   * Get the agent's instructions
   */
  abstract getInstructions(): string;

  /**
   * Get the agent's system prompt (defaults to instructions)
   */
  getSystemPrompt(): string {
    return this.getInstructions();
  }

  /**
   * Spec-Kit workflow integration block, shared by all agents.
   * Each agent passes its own file list, fallback advice, and commands.
   */
  protected buildSpecKitBlock(options: {
    trigger?: string;
    files: Array<{ path: string; note: string }>;
    fallback: string;
    commands: Array<{ cmd: string; description: string }>;
    extraSections?: string;
  }): string {
    const trigger = options.trigger ?? 'Before every task';
    const fileList = options.files
      .map((f, i) => `${i + 1}. **\`${f.path}\`** — ${f.note}`)
      .join('\n');
    const cmdList = options.commands
      .map((c) => `- \`${c.cmd}\` — ${c.description}`)
      .join('\n');
    const extra = options.extraSections ? `\n${options.extraSections}` : '';
    return [
      '---',
      '',
      '## Spec-Kit Workflow Integration',
      '',
      `${trigger}, load these files if they exist:`,
      '',
      fileList,
      '',
      `If none exist: ${options.fallback}`,
      '',
      '### Slash Commands',
      cmdList,
      extra,
    ].join('\n');
  }

  /**
   * Generate agent file content for a specific target platform.
   * This is the primary entry point used by PlatformEmitter.
   */
  generateForPlatform(platform: TargetPlatform): string {
    const raw = this._generateForPlatformRaw(platform);
    return this.config.compact ? PromptOptimizer.compress(raw) : raw;
  }

  private _generateForPlatformRaw(platform: TargetPlatform): string {
    switch (platform) {
      case 'copilot':
        return this.generateAgentFile();
      case 'cursor':
        return this.generateCursorRule();
      case 'claude':
        return this.generateClaudeSection();
      case 'windsurf':
        return this.generateWindsurfRule();
      case 'open-plugins':
        return this.generateAgentFile(); // Open Plugins uses the canonical .agent.md format
      default:
        return this.generateAgentFile();
    }
  }

  /**
   * Generate a Cursor .mdc rule file.
   * Uses gray-matter to produce valid YAML frontmatter.
   */
  protected generateCursorRule(): string {
    const fm: Record<string, unknown> = {
      description: this.metadata.description,
      alwaysApply: false,
    };
    if (this.metadata.tags && this.metadata.tags.length > 0) {
      fm['globs'] = '';
    }
    return matter.stringify(`\n# ${this.metadata.displayName}\n\n${this.getInstructions()}`, fm);
  }

  /**
   * Generate a Windsurf rule file (.windsurf/rules/*.md).
   * Windsurf uses the same frontmatter format as Cursor.
   */
  protected generateWindsurfRule(): string {
    const fm: Record<string, unknown> = {
      description: this.metadata.description,
      trigger: 'always_on',
    };
    return matter.stringify(`\n# ${this.metadata.displayName}\n\n${this.getInstructions()}`, fm);
  }

  /**
   * Generate a markdown section for inclusion in AGENTS.md (Claude Code).
   * Each agent contributes one top-level section.
   */
  generateClaudeSection(): string {
    const tags = this.metadata.tags ? `\n_Tags: ${this.metadata.tags.join(', ')}_\n` : '';
    return `## ${this.metadata.displayName}\n\n> ${this.metadata.description}\n${tags}\n${this.getInstructions()}\n`;
  }

  /**
   * Generate YAML frontmatter for agent file.
   * The 'target' field is the platform selector:
   *   target: vscode        — enables agents, argument-hint, handoffs, model, user-invocable, disable-model-invocation
   *   target: github-copilot — enables infer, mcp-servers
   * Both platforms support: description, github, name, target, tools
   */
  protected generateFrontmatter(): string {
    const platform = this.config.platform ?? 'vscode';
    const isGitHubCopilot = platform === 'github-copilot';

    const yaml: any = {
      name: this.metadata.name,
      description: this.metadata.description,
      target: platform
    };

    // tools — supported by both platforms
    if (this.config.tools && this.config.tools.length > 0) {
      yaml.tools = this.config.tools;
    }

    // github — supported by both platforms
    if (this.config.github) {
      yaml.github = this.config.github;
    }

    if (isGitHubCopilot) {
      // github-copilot only attributes
      if (this.config.infer !== undefined) {
        yaml.infer = this.config.infer;
      }
      if (this.config.mcpServers && this.config.mcpServers.length > 0) {
        yaml['mcp-servers'] = this.config.mcpServers;
      }
    } else {
      // vscode only attributes
      if (this.config.argumentHint) {
        yaml['argument-hint'] = this.config.argumentHint;
      }
      if (this.config.agents && this.config.agents.length > 0) {
        yaml.agents = this.config.agents;
      }
      if (this.config.handoffs && this.config.handoffs.length > 0) {
        yaml.handoffs = this.config.handoffs;
      }
      if (this.config.model) {
        yaml.model = this.config.model;
      }
      if (this.config.userInvocable !== undefined) {
        yaml['user-invocable'] = this.config.userInvocable;
      }
      if (this.config.disableModelInvocation !== undefined) {
        yaml['disable-model-invocation'] = this.config.disableModelInvocation;
      }
    }

    return this.yamlStringify(yaml);
  }

  /**
   * Simple YAML stringifier — handles flat values, string arrays, and object arrays
   */
  private yamlStringify(obj: any): string {
    let yaml = '---\n';
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        yaml += `${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const entries = Object.entries(item as Record<string, unknown>);
            entries.forEach(([k, v], i) => {
              const prefix = i === 0 ? '  - ' : '    ';
              yaml += `${prefix}${k}: ${this.yamlValue(v)}\n`;
            });
          } else {
            yaml += `  - ${item}\n`;
          }
        }
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }
    yaml += '---\n\n';
    return yaml;
  }

  private yamlValue(v: unknown): string {
    if (typeof v === 'boolean') return String(v);
    const s = String(v);
    // Quote strings containing YAML-special characters
    if (/[:#\[\]{}|>&*?!,'"`%@-]/.test(s) || s.includes('\n') || s !== s.trim()) {
      return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return s;
  }
}
