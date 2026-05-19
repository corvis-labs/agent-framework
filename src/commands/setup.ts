import * as path from 'path';
import * as fs from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { TargetPlatform } from '../core/Agent';
import { emitSkill } from '../core/PlatformEmitter';

/**
 * Maps a TargetPlatform to the corresponding `specify --integration` value.
 * spec-kit v0.10+ accepts: copilot, cursor, claude, windsurf.
 * Falls back to 'copilot' for open-plugins (not a specify integration).
 */
const SPECIFY_INTEGRATION: Partial<Record<TargetPlatform, string>> = {
  copilot: 'copilot',
  cursor: 'cursor',
  claude: 'claude',
  windsurf: 'windsurf',
};

function pickSpecifyIntegration(platforms: TargetPlatform[]): string {
  for (const p of platforms) {
    const integration = SPECIFY_INTEGRATION[p];
    if (integration) return integration;
  }
  return 'copilot';
}

/** spec-kit extensions to install via `specify extension add <name> --from <zip>` */
const SPECKIT_PLUGINS = [
  {
    name: 'brownfield',
    zipUrl: 'https://github.com/Quratulain-bilal/spec-kit-brownfield/archive/refs/heads/main.zip',
  },
  {
    name: 'fleet',
    zipUrl: 'https://github.com/sharathsatish/spec-kit-fleet/archive/refs/heads/main.zip',
  },
  {
    name: 'superpowers-bridge',
    zipUrl: 'https://github.com/WangX0111/superspec/archive/refs/heads/main.zip',
  },
];

const isWindows = process.platform === 'win32';

