/**
 * agency.ts
 *
 * Browse and install agents from the Agency community roster:
 *   https://github.com/msitarzewski/agency-agents
 *
 * Commands:
 *   acli agency install <name>            Install an agent by slug or keyword
 *   acli agency list [--division <name>]  List all available agents
 *   acli agency search <query>            Search agents by keyword
 *
 * Agents are downloaded directly from GitHub raw URLs and written to
 * the appropriate platform paths based on .agent-framework.json.
 *
 * Platform output:
 *   copilot      → .github/agents/{slug}.agent.md     (native frontmatter)
 *   cursor       → .cursor/rules/{slug}.mdc            (description + alwaysApply)
 *   windsurf     → .windsurf/rules/{slug}.md           (description + trigger)
 *   claude       → .claude/agents/{slug}.md            (native Claude Code format)
 *   open-plugins → .agents/plugins/agency-agents/agents/{slug}.agent.md
 */

import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as https from 'https';
import * as os from 'os';
import matter from 'gray-matter';
import { TargetPlatform } from '../core/Agent';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENCY_OWNER = 'msitarzewski';
const AGENCY_REPO = 'agency-agents';
const AGENCY_BRANCH = 'main';
const AGENCY_API_TREE = `https://api.github.com/repos/${AGENCY_OWNER}/${AGENCY_REPO}/git/trees/${AGENCY_BRANCH}?recursive=1`;
const AGENCY_RAW_BASE = `https://raw.githubusercontent.com/${AGENCY_OWNER}/${AGENCY_REPO}/${AGENCY_BRANCH}`;

