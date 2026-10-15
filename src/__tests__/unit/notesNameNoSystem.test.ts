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
 * This guard excludes itself because its patterns name the forbidden content.
 * Only .ts, .js, .md and .xml are checked: configuration (.yaml and
 * .template files) describes how to target a system rather than observations.
 */
const FORBIDDEN =
  /\bE1[9]\b|\bE7[7]\b|RFCSAPRL|trial sy[s]tem|on the trial|against the trial|ZOK_MESSAGE_0002|ZAC_INCL01|ZAC_CDSUT_CLS|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.abap(?:-web)?\./i;

describe('notes', () => {
  const files = execSync('git ls-files src docs CHANGELOG.md README.md', {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && f !== 'src/__tests__/unit/notesNameNoSystem.test.ts')
    .filter((f) => !f.startsWith('docs/development/'))
    .filter((f) => !f.startsWith('docs/superpowers/'))
    .filter((f) => /\.(ts|js|md|xml)$/.test(f));

  it('finds the files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)('%s names no system', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(FORBIDDEN);
  });
});
