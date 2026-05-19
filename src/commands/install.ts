import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs-extra';
import { getPrebuiltAgents } from '../agents';
import { AgentManager } from '../core/AgentManager';
import { TargetPlatform } from '../core/Agent';

interface InstallOptions {
  force?: boolean;
}

// Prompt command files (v2: spec-kit delegates + superpowers-bridge + fleet)
const PROMPTS = [
  'acli.constitution.prompt.md',
  'acli.specify.prompt.md',
  'acli.clarify.prompt.md',
  'acli.plan.prompt.md',
  'acli.checklist.prompt.md',
  'acli.tasks.prompt.md',
  'acli.analyze.prompt.md',
  'acli.implement.prompt.md',
  'acli.run.prompt.md',
  'acli.onboard.prompt.md',
  'acli.debug.prompt.md',
  'acli.critique.prompt.md',
  'acli.respond.prompt.md',
  'acli.finish.prompt.md',
  'acli.create.agent.prompt.md',
  'acli.create.skill.prompt.md',
];

// Skill files installed into .github/skills/ (v2: only framework-specific skills remain)
const SKILLS = [
  'speckit-checklist.skill.md',
  'speckit-implement.skill.md',
  'speckit-onboard.skill.md',
];

export async function installSkills(projectRoot: string): Promise<void> {
  const destDir = path.join(projectRoot, '.github', 'skills');
  await fs.ensureDir(destDir);

  const skillsSourceDir = path.resolve(__dirname, '..', '..', 'templates', 'skills');

  for (const fileName of SKILLS) {
    const src = path.join(skillsSourceDir, fileName);
    const dest = path.join(destDir, fileName);
    if (await fs.pathExists(src)) {
      await fs.copyFile(src, dest);
    }
  }
}

export async function installPrompts(projectRoot: string): Promise<void> {
  const destDir = path.join(projectRoot, '.github', 'prompts');
  await fs.ensureDir(destDir);

  const promptsSourceDir = path.resolve(__dirname, '..', '..', 'templates', 'prompts');

  for (const fileName of PROMPTS) {
    const src = path.join(promptsSourceDir, fileName);
    const dest = path.join(destDir, fileName);
    if (await fs.pathExists(src)) {
      await fs.copyFile(src, dest);
    }
  }

  await installSkills(projectRoot);
}

export async function installCommand(name: string, options: InstallOptions): Promise<void> {
  const projectRoot = process.cwd();
  await installAgent(name, options, projectRoot);
}

export async function installAgent(name: string, options: InstallOptions, projectRoot: string): Promise<void> {
  const configPath = path.join(projectRoot, '.agent-framework.json');

  if (!(await fs.pathExists(configPath))) {
    console.error(chalk.red('Agent framework not initialized. Run "acli init" first.'));
    process.exit(1);
  }

  const config = await fs.readJson(configPath);
  const platforms: TargetPlatform[] = config.platforms ?? ['copilot', 'open-plugins'];
  const agentManager = new AgentManager(projectRoot, config.agentsDir, platforms, config.version ?? '2.0.0');

  // Get pre-built agents
  const prebuiltAgents = getPrebuiltAgents();

  if (!prebuiltAgents[name]) {
    console.error(chalk.red(`Agent "${name}" not found.`));
    console.log(chalk.gray('\nAvailable agents:'));
    for (const agentName of Object.keys(prebuiltAgents)) {
      console.log(chalk.cyan(`  - ${agentName}`));
    }
    process.exit(1);
  }

  // If installing orchestrator, install all agents + prompts
  if (name === 'orchestrator') {
    const spinner = ora('Installing orchestrator, all agents and slash commands...').start();
    const allAgents = Object.keys(prebuiltAgents);
    const installed: string[] = [];
    
    try {
      for (const agentName of allAgents) {
        const agent = prebuiltAgents[agentName];
        await agentManager.installAgent(agent, options.force);
        installed.push(agentName);
      }

      // Install prompt files
      await installPrompts(projectRoot);
      
      spinner.succeed('All agents and slash commands installed successfully.');
      console.log(chalk.cyan('\nInstalled agents:'));
      for (const agentName of installed) {
        console.log(chalk.gray(`  - ${agentName}`));
      }
      console.log(chalk.cyan('\nTarget platforms:'));
      for (const p of platforms) {
        console.log(chalk.gray(`  - ${p}`));
      }
      console.log(chalk.cyan('\nSlash commands installed:'));
      for (const p of PROMPTS) {
        console.log(chalk.gray(`  - /${p.replace('.prompt.md', '')}`));
      }
      console.log(chalk.cyan('\nSkills installed:'));
      for (const s of SKILLS) {
        console.log(chalk.gray(`  - ${s.replace('.skill.md', '')}`));
      }
      console.log(chalk.cyan('\nStart your workflow:'));
      console.log(chalk.gray('  GitHub Copilot: /acli.constitution'));
      console.log(chalk.gray('  Cursor/Claude:  open chat and reference @architect'));
    } catch (error) {
      spinner.fail('Failed to install agents');
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  } else {
    const spinner = ora(`Installing ${name} agent...`).start();

    try {
      const agent = prebuiltAgents[name];
      const written = await agentManager.installAgent(agent, options.force);

      spinner.succeed(`Agent "${name}" installed to ${written.size} platform(s).`);
      for (const [platform, dest] of written.entries()) {
        console.log(chalk.gray(`  ${platform.padEnd(14)} → ${dest.replace(process.cwd() + '/', '')}`));
      }
      console.log(chalk.cyan(`\nUse @${name} in your AI editor to invoke this agent.`));
    } catch (error) {
      spinner.fail(`Failed to install agent "${name}"`);
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
}
