import * as path from 'path';
import * as fs from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';

/** spec-kit plugins to install */
const SPECKIT_PLUGINS = [
  { name: 'spec-kit-brownfield', repo: 'https://github.com/Quratulain-bilal/spec-kit-brownfield' },
  { name: 'spec-kit-fleet', repo: 'https://github.com/sharathsatish/spec-kit-fleet' },
  { name: 'superpowers-bridge', repo: 'https://github.com/RbBtSn0w/spec-kit-extensions', path: 'superpowers-bridge' },
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
 * Install spec-kit plugins: brownfield, fleet, superpowers-bridge.
 * Strategy per plugin:
 *   1. `specify plugin install <name>` (PyPI package name)
 *   2. `pip install "git+<repo>[#subdirectory=<path>]"` (git fallback)
 */
export async function installSpecKitPlugins(spinner?: ReturnType<typeof ora>): Promise<string[]> {
  const s = spinner || ora('Installing spec-kit plugins...').start();
  const installed: string[] = [];

  if (!commandExists('specify')) {
    s.warn('spec-kit CLI not available. Skipping plugin installation.');
    return installed;
  }

  const pipCmd = commandExists('pip3') ? 'pip3' : 'pip';

  for (const plugin of SPECKIT_PLUGINS) {
    s.text = `Installing spec-kit plugin: ${plugin.name}...`;
    let success = false;

    // Attempt 1: specify plugin install <package-name>
    try {
      execSync(`specify plugin install ${plugin.name}`, { stdio: 'ignore', timeout: 60000 });
      success = true;
    } catch { /* fall through */ }

    // Attempt 2: pip install git+<url>[#subdirectory=<path>]
    if (!success) {
      try {
        const gitUrl = plugin.path
          ? `git+${plugin.repo}.git#subdirectory=${plugin.path}`
          : `git+${plugin.repo}.git`;
        execSync(`${pipCmd} install "${gitUrl}"`, { stdio: 'ignore', timeout: 90000 });
        success = true;
      } catch { /* fall through */ }
    }

    if (success) {
      installed.push(plugin.name);
    } else {
      console.log(chalk.yellow(`  Warning: failed to install plugin ${plugin.name}`));
    }
  }

  if (installed.length > 0) {
    s.succeed(`Installed ${installed.length} spec-kit plugin(s): ${installed.join(', ')}`);
  } else {
    s.warn('No spec-kit plugins installed. Install manually if needed.');
  }

  return installed;
}

// ─── Project-Level Initialisation (used by `acli init`) ──────────────────────

/**
 * Initialize spec-kit for the project: `specify init . --ai copilot`
 */
export async function setupSpecKit(projectRoot: string, spinner?: ReturnType<typeof ora>): Promise<boolean> {
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
    execSync('specify init . --ai copilot', { cwd: projectRoot, stdio: 'pipe' });
    s.succeed('spec-kit initialized (specify init . --ai copilot).');
    return true;
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer; stdout?: Buffer };
    const output = ((e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '')).toLowerCase();
    // If already initialized despite directory not existing, treat as success
    if (output.includes('already') || await fs.pathExists(specifyDir)) {
      s.succeed('spec-kit already initialized for this project.');
      return true;
    }
    s.warn('spec-kit init failed. Run "specify init . --ai copilot" manually.');
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
 * Project-level initialisation: init spec-kit project, install plugins, init beads.
 * Does NOT install dependencies — use `acli setup` for that.
 */
export async function initProject(projectRoot: string): Promise<{
  specKit: boolean;
  beads: boolean;
  plugins: string[];
}> {
  console.log(chalk.cyan('\nInitializing project tools...\n'));

  // 1. Initialize spec-kit for the project
  const specKit = await setupSpecKit(projectRoot);

  // 2. Install spec-kit plugins (brownfield, fleet, superpowers-bridge)
  const plugins = await installSpecKitPlugins();

  // 3. Initialize and enable beads
  const beads = await setupBeads(projectRoot);

  return { specKit, beads, plugins };
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

  // Step 3: Install spec-kit
  const specKitOk = await ensureSpecKit();

  // Step 4: Initialize spec-kit for the project
  let specKitInitOk = false;
  if (specKitOk) {
    specKitInitOk = await setupSpecKit(projectRoot);
  }

  // Step 5: Install spec-kit plugins
  let plugins: string[] = [];
  if (specKitOk) {
    plugins = await installSpecKitPlugins();
  }

  // Step 6: Install beads
  const beadsOk = await ensureBeads();

  // Step 7: Initialize beads for the project
  let beadsInitOk = false;
  if (beadsOk) {
    beadsInitOk = await setupBeads(projectRoot);
  }

  // Summary
  console.log(chalk.cyan.bold('\n--- Setup Summary ---\n'));
  console.log(`  spec-kit (specify):    ${specKitOk ? chalk.green('installed') : chalk.red('not installed')}`);
  console.log(`  spec-kit init:         ${specKitInitOk ? chalk.green('initialized') : chalk.yellow(specKitOk ? 'skipped' : 'n/a')}`);
  console.log(`  spec-kit plugins:      ${plugins.length > 0 ? chalk.green(plugins.join(', ')) : chalk.yellow('none')}`);
  console.log(`  beads (bd):            ${beadsOk ? chalk.green('installed') : chalk.red('not installed')}`);
  console.log(`  beads init:            ${beadsInitOk ? chalk.green('initialized') : chalk.yellow(beadsOk ? 'skipped' : 'n/a')}`);
  console.log('');

  if (specKitOk && beadsOk) {
    console.log(chalk.green('All dependencies installed and initialized. Run ') + chalk.cyan('acli init') + chalk.green(' to scaffold your project.\n'));
  } else {
    console.log(chalk.yellow('Some dependencies could not be installed automatically.'));
    if (!specKitOk) {
      console.log(chalk.gray('  spec-kit: pip install spec-kit'));
    }
    if (!beadsOk) {
      console.log(chalk.gray('  beads:    npm install -g @beads/bd'));
    }
    console.log('');
  }
}
