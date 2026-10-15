import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Keep observations, but remove the identity of the measured system.
 * Development docs, plans and configuration templates also hold observations,
 * so they are scanned along with scripts and package sources.
 * Only this guard is excluded: its patterns necessarily name forbidden content.
 * The object names a capture happened to carry are checked everywhere except
 * the configuration template, where they are the configured test objects.
 */
const SYSTEM_ID = /(?:\b|_)(?:E1[9]|E7[7]|E9[6]|T[R]L)(?:\b|_)/i;
const FORBIDDEN =
  /CB99\d{8}|RFCSAPRL|trial sy[s]tem|the tr[i]al|trial ref[u]sed|on tr[i]al|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.abap(?:-web)?\./i;

const CAPTURED_OBJECTS = /ZOK_MESSAGE_0002|ZAC_INCL01|ZAC_CDSUT_CLS/i;
const TEMPLATE = 'src/__tests__/helpers/test-config.yaml.template';

describe('notes', () => {
  // Include unstaged renames in the working tree as well as indexed files.
  const paths = execSync(
    'git ls-files --cached --others --exclude-standard -z',
    {
      encoding: 'utf8',
    },
  )
    .split('\0')
    .filter((file) => file && existsSync(file));
  const files = paths
    .filter((file) => file !== 'src/__tests__/unit/notesNameNoSystem.test.ts')
    .filter(
      (file) =>
        /^(src\/|docs\/|scripts\/|packages\/[^/]+\/src\/)/.test(file) ||
        /^(CHANGELOG|README)\.md$/.test(file),
    )
    .filter((file) => /\.(ts|js|mjs|md|xml|yaml|yml|template)$/.test(file));

  it('finds the files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(paths)('%s has no system in its path', (file) => {
    expect(file).not.toMatch(SYSTEM_ID);
  });

  it.each(files)('%s names no system', (file) => {
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(SYSTEM_ID);
    expect(content).not.toMatch(FORBIDDEN);
    if (file !== TEMPLATE) expect(content).not.toMatch(CAPTURED_OBJECTS);
  });
});
