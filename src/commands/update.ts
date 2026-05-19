import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs-extra';
import { getPrebuiltAgents } from '../agents';
import { AgentManager } from '../core/AgentManager';
import { TargetPlatform } from '../core/Agent';
import { installPrompts } from './install';

export async function updateCommand(name?: string): Promise<void> {
  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, '.agent-framework.json');

  if (!(await fs.pathExists(configPath))) {
    console.error(chalk.red('Agent framework not initialized.'));
    process.exit(1);
  }

  const config = await fs.readJson(configPath);
  const platforms: TargetPlatform[] = config.platforms ?? ['copilot', 'open-plugins'];
  const agentManager = new AgentManager(projectRoot, config.agentsDir, platforms, config.version ?? '2.0.0');
  const prebuiltAgents = getPrebuiltAgents();

  if (name) {
    // Update specific agent
    await updateAgent(agentManager, prebuiltAgents, name);
  } else {
    // Update all installed agents
    const installed = await agentManager.listInstalled();

    if (installed.length === 0) {
      console.log(chalk.yellow('No agents installed.'));
    } else {
      console.log(chalk.cyan(`Updating ${installed.length} agent(s)...\n`));

      for (const agent of installed) {
        if (prebuiltAgents[agent.name]) {
          await updateAgent(agentManager, prebuiltAgents, agent.name);
        } else {
          console.log(chalk.gray(`Skipping custom agent: ${agent.name}`));
        }
      }
    }

    // Also update prompts and skills
    const promptsSpinner = ora('Updating prompts...').start();
    await installPrompts(projectRoot);
    promptsSpinner.succeed('Prompts updated.');
  }
}

async function updateAgent(
  agentManager: AgentManager,
  prebuiltAgents: Record<string, any>,
  name: string
): Promise<void> {
  const spinner = ora(`Updating ${name}...`).start();

  try {
    if (!prebuiltAgents[name]) {
      spinner.warn(`Agent "${name}" is not a pre-built agent. Skipping.`);
      return;
    }

    if (!(await agentManager.isInstalled(name))) {
      spinner.warn(`Agent "${name}" is not installed. Skipping.`);
      return;
    }

    const agent = prebuiltAgents[name];
    await agentManager.installAgent(agent, true);
    
    spinner.succeed(`Updated ${name}`);
  } catch (error) {
    spinner.fail(`Failed to update ${name}`);
    console.error(chalk.red((error as Error).message));
  }
}
