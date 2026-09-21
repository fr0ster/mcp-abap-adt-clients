import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A publish that runs past a failed build.
 *
 * `scripts/publish-changed.sh` rebuilds before publishing, and until this test
 * it did so with `set -uo pipefail` — no `-e`. A failing `npm run build` left
 * `dist` holding whatever the previous build had put there, and the script
 * went on to publish that. Found while dry-running 20.0.0: a stale
 * `node_modules` made `tsc` fail with "has no exported member
 * 'IAdtTransportObjectActions'" and the run still said "would publish".
 *
 * A publish is the one step where continuing past an error is worse than
 * stopping, because what reaches npm cannot be withdrawn, only superseded.
 *
 * The test runs the real script against a stub `npm` on `PATH`: the build
 * fails, `view` reports the version as unpublished, and `publish` would
 * announce itself. What must not appear is that announcement.
 */
const SCRIPT = join(__dirname, '../../../scripts/publish-changed.sh');

function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'publish-guard-'));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'packages'));

  writeFileSync(
    join(dir, 'bin', 'npm'),
    `#!/usr/bin/env bash
case "$*" in
  *"run --silent build"*) echo "tsc: error TS2305" >&2; exit 2 ;;
  *"view"*) exit 1 ;;
  *"publish"*) echo "STUB PUBLISHED $*"; exit 0 ;;
  *) exit 0 ;;
esac
`,
    { mode: 0o755 },
  );
  chmodSync(join(dir, 'bin', 'npm'), 0o755);

  execFileSync('cp', [SCRIPT, join(dir, 'scripts', 'publish-changed.sh')]);
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: '@fixture/root',
      version: '1.0.0',
      workspaces: ['packages/*'],
    }),
  );
  return dir;
}

describe('the publish script and a build that failed', () => {
  const run = (dir: string) =>
    spawnSync('bash', [join(dir, 'scripts', 'publish-changed.sh')], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` },
    });

  it('publishes nothing and fails', () => {
    const result = run(sandbox());

    expect(result.status).toBe(1);
    // The assertion that matters: the stub announces every publish it is
    // asked for, and it must not have been asked.
    expect(`${result.stdout}${result.stderr}`).not.toContain('STUB PUBLISHED');
  });

  it('says why, so the operator does not go looking in npm', () => {
    const result = run(sandbox());

    expect(result.stderr).toContain('the build failed');
    expect(result.stderr).toContain('Nothing was published');
  });
});
