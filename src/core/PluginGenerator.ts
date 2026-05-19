/**
 * PluginGenerator — creates and maintains the Open Plugins manifest.
 *
 * Spec: https://open-plugins.com/plugin-builders/specification
 *
 * Generates `.plugin/plugin.json` inside the plugin directory
 * (.agents/plugins/agent-framework/) so any conformant tool
 * (Cursor, Claude Code, etc.) can discover all installed agents, skills, and rules.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { AgentMetadata } from './Agent';

const PLUGIN_NAME = 'agent-framework';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: { name: string; url: string };
  homepage: string;
  repository: string;
  license: string;
  keywords: string[];
  agents: string;
  skills: string;
  rules: string;
}

/**
 * Returns the plugin root directory for the Open Plugins structure.
 */
export function getPluginDir(projectRoot: string): string {
  return path.join(projectRoot, '.agents', 'plugins', PLUGIN_NAME);
}

/**
 * Write (or overwrite) the `.plugin/plugin.json` manifest.
 * The manifest is rebuilt from the currently installed agent list each time.
 */
export async function writePluginManifest(
  projectRoot: string,
  installedAgents: AgentMetadata[],
  frameworkVersion = '2.0.0',
): Promise<string> {
  const pluginDir = getPluginDir(projectRoot);
  const manifestDir = path.join(pluginDir, '.plugin');
  await fs.ensureDir(manifestDir);

  const manifest: PluginManifest = {
    name: PLUGIN_NAME,
    version: frameworkVersion,
    description:
      'Multi-platform AI agent framework — specification-driven development lifecycle with quality gates and human-in-the-loop governance.',
    author: {
      name: 'Pranjal Pandey',
      url: 'https://github.com/ipranjal/agent-framework',
    },
    homepage: 'https://github.com/ipranjal/agent-framework',
    repository: 'https://github.com/ipranjal/agent-framework',
    license: 'MIT',
    keywords: [
      'agents',
      'ai',
      'spec-kit',
      'workflow',
      'quality-gates',
      'multi-platform',
      'copilot',
      'cursor',
      'claude',
      'windsurf',
      ...new Set(installedAgents.flatMap((a) => a.tags ?? [])),
    ],
    agents: './agents',
    skills: './skills',
    rules: './rules',
  };

  const manifestPath = path.join(manifestDir, 'plugin.json');
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  return manifestPath;
}

/**
 * Remove a named agent entry from the Open Plugins structure.
 * (File deletion is handled by AgentManager; this just updates the manifest.)
 */
export async function removeFromPluginManifest(
  projectRoot: string,
  agentName: string,
  remainingAgents: AgentMetadata[],
  frameworkVersion = '2.0.0',
): Promise<void> {
  const filtered = remainingAgents.filter((a) => a.name !== agentName);
  await writePluginManifest(projectRoot, filtered, frameworkVersion);
}
