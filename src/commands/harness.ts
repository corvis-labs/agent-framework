import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { TargetPlatform } from '../core/Agent';
import { ensurePlatformDirs } from '../core/PlatformEmitter';
import { AgentManager } from '../core/AgentManager';
import { getPrebuiltAgents } from '../agents';
import { installPrompts } from './install';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json') as { version: string };

const isWindows = process.platform === 'win32';

// ─── Harness Catalogue ────────────────────────────────────────────────────────

export interface InstallOption {
  /** Package manager / method name shown in the install hint */
  manager: string;
  /** Full shell command to run */
  cmd: string;
}

export interface HarnessDefinition {
  /** Short identifier used in CLI: `acli use <id>` */
  id: string;
  displayName: string;
  url: string;
  /** Maps to an existing TargetPlatform — runs full agent + prompt + skill emit. */
  platform?: TargetPlatform;
  /** VS Code extension ID added to .vscode/extensions.json */
  vscodeExtension?: string;
  /** Binary name used to probe whether the tool is already installed */
  cliCommand?: string;
  /** Install options tried in order; first whose manager binary exists wins */
  installOptions?: InstallOption[];
  /** How to launch the tool once installed (shown in the summary) */
  launchHint?: string;
  /** One-line description of what gets created */
  description: string;
  /** Printed to the user after successful setup */
  afterNote: string;
}

export const HARNESSES: HarnessDefinition[] = [
  // ── Platform-mapped ───────────────────────────────────────────────────────
  {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    url: 'https://github.com/features/copilot',
    platform: 'copilot',
    vscodeExtension: 'github.copilot-chat',
    cliCommand: 'code',
    installOptions: [
      { manager: 'code', cmd: 'code --install-extension github.copilot-chat' },
    ],
    launchHint: 'code .',
    description: 'GitHub Copilot via VS Code  (.github/agents/)',
    afterNote: 'Invoke agents with @architect, @frontend, @backend in Copilot Chat.',
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    url: 'https://cursor.sh',
    platform: 'cursor',
    cliCommand: 'cursor',
    installOptions: [
      { manager: 'brew', cmd: 'brew install --cask cursor' },
    ],
    launchHint: 'cursor .',
    description: 'Cursor AI rules              (.cursor/rules/)',
    afterNote: 'Agents appear as @architect, @frontend, @backend in Cursor chat.',
  },
  {
    id: 'claude',
    displayName: 'Claude Code',
    url: 'https://docs.anthropic.com/en/docs/claude-code',
    platform: 'claude',
    cliCommand: 'claude',
    installOptions: [
      { manager: 'npm', cmd: 'npm install -g @anthropic-ai/claude-code' },
    ],
    launchHint: 'claude',
    description: 'Claude Code agents           (AGENTS.md)',
    afterNote: 'Agent instructions are loaded automatically from AGENTS.md.',
  },
  {
    id: 'windsurf',
    displayName: 'Windsurf',
    url: 'https://codeium.com/windsurf',
    platform: 'windsurf',
    cliCommand: 'windsurf',
    installOptions: [
      { manager: 'brew', cmd: 'brew install --cask windsurf' },
    ],
    launchHint: 'windsurf .',
    description: 'Windsurf rules               (.windsurf/rules/)',
    afterNote: 'Rules are activated automatically from .windsurf/rules/.',
  },
  {
    id: 'opencode',
    displayName: 'OpenCode',
    url: 'https://opencode.ai',
    platform: 'opencode',
    cliCommand: 'opencode',
    installOptions: [
      { manager: 'npm', cmd: 'npm install -g opencode' },
    ],
    launchHint: 'opencode',
    description: 'OpenCode agents              (.opencode/agents/)',
    afterNote: 'Agents are available in OpenCode from .opencode/agents/.',
  },
  // ── CLI-only harnesses ────────────────────────────────────────────────────
  {
    id: 'aider',
    displayName: 'Aider',
    url: 'https://aider.chat',
    cliCommand: 'aider',
    installOptions: [
      { manager: 'uv',   cmd: 'uv tool install aider-chat' },
      { manager: 'pipx', cmd: 'pipx install aider-chat' },
      { manager: 'brew', cmd: 'brew install aider' },
      { manager: 'pip',  cmd: 'pip install aider-chat' },
    ],
    launchHint: 'aider',
    description: 'Aider config + context       (.aider.conf.yml + AGENTS.md)',
    afterNote: 'Run "aider" in the project root — AGENTS.md is included automatically.',
  },
  {
    id: 'codex',
    displayName: 'OpenAI Codex CLI',
    url: 'https://github.com/openai/codex',
    platform: 'claude',   // Codex reads AGENTS.md natively
    cliCommand: 'codex',
    installOptions: [
      { manager: 'npm', cmd: 'npm install -g @openai/codex' },
    ],
    launchHint: 'codex',
    description: 'OpenAI Codex CLI context     (AGENTS.md)',
    afterNote: 'Run "codex" in the project root — AGENTS.md is read automatically.',
  },
  {
    id: 'gemini',
    displayName: 'Gemini CLI',
    url: 'https://github.com/google-gemini/gemini-cli',
    cliCommand: 'gemini',
    installOptions: [
      { manager: 'npm', cmd: 'npm install -g @google/gemini-cli' },
    ],
    launchHint: 'gemini',
    description: 'Gemini CLI context           (GEMINI.md + .gemini/)',
    afterNote: 'Run "gemini" in the project root — GEMINI.md is read automatically.',
  },
  {
    id: 'pi',
    displayName: 'Pi',
    url: 'https://pi.dev',
    platform: 'claude',   // Pi reads AGENTS.md natively
    cliCommand: 'pi',
    installOptions: [
      { manager: 'npm',  cmd: 'npm install -g @earendil-works/pi-coding-agent' },
      { manager: 'curl', cmd: 'curl -fsSL https://pi.dev/install.sh | sh' },
    ],
    launchHint: 'pi',
    description: 'Pi terminal harness          (AGENTS.md + .pi/settings.json)',
    afterNote: 'Run "pi" in the project root — AGENTS.md and skills are loaded automatically.',
  },
  // ── VS Code extension harnesses ───────────────────────────────────────────
  {
    id: 'cline',
    displayName: 'Cline',
    url: 'https://cline.bot',
    vscodeExtension: 'saoudrizwan.claude-dev',
    cliCommand: 'code',
    installOptions: [
      { manager: 'code', cmd: 'code --install-extension saoudrizwan.claude-dev' },
    ],
    launchHint: 'code .',
    description: 'Cline project rules          (.clinerules)',
    afterNote: 'Project rules are loaded from .clinerules by Cline automatically.',
  },
  {
    id: 'continue',
    displayName: 'Continue',
    url: 'https://continue.dev',
    vscodeExtension: 'Continue.continue',
    cliCommand: 'code',
    installOptions: [
      { manager: 'code', cmd: 'code --install-extension Continue.continue' },
    ],
    launchHint: 'code .',
    description: 'Continue config              (.continue/config.yaml)',
    afterNote: 'Edit .continue/config.yaml to add models. Agent context is pre-configured.',
  },
];

