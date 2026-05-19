/**
 * extensions.ts
 *
 * Manages extensions for two ecosystems:
 *   speckit       — installed via the `specify extension add` CLI command
 *   open-plugins  — installed by downloading a zip to .agents/plugins/<name>/
 *
 * Commands:
 *   acli extensions list [--available] [--ecosystem speckit|open-plugins]
 *   acli extensions add <name> [--from <url>] [--ecosystem speckit|open-plugins] [--force]
 *   acli extensions remove <name> [--yes]
 */

import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as https from 'https';
import * as http from 'http';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

// ─── Types ────────────────────────────────────────────────────────────────────

type Ecosystem = 'speckit' | 'open-plugins';

interface ExtensionEntry {
  name: string;
  ecosystem: Ecosystem;
  description: string;
  source: string;
  keywords?: string[];
  version?: string;
}

interface InstalledExtension {
  name: string;
  ecosystem: Ecosystem;
  version?: string;
  location?: string;
}

export interface ExtensionsAddOptions {
  from?: string;
  ecosystem?: string;
  force?: boolean;
}

export interface ExtensionsRemoveOptions {
  yes?: boolean;
}

export interface ExtensionsListOptions {
  available?: boolean;
  ecosystem?: string;
}

// ─── Built-in Registry ────────────────────────────────────────────────────────

/**
 * Known extensions — users can install by name without --from.
 * Add community open-plugins extensions here as the ecosystem grows.
 */
const EXTENSION_REGISTRY: ExtensionEntry[] = [
  // ── speckit ecosystem ──────────────────────────────────────────────────────
  {
    name: 'brownfield',
    ecosystem: 'speckit',
    description: 'Onboarding extension for existing codebases — generates brownfield context and architecture docs.',
    source: 'https://github.com/Quratulain-bilal/spec-kit-brownfield/archive/refs/heads/main.zip',
    keywords: ['onboarding', 'brownfield', 'existing-codebase'],
  },
  {
    name: 'fleet',
    ecosystem: 'speckit',
    description: 'Multi-agent fleet orchestration — coordinate specialist agents across large projects.',
    source: 'https://github.com/sharathsatish/spec-kit-fleet/archive/refs/heads/main.zip',
    keywords: ['orchestration', 'multi-agent', 'fleet'],
  },
  {
    name: 'superpowers-bridge',
    ecosystem: 'speckit',
    description: 'Bridge to Superpowers AI IDE — enables spec-kit workflows inside the Superpowers editor.',
    source: 'https://github.com/WangX0111/superspec/archive/refs/heads/main.zip',
    keywords: ['superpowers', 'bridge', 'ide'],
  },
  // ── open-plugins ecosystem ─────────────────────────────────────────────────
  // Add community open-plugins extensions here, e.g.:
  // {
  //   name: 'my-plugin',
  //   ecosystem: 'open-plugins',
  //   description: '...',
  //   source: 'https://github.com/org/repo/archive/refs/heads/main.zip',
  // },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const isWindows = process.platform === 'win32';

function commandExists(cmd: string): boolean {
  try {
    execSync(isWindows ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a URL is HTTPS (rejects plain HTTP and non-URL strings).
 * Prevents accidental cleartext downloads and basic SSRF from untrusted input.
 */
function validateHttpsUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: "${rawUrl}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed for extension sources. Got: ${rawUrl}`);
  }
  return parsed;
}

/**
 * Validate extension name to prevent command-injection when it is
 * interpolated into `specify extension add <name>` / `remove <name>`.
 */
function validateExtensionName(name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(
      `Invalid extension name "${name}". Names may only contain letters, numbers, hyphens, and underscores.`,
    );
  }
}

// ─── Download + Extract ───────────────────────────────────────────────────────

/**
 * Download a remote URL to a local file path with redirect following.
 * Only HTTPS is followed to avoid protocol-downgrade attacks.
 */
function downloadToFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (u: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error('Too many HTTP redirects'));
        return;
      }
      const proto = u.startsWith('https:') ? https : http;
      proto
        .get(u, { headers: { 'User-Agent': 'acli/2.0.0' } }, (res) => {
          // Follow redirects
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            doRequest(res.headers.location, redirectCount + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} when downloading ${u}`));
            return;
          }
          const ws = createWriteStream(destPath);
          res.pipe(ws);
          ws.on('finish', () => ws.close(() => resolve()));
          ws.on('error', (e) => {
            fs.remove(destPath).catch(() => {});
            reject(e);
          });
          res.on('error', (e) => {
            fs.remove(destPath).catch(() => {});
            reject(e);
          });
        })
        .on('error', reject);
    };
    doRequest(url);
  });
}

/**
 * Extract a zip archive to destDir.
 * GitHub archives contain a single top-level directory (repo-branch/) which is
 * automatically unwrapped so the plugin contents land directly in destDir.
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const tmpDir = `${zipPath}_extracted`;
  await fs.ensureDir(tmpDir);
  try {
    if (isWindows) {
      execSync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`,
        { stdio: 'ignore' },
      );
    } else {
      execSync(`unzip -qo "${zipPath}" -d "${tmpDir}"`, { stdio: 'ignore' });
    }

    // Detect and unwrap single top-level directory (GitHub archive format)
    const entries = await fs.readdir(tmpDir);
    let sourceDir = tmpDir;
    if (entries.length === 1) {
      const candidate = path.join(tmpDir, entries[0]);
      if ((await fs.stat(candidate)).isDirectory()) {
        sourceDir = candidate;
      }
    }

    await fs.ensureDir(destDir);
    await fs.copy(sourceDir, destDir, { overwrite: true });
  } finally {
    await fs.remove(tmpDir).catch(() => {});
  }
}

