import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { AgentManager } from '../core/AgentManager';
import { getPrebuiltAgents } from '../agents';
import { installPrompts } from './install';
import { setupSpecKit, setupBeads } from './setup';

interface InitOptions {
  dir: string;
  agents?: string[];
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora('Initializing agent framework...').start();

  try {
    const projectRoot = path.resolve(options.dir);

    // Create .github directory structure
    const githubDir = path.join(projectRoot, '.github');
    await fs.ensureDir(githubDir);

    const agentsDir = path.join(githubDir, 'agents');
    await fs.ensureDir(agentsDir);

    const skillsDir = path.join(githubDir, 'skills');
    await fs.ensureDir(skillsDir);

    // Create .vscode directory for VS Code settings
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.ensureDir(vscodeDir);

    // Create config file
    const configPath = path.join(projectRoot, '.agent-framework.json');
    if (await fs.pathExists(configPath)) {
      if (!options.force) {
        spinner.fail('Agent framework already initialized. Use --force to reinitialize.');
        process.exit(1);
      }
    }
    const config = {
        version: '2.0.0',
        agentsDir: '.github/agents',
        skillsDir: '.github/skills',
        promptsDir: '.github/prompts',
        dependencies: {
          'spec-kit': { enabled: true, version: 'bundled' },
          superpowers: { enabled: true, version: 'bundled' },
          beads: { enabled: true, requireCli: false }
        },
        enterprise: {
          tone: 'formal',
          emojis: false
        },
        defaultAgents: options.agents || [],
        customSettings: {}
      };
    await fs.writeJson(configPath, config, { spaces: 2 });

    // Create VS Code extensions.json
    const extensionsPath = path.join(vscodeDir, 'extensions.json');
    if (!(await fs.pathExists(extensionsPath))) {
      const extensions = {
        recommendations: [
          'github.copilot',
          'github.copilot-chat'
        ]
      };
      await fs.writeJson(extensionsPath, extensions, { spaces: 2 });
    }

    // Create README in agents directory
    const agentsReadme = path.join(agentsDir, 'README.md');
    await fs.writeFile(agentsReadme, `# GitHub Copilot Agents

This directory contains AI agents for GitHub Copilot.

## Installation

Install all agents:
\`\`\`bash
acli install orchestrator
\`\`\`

Or install individually:
- \`acli install architect\` - Requirements, specifications, and architecture
- \`acli install security\` - Security analysis
- \`acli install development\` - Code implementation
- \`acli install qa\` - Testing and code quality
- \`acli install orchestrator\` - Multi-agent coordination

## Usage

In VS Code Copilot Chat, use \`@agentname\` to invoke agents.

Example:
\`\`\`
@architect gather requirements for user authentication
\`\`\`
`, 'utf-8');

    // Create README in skills directory
    const skillsReadme = path.join(skillsDir, 'README.md');
    await fs.writeFile(skillsReadme, `# GitHub Copilot Skills

This directory contains reusable skills for GitHub Copilot agents.

## Create Custom Skills

\`\`\`bash
acli create skill
\`\`\`
`, 'utf-8');

    spinner.succeed('Directory structure created.');

    // Install slash command prompts
    const promptsSpinner = ora('Installing slash command prompts...').start();
    await installPrompts(projectRoot);
    promptsSpinner.succeed('Slash command prompts installed.');

    // Install all built-in agents
    const agentsSpinner = ora('Installing built-in agents...').start();
    const agentManager = new AgentManager(projectRoot, config.agentsDir);
    const prebuiltAgents = getPrebuiltAgents();
    const installedAgents: string[] = [];

    for (const [agentName, agent] of Object.entries(prebuiltAgents)) {
      try {
        await agentManager.installAgent(agent, true);
        installedAgents.push(agentName);
      } catch (error) {
        console.log(chalk.yellow(`  Warning: failed to install ${agentName}: ${(error as Error).message}`));
      }
    }
    agentsSpinner.succeed(`Installed ${installedAgents.length} built-in agents.`);

    // Init spec-kit and beads for the project (tools already installed by acli setup)
    const specKitOk = await setupSpecKit(projectRoot);
    const beadsOk   = await setupBeads(projectRoot);

    // Update config with actual dependency status
    config.dependencies['spec-kit'].version = specKitOk ? 'cli' : 'unavailable';
    config.dependencies.beads.enabled = beadsOk;
    config.dependencies.beads.requireCli = beadsOk;
    await fs.writeJson(configPath, config, { spaces: 2 });

    // Install additional default agents if specified
    if (options.agents && options.agents.length > 0) {
      console.log(chalk.cyan('\nInstalling additional specified agents...'));
      for (const agentName of options.agents) {
        if (!installedAgents.includes(agentName)) {
          const agentSpinner = ora(`Installing ${agentName}...`).start();
          try {
            const { installAgent } = await import('./install');
            await installAgent(agentName, { force: false }, projectRoot);
            agentSpinner.succeed(`Installed ${agentName}`);
          } catch (error) {
            agentSpinner.fail(`Failed to install ${agentName}`);
            console.error(chalk.red((error as Error).message));
          }
        }
      }
    }

    // Success message
    console.log('');
    console.log(chalk.green.bold('Agent Framework v2 initialized successfully.'));
    console.log('');

    console.log(chalk.white('Next steps:'));
    console.log(chalk.cyan('  /acli.onboard') + chalk.gray('      - Onboard an existing project (brownfield)'));
    console.log(chalk.cyan('  /acli.constitution') + chalk.gray(' - Create your project constitution'));
    console.log(chalk.cyan('  /acli.run') + chalk.gray('          - Run the full fleet orchestrator'));
    console.log(chalk.cyan('  /acli.specify') + chalk.gray('      - Define what you want to build'));
    console.log('');
    console.log(chalk.white('Installed to:'));
    console.log(chalk.gray('  Agents:  .github/agents/'));
    console.log(chalk.gray('  Prompts: .github/prompts/'));
    console.log(chalk.gray('  Skills:  .github/skills/'));
    console.log(chalk.gray('  Specs:   .specify/'));
    console.log('');
    console.log(chalk.white('Documentation: ') + chalk.gray('https://github.com/ipranjal/agent-framework'));

  } catch (error) {
    spinner.fail('Failed to initialize agent framework');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
