/**
 * The cloud-wait example of CLIENT_API_REFERENCE.md ("AbapGit") unlinks only
 * after the run is this pull's: a log link other than the one before the POST
 * and a terminal status — the rule the new forms' section states. A wait on
 * `status === 'R'` alone takes the previous run's terminal status for this one.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const DOC = fs.readFileSync(
  path.resolve(__dirname, '../../../../../docs/usage/CLIENT_API_REFERENCE.md'),
  'utf8',
);

describe('the abapGit wait example', () => {
  const start = DOC.indexOf('### AbapGit (ADT-integrated)');
  const block = DOC.slice(start, DOC.indexOf('```\n', DOC.indexOf('```typescript', start) + 3));

  it('requires a new log link and a terminal status before unlink', () => {
    const guard = block.indexOf('if (!finished)');
    const unlink = block.indexOf('abapGit.unlink(');
    expect(block).toContain('const before = linked.logLink;');
    expect(block).toContain("['S', 'W', 'E', 'A']");
    expect(block).toContain('repo.logLink !== before && terminal(repo.status)');
    expect(guard).toBeGreaterThan(0);
    expect(unlink).toBeGreaterThan(guard);
    expect(block).not.toContain("while (repo.status === 'R'");
  });
});
