import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A consumer's sequence lives outside the package, and stays there.
 *
 * 19.0.0 removed every member that joined several requests, and wrote the
 * joins the repository still needs — the package walk, the function-group
 * children, the table statement, the activation wait — as what they are:
 * code a consumer writes. They sit under `scripts/`, which `tsconfig.json`
 * excludes and `package.json` does not ship.
 *
 * The hazard is not that they exist. It is that one of them looks useful,
 * moves into `src/`, and is exported — and the release is undone by a helper
 * nobody argued about. So the location is asserted rather than assumed, and a
 * new sequence has to be added to this list deliberately.
 *
 * `activateAndWait` was one of these for a commit and is not here because it no
 * longer exists anywhere: a wait is four lines, so each caller writes its own.
 * Its name stays in the entry-point check below, so bringing it back as an
 * export fails a test rather than passing review.
 */
const SEQUENCES = [
  'packageWalk.ts',
  'functionGroupChildren.ts',
  'tableSelect.ts',
];

describe("a consumer's sequence", () => {
  it.each(SEQUENCES)('%s lives under scripts/, not src/', (file) => {
    expect(existsSync(join(process.cwd(), 'scripts', 'lib', file))).toBe(true);
  });

  it('none of them is inside src/', () => {
    const inSrc = execSync('git ls-files src', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => SEQUENCES.some((s) => f.endsWith(`/${s}`)));

    expect(inSrc).toEqual([]);
  });

  it('none of them is reachable from the package entry point', async () => {
    const api = (await import('../../index')) as Record<string, unknown>;

    for (const name of [
      'walkPackage',
      'functionGroupChildren',
      'selectEveryColumn',
      'activateAndWait',
    ]) {
      expect(api[name]).toBeUndefined();
    }
  });
});