/** OS-level cache shared across projects — avoids hitting the GitHub API rate limit. */
const CACHE_PATH = path.join(os.tmpdir(), '.acli-agency-index.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Top-level directories that do not contain agent files. */
const SKIP_DIRS = new Set(['.github', 'docs', 'scripts', 'integrations', 'examples', 'bin']);

/** Root-level markdown files to ignore when they appear in a division dir. */
const SKIP_FILENAMES = new Set(['README.md', 'CONTRIBUTING.md', 'LICENSE.md', 'index.md']);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgencyInstallOptions {
  division?: string;
  force?: boolean;
  refresh?: boolean;
}

export interface AgencyListOptions {
  division?: string;
  refresh?: boolean;
}

export interface AgencySearchOptions {
  division?: string;
  refresh?: boolean;
}

interface AgencyEntry {
  /** Filename without .md, e.g. "engineering-frontend-developer" */
  slug: string;
  /** Top-level directory name, e.g. "engineering" */
  division: string;
  /** Relative path in the repo, e.g. "engineering/engineering-frontend-developer.md" */
  repoPath: string;
  /** Direct download URL */
  rawUrl: string;
}

interface IndexCache {
  timestamp: number;
  agents: AgencyEntry[];
}

interface GitHubTreeResponse {
  tree: Array<{ path: string; type: string }>;
  truncated: boolean;
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

function httpsGetJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    // Only allow requests to known safe hosts
    const parsed = new URL(url);
    if (parsed.hostname !== 'api.github.com') {
      reject(new Error(`Unexpected host: ${parsed.hostname}`));
      return;
    }

    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'agent-framework-cli',
            Accept: 'application/vnd.github.v3+json',
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (!location) {
              reject(new Error('Redirect with no location header'));
              return;
            }
            httpsGetJson<T>(location).then(resolve, reject);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} fetching agent index`));
            return;
          }
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as T);
            } catch (e) {
              reject(new Error('Failed to parse GitHub API response'));
            }
          });
        },
      )
      .on('error', reject);
  });
}

function httpsGetText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only allow downloads from the expected raw content host
    const parsed = new URL(url);
    if (parsed.hostname !== 'raw.githubusercontent.com') {
      reject(new Error(`Unexpected host: ${parsed.hostname}`));
      return;
    }

    https
      .get(url, { headers: { 'User-Agent': 'agent-framework-cli' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (!location) {
            reject(new Error('Redirect with no location header'));
            return;
          }
          httpsGetText(location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading agent file`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

// ─── Cache ────────────────────────────────────────────────────────────────────

async function loadCache(): Promise<AgencyEntry[] | null> {
  try {
    if (!(await fs.pathExists(CACHE_PATH))) return null;
    const cache: IndexCache = await fs.readJson(CACHE_PATH);
    if (Date.now() - cache.timestamp < CACHE_TTL_MS) return cache.agents;
  } catch {
    // ignore corrupted or missing cache
  }
  return null;
}

async function saveCache(agents: AgencyEntry[]): Promise<void> {
  try {
    await fs.writeJson(CACHE_PATH, { timestamp: Date.now(), agents } as IndexCache, { spaces: 2 });
  } catch {
    // ignore write failures (read-only tmp, etc.)
  }
}

// ─── Index Fetcher ────────────────────────────────────────────────────────────

async function fetchAgentIndex(forceRefresh = false): Promise<AgencyEntry[]> {
  if (!forceRefresh) {
    const cached = await loadCache();
    if (cached) return cached;
  }

  const data = await httpsGetJson<GitHubTreeResponse>(AGENCY_API_TREE);

  const agents: AgencyEntry[] = [];
  for (const item of data.tree) {
    if (item.type !== 'blob') continue;
    if (!item.path.endsWith('.md')) continue;

    const parts = item.path.split('/');
    // Only direct children of a division directory (no nested paths)
    if (parts.length !== 2) continue;

    const [division, filename] = parts;
    if (SKIP_DIRS.has(division)) continue;
    if (SKIP_FILENAMES.has(filename)) continue;

    const slug = filename.replace(/\.md$/, '');
    agents.push({
      slug,
      division,
      repoPath: item.path,
      rawUrl: `${AGENCY_RAW_BASE}/${item.path}`,
    });
  }

  await saveCache(agents);
  return agents;
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

/**
 * Find agents matching a query string.
 *
 * Matching rules (in priority order):
 *  1. Division-scoped path, e.g. "engineering/frontend-developer"
 *  2. Exact slug match (with or without division prefix)
 *  3. Prefix match on slug
 *  4. Substring match on slug
 */
function matchAgents(index: AgencyEntry[], query: string, division?: string): AgencyEntry[] {
  const q = query.toLowerCase().trim();

  // 1. Division-scoped query: "engineering/frontend-developer"
  if (q.includes('/')) {
    const [div, slug] = q.split('/', 2);
    return index.filter(
      (a) =>
        a.division.toLowerCase() === div &&
        (a.slug.toLowerCase() === slug ||
          a.slug.toLowerCase() === `${a.division.toLowerCase()}-${slug}`),
    );
  }

  // Optionally restrict pool to a division
  const pool = division
    ? index.filter((a) => a.division.toLowerCase() === division.toLowerCase())
    : index;

  // 2. Exact slug match (accept "frontend-developer" → "engineering-frontend-developer")
  const exact = pool.filter(
    (a) =>
      a.slug.toLowerCase() === q ||
      a.slug.toLowerCase() === `${a.division.toLowerCase()}-${q}`,
  );
  if (exact.length > 0) return exact;

  // 3. Prefix match
  const prefix = pool.filter((a) => a.slug.toLowerCase().startsWith(q));
  if (prefix.length > 0) return prefix;

  // 4. Substring match
  return pool.filter((a) => a.slug.toLowerCase().includes(q));
}

// ─── Config Reader ────────────────────────────────────────────────────────────

async function readConfigPlatforms(projectRoot: string): Promise<TargetPlatform[]> {
  const cfgPath = path.join(projectRoot, '.agent-framework.json');
  if (await fs.pathExists(cfgPath)) {
    const cfg = await fs.readJson(cfgPath).catch(() => ({}));
    if (Array.isArray(cfg.platforms) && cfg.platforms.length > 0) {
      return cfg.platforms as TargetPlatform[];
    }
  }
  return ['copilot'];
}

// ─── Platform Writer ──────────────────────────────────────────────────────────

/**
 * Write a downloaded agency agent to all configured platforms.
 * Returns a list of written file paths.
 */
async function writeAgencyAgent(
  entry: AgencyEntry,
  content: string,
  platforms: TargetPlatform[],
  projectRoot: string,
  force: boolean,
): Promise<string[]> {
  const written: string[] = [];
  const parsed = matter(content);
  const { slug } = entry;

  // Flatten description to a single line for frontmatter safety
  const description = ((parsed.data.description as string | undefined) ?? '')
    .replace(/\n/g, ' ')
    .trim();

  for (const platform of platforms) {
    let dest: string;
    let fileContent: string;

    switch (platform) {
      case 'copilot':
        // GitHub Copilot reads .md files in .github/agents/
        // The agency-agents native frontmatter (name, description, color, emoji) is supported.
        dest = path.join(projectRoot, '.github', 'agents', `${slug}.agent.md`);
        fileContent = content;
        break;

      case 'cursor':
        // Cursor rules use description + alwaysApply frontmatter in .mdc files
        dest = path.join(projectRoot, '.cursor', 'rules', `${slug}.mdc`);
        fileContent = matter.stringify(parsed.content, {
          description,
          alwaysApply: false,
        });
        break;

      case 'windsurf':
        // Windsurf rules use description + trigger frontmatter
        dest = path.join(projectRoot, '.windsurf', 'rules', `${slug}.md`);
        fileContent = matter.stringify(parsed.content, {
          description,
          trigger: 'always_on',
        });
        break;

      case 'claude':
        // Claude Code reads native .md agents from .claude/agents/
        // The agency-agents format is exactly the Claude Code agent format.
        dest = path.join(projectRoot, '.claude', 'agents', `${slug}.md`);
        fileContent = content;
        break;

      case 'open-plugins':
        // Open Plugins canonical plugin path
        dest = path.join(
          projectRoot,
          '.agents',
          'plugins',
          'agency-agents',
          'agents',
          `${slug}.agent.md`,
        );
        fileContent = content;
        break;

      default:
        continue;
    }

    if (!force && (await fs.pathExists(dest))) continue;

    await fs.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, fileContent, 'utf-8');
    written.push(dest);
  }

  return written;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export async function agencyInstallCommand(
  name: string,
  options: AgencyInstallOptions,
): Promise<void> {
  // Input validation — allowlist characters only
  if (!/^[a-zA-Z0-9/_\- ]+$/.test(name)) {
    console.error(
      chalk.red(
        '✖ Invalid agent name. Use letters, numbers, hyphens, slashes, and spaces only.',
      ),
    );
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const spinner = ora(`Fetching agent index from ${AGENCY_OWNER}/${AGENCY_REPO}…`).start();

  let index: AgencyEntry[];
  try {
    index = await fetchAgentIndex(options.refresh ?? false);
    spinner.succeed(`Agent index loaded (${index.length} agents)`);
  } catch (err: unknown) {
    spinner.fail('Failed to fetch agent index');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  const matches = matchAgents(index, name, options.division);

  if (matches.length === 0) {
    console.error(chalk.red(`\n✖ No agent matching "${name}" found.\n`));
    console.log(chalk.dim(`  Browse agents: ${chalk.cyan('acli agency list')}`));
    console.log(chalk.dim(`  Search agents: ${chalk.cyan('acli agency search <query>')}\n`));
    process.exit(1);
  }

  if (matches.length > 1) {
    console.log(chalk.yellow(`\n⚠ Multiple agents match "${name}":\n`));
    for (const m of matches) {
      console.log(`  ${chalk.cyan(m.slug)}  ${chalk.dim(`[${m.division}]`)}`);
    }
    console.log(
      chalk.dim(
        `\n  Specify the full slug (e.g. ${chalk.cyan(`acli agency install ${matches[0].slug}`)})`,
      ),
    );
    console.log(
      chalk.dim(`  or scope to a division: ${chalk.cyan('--division engineering')}\n`),
    );
    process.exit(1);
  }

  const entry = matches[0];
  const platforms = await readConfigPlatforms(projectRoot);

  const downloadSpinner = ora(`Downloading ${chalk.cyan(entry.slug)}…`).start();
  let content: string;
  try {
    content = await httpsGetText(entry.rawUrl);
    downloadSpinner.succeed(`Downloaded ${chalk.cyan(entry.slug)}`);
  } catch (err: unknown) {
    downloadSpinner.fail('Download failed');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  const writeSpinner = ora('Installing to platforms…').start();
  let written: string[];
  try {
    written = await writeAgencyAgent(entry, content, platforms, projectRoot, options.force ?? false);
    writeSpinner.succeed('Installed');
  } catch (err: unknown) {
    writeSpinner.fail('Installation failed');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  if (written.length === 0) {
    console.log(
      chalk.yellow('\n⚠ Agent already installed (use --force to overwrite).\n'),
    );
  } else {
    console.log(chalk.green(`\n✔ Installed ${chalk.bold(entry.slug)} to:\n`));
    for (const p of written) {
      console.log(`  ${chalk.dim(path.relative(projectRoot, p))}`);
    }
    console.log();
  }
}

export async function agencyListCommand(options: AgencyListOptions): Promise<void> {
  const spinner = ora('Fetching agent index…').start();
  let index: AgencyEntry[];
  try {
    index = await fetchAgentIndex(options.refresh ?? false);
    spinner.stop();
  } catch (err: unknown) {
    spinner.fail('Failed to fetch agent index');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  const pool = options.division
    ? index.filter((a) => a.division.toLowerCase() === options.division!.toLowerCase())
    : index;

  if (pool.length === 0) {
    if (options.division) {
      console.log(chalk.yellow(`\n⚠ No agents found in division "${options.division}".\n`));
      console.log(chalk.dim(`  Run ${chalk.cyan('acli agency list')} without --division to see all.\n`));
    } else {
      console.log(chalk.yellow('\n⚠ No agents found.\n'));
    }
    return;
  }

  // Group by division
  const byDivision = new Map<string, AgencyEntry[]>();
  for (const entry of pool) {
    if (!byDivision.has(entry.division)) byDivision.set(entry.division, []);
    byDivision.get(entry.division)!.push(entry);
  }

  const divisionHeader = options.division ? ` — ${options.division}` : '';
  console.log(chalk.bold(`\n Agency Agents${divisionHeader}  (${AGENCY_OWNER}/${AGENCY_REPO})\n`));

  for (const [division, agents] of byDivision) {
    console.log(chalk.cyan.bold(`  ${division}  (${agents.length})`));
    for (const agent of agents) {
      console.log(`    ${chalk.white(agent.slug)}`);
    }
    console.log();
  }

  console.log(chalk.dim(`  Total: ${pool.length} agents`));
  console.log(chalk.dim(`  Install: ${chalk.cyan('acli agency install <slug>')}\n`));
}

export async function agencySearchCommand(
  query: string,
  options: AgencySearchOptions,
): Promise<void> {
  // Input validation
  if (!/^[a-zA-Z0-9/_\- ]+$/.test(query)) {
    console.error(chalk.red('✖ Invalid search query.'));
    process.exit(1);
  }

  const spinner = ora('Searching…').start();
  let index: AgencyEntry[];
  try {
    index = await fetchAgentIndex(options.refresh ?? false);
    spinner.stop();
  } catch (err: unknown) {
    spinner.fail('Failed to fetch agent index');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  const results = matchAgents(index, query, options.division);

  if (results.length === 0) {
    console.log(chalk.yellow(`\nNo agents matching "${query}".\n`));
    console.log(chalk.dim(`  Try ${chalk.cyan('acli agency list')} to browse all agents.\n`));
    return;
  }

  console.log(chalk.bold(`\n Search results for "${query}"  (${results.length} found)\n`));
  for (const agent of results) {
    console.log(`  ${chalk.cyan(agent.slug)}  ${chalk.dim(`[${agent.division}]`)}`);
  }
  console.log();
  console.log(chalk.dim(`  Install: ${chalk.cyan(`acli agency install <slug>`)}\n`));
}