// ─── Install ──────────────────────────────────────────────────────────────────

async function installSpeckitExtension(
  name: string,
  source: string,
  force?: boolean,
  spinner?: ReturnType<typeof ora>,
): Promise<void> {
  const s = spinner ?? ora(`Installing speckit extension: ${name}...`).start();

  if (!commandExists('specify')) {
    s.fail('spec-kit CLI (specify) not found. Run `acli setup` first to install it.');
    throw new Error('specify CLI not available');
  }

  const forceFlag = force ? ' --force' : '';
  try {
    execSync(`specify extension add ${name} --from "${source}"${forceFlag}`, {
      stdio: 'pipe',
      input: 'y\n',
      timeout: 120_000,
    });
    s.succeed(`Installed speckit extension: ${chalk.cyan(name)}`);
  } catch (err) {
    const msg = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err);
    s.fail(`Failed to install speckit extension "${name}": ${msg.slice(0, 300)}`);
    throw err;
  }
}

async function installOpenPluginExtension(
  name: string,
  source: string,
  projectRoot: string,
  force?: boolean,
  spinner?: ReturnType<typeof ora>,
): Promise<string> {
  const s = spinner ?? ora(`Installing open-plugins extension: ${name}...`).start();
  const destDir = path.join(projectRoot, '.agents', 'plugins', name);

  if (!force && (await fs.pathExists(destDir))) {
    s.warn(`Extension "${name}" already installed. Use --force to overwrite.`);
    throw new Error(`Extension already installed: ${name}`);
  }

  const tmpZip = path.join(os.tmpdir(), `acli-ext-${name}-${Date.now()}.zip`);
  try {
    s.text = `Downloading ${name}...`;
    await downloadToFile(source, tmpZip);

    s.text = `Extracting ${name}...`;
    await extractZip(tmpZip, destDir);

    // Ensure a minimal .plugin/plugin.json manifest exists so the plugin is discoverable
    const manifestPath = path.join(destDir, '.plugin', 'plugin.json');
    if (!(await fs.pathExists(manifestPath))) {
      await fs.ensureDir(path.join(destDir, '.plugin'));
      await fs.writeJson(
        manifestPath,
        {
          name,
          version: '1.0.0',
          description: `Installed via acli extensions add`,
          source,
          agents: './agents',
          skills: './skills',
          rules: './rules',
        },
        { spaces: 2 },
      );
    }

    const relDest = destDir.replace(projectRoot + path.sep, '');
    s.succeed(`Installed open-plugins extension: ${chalk.cyan(name)} → ${relDest}`);
    return destDir;
  } catch (err) {
    // Clean up partial install on failure
    await fs.remove(destDir).catch(() => {});
    if (!(err instanceof Error && err.message.startsWith('Extension already'))) {
      s.fail(`Failed to install open-plugins extension "${name}": ${(err as Error).message}`);
    }
    throw err;
  } finally {
    await fs.remove(tmpZip).catch(() => {});
  }
}

// ─── List Installed ───────────────────────────────────────────────────────────

