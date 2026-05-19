import * as path from 'path';
import * as fs from 'fs-extra';
import matter from 'gray-matter';
import { Agent, AgentMetadata, TargetPlatform } from './Agent';
import { emitAgent, emitAgentsClaude, platformDestPath } from './PlatformEmitter';
import { writePluginManifest, getPluginDir } from './PluginGenerator';

export class AgentManager {
  private projectRoot: string;
  /** Legacy Copilot agents dir — kept for backward compat with callers that read it. */
  private agentsDir: string;
  private platforms: TargetPlatform[];
  private frameworkVersion: string;
  private installedAgentsCache: Map<string, Agent> = new Map();

  constructor(
    projectRoot: string,
    agentsDir: string = '.github/agents',
    platforms: TargetPlatform[] = ['copilot', 'open-plugins'],
    frameworkVersion = '2.0.0',
  ) {
    this.projectRoot = projectRoot;
    this.agentsDir = path.join(projectRoot, agentsDir);
    this.platforms = platforms;
    this.frameworkVersion = frameworkVersion;
  }

  /**
   * Initialize required directories for all configured platforms.
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.agentsDir);
  }

  /**
   * Install an agent across all configured platforms.
   * Returns the map of { platform → written file path }.
   */
  async installAgent(agent: Agent, force = false): Promise<Map<TargetPlatform, string>> {
    const metadata = agent.getMetadata();

    // Guard: check primary Copilot location for duplicate detection
    if (this.platforms.includes('copilot')) {
      const copilotDest = platformDestPath(agent, 'copilot', this.projectRoot);
      if (!force && (await fs.pathExists(copilotDest))) {
        throw new Error(`Agent "${metadata.name}" already exists. Use --force to reinstall.`);
      }
    }

    // Emit non-Claude platforms
    const written = await emitAgent(agent, this.platforms, this.projectRoot, force);

    // Cache the agent instance so we can regenerate AGENTS.md later
    this.installedAgentsCache.set(metadata.name, agent);

    // Regenerate AGENTS.md if Claude is a target
    if (this.platforms.includes('claude')) {
      const allAgents = await this.loadCachedAgents();
      const claudeDest = await emitAgentsClaude(allAgents, this.projectRoot);
      written.set('claude', claudeDest);
    }

    // Update Open Plugins manifest
    if (this.platforms.includes('open-plugins')) {
      const allMeta = await this.listInstalled();
      await writePluginManifest(this.projectRoot, allMeta, this.frameworkVersion);
    }

    return written;
  }

  /**
   * Remove an agent from all platforms.
   */
  async removeAgent(name: string): Promise<boolean> {
    const copilotPath = path.join(this.agentsDir, `${name}.agent.md`);

    if (!(await fs.pathExists(copilotPath))) {
      // Try open-plugins location as fallback
      const pluginPath = path.join(
        getPluginDir(this.projectRoot),
        'agents',
        `${name}.agent.md`,
      );
      if (!(await fs.pathExists(pluginPath))) {
        throw new Error(`Agent "${name}" not found.`);
      }
    }

    // Remove from every platform location
    const dummyAgent = this.installedAgentsCache.get(name);
    if (dummyAgent) {
      for (const platform of this.platforms) {
        if (platform === 'claude') continue;
        const dest = platformDestPath(dummyAgent, platform, this.projectRoot);
        await fs.remove(dest);
      }
    } else {
      // Fall back to removing known paths by name
      await fs.remove(copilotPath);
      await fs.remove(path.join(this.projectRoot, '.cursor', 'rules', `${name}.mdc`));
      await fs.remove(path.join(this.projectRoot, '.windsurf', 'rules', `${name}.md`));
      await fs.remove(
        path.join(getPluginDir(this.projectRoot), 'agents', `${name}.agent.md`),
      );
    }

    this.installedAgentsCache.delete(name);

    // Regenerate AGENTS.md without the removed agent
    if (this.platforms.includes('claude')) {
      const remaining = await this.loadCachedAgents();
      await emitAgentsClaude(remaining, this.projectRoot);
    }

    // Update Open Plugins manifest
    if (this.platforms.includes('open-plugins')) {
      const remaining = await this.listInstalled();
      await writePluginManifest(this.projectRoot, remaining, this.frameworkVersion);
    }

    return true;
  }

  /**
   * List installed agents by scanning the primary Copilot agents directory.
   * Falls back to Open Plugins agents dir if the Copilot dir is absent.
   */
  async listInstalled(): Promise<AgentMetadata[]> {
    // Try Copilot dir first, then Open Plugins dir
    const dirs = [
      this.agentsDir,
      path.join(getPluginDir(this.projectRoot), 'agents'),
    ];

    const seen = new Set<string>();
    const agents: AgentMetadata[] = [];

    for (const dir of dirs) {
      if (!(await fs.pathExists(dir))) continue;

      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.agent.md')) continue;
        const agentFile = path.join(dir, entry.name);
        const metadata = await this.parseAgentMetadata(agentFile);
        if (metadata && !seen.has(metadata.name)) {
          seen.add(metadata.name);
          agents.push(metadata);
        }
      }
      // If we found agents in the first dir, don't double-count from the second
      if (agents.length > 0) break;
    }

    return agents;
  }

  /**
   * Check if an agent is installed (checks primary Copilot location).
   */
  async isInstalled(name: string): Promise<boolean> {
    const copilotPath = path.join(this.agentsDir, `${name}.agent.md`);
    return fs.pathExists(copilotPath);
  }

  /**
   * Parse agent metadata from an .agent.md file using gray-matter.
   */
  private async parseAgentMetadata(filePath: string): Promise<AgentMetadata | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const { data } = matter(raw);
      if (!data.name) return null;
      return {
        name: data.name,
        displayName: data.displayName ?? data.name,
        description: data.description ?? '',
        version: data.version ?? '1.0.0',
        author: data.author,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Load all agents currently in the cache (used for AGENTS.md regeneration).
   * When cache is cold (e.g. after restart), falls back to stubs from disk metadata.
   */
  private async loadCachedAgents(): Promise<Agent[]> {
    return [...this.installedAgentsCache.values()];
  }

  /** Returns the primary Copilot agents directory path. */
  getAgentsDir(): string {
    return this.agentsDir;
  }

  /** Returns configured target platforms. */
  getPlatforms(): TargetPlatform[] {
    return this.platforms;
  }
}
