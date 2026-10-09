import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The server is the authority on its own requests.
 *
 * A field typed as required that arrives `undefined` is a defect in the
 * caller's code, which the compiler already told them about. What this package
 * must not do is answer for the server: a string composed here before the
 * request existed is not something a strategy can read, and it never reaches
 * `answering`, so the member breaks its own contract by throwing where it
 * promised an `IAdtResponse`.
 *
 * What replaces a guard is nothing. Where the value reaches
 * `encodeSapObjectName` the URL is built from what was given and SAP answers;
 * where a method is called on it first a `TypeError` is raised locally, and
 * that is accepted — a defect in the caller's code says so in the caller's
 * stack.
 */
describe('production code', () => {
  const files = execSync('git ls-files src', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.includes('__tests__'));

  it('finds the files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  /**
   * The one exception, and it is named rather than pattern-matched.
   *
   * A create that reaches SAP without a package makes an object nothing can
   * remove through ADT: the deletion check resolves through the package, so it
   * answers "Object does not exist" while the name stays taken for good. Every
   * other missing field produces a request the server answers — a reading a
   * strategy can take, and a state a caller can recover from.
   */
  const PACKAGE_ON_CREATE =
    /packageName is required for create: an object created without one cannot be deleted through ADT/;

  it.each(files)('%s validates no input', (file) => {
    const source = readFileSync(file, 'utf8').replace(PACKAGE_ON_CREATE, '');
    expect(source).not.toMatch(/throw new \w*Error\([`'"][^`'"]*is required/i);
  });
});
