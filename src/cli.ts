#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };
import { initCommand } from './commands/init';
import { listCommand } from './commands/list';
import { installCommand } from './commands/install';
import { removeCommand } from './commands/remove';
import { updateCommand } from './commands/update';
import { configCommand } from './commands/config';
import { setupCommand } from './commands/setup';
import {
  extensionsListCommand,
  extensionsAddCommand,
  extensionsRemoveCommand,
  extensionsCreateCommand,
  extensionsPackCommand,
} from './commands/extensions';

const program = new Command();

program
  .name('agent-cli')
  .description('Multi-platform AI agent framework — deploy agents to GitHub Copilot, Cursor, Claude Code, Windsurf, and more')
  .version(pkg.version);

// Initialize command
program
  .command('init')
  .description('Initialize agent framework in current project')
  .option('-d, --dir <directory>', 'Target directory', '.')
  .option('-a, --agents <agents...>', 'Pre-install specific agents')
  .option('-f, --force', 'Reinitialize even if already configured')
  .action(initCommand);

// List command
program
  .command('list <type>')
  .description('List available agents or skills (type: agents|skills)')
  .option('-i, --installed', 'Show only installed items')
  .action(listCommand);

// Install command
program
  .command('install <name>')
  .description('Install a pre-built agent')
  .option('-f, --force', 'Force reinstall if already exists')
  .action(installCommand);

// Remove command
program
  .command('remove <name>')
  .description('Remove an agent from project')
  .option('-y, --yes', 'Skip confirmation')
  .action(removeCommand);

// Update command
program
  .command('update [name]')
  .description('Update an agent or all agents to latest version')
  .action(updateCommand);

// Config command
program
  .command('config')
  .description('Configure framework settings')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .option('-g, --get <key>', 'Get a configuration value')
  .option('-l, --list', 'List all configuration')
  .action(configCommand);

// Setup command
program
  .command('setup')
  .description('Check and install all dependencies (spec-kit, beads, plugins)')
  .option('-d, --dir <directory>', 'Target directory', '.')
  .option('-c, --check', 'Check only, do not install')
  .action(setupCommand);

// Extensions command group
const extensions = program
  .command('extensions')
  .description('Manage speckit and open-plugins extensions');

extensions
  .command('list')
  .description('List installed extensions')
  .option('-a, --available', 'Also show available extensions from the built-in registry')
  .option('-e, --ecosystem <ecosystem>', 'Filter by ecosystem: speckit or open-plugins')
  .action(extensionsListCommand);

extensions
  .command('add <name>')
  .description('Install an extension by name (from registry) or URL (--from)')
  .option('--from <url>', 'Install from a custom HTTPS zip URL')
  .option('-e, --ecosystem <ecosystem>', 'Force ecosystem: speckit or open-plugins')
  .option('-f, --force', 'Overwrite if already installed')
  .action(extensionsAddCommand);

extensions
  .command('remove <name>')
  .description('Remove an installed extension')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(extensionsRemoveCommand);

extensions
  .command('create <name>')
  .description('Scaffold a new custom open-plugins plugin in .agents/plugins/<name>/')
  .option('-d, --description <text>', 'Plugin description')
  .option('-a, --author <name>', 'Author name')
  .option('--author-url <url>', 'Author URL')
  .option('-v, --version <version>', 'Initial version', '1.0.0')
  .option('--with-agent', 'Include a starter agent file')
  .option('--with-skill', 'Include a starter SKILL.md file')
  .option('-f, --force', 'Overwrite if plugin already exists')
  .action(extensionsCreateCommand);

extensions
  .command('pack <name>')
  .description('Package an installed plugin as a distributable zip')
  .option('-o, --output <filename>', 'Output zip filename (default: <name>-v<version>.zip)')
  .action(extensionsPackCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export default program;