async function listInstalledOpenPlugins(projectRoot: string): Promise<InstalledExtension[]> {
  const pluginsRoot = path.join(projectRoot, '.agents', 'plugins');
  if (!(await fs.pathExists(pluginsRoot))) return [];

  const entries = await fs.readdir(pluginsRoot);
  const result: InstalledExtension[] = [];

  for (const entry of entries) {
    const pluginDir = path.join(pluginsRoot, entry);
    if (!(await fs.stat(pluginDir)).isDirectory()) continue;

    const manifestPath = path.join(pluginDir, '.plugin', 'plugin.json');
    let version: string | undefined;
    if (await fs.pathExists(manifestPath)) {
      const manifest = await fs.readJson(manifestPath).catch(() => ({}));
      version = manifest.version;
    }

    result.push({
      name: entry,
      ecosystem: 'open-plugins',
      version,
      location: pluginDir,
    });
  }

  return result;
}

async function listInstalledSpeckitExtensions(projectRoot: string): Promise<InstalledExtension[]> {
  // Strategy 1: ask the CLI
  if (commandExists('specify')) {
    try {
      const raw = execSync('specify extension list', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10_000,
      });
      // Parse lines like "  - name (1.0.0)" or "  name"
      const lines = raw.split('\n').filter((l) => /^\s*[-•*]?\s*\w/.test(l));
      if (lines.length > 0) {
        const parsed: InstalledExtension[] = [];
        for (const l of lines) {
          const m = l.match(/[-•*\s]+([a-zA-Z0-9_-]+)(?:\s+\(([^)]+)\))?/);
          if (m) {
            parsed.push({ name: m[1], ecosystem: 'speckit', version: m[2] ?? undefined });
          }
        }
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // Fall through to directory scan
    }
  }

  // Strategy 2: scan .specify/extensions/
  const extDir = path.join(projectRoot, '.specify', 'extensions');
  if (!(await fs.pathExists(extDir))) return [];

  const entries = await fs.readdir(extDir);
  return entries
    .filter((e) => !e.startsWith('.'))
    .map((name) => ({ name, ecosystem: 'speckit' as Ecosystem }));
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

export async function extensionsListCommand(options: ExtensionsListOptions): Promise<void> {
  const projectRoot = process.cwd();
  const ecosystemFilter = options.ecosystem as Ecosystem | undefined;

  console.log(chalk.cyan.bold('\nInstalled Extensions\n'));

  // Open Plugins
  if (!ecosystemFilter || ecosystemFilter === 'open-plugins') {
    const installed = await listInstalledOpenPlugins(projectRoot);
    console.log(chalk.bold('  open-plugins:'));
    if (installed.length === 0) {
      console.log(chalk.gray('    (none)'));
    } else {
      for (const ext of installed) {
        const ver = ext.version ? chalk.gray(` v${ext.version}`) : '';
        const loc = chalk.gray(` → .agents/plugins/${ext.name}/`);
        console.log(`    ${chalk.green('✓')} ${ext.name}${ver}${loc}`);
      }
    }
    console.log('');
  }

  // Speckit
  if (!ecosystemFilter || ecosystemFilter === 'speckit') {
    const installed = await listInstalledSpeckitExtensions(projectRoot);
    console.log(chalk.bold('  speckit:'));
    if (installed.length === 0) {
      console.log(chalk.gray('    (none)'));
    } else {
      for (const ext of installed) {
        const ver = ext.version ? chalk.gray(` v${ext.version}`) : '';
        console.log(`    ${chalk.green('✓')} ${ext.name}${ver}`);
      }
    }
    console.log('');
  }

  // Available (registry)
  if (options.available) {
    console.log(chalk.cyan.bold('Available Extensions (built-in registry)\n'));
    const registry = EXTENSION_REGISTRY.filter(
      (e) => !ecosystemFilter || e.ecosystem === ecosystemFilter,
    );
    if (registry.length === 0) {
      console.log(chalk.gray('  No registry entries for the selected ecosystem.'));
    } else {
      for (const ext of registry) {
        const tag =
          ext.ecosystem === 'speckit'
            ? chalk.blue('[speckit]')
            : chalk.magenta('[open-plugins]');
        console.log(`  ${tag} ${chalk.white(ext.name)}`);
        console.log(chalk.gray(`       ${ext.description}`));
        if (ext.keywords?.length) {
          console.log(chalk.gray(`       keywords: ${ext.keywords.join(', ')}`));
        }
        console.log('');
      }
    }
    console.log(
      chalk.gray('  More at ') +
        chalk.cyan('https://open-plugins.com') +
        chalk.gray(' and ') +
        chalk.cyan('https://github.com/ipranjal/agent-framework'),
    );
    console.log('');
  }
}