function commandExists(cmd: string): boolean {
  try {
    const check = isWindows ? `where ${cmd}` : `which ${cmd}`;
    execSync(check, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ─── Dependency Checks (for `acli setup`) ───────────────────────────────────

function checkPython(): { available: boolean; version?: string } {
  for (const cmd of ['python3', 'python']) {
    if (commandExists(cmd)) {
      try {
        const ver = execSync(`${cmd} --version`, { encoding: 'utf8' }).trim();
        return { available: true, version: ver };
      } catch { /* try next */ }
    }
  }
  return { available: false };
}

function checkUv(): { available: boolean; version?: string } {
  if (commandExists('uv')) {
    try {
      const ver = execSync('uv --version', { encoding: 'utf8' }).trim();
      return { available: true, version: ver };
    } catch {
      return { available: true };
    }
  }
  return { available: false };
}

function checkBrew(): { available: boolean } {
  return { available: commandExists('brew') };
}

function checkNode(): { available: boolean; version?: string } {
  if (commandExists('node')) {
    try {
      const ver = execSync('node --version', { encoding: 'utf8' }).trim();
      return { available: true, version: ver };
    } catch {
      return { available: true };
    }
  }
  return { available: false };
}

/**
 * Return IDs of harnesses that appear to be configured in the project already,
 * based on the presence of their canonical config files / directories.
 */
function detectHarnessSetup(projectRoot: string): string[] {
  const markers: Array<{ id: string; check: string }> = [
    { id: 'copilot',  check: path.join(projectRoot, '.github', 'agents') },
    { id: 'cursor',   check: path.join(projectRoot, '.cursor', 'rules') },
    { id: 'claude',   check: path.join(projectRoot, 'AGENTS.md') },
    { id: 'windsurf', check: path.join(projectRoot, '.windsurf', 'rules') },
    { id: 'opencode', check: path.join(projectRoot, '.opencode', 'agents') },
    { id: 'cline',    check: path.join(projectRoot, '.clinerules') },
    { id: 'continue', check: path.join(projectRoot, '.continue', 'config.yaml') },
    { id: 'aider',    check: path.join(projectRoot, '.aider.conf.yml') },
    { id: 'gemini',   check: path.join(projectRoot, 'GEMINI.md') },
    { id: 'pi',       check: path.join(projectRoot, '.pi', 'settings.json') },
  ];
  return markers.filter((m) => fs.pathExistsSync(m.check)).map((m) => m.id);
}

// ─── Dependency Installation ─────────────────────────────────────────────────

/**
 * Ensure spec-kit CLI (`specify`) is installed.
 * Tries uv → pipx → pip in order. Returns true if available after attempt.
 */
export async function ensureSpecKit(spinner?: ReturnType<typeof ora>): Promise<boolean> {
  const s = spinner || ora('Checking spec-kit installation...').start();

  if (commandExists('specify')) {
    s.succeed('spec-kit CLI (specify) is available.');
    return true;
  }

  s.text = 'Installing spec-kit CLI...';

  const installers = [
    { name: 'uv', cmd: 'uv tool install spec-kit' },
    { name: 'pipx', cmd: 'pipx install spec-kit' },
    { name: 'pip', cmd: isWindows ? 'pip install spec-kit' : 'pip install --user spec-kit' },
  ];

  for (const installer of installers) {
    if (!commandExists(installer.name)) continue;
    try {
      execSync(installer.cmd, { stdio: 'ignore', timeout: 120000 });
      if (commandExists('specify')) {
        s.succeed(`spec-kit installed via ${installer.name}.`);
        return true;
      }
    } catch {
      // Try next installer
    }
  }

  s.warn('Could not install spec-kit automatically. Install manually: pip install spec-kit');
  return false;
}

/**
 * Ensure beads CLI (`bd`) is installed.
 * Tries brew → npm in order. Returns true if available after attempt.
 */
export async function ensureBeads(spinner?: ReturnType<typeof ora>): Promise<boolean> {
  const s = spinner || ora('Checking beads installation...').start();

  if (commandExists('bd')) {
    s.succeed('beads CLI (bd) is available.');
    return true;
  }

  s.text = 'Installing beads CLI...';

  const installers = [
    ...(!isWindows ? [{ name: 'brew', cmd: 'brew install gastownhall/tap/beads' }] : []),
    { name: 'npm', cmd: 'npm install -g @beads/bd' },
  ];

  for (const installer of installers) {
    if (!commandExists(installer.name)) continue;
    try {
      execSync(installer.cmd, { stdio: 'ignore', timeout: 120000 });
      if (commandExists('bd')) {
        s.succeed(`beads installed via ${installer.name}.`);
        return true;
      }
    } catch {
      // Try next installer
    }
  }

  s.warn('Could not install beads automatically. Install via: npm install -g @beads/bd');
  return false;
}

/**
 * Install spec-kit extensions: brownfield (optional), fleet, superpowers-bridge.
 * Uses `specify extension add <name> --from <zip-url>` (community catalog
 * extensions are not directly installable, so we supply the GitHub archive).
 */
export async function installSpecKitPlugins(
  opts: { includeBrownfield?: boolean } = {},
  spinner?: ReturnType<typeof ora>,
): Promise<string[]> {
  const s = spinner || ora('Installing spec-kit extensions...').start();
  const installed: string[] = [];

  if (!commandExists('specify')) {
    s.warn('spec-kit CLI not available. Skipping extension installation.');
    return installed;
  }

  const pluginsToInstall = SPECKIT_PLUGINS.filter(
    (p) => p.name !== 'brownfield' || opts.includeBrownfield !== false,
  );

  for (const plugin of pluginsToInstall) {
    s.text = `Installing spec-kit extension: ${plugin.name}...`;
    try {
      execSync(`specify extension add ${plugin.name} --from "${plugin.zipUrl}"`, {
        stdio: 'pipe',
        input: 'y\n',
        timeout: 90000,
      });
      installed.push(plugin.name);
    } catch {
      console.log(chalk.yellow(`  Warning: failed to install extension ${plugin.name}`));
    }
  }

  if (installed.length > 0) {
    s.succeed(`Installed ${installed.length} spec-kit extension(s): ${installed.join(', ')}`);
  } else {
    s.warn('No spec-kit extensions installed. Install manually: specify extension add <name> --from <zip-url>');
  }

  return installed;
}

/**
 * Copy the bundled SKILL.md files from templates/skills/ to the
 * vercel-labs/skills compatible paths for every selected platform.
 *
 * This makes `npx skills list` and `npx skills update` work out of the box
 * without any additional configuration.
 */
export async function installBundledSkills(
  projectRoot: string,
  platforms: TargetPlatform[] = ['copilot'],
  spinner?: ReturnType<typeof ora>,
): Promise<string[]> {
  const s = spinner || ora('Installing bundled skills...').start();

  // Bundled skills live alongside the compiled CLI (dist/commands → dist → package root → templates)
  const templatesDir = path.join(__dirname, '..', '..', 'templates', 'skills');

  if (!(await fs.pathExists(templatesDir))) {
    s.warn('Bundled skills directory not found — skipping skill installation.');
    return [];
  }

  const entries = await fs.readdir(templatesDir);
  const skillFiles = entries.filter((f) => f.endsWith('.skill.md') || f === 'SKILL.md');

  if (skillFiles.length === 0) {
    s.warn('No bundled skills found.');
    return [];
  }

  const written: string[] = [];

  for (const file of skillFiles) {
    // Derive skill name from filename, e.g. "speckit-checklist.skill.md" → "speckit-checklist"
    const skillName = file.replace(/\.skill\.md$/, '').replace(/\.md$/, '');
    const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');

    s.text = `Installing skill: ${skillName}...`;
    const paths = await emitSkill(skillName, content, platforms, projectRoot);
    written.push(...paths);
  }

  if (written.length > 0) {
    s.succeed(
      `Installed ${skillFiles.length} bundled skill(s) to ${written.length} path(s). ` +
      chalk.gray('(npx skills list will find them automatically)'),
    );
  } else {
    s.succeed('Bundled skills already up to date.');
  }

  return written;
}

// ─── Project-Level Initialisation (used by `acli init`) ──────────────────────

/**
 * Initialize spec-kit for the project: `specify init . --ai copilot`
 */
export async function setupSpecKit(
  projectRoot: string,
  platforms: TargetPlatform[] = ['copilot'],
  spinner?: ReturnType<typeof ora>,
): Promise<boolean> {
  const s = spinner || ora('Initializing spec-kit...').start();

  if (!commandExists('specify')) {
    s.warn('spec-kit CLI not available. Skipping spec-kit init.');
    return false;
  }

  // Already initialized — skip gracefully
  const specifyDir = path.join(projectRoot, '.specify');
  if (await fs.pathExists(specifyDir)) {
    s.succeed('spec-kit already initialized for this project.');
    return true;
  }

  try {
    // Pass 'y\n' to stdin to answer the non-empty directory confirmation prompt.
    // Use --integration (--ai is deprecated since v0.10.0).
    const integration = pickSpecifyIntegration(platforms);
    execSync(`specify init . --integration ${integration}`, {
      cwd: projectRoot,
      stdio: 'pipe',
      input: 'y\n',
    });
    s.succeed('spec-kit initialized.');
    return true;
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer; stdout?: Buffer };
    const output = ((e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '')).toLowerCase();
    // If already initialized despite directory not existing, treat as success
    if (output.includes('already') || await fs.pathExists(specifyDir)) {
      s.succeed('spec-kit already initialized for this project.');
      return true;
    }
    s.warn('spec-kit init failed. Run "specify init . --integration copilot" manually.');
    return false;
  }
}

/**
 * Initialize and enable beads for the current project.
 */
export async function setupBeads(projectRoot: string, spinner?: ReturnType<typeof ora>): Promise<boolean> {
  const s = spinner || ora('Setting up beads...').start();

  if (!commandExists('bd')) {
    s.warn('beads CLI (bd) not available. Run "acli setup" to install dependencies.');
    return false;
  }

  const beadsDir = path.join(projectRoot, '.beads');
  if (await fs.pathExists(beadsDir)) {
    s.succeed('beads already initialized for this project.');
    return true;
  }

  try {
    execSync('bd init', { cwd: projectRoot, stdio: 'ignore' });
    s.succeed('beads initialized and enabled (.beads/ created).');
    return true;
  } catch {
    s.warn('beads init failed. Run "bd init" manually.');
    return false;
  }
}

/**
 * Project-level initialisation: init spec-kit project and init beads.
 * Does NOT install dependencies or extensions — use `acli setup` for that.
 */
export async function initProject(projectRoot: string): Promise<{
  specKit: boolean;
  beads: boolean;
}> {
  // 1. Initialize spec-kit for the project
  const specKit = await setupSpecKit(projectRoot);

  // 2. Initialize and enable beads
  const beads = await setupBeads(projectRoot);

  return { specKit, beads };
}

// ─── CLI Command: `acli setup` ──────────────────────────────────────────────

interface SetupOptions {
  dir: string;
  check?: boolean;
}

/**
 * `acli setup` — check and install all dependencies.
 * Separated from `acli init` so init only handles project scaffolding.
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
  const projectRoot = path.resolve(options.dir);

  if (options.check) {
    // Check-only mode: report what is/isn't installed
    console.log(chalk.cyan.bold('\nDependency Health Check\n'));

    const node = checkNode();
    const python = checkPython();
    const uv = checkUv();
    const brew = checkBrew();
    const specKit = commandExists('specify');
    const beads = commandExists('bd');
    const harnesses = detectHarnessSetup(projectRoot);

    const ok = chalk.green('OK');
    const missing = chalk.red('MISSING');
    const optional = chalk.yellow('MISSING (optional)');

    console.log(`  Node.js         ${node.available ? `${ok}  ${chalk.gray(node.version)}` : missing}`);
    console.log(`  Python          ${python.available ? `${ok}  ${chalk.gray(python.version)}` : missing}`);
    console.log(`  uv              ${uv.available ? `${ok}  ${chalk.gray(uv.version)}` : optional}`);
    if (!isWindows) {
      console.log(`  Homebrew        ${brew.available ? ok : optional}`);
    }
    console.log(`  spec-kit (specify)  ${specKit ? ok : missing}`);
    console.log(`  beads (bd)      ${beads ? ok : missing}`);
    console.log(`  harnesses       ${harnesses.length > 0 ? `${ok}  ${chalk.gray(harnesses.join(', '))}` : chalk.yellow('none detected')}`);
    console.log('');

    if (!specKit || !beads) {
      console.log(chalk.white('Run ') + chalk.cyan('acli setup') + chalk.white(' (without --check) to install missing tools.\n'));
    } else {
      console.log(chalk.green('All dependencies are available.\n'));
    }

    return;
  }

  // Full setup: install everything
  console.log(chalk.cyan.bold('\nAgent Framework — Dependency Setup\n'));

  // Step 1: Check Node.js (required)
  const node = checkNode();
  if (!node.available) {
    console.log(chalk.red('Node.js is required but not found. Install from https://nodejs.org'));
    process.exit(1);
  }
  console.log(chalk.green(`  Node.js: ${node.version}`));

  // Step 2: Check Python (required for spec-kit)
  const python = checkPython();
  if (!python.available) {
    console.log(chalk.red('Python is required for spec-kit but not found. Install from https://www.python.org/downloads/'));
    process.exit(1);
  }
  console.log(chalk.green(`  Python: ${python.version}`));
  console.log('');

  // ── Interactive questions ────────────────────────────────────────────────
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'projectType',
      message: 'What type of project are you setting up?',
      choices: [
        {
          name: `${chalk.cyan('Greenfield')} — brand-new project (spec-kit core only)`,
          value: 'greenfield',
        },
        {
          name: `${chalk.cyan('Brownfield')} — existing codebase (adds brownfield onboarding extension)`,
          value: 'brownfield',
        },
      ],
    },
    {
      type: 'list',
      name: 'memoryBackend',
      message: 'Which memory / context backend do you want?',
      choices: [
        {
          name: `${chalk.cyan('Git-based')}  — lightweight, zero extra tooling; stores context in plain files tracked by git`,
          value: 'git',
        },
        {
          name: `${chalk.cyan('Beads-based')} — advanced semantic memory with chunking, search & structured context (requires bd CLI)`,
          value: 'beads',
        },
      ],
    },
  ]);

  const wantBrownfield  = (answers.projectType   as string) === 'brownfield';
  const wantBeads       = (answers.memoryBackend  as string) === 'beads';
  console.log('');

  // Step 3: Install spec-kit
  const specKitOk = await ensureSpecKit();

  // Step 4: Initialize spec-kit for the project (use configured platforms if available)
  let specKitInitOk = false;
  if (specKitOk) {
    let configPlatforms: TargetPlatform[] = ['copilot'];
    const cfgPath = path.join(projectRoot, '.agent-framework.json');
    if (await fs.pathExists(cfgPath)) {
      const cfg = await fs.readJson(cfgPath).catch(() => ({}));
      if (Array.isArray(cfg.platforms) && cfg.platforms.length > 0) {
        configPlatforms = cfg.platforms as TargetPlatform[];
      }
    }
    specKitInitOk = await setupSpecKit(projectRoot, configPlatforms);
  }

  // Step 5: Install spec-kit extensions (filter based on project type)
  let plugins: string[] = [];
  if (specKitOk) {
    plugins = await installSpecKitPlugins({ includeBrownfield: wantBrownfield });
  }

  // Step 5b: Copy bundled SKILL.md files to npx-skills-compatible paths
  let configPlatformsForSkills: TargetPlatform[] = ['copilot'];
  const cfgPathForSkills = path.join(projectRoot, '.agent-framework.json');
  if (await fs.pathExists(cfgPathForSkills)) {
    const cfg = await fs.readJson(cfgPathForSkills).catch(() => ({}));
    if (Array.isArray(cfg.platforms) && cfg.platforms.length > 0) {
      configPlatformsForSkills = cfg.platforms as TargetPlatform[];
    }
  }
  await installBundledSkills(projectRoot, configPlatformsForSkills);

  // Step 6: Install beads (only if user chose beads-based memory)
  let beadsOk = false;
  let beadsInitOk = false;
  if (wantBeads) {
    beadsOk = await ensureBeads();
    if (beadsOk) {
      beadsInitOk = await setupBeads(projectRoot);
    }
  } else {
    console.log(chalk.gray('  Skipping beads install (git-based memory selected).'));
  }

  // Summary
  console.log(chalk.cyan.bold('\n--- Setup Summary ---\n'));
  console.log(`  spec-kit (specify):    ${specKitOk ? chalk.green('installed') : chalk.red('not installed')}`);
  console.log(`  spec-kit init:         ${specKitInitOk ? chalk.green('initialized') : chalk.yellow(specKitOk ? 'skipped' : 'n/a')}`);
  console.log(`  spec-kit plugins:      ${plugins.length > 0 ? chalk.green(plugins.join(', ')) : chalk.yellow('none')}`);
  console.log(`  beads (bd):            ${wantBeads ? (beadsOk ? chalk.green('installed') : chalk.red('not installed')) : chalk.gray('skipped (git-based memory)')}`);
  console.log(`  beads init:            ${wantBeads ? (beadsInitOk ? chalk.green('initialized') : chalk.yellow(beadsOk ? 'failed' : 'n/a')) : chalk.gray('skipped')}`);
  console.log('');

  if (specKitOk && beadsOk || specKitOk && !wantBeads) {
    console.log(chalk.green('All selected dependencies installed and initialized.\n'));
  } else {
    console.log(chalk.yellow('Some dependencies could not be installed automatically.'));
    if (!specKitOk) {
      console.log(chalk.gray('  spec-kit: pip install spec-kit'));
    }
    if (wantBeads && !beadsOk) {
      console.log(chalk.gray('  beads:    npm install -g @beads/bd'));
    }
    console.log('');
  }

  // Snapshot which harnesses exist BEFORE init so we know if we should offer setup
  const preExistingHarnesses = detectHarnessSetup(projectRoot);

  // Auto-run acli init
  console.log(chalk.cyan.bold('\nScaffolding project...\n'));
  const { initCommand } = await import('./init');
  await initCommand({ dir: options.dir, force: false });

  // Step: Harness setup — offer if nothing was configured before this run
  if (preExistingHarnesses.length === 0) {
    console.log('');
    console.log(chalk.cyan.bold('No AI coding harness detected.\n'));
    const { HARNESSES, useCommand: runHarness } = await import('./harness');
    const { harnessId } = await inquirer.prompt<{ harnessId: string | null }>([
      {
        type: 'list',
        name: 'harnessId',
        message: 'Set up an AI coding harness now?',
        choices: [
          ...HARNESSES.map((h) => ({
            name: `${chalk.cyan(h.id.padEnd(12))}  ${h.description}`,
            value: h.id,
          })),
          new inquirer.Separator(),
          { name: chalk.gray('Skip for now'), value: null },
        ],
      },
    ]);
    if (harnessId) {
      await runHarness(harnessId as string, { dir: options.dir, force: false });
    }
  } else {
    console.log(chalk.green(`\n  Harness already configured: ${preExistingHarnesses.join(', ')}\n`));
  }
}
