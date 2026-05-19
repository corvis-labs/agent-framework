import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { getPrebuiltAgents } from '../agents';
import { AgentManager } from '../core/AgentManager';
import { TargetPlatform } from '../core/Agent';

interface ListOptions {
  installed?: boolean;
}

export async function listCommand(type: string, options: ListOptions): Promise<void> {
  if (type !== 'agents' && type !== 'skills') {
    console.error(chalk.red('Invalid type. Use "agents" or "skills"'));
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, '.agent-framework.json');

  if (type === 'agents') {
    await listAgents(projectRoot, configPath, options);
  } else {
    await listSkills(projectRoot, configPath, options);
  }
}

async function listAgents(projectRoot: string, configPath: string, options: ListOptions): Promise<void> {
  console.log(chalk.bold.cyan('\nAvailable Agents\n'));

  // List pre-built agents
  const prebuiltAgents = getPrebuiltAgents();
  
  console.log(chalk.bold('Pre-built Agents:'));
  console.log(chalk.gray('─'.repeat(50)));

  let installedAgents: Set<string> = new Set();

  // Check which agents are installed
  if (await fs.pathExists(configPath)) {
    const config = await fs.readJson(configPath);
    const platforms: TargetPlatform[] = config.platforms ?? ['copilot', 'open-plugins'];
    const agentManager = new AgentManager(projectRoot, config.agentsDir, platforms, config.version ?? '2.0.0');
    const installed = await agentManager.listInstalled();
    installedAgents = new Set(installed.map(a => a.name));
  }

  for (const [name, agent] of Object.entries(prebuiltAgents)) {
    const metadata = agent.getMetadata();
    const isInstalled = installedAgents.has(name);
    const status = isInstalled ? chalk.green('installed') : chalk.gray('not installed');
    
    if (!options.installed || isInstalled) {
      console.log(chalk.cyan(`\n  ${metadata.displayName}`));
      console.log(`    Name: ${chalk.yellow(name)}`);
      console.log(`    Description: ${metadata.description}`);
      console.log(`    Status: ${status}`);
      console.log(`    Version: ${metadata.version}`);
      if (metadata.tags && metadata.tags.length > 0) {
        console.log(`    Tags: ${metadata.tags.map(t => chalk.blue(t)).join(', ')}`);
      }
    }
  }

  // List custom agents if initialized
  if (await fs.pathExists(configPath)) {
    const config = await fs.readJson(configPath);
    const platforms: TargetPlatform[] = config.platforms ?? ['copilot', 'open-plugins'];
    const agentManager = new AgentManager(projectRoot, config.agentsDir, platforms, config.version ?? '2.0.0');
    const customAgents = await agentManager.listInstalled();
    const customOnly = customAgents.filter(a => !prebuiltAgents[a.name]);

    if (customOnly.length > 0) {
      console.log(chalk.bold('\n\nCustom Agents:'));
      console.log(chalk.gray('─'.repeat(50)));

      for (const agent of customOnly) {
        console.log(chalk.cyan(`\n  ${agent.displayName}`));
        console.log(`    Name: ${chalk.yellow(agent.name)}`);
        console.log(`    Description: ${agent.description}`);
        console.log(`    Status: ${chalk.green('installed')}`);
        console.log(`    Version: ${agent.version}`);
      }
    }
  }

  console.log(chalk.gray('\n' + '─'.repeat(50)));
  console.log(chalk.gray('\nTo install an agent: ') + chalk.cyan('acli install <name>'));
  console.log(chalk.gray('To create custom agent: ') + chalk.cyan('acli create agent\n'));
}

async function listSkills(projectRoot: string, configPath: string, options: ListOptions): Promise<void> {
  console.log(chalk.bold.cyan('\nAvailable Skills\n'));

  if (!(await fs.pathExists(configPath))) {
    console.log(chalk.yellow('Agent framework not initialized. Run "acli init" first.'));
    return;
  }

  const config = await fs.readJson(configPath);
  const skillsDir = path.join(projectRoot, config.skillsDir);

  if (!(await fs.pathExists(skillsDir))) {
    console.log(chalk.yellow('No skills directory found.'));
    return;
  }

  const skills = await scanSkillsDir(skillsDir);

  if (skills.length === 0) {
    console.log(chalk.yellow('No skills found.'));
    console.log(chalk.gray('Create a skill: ') + chalk.cyan('acli create skill\n'));
    return;
  }

  console.log(chalk.gray('─'.repeat(50)));

  for (const skill of skills) {
    console.log(chalk.cyan(`\n  ${skill.displayName || skill.name}`));
    console.log(`    Name: ${chalk.yellow(skill.name)}`);
    console.log(`    Description: ${skill.description}`);
    console.log(`    Version: ${skill.version}`);
    if (skill.tags && skill.tags.length > 0) {
      console.log(`    Tags: ${skill.tags.map((t: string) => chalk.blue(t)).join(', ')}`);
    }
  }

  console.log(chalk.gray('\n' + '─'.repeat(50)));
  console.log(chalk.gray('Create a new skill: ') + chalk.cyan('acli create skill\n'));
}

async function scanSkillsDir(dir: string, prefix = ''): Promise<any[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const skills: any[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subSkills = await scanSkillsDir(fullPath, `${prefix}${entry.name}/`);
      skills.push(...subSkills);
    } else if (entry.isFile() && entry.name.endsWith('.skill.md')) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const metadata = parseSkillMetadata(content);
      if (metadata) {
        const name = entry.name.replace('.skill.md', '');
        skills.push({ ...metadata, name, group: prefix || undefined });
      }
    }
  }

  return skills;
}

function parseSkillMetadata(content: string): any {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const metadata: any = {};

  const lines = frontmatter.split('\n');
  let currentKey = '';
  
  for (const line of lines) {
    if (line.includes(':') && !line.startsWith('  ')) {
      const [key, ...valueParts] = line.split(':');
      currentKey = key.trim();
      const value = valueParts.join(':').trim();
      
      if (value) {
        metadata[currentKey] = value;
      } else {
        metadata[currentKey] = [];
      }
    } else if (line.startsWith('  - ') && Array.isArray(metadata[currentKey])) {
      metadata[currentKey].push(line.substring(4).trim());
    }
  }

  return metadata;
}
