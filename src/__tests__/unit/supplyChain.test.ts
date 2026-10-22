import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Supply-chain hardening: no dependency runs an install script, and nothing
 * fetches code it did not install.
 *
 * Worms of the Shai-Hulud kind spread through dependencies' install scripts
 * and steal npm and GitHub tokens. So each of the two packages of this
 * repository — the root and `packages/adt-strategies`, each with a lockfile
 * of its own — names every dependency with an install script in
 * `package.json` `allowScripts` and denies it, and its `.npmrc` makes an
 * unreviewed one fail the install (`strict-allow-scripts`). npm reads those in
 * full only from 11.19.0, so the workflows install with `--ignore-scripts`.
 * `npx` runs whatever it does not find installed straight from the registry,
 * so nothing calls it.
 *
 * Plain line reading over the workflow text: no YAML parser in the repository.
 */

const ROOT = resolve(__dirname, '../../..');
const PACKAGES = ['.', 'packages/adt-strategies'] as const;
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

  it('installs both packages, each with npm ci --ignore-scripts, and only so', () => {
    const installs = text
      .map((line) => line.trim().replace(/^run:\s*/, ''))
      .filter((line) => /^npm (ci|install|i)(\s|$)/.test(line));
    expect(installs.length).toBeGreaterThan(0);
    expect(
      installs.filter((line) => !line.includes('--ignore-scripts')),
    ).toEqual([]);
    if (file === 'ci.yml')
      expect(sorted(installs)).toEqual(
        sorted([
          'npm ci --ignore-scripts',
          'npm ci --ignore-scripts --prefix packages/adt-strategies',
        ]),
      );
  });

  it('gates on every known advisory of moderate severity or above, in both trees', () => {
    const audits = text
      .map((line) => line.trim())
      .filter((line) => line.startsWith('run: npm audit'));
    expect(sorted(audits)).toEqual(
      sorted([
        'run: npm audit --audit-level=moderate',
        'run: npm audit --audit-level=moderate --prefix packages/adt-strategies',
      ]),
    );
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
  const shell = readdirSync(join(ROOT, 'scripts'))
    .filter((name) => name.endsWith('.sh'))
    .map((name) => join('scripts', name));
  for (const file of ['.husky/pre-commit', ...shell])
    for (const line of lines(file))
      if (!line.trim().startsWith('#') && callsNpx(line))
        offenders.push(`${file}: ${line.trim()}`);
  expect(offenders).toEqual([]);
});

describe.each(PACKAGES)('%s decides every install script', (dir) => {
  it('allowScripts denies each package of the lockfile with an install script, and names no other', () => {
    const lock = JSON.parse(
      readFileSync(join(ROOT, dir, 'package-lock.json'), 'utf8'),
    ) as { packages: Record<string, { hasInstallScript?: boolean }> };
    const withScripts = new Set(
      Object.entries(lock.packages)
        .filter(([path, entry]) => path !== '' && entry.hasInstallScript)
        .map(([path]) => path.split('node_modules/').pop() as string),
    );
    const { allowScripts = {} } = JSON.parse(
      readFileSync(join(ROOT, dir, 'package.json'), 'utf8'),
    ) as { allowScripts?: Record<string, boolean> };
    expect(sorted(Object.keys(allowScripts))).toEqual(sorted(withScripts));
    expect(
      Object.values(allowScripts).every((allowed) => allowed === false),
    ).toBe(true);
  });

  it('.npmrc makes an unreviewed install script fail, and waits 7 days for a release', () => {
    const npmrc = lines(join(dir, '.npmrc')).map((line) => line.trim());
    expect(npmrc).toContain('strict-allow-scripts=true');
    expect(npmrc).toContain('min-release-age=7');
    expect(npmrc).toContain('min-release-age-exclude[]=@mcp-abap-adt/*');
  });

  it('the lockfile resolves every package from the registry, none linked', () => {
    const lock = JSON.parse(
      readFileSync(join(ROOT, dir, 'package-lock.json'), 'utf8'),
    ) as {
      packages: Record<string, { resolved?: string; link?: boolean }>;
    };
    const foreign = Object.entries(lock.packages)
      .filter(([path]) => path !== '')
      .filter(
        ([, entry]) =>
          entry.link === true ||
          !entry.resolved?.startsWith('https://registry.npmjs.org/'),
      )
      .map(([path]) => path);
    expect(foreign).toEqual([]);
  });
});