export async function extensionsAddCommand(
  name: string,
  options: ExtensionsAddOptions,
): Promise<void> {
  validateExtensionName(name);

  const projectRoot = process.cwd();
  let source = options.from;
  let ecosystem = options.ecosystem as Ecosystem | undefined;

  // Resolve from built-in registry if no --from supplied
  if (!source) {
    const entry = EXTENSION_REGISTRY.find((e) => e.name === name);
    if (!entry) {
      console.error(
        chalk.red(`Unknown extension "${name}". Provide --from <url> to install a custom extension.`),
      );
      console.error(
        chalk.gray(`  Run "acli extensions list --available" to see registered extensions.`),
      );
      process.exit(1);
    }
    source = entry.source;
    ecosystem = ecosystem ?? entry.ecosystem;
  }

  // Security: validate URL
  validateHttpsUrl(source);

  // Default ecosystem if not specified: prefer speckit for known names, open-plugins otherwise
  if (!ecosystem) {
    const speckitNames = EXTENSION_REGISTRY.filter((e) => e.ecosystem === 'speckit').map((e) => e.name);
    ecosystem = speckitNames.includes(name) ? 'speckit' : 'open-plugins';
  }

  const spinner = ora(`Installing ${ecosystem} extension: ${chalk.cyan(name)}...`).start();

  try {
    if (ecosystem === 'speckit') {
      await installSpeckitExtension(name, source, options.force, spinner);
    } else {
      await installOpenPluginExtension(name, source, projectRoot, options.force, spinner);
    }
  } catch {
    process.exit(1);
  }
}

export async function extensionsRemoveCommand(
  name: string,
  options: ExtensionsRemoveOptions,
): Promise<void> {
  validateExtensionName(name);

  const projectRoot = process.cwd();
  const openPluginDir = path.join(projectRoot, '.agents', 'plugins', name);
  const isOpenPlugin = await fs.pathExists(openPluginDir);

  if (!isOpenPlugin && !commandExists('specify')) {
    console.error(
      chalk.red(
        `Extension "${name}" not found in .agents/plugins/ and spec-kit CLI is not available.`,
      ),
    );
    process.exit(1);
  }

  // Confirm removal
  if (!options.yes) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Remove extension "${name}"?`,
        default: false,
      },
    ]);
    if (!confirmed) {
      console.log(chalk.gray('Removal cancelled.'));
      return;
    }
  }

  const spinner = ora(`Removing extension: ${chalk.cyan(name)}...`).start();

  // Open Plugins: remove the directory
  if (isOpenPlugin) {
    await fs.remove(openPluginDir);
    spinner.succeed(`Removed open-plugins extension: ${chalk.cyan(name)}`);
    return;
  }

  // Speckit: try CLI remove
  if (commandExists('specify')) {
    try {
      execSync(`specify extension remove ${name}`, {
        stdio: 'pipe',
        input: 'y\n',
        timeout: 30_000,
      });
      spinner.succeed(`Removed speckit extension: ${chalk.cyan(name)}`);
      return;
    } catch {
      // specify may not support `remove` in this version
    }
  }

  spinner.warn(
    `Could not automatically remove "${name}". Remove manually:\n` +
      chalk.gray(`  speckit:      specify extension remove ${name}\n`) +
      chalk.gray(`  open-plugins: rm -rf .agents/plugins/${name}/`),
  );
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface ExtensionsCreateOptions {
  description?: string;
  author?: string;
  authorUrl?: string;
  version?: string;
  withAgent?: boolean;
  withSkill?: boolean;
  force?: boolean;
}

/**
 * Generates the content of a starter .agent.md file inside the plugin's agents/ directory.
 * Format is the open-plugins canonical .agent.md (also valid for GitHub Copilot).
 */
function scaffoldAgentFile(pluginName: string, agentName: string, description: string): string {
  const display = agentName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return [
    '---',
    `name: ${agentName}`,
    `description: ${description}`,
    'version: 1.0.0',
    'target: vscode',
    'tools:',
    '  - codebase',
    '  - changes',
    '---',
    '',
    `# ${display} Agent`,
    '',
    `> Part of the **${pluginName}** plugin.`,
    '',
    '## Purpose',
    '',
    description,
    '',
    '## Instructions',
    '',
    `When invoked as @${agentName}, this agent should:`,
    '',
    '1. Understand the user request and gather context',
    '2. Execute the relevant actions for this domain',
    '3. Return a clear, actionable response',
    '',
    '## Workflow',
    '',
    '### 1. Analysis',
    '- Review the request and current codebase context',
    '- Identify what needs to be done',
    '',
    '### 2. Execution',
    '- Carry out the required actions',
    '- Use tools appropriately',
    '',
    '### 3. Output',
    '- Summarise what was done',
    '- Suggest any follow-up steps',
    '',
    '## Notes',
    '',
    '- Customise this file for your domain',
    '- Add examples and domain-specific knowledge',
    '- Update version and tags as the agent evolves',
    '',
  ].join('\n');
}