// ─── CLI detection helpers ────────────────────────────────────────────────────

function commandExists(cmd: string): boolean {
  try {
    execSync(isWindows ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd: string): string | undefined {
  for (const flag of ['--version', '-v', 'version']) {
    try {
      const out = execSync(`${cmd} ${flag}`, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 })
        .trim()
        .split('\n')[0];
      if (out) return out;
    } catch { /* try next flag */ }
  }
  return undefined;
}

/**
 * Try each install option in order; return true if the CLI is found after install.
 */
async function runInstall(harness: HarnessDefinition, spinner: ReturnType<typeof ora>): Promise<boolean> {
  const opts = harness.installOptions ?? [];
  if (opts.length === 0) {
    spinner.warn(`No automatic install available for ${harness.displayName}.`);
    return false;
  }

  for (const opt of opts) {
    if (!commandExists(opt.manager)) continue;
    spinner.text = `Installing ${harness.displayName} via ${opt.manager}…`;
    try {
      execSync(opt.cmd, { stdio: 'ignore', timeout: 120_000 });
      if (!harness.cliCommand || commandExists(harness.cliCommand)) {
        spinner.succeed(`${harness.displayName} installed via ${opt.manager}.`);
        return true;
      }
    } catch { /* try next */ }
  }

  spinner.warn(`Could not install ${harness.displayName} automatically.`);
  return false;
}

// ─── VS Code extension helper ─────────────────────────────────────────────────

async function addVscodeExtension(projectRoot: string, extensionId: string): Promise<void> {
  const extPath = path.join(projectRoot, '.vscode', 'extensions.json');
  await fs.ensureDir(path.join(projectRoot, '.vscode'));
  let json: { recommendations?: string[] } = {};
  if (await fs.pathExists(extPath)) {
    json = await fs.readJson(extPath);
  }
  const recs: string[] = json.recommendations ?? [];
  if (!recs.includes(extensionId)) {
    recs.push(extensionId);
    json.recommendations = recs;
    await fs.writeJson(extPath, json, { spaces: 2 });
  }
}

// ─── Custom (non-platform) harness setup ─────────────────────────────────────

function buildAgentContext(): string {
  return Object.values(getPrebuiltAgents())
    .map((a) => a.generateClaudeSection())
    .join('\n---\n\n');
}

async function setupCline(projectRoot: string, force: boolean): Promise<void> {
  const dest = path.join(projectRoot, '.clinerules');
  if (!force && (await fs.pathExists(dest))) return;
  await fs.writeFile(dest, [
    '# Agent Framework Rules',
    '',
    '> Auto-generated by agent-framework. Re-run `acli use cline --force` to regenerate.',
    '',
    buildAgentContext(),
  ].join('\n'), 'utf-8');
}

async function setupContinue(projectRoot: string, force: boolean): Promise<void> {
  const configDir = path.join(projectRoot, '.continue');
  await fs.ensureDir(configDir);
  const configPath = path.join(configDir, 'config.yaml');
  if (!force && (await fs.pathExists(configPath))) return;
  await fs.writeFile(configPath, [
    '# Continue configuration — managed by agent-framework',
    '# See https://docs.continue.dev/reference/config for all options.',
    '',
    'models: []',
    '',
    'rules:',
    '  - name: agent-framework',
    '    rule: |',
    '      This project uses agent-framework with specialist agents: Architect,',
    '      Frontend Developer, Backend Developer, QA Engineer, Security Engineer.',
    '      See AGENTS.md at project root for full role definitions.',
    '',
  ].join('\n'), 'utf-8');
}

async function setupAider(projectRoot: string, force: boolean): Promise<void> {
  const confPath = path.join(projectRoot, '.aider.conf.yml');
  if (force || !(await fs.pathExists(confPath))) {
    await fs.writeFile(confPath, [
      '# Aider config — managed by agent-framework',
      '# See https://aider.chat/docs/config/aider_conf.html for all options.',
      '',
      '# Auto-include AGENTS.md as read-only context on every session',
      'read:',
      '  - AGENTS.md',
      '',
    ].join('\n'), 'utf-8');
  }
  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  if (force || !(await fs.pathExists(agentsPath))) {
    const header = '# Agents\n\nAuto-generated by agent-framework.\n\n---\n\n';
    await fs.writeFile(agentsPath, header + buildAgentContext(), 'utf-8');
  }
}

async function setupGemini(projectRoot: string, force: boolean): Promise<void> {
  await fs.ensureDir(path.join(projectRoot, '.gemini'));
  const geminiMd = path.join(projectRoot, 'GEMINI.md');
  if (force || !(await fs.pathExists(geminiMd))) {
    await fs.writeFile(geminiMd, [
      '# Project Context',
      '',
      '> Auto-generated by agent-framework. Re-run `acli use gemini --force` to regenerate.',
      '',
      buildAgentContext(),
    ].join('\n'), 'utf-8');
  }
}

async function setupPi(projectRoot: string, force: boolean): Promise<void> {
  // Pi reads AGENTS.md natively (handled by the 'claude' platform mapping above).
  // Additionally write .pi/settings.json to wire in bundled skills.
  const piDir = path.join(projectRoot, '.pi');
  await fs.ensureDir(piDir);
  const settingsPath = path.join(piDir, 'settings.json');
  if (force || !(await fs.pathExists(settingsPath))) {
    await fs.writeJson(settingsPath, {
      // Load bundled skills from agent-framework's shared skills directory
      skills: ['.agents/skills'],
    }, { spaces: 2 });
  }
}

// ─── Platform harness setup ───────────────────────────────────────────────────

async function setupPlatformHarness(
  platform: TargetPlatform,
  projectRoot: string,
  force: boolean,
): Promise<void> {
  await ensurePlatformDirs([platform], projectRoot);
  const agentManager = new AgentManager(projectRoot, '.github/agents', [platform], pkg.version);
  for (const agent of Object.values(getPrebuiltAgents())) {
    try {
      await agentManager.installAgent(agent, force);
    } catch { /* already installed — skip */ }
  }
  await installPrompts(projectRoot);
}

// ─── Main Command ─────────────────────────────────────────────────────────────

interface UseOptions {
  dir: string;
  force?: boolean;
  install?: boolean;
}

export async function useCommand(name: string, options: UseOptions): Promise<void> {
  const projectRoot = path.resolve(options.dir);

  if (name === 'list') return harnessListCommand();

  const harness = HARNESSES.find((h) => h.id === name.toLowerCase());
  if (!harness) {
    console.error(chalk.red(`Unknown harness: "${name}"`));
    console.log(chalk.gray(`Available: ${HARNESSES.map((h) => h.id).join(', ')}`));
    console.log(chalk.gray('Run "acli use list" to see all harnesses.'));
    process.exit(1);
  }

  const spinner = ora(`Setting up ${harness.displayName}…`).start();

  try {
    // 1. Platform emit (agents + prompts + skills)
    if (harness.platform) {
      await setupPlatformHarness(harness.platform, projectRoot, options.force ?? false);
    }

    // 2. Harness-specific config files
    switch (harness.id) {
      case 'cline':   await setupCline(projectRoot, options.force ?? false);   break;
      case 'continue':await setupContinue(projectRoot, options.force ?? false);break;
      case 'aider':   await setupAider(projectRoot, options.force ?? false);   break;
      case 'gemini':  await setupGemini(projectRoot, options.force ?? false);  break;
      case 'pi':      await setupPi(projectRoot, options.force ?? false);      break;
    }

    // 3. VS Code extension recommendation
    if (harness.vscodeExtension) {
      await addVscodeExtension(projectRoot, harness.vscodeExtension);
    }

    spinner.succeed(`Project files ready for ${harness.displayName}.`);
  } catch (err) {
    spinner.fail(`Setup failed: ${(err as Error).message}`);
    process.exit(1);
  }

  // ── CLI install / status check ──────────────────────────────────────────
  console.log('');

  const cli = harness.cliCommand;
  const isInstalled = cli ? commandExists(cli) : true;

  if (!isInstalled) {
    if (options.install) {
      const installSpinner = ora(`Installing ${harness.displayName}…`).start();
      const ok = await runInstall(harness, installSpinner);
      if (!ok) {
        printInstallHint(harness);
      }
    } else {
      console.log(chalk.yellow(`  ${harness.displayName} is not installed.`));
      printInstallHint(harness);
      console.log(chalk.gray(`  Re-run with ${chalk.white('--install')} to install automatically.`));
    }
  } else {
    const version = cli ? getVersion(cli) : undefined;
    console.log(
      chalk.green(`  ${harness.displayName}`) +
      (version ? chalk.gray(` (${version})`) : '') +
      chalk.green(' is installed.'),
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${chalk.cyan.bold(harness.displayName)}  ${chalk.gray(harness.url)}`);
  console.log(`  ${harness.afterNote}`);
  if (harness.launchHint && isInstalled) {
    console.log('');
    console.log(`  ${chalk.gray('Launch:')}  ${chalk.cyan(harness.launchHint)}`);
  }
  console.log('');
}

function printInstallHint(harness: HarnessDefinition): void {
  const opts = harness.installOptions ?? [];
  if (opts.length === 0) {
    console.log(chalk.gray(`  Download: ${harness.url}`));
    return;
  }
  console.log(chalk.gray('  Install with:'));
  for (const opt of opts) {
    console.log(`    ${chalk.cyan(opt.cmd)}`);
  }
}

// ─── acli list harnesses ──────────────────────────────────────────────────────

export async function harnessListCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\nAvailable Harnesses\n'));
  console.log(chalk.gray('─'.repeat(66)));

  for (const h of HARNESSES) {
    const installed = h.cliCommand ? commandExists(h.cliCommand) : undefined;
    const badge =
      installed === true  ? chalk.green(' ✔') :
      installed === false ? chalk.gray('  ') :
      '  ';
    console.log(`\n${badge} ${chalk.cyan.bold(h.id.padEnd(12))}  ${h.description}`);
  }

  console.log(chalk.gray('\n' + '─'.repeat(66)));
  console.log('');
  console.log(chalk.bold('Usage:'));
  console.log(`  ${chalk.cyan('acli use <harness>')}           ${chalk.gray('set up project files')}`);
  console.log(`  ${chalk.cyan('acli use <harness> --install')} ${chalk.gray('set up + install the CLI')}`);
  console.log(`  ${chalk.cyan('acli use <harness> -f')}        ${chalk.gray('overwrite existing config')}`);
  console.log('');
  console.log(chalk.gray('  ✔ = already installed on this machine'));
  console.log('');
}
