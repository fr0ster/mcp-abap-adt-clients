import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The corpus is committed, so what is in it is published.
 *
 * The first version shipped here claimed the system was identified nowhere
 * while fourteen files carried the real system id in `adtcore:masterSystem`
 * and thirty-seven carried the answering application server in
 * `sap-adt-saplb`. A README is not a check; this is.
 *
 * Placeholders are deliberate rather than deletions — a strategy still has to
 * see that a user id and a system id sit in those attributes.
 *
 * The corpus is kept in subfolders (`answers/`, `debugger/`, `discovery/`,
 * `typestructure/`, `measurements/<release>/`); every file under it is read.
 */
const CORPUS = join(__dirname, '../../../corpus/adt');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : [relative(CORPUS, join(dir, entry.name))],
  );

const files = (() => {
  try {
    return walk(CORPUS);
  } catch {
    return [];
  }
})();

const text = (name: string): string =>
  readFileSync(join(CORPUS, name), 'utf-8');

describe('the recorded corpus', () => {
  it('is there to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each([
    [
      'a system id other than the placeholder or SAP',
      // Also inside a recorded request body, where the quotes are escaped.
      /masterSystem=\\?"(?!SYS\\?"|SAP\\?")[^"\\]+\\?"/,
    ],
    ['a system id of the recorded systems', /\b(?:T[R]L|E1[9]|E7[7])\b/],
    ['a transport request number', /\b[A-Z0-9]{3}K9\d{5}\b/],
    ['an unreplaced scrub marker', /<scrubbed>/],
    ['an application server name', /appserver-[a-z0-9]/i],
    ['a bearer token', /Bearer\s+[A-Za-z0-9._-]{16,}/],
    ['an Authorization header value', /"authorization"\s*:\s*"(?!REDACTED)/i],
    ['a cookie value', /"set-cookie"\s*:\s*"(?!REDACTED)/i],
    ['a CSRF token', /"x-csrf-token"\s*:\s*"(?!REDACTED|Fetch")/i],
    ['a host name', /[a-z0-9-]+\.(?:hana\.ondemand|ondemand)\.com/i],
    ['an IP address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ])('carries no %s', (_what, pattern) => {
    const offenders = files.filter((name) => pattern.test(text(name)));
    expect(offenders).toEqual([]);
  });

  /**
   * A host is named only as a placeholder or as SAP's own: the XML namespaces,
   * SAP's people directory a feed author links to, and the corpus
   * placeholders. Any other host is the recorded system's.
   */
  const HOSTS = new Set([
    'www.sap.com',
    'www.w3.org',
    'people.wdf.sap.corp',
    'abap.example.com',
    'sap.example.local',
    'abap-cloud.example',
  ]);

  it("names no host but a placeholder or SAP's own", () => {
    const offenders = files.flatMap((name) =>
      [...text(name).matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)]
        .map((match) => match[1])
        .filter((host) => !HOSTS.has(host.toLowerCase()))
        .map((host) => `${name}: ${host}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * A user is named only as the placeholder or as one of SAP's own users,
   * in an attribute or a JSON field, escaped or not.
   */
  const USERS = new Set(['SAPUSER01', 'SAP', 'SAP_SPC', '_SAPSUPPORT', 'SYS']);

  it("names no user but the placeholder or SAP's own", () => {
    const field =
      /\b(?:user|User|userName|responsible|changedBy|createdBy|owner|executedBy|lockedBy)\\?"?\s*[=:]\s*\\?"([^"\\]+)\\?"/g;
    const offenders = files.flatMap((name) =>
      [...text(name).matchAll(field)]
        .map((match) => match[1])
        .filter((user) => user.trim() !== '' && !USERS.has(user))
        .map((user) => `${name}: ${user}`),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the placeholders it promises, so a reading still sees the shape', () => {
    const documents = files.filter((name) => name.endsWith('.body.xml'));
    const withSystem = documents.filter((name) =>
      text(name).includes('masterSystem='),
    );
    expect(withSystem.length).toBeGreaterThan(0);
    // `SAP` is the master system of an object SAP delivers, not a system id.
    for (const name of withSystem) {
      expect(text(name)).toMatch(/masterSystem="(?:SYS|SAP)"/);
    }
    expect(
      withSystem.some((name) => text(name).includes('masterSystem="SYS"')),
    ).toBe(true);
  });
});
