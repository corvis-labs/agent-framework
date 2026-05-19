import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AgentManager } from '../core/AgentManager';
import { TargetPlatform } from '../core/Agent';
import { ensurePlatformDirs } from '../core/PlatformEmitter';
import { getPrebuiltAgents } from '../agents';
import { installPrompts } from './install';
import { setupSpecKit, setupBeads } from './setup';

interface InitOptions {
  dir: string;
  agents?: string[];
  force?: boolean;
  platforms?: string[];
}

const ALL_PLATFORMS: { value: TargetPlatform; name: string }[] = [
  { value: 'copilot',      name: 'GitHub Copilot / VS Code  (.github/agents/)' },
  { value: 'cursor',       name: 'Cursor AI                 (.cursor/rules/)' },
  { value: 'claude',       name: 'Claude Code               (AGENTS.md)' },
  { value: 'windsurf',     name: 'Windsurf                  (.windsurf/rules/)' },
  { value: 'open-plugins', name: 'Open Plugins standard     (.agents/plugins/)' },  { value: 'opencode',     name: 'OpenCode                  (.opencode/agents/)' },];

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora('Initializing agent framework...').start();

  try {
    const projectRoot = path.resolve(options.dir);

    // --- Platform selection ---
    let selectedPlatforms: TargetPlatform[];
    if (options.platforms && options.platforms.length > 0) {
      selectedPlatforms = options.platforms as TargetPlatform[];
    } else {
      spinner.stop();
      const { platforms } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'platforms',
          message: 'Which AI editor platforms would you like to target?',
          choices: ALL_PLATFORMS,
          default: ['copilot', 'open-plugins'],
        },
      ]);
      selectedPlatforms = platforms.length > 0 ? platforms : ['copilot', 'open-plugins'];
      spinner.start('Initializing agent framework...');
    }

    // --- Ensure platform-specific directories ---
    await ensurePlatformDirs(selectedPlatforms, projectRoot);

    // Always create .vscode dir for VS Code settings
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
      platforms: selectedPlatforms,
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

    // Create README in agents directory (Copilot)
    const agentsDir = path.join(projectRoot, config.agentsDir);
    if (await fs.pathExists(agentsDir)) {
      const agentsReadme = path.join(agentsDir, 'README.md');
      await fs.writeFile(agentsReadme, `# AI Agents

This directory contains agent definitions installed by agent-framework.
Agents are automatically emitted to all configured platforms: ${selectedPlatforms.join(', ')}.

## Installation

Install all agents:
\`\`\`bash
acli install architect
\`\`\`

Or install individually:
- \`acli install architect\`  — System design, specifications, and technical planning
- \`acli install frontend\`   — Frontend and UI implementation
- \`acli install backend\`    — Backend services, APIs, and databases
- \`acli install qa\`         — Code review and quality assurance
- \`acli install security\`   — Security engineering and threat modeling

## Usage

| Platform       | Invocation                         |
|----------------|------------------------------------|
| GitHub Copilot | \`@architect\` in Copilot Chat      |
| Cursor         | \`@architect\` in Cursor chat       |
| Claude Code    | Loaded automatically from AGENTS.md|
| Windsurf       | Active via .windsurf/rules/        |
`, 'utf-8');
    }

    // Create README in skills directory
    const skillsDir = path.join(projectRoot, config.skillsDir);
    if (await fs.pathExists(skillsDir)) {
      const skillsReadme = path.join(skillsDir, 'README.md');
      await fs.writeFile(skillsReadme, `# Agent Skills

This directory contains reusable skills for AI agents.

## Create Custom Skills

\`\`\`bash
acli create skill
\`\`\`
`, 'utf-8');
    }

    spinner.succeed('Directory structure created.');

    // Install slash command prompts
    const promptsSpinner = ora('Installing slash command prompts...').start();
    await installPrompts(projectRoot);
    promptsSpinner.succeed('Slash command prompts installed.');

    // Install all built-in agents
    const agentsSpinner = ora('Installing built-in agents...').start();
    const agentManager = new AgentManager(projectRoot, config.agentsDir, selectedPlatforms, config.version);
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
    const specKitOk = await setupSpecKit(projectRoot, selectedPlatforms);
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
    console.log(chalk.green.bold('Agent Framework initialized successfully.'));
    console.log('');

    console.log(chalk.white('Platforms configured:'));
    const platformPaths: Record<string, string> = {
      copilot: '.github/agents/',
      cursor: '.cursor/rules/',
      claude: 'AGENTS.md',
      windsurf: '.windsurf/rules/',
      'open-plugins': '.agents/plugins/agent-framework/',
    };
    for (const p of selectedPlatforms) {
      console.log(chalk.gray(`  ${p.padEnd(14)} → ${platformPaths[p] ?? p}`));
    }

    console.log('');
    console.log(chalk.white('Next steps:'));
    console.log(chalk.cyan('  /acli.constitution') + chalk.gray(' - Create your project constitution'));
    console.log(chalk.cyan('  /acli.onboard') + chalk.gray('      - Onboard an existing project (brownfield)'));
    console.log(chalk.cyan('  /acli.specify') + chalk.gray('      - Define what you want to build'));
    console.log('');
    console.log(chalk.white('Documentation: ') + chalk.gray('https://github.com/ipranjal/agent-framework'));

  } catch (error) {
    spinner.fail('Failed to initialize agent framework');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
