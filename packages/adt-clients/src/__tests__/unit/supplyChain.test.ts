import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Supply-chain hardening: no dependency runs an install script, and nothing
 * fetches code it did not install.
 *
 * Worms of the Shai-Hulud kind spread through dependencies' install scripts
 * and steal npm and GitHub tokens. The repository installs once, at its
 * private root: the packages are npm workspaces under one lockfile. The root
 * names every dependency of that lockfile with an install script in
 * `package.json` `allowScripts` and denies it, its `.npmrc` makes an
 * unreviewed one fail the install (`strict-allow-scripts`), and no package
 * allows one either. npm reads those in full only from 11.19.0, so the
 * workflows install with `--ignore-scripts`.
 * `npx` runs whatever it does not find installed straight from the registry,
 * so nothing calls it.
 *
 * Plain line reading over the workflow text: no YAML parser in the repository.
 */

/** The repository's root: this file is in packages/adt-clients/src/__tests__/unit. */
const ROOT = resolve(__dirname, '../../../../..');
/** Every manifest of the repository: the private root and each workspace package. */
const PACKAGES = [
  '.',
  'packages/adt-clients',
  'packages/adt-clients-legacy',
  'packages/adt-strategies',
] as const;
/** The workspace siblings, the only entries of the lockfile npm links. */
const WORKSPACES = PACKAGES.filter((dir) => dir !== '.');
const WORKFLOWS = ['ci.yml', 'release.yml'] as const;

const lines = (file: string): string[] =>
  readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);

const sorted = (items: Iterable<string>): string[] => [...items].sort();

const callsNpx = (line: string): boolean => /\bnpx\b/.test(line);

/** The workflow's lines without a `body: |` block (text for a release's readers). */
function commands(file: string): string[] {
  const kept: string[] = [];
  let body = -1;
  for (const line of lines(join('.github', 'workflows', file))) {
    const indent = line.length - line.trimStart().length;
    if (body >= 0 && (line.trim() === '' || indent > body)) continue;
    body = line.trim() === 'body: |' ? indent : -1;
    kept.push(line);
  }
  return kept;
}

describe.each(WORKFLOWS)('%s installs and runs nothing unreviewed', (file) => {
  const text = commands(file);

  it('installs the repository once, with npm ci --ignore-scripts, and only so', () => {
    const installs = text
      .map((line) => line.trim().replace(/^run:\s*/, ''))
      .filter((line) => /^npm (ci|install|i)(\s|$)/.test(line));
    expect(installs.length).toBeGreaterThan(0);
    expect(
      installs.filter((line) => !line.includes('--ignore-scripts')),
    ).toEqual([]);
    expect([...new Set(installs)]).toEqual(['npm ci --ignore-scripts']);
  });

  it('gates on every known advisory of moderate severity or above, in the one tree', () => {
    const audits = text
      .map((line) => line.trim())
      .filter((line) => line.startsWith('run: npm audit'));
    expect(audits.length).toBeGreaterThan(0);
    expect([...new Set(audits)]).toEqual([
      'run: npm audit --audit-level=moderate',
    ]);
    expect(
      text.filter((line) => line.trim().startsWith('continue-on-error')),
    ).toEqual([]);
  });

  it('caps every job', () => {
    const body = text.slice(text.indexOf('jobs:') + 1);
    const jobs = body.filter((line) => /^ {2}[a-z-]+:$/.test(line)).length;
    const caps = body.filter((line) =>
      /^ {4}timeout-minutes: \d+$/.test(line),
    ).length;
    expect(jobs).toBeGreaterThan(0);
    expect(caps).toBe(jobs);
  });

  it('calls no npx', () => {
    expect(text.filter(callsNpx)).toEqual([]);
  });
});

it('no package script, git hook or runner script calls npx', () => {
  const offenders: string[] = [];
  for (const dir of PACKAGES) {
    const { scripts = {} } = JSON.parse(
      readFileSync(join(ROOT, dir, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    for (const [name, command] of Object.entries(scripts))
      if (callsNpx(command)) offenders.push(`${dir}: ${name}`);
  }
  const scripts = join('packages', 'adt-clients', 'scripts');
  const shell = readdirSync(join(ROOT, scripts))
    .filter((name) => name.endsWith('.sh'))
    .map((name) => join(scripts, name));
  for (const file of ['.husky/pre-commit', ...shell])
    for (const line of lines(file))
      if (!line.trim().startsWith('#') && callsNpx(line))
        offenders.push(`${file}: ${line.trim()}`);
  expect(offenders).toEqual([]);
});

describe('the repository decides every install script', () => {
  const lock = JSON.parse(
    readFileSync(join(ROOT, 'package-lock.json'), 'utf8'),
  ) as {
    packages: Record<
      string,
      { hasInstallScript?: boolean; resolved?: string; link?: boolean }
    >;
  };
  const allowScriptsOf = (dir: string): Record<string, boolean> =>
    (
      JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as {
        allowScripts?: Record<string, boolean>;
      }
    ).allowScripts ?? {};

  it('the root allowScripts denies each package of the lockfile with an install script, and names no other', () => {
    const withScripts = new Set(
      Object.entries(lock.packages)
        .filter(([path, entry]) => path !== '' && entry.hasInstallScript)
        .map(([path]) => path.split('node_modules/').pop() as string),
    );
    const allowScripts = allowScriptsOf('.');
    expect(sorted(Object.keys(allowScripts))).toEqual(sorted(withScripts));
    expect(
      Object.values(allowScripts).every((allowed) => allowed === false),
    ).toBe(true);
  });

  it.each(WORKSPACES)('%s allows no install script', (dir) => {
    expect(
      Object.values(allowScriptsOf(dir)).every((allowed) => allowed === false),
    ).toBe(true);
  });

  it('.npmrc makes an unreviewed install script fail, and sets no release-age gate', () => {
    // No min-release-age: it conflicts with the gating audit — a security
    // fix younger than the gate could not be installed while the audit
    // kept CI red on the advisory it fixes.
    const npmrc = lines('.npmrc').map((line) => line.trim());
    expect(npmrc).toContain('strict-allow-scripts=true');
    expect(npmrc.filter((line) => line.startsWith('min-release-age'))).toEqual(
      [],
    );
  });

  it('the lockfile resolves every package from the registry, and links only the workspace siblings', () => {
    const siblings = new Set<string>(WORKSPACES);
    const links = Object.entries(lock.packages)
      .filter(([, entry]) => entry.link === true)
      .map(([path, entry]) => `${path} -> ${entry.resolved}`);
    expect(sorted(links)).toEqual(
      sorted(
        WORKSPACES.map((dir) => {
          const { name } = JSON.parse(
            readFileSync(join(ROOT, dir, 'package.json'), 'utf8'),
          ) as { name: string };
          return `node_modules/${name} -> ${dir}`;
        }),
      ),
    );
    const foreign = Object.entries(lock.packages)
      .filter(([path]) => path !== '' && !siblings.has(path))
      .filter(([, entry]) => entry.link !== true)
      .filter(
        ([, entry]) =>
          !entry.resolved?.startsWith('https://registry.npmjs.org/'),
      )
      .map(([path]) => path);
    expect(foreign).toEqual([]);
  });
});