/**
 * Generates the content of a starter SKILL.md inside skills/<plugin-name>/.
 */
function scaffoldSkillFile(pluginName: string, description: string): string {
  const display = pluginName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return [
    '---',
    `name: ${pluginName}`,
    `description: ${description}`,
    'version: 1.0.0',
    'tags:',
    `  - ${pluginName}`,
    '  - custom',
    '---',
    '',
    `# ${display} Skill`,
    '',
    '## Description',
    '',
    description,
    '',
    '## When to Use',
    '',
    '- When you need to perform domain-specific actions related to this plugin',
    '- When the built-in agents need extra guidance for this workflow',
    '',
    '## Instructions',
    '',
    '### Step 1: Prepare',
    'Gather context required for this skill.',
    '',
    '### Step 2: Execute',
    'Perform the skill actions with the available tools.',
    '',
    '### Step 3: Review',
    'Verify outputs and report what was done.',
    '',
    '## Expected Output',
    '',
    '- A clear summary of actions taken',
    '- Any artefacts created or modified',
    '',
    '## Notes',
    '',
    '- Customise this file for your use case',
    '- Reference this skill in your agent instructions if needed',
    '',
  ].join('\n');
}

export async function extensionsCreateCommand(
  name: string,
  options: ExtensionsCreateOptions,
): Promise<void> {
  validateExtensionName(name);

  const projectRoot = process.cwd();
  const pluginDir = path.join(projectRoot, '.agents', 'plugins', name);

  if (!options.force && (await fs.pathExists(pluginDir))) {
    console.error(
      chalk.red(`Plugin "${name}" already exists at .agents/plugins/${name}/`),
    );
    console.error(chalk.gray('  Use --force to overwrite.'));
    process.exit(1);
  }

  // ── Collect metadata via prompts if not provided as flags ──────────────────
  const display = name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Plugin description:',
      default: options.description ?? `A custom agent-framework plugin.`,
      when: !options.description,
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author name:',
      default: options.author ?? '',
      when: !options.author,
    },
    {
      type: 'input',
      name: 'authorUrl',
      message: 'Author URL (GitHub, etc.):',
      default: options.authorUrl ?? '',
      when: !options.authorUrl,
    },
    {
      type: 'input',
      name: 'version',
      message: 'Initial version:',
      default: options.version ?? '1.0.0',
      when: !options.version,
    },
    {
      type: 'confirm',
      name: 'withAgent',
      message: 'Scaffold a starter agent?',
      default: true,
      when: options.withAgent === undefined,
    },
    {
      type: 'confirm',
      name: 'withSkill',
      message: 'Scaffold a starter skill?',
      default: true,
      when: options.withSkill === undefined,
    },
  ]);

  const description: string = options.description ?? (answers.description as string);
  const author: string = options.author ?? (answers.author as string) ?? '';
  const authorUrl: string = options.authorUrl ?? (answers.authorUrl as string) ?? '';
  const version: string = options.version ?? (answers.version as string) ?? '1.0.0';
  const withAgent: boolean = options.withAgent ?? (answers.withAgent as boolean) ?? true;
  const withSkill: boolean = options.withSkill ?? (answers.withSkill as boolean) ?? true;

  const spinner = ora(`Creating plugin: ${chalk.cyan(name)}...`).start();

  // ── Scaffold directory structure ───────────────────────────────────────────
  const agentsDir = path.join(pluginDir, 'agents');
  const skillsDir = path.join(pluginDir, 'skills', name);
  const rulesDir = path.join(pluginDir, 'rules');
  const pluginMetaDir = path.join(pluginDir, '.plugin');

  await fs.ensureDir(agentsDir);
  await fs.ensureDir(rulesDir);
  await fs.ensureDir(pluginMetaDir);

  // ── .plugin/plugin.json manifest ───────────────────────────────────────────
  const manifest = {
    name,
    version,
    description,
    author: author ? { name: author, url: authorUrl } : undefined,
    license: 'MIT',
    keywords: [name, 'agent-framework', 'custom-plugin'],
    agents: './agents',
    skills: './skills',
    rules: './rules',
  };
  await fs.writeJson(path.join(pluginMetaDir, 'plugin.json'), manifest, { spaces: 2 });

  // ── Starter agent ──────────────────────────────────────────────────────────
  if (withAgent) {
    const agentFile = path.join(agentsDir, `${name}.agent.md`);
    await fs.writeFile(agentFile, scaffoldAgentFile(name, name, description), 'utf-8');
  }

  // ── Starter skill ──────────────────────────────────────────────────────────
  if (withSkill) {
    await fs.ensureDir(skillsDir);
    const skillFile = path.join(skillsDir, 'SKILL.md');
    await fs.writeFile(skillFile, scaffoldSkillFile(name, description), 'utf-8');
  }

  spinner.succeed(`Plugin ${chalk.cyan(name)} created at .agents/plugins/${name}/`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold('  Structure:'));
  console.log(chalk.gray(`  .agents/plugins/${name}/`));
  console.log(chalk.gray(`    .plugin/plugin.json        (manifest)`));
  if (withAgent) {
    console.log(chalk.gray(`    agents/${name}.agent.md    (starter agent)`));
  }
  if (withSkill) {
    console.log(chalk.gray(`    skills/${name}/SKILL.md    (starter skill)`));
  }
  console.log(chalk.gray(`    rules/                      (platform rules go here)`));
  console.log('');
  console.log(chalk.cyan('  Next steps:'));
  console.log(chalk.gray(`  1. Edit .agents/plugins/${name}/agents/${name}.agent.md`));
  console.log(chalk.gray(`  2. Run "acli extensions pack ${name}" to create a distributable zip`));
  console.log(
    chalk.gray(`  3. Share via "acli extensions add ${name} --from <url-to-your-zip>"`),
  );
  console.log('');
}

