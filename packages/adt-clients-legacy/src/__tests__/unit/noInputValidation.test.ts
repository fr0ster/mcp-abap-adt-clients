import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * The server is the authority on its own requests — the root package's rule
 * (`noInputValidation.test.ts` there), held on this package's production code:
 * no legacy override answers for the server by throwing on a missing field
 * before a request exists.
 */
describe('production code', () => {
  const PACKAGE = path.resolve(__dirname, '../../..');
  const files = execSync('git ls-files src', {
    cwd: PACKAGE,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.includes('__tests__'));

  it('finds the files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s validates no input', (file) => {
    const source = readFileSync(path.join(PACKAGE, file), 'utf8');
    expect(source).not.toMatch(/throw new \w*Error\([`'"][^`'"]*is required/i);
  });
});
