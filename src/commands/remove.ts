import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs-extra';
import { AgentManager } from '../core/AgentManager';
import { TargetPlatform } from '../core/Agent';

interface RemoveOptions {
  yes?: boolean;
}

export async function removeCommand(name: string, options: RemoveOptions): Promise<void> {
  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, '.agent-framework.json');

  if (!(await fs.pathExists(configPath))) {
    console.error(chalk.red('Agent framework not initialized.'));
    process.exit(1);
  }

  const config = await fs.readJson(configPath);
  const platforms: TargetPlatform[] = config.platforms ?? ['copilot', 'open-plugins'];
  const agentManager = new AgentManager(projectRoot, config.agentsDir, platforms, config.version ?? '2.0.0');

  // Check if agent is installed
  if (!(await agentManager.isInstalled(name))) {
    console.error(chalk.red(`Agent "${name}" is not installed.`));
    process.exit(1);
  }

  // Confirm removal
  if (!options.yes) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove agent "${name}"?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Removal cancelled.'));
      return;
    }
  }

  const spinner = ora(`Removing ${name} agent...`).start();

  try {
    await agentManager.removeAgent(name);
    spinner.succeed(`Agent "${name}" removed.`);
  } catch (error) {
    spinner.fail(`Failed to remove agent "${name}"`);
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
