import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Which system an observation came from is closed information.
 *
 * The observation stays where it explains a choice — it is the reason a default
 * is what it is — but the identity of the system never does, and neither do the
 * object names a capture happened to carry.
 *
 * `docs/development/` is excluded on purpose: it tells a developer how to point
 * the suite at a system, which is configuration rather than a claim about SAP.
 * `docs/superpowers/` is excluded because a plan is not documentation.
 */
const FORBIDDEN =
  /\bE19\b|\bE77\b|RFCSAPRL|trial system|on the trial|against the trial|ZOK_MESSAGE_0002|ZAC_INCL01|ZAC_CDSUT_CLS/i;

describe('notes', () => {
  const files = execSync('git ls-files src docs', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__'))
    .filter((f) => !f.startsWith('docs/development/'))
    .filter((f) => !f.startsWith('docs/superpowers/'))
    .filter((f) => f.endsWith('.ts') || f.endsWith('.md'));

  it('finds the files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)('%s names no system', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(FORBIDDEN);
  });
});