// ─── Pack ─────────────────────────────────────────────────────────────────────

export interface ExtensionsPackOptions {
  output?: string;
}

export async function extensionsPackCommand(
  name: string,
  options: ExtensionsPackOptions,
): Promise<void> {
  validateExtensionName(name);

  const projectRoot = process.cwd();
  const pluginDir = path.join(projectRoot, '.agents', 'plugins', name);

  if (!(await fs.pathExists(pluginDir))) {
    console.error(chalk.red(`Plugin "${name}" not found at .agents/plugins/${name}/`));
    console.error(chalk.gray('  Run "acli extensions create <name>" first.'));
    process.exit(1);
  }

  // Read version from manifest for the default output filename
  let version = '1.0.0';
  const manifestPath = path.join(pluginDir, '.plugin', 'plugin.json');
  if (await fs.pathExists(manifestPath)) {
    const manifest = await fs.readJson(manifestPath).catch(() => ({}));
    if (manifest.version) version = manifest.version;
  }

  const outputName = options.output ?? `${name}-v${version}.zip`;
  const outputPath = path.isAbsolute(outputName)
    ? outputName
    : path.join(projectRoot, outputName);

  const spinner = ora(`Packing ${chalk.cyan(name)} → ${outputName}...`).start();

  try {
    // The zip must contain a single top-level directory matching the plugin name
    // so our extractZip can unwrap it correctly on the receiving end.
    const pluginsRoot = path.join(projectRoot, '.agents', 'plugins');

    if (isWindows) {
      execSync(
        `powershell -Command "Compress-Archive -Path '${pluginDir}' -DestinationPath '${outputPath}' -Force"`,
        { stdio: 'ignore' },
      );
    } else {
      execSync(`zip -qr "${outputPath}" "${name}"`, {
        cwd: pluginsRoot,
        stdio: 'ignore',
      });
    }

    spinner.succeed(`Packed: ${chalk.cyan(outputName)}`);
    console.log('');
    console.log(chalk.gray(`  Share via:`));
    console.log(
      chalk.gray(
        `  acli extensions add ${name} --from https://<your-host>/${outputName} --ecosystem open-plugins`,
      ),
    );
    console.log('');
  } catch (err) {
    spinner.fail(`Pack failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
