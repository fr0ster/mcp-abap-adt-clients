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
 * `headers/`, `typestructure/`); every file under it is read.
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

  /** An element naming a host or a server holds a placeholder. */
  const SERVERS = new Set([
    'appserver',
    'APPSERVER_00',
    'appserver_SYS_00',
    'sap.example.local',
    'abap.example.com',
    'abap-cloud.example',
  ]);

  /** A user is named only as the placeholder or as one of SAP's own users. */
  const USERS = new Set([
    'SAPUSER01',
    'SAPUSER_NONE',
    'SAP',
    'SAP AG',
    'SAP SE',
    'SAP_SPC',
    '_SAPSUPPORT',
    'SYS',
  ]);

  // The whole authority: a host after any `user@` and without its port.
  const URL_AUTHORITY = /https?:\/\/([^/\s"'<>\\?#]+)/g;
  const hostOf = (authority: string): string =>
    (authority.split('@').pop() ?? '').split(':')[0] ?? '';
  const SERVER_ELEMENT =
    /<(?:[A-Za-z]+:)?(?:host|HOST|hostname|server|APPSERVER|originalServer)>([^<]*)</g;
  // A server named in an attribute (`serverName`), and the server a debuggee
  // session id ends with.
  const SERVER_ATTRIBUTE =
    /\b[A-Za-z]*[Ss]erver[A-Za-z]*=\\?"([^"\\]*)\\?"|debuggeeSessionId=\\?"[0-9A-Fa-f]+\s+([^"\\]+)\\?"/g;
  const DASHED_IP = /\b(?:\d{1,3}-){3}\d{1,3}\b/g;
  // An attribute or a JSON field, escaped or not: the whole double- or
  // single-quoted value, or an unquoted one (a query parameter).
  const USER_FIELD =
    /\b(?:[A-Za-z]*[Uu]ser(?:Name|FullName|Id)?|responsible|changedBy|createdBy|owner|executedBy|lockedBy)\\?["']?\s*[=:]\s*(?:\\"((?:[^"\\]|\\(?!"))*)\\"|"((?:[^"\\]|\\.)*)"|'([^']*)'|([^"'\\&<>\s,}]+))/g;
  // An element named for a user (`trc:user`, `mi:originalUser`,
  // `del:lockUser`, `DEBUGGEE_USER`), and a feed author's name.
  const USER_ELEMENT =
    /<((?:[A-Za-z]+:)?(?:[A-Za-z]*[Uu]ser[A-Za-z]*|[A-Z_]*_USER|atom:name))>([^<]*)</g;

  /** What a detector finds in one text that it refuses. */
  const detectors: Record<string, (content: string) => string[]> = {
    host: (content) =>
      [...content.matchAll(URL_AUTHORITY)]
        .map((match) => hostOf(match[1] ?? ''))
        .filter((host) => !HOSTS.has(host.toLowerCase())),
    server: (content) =>
      [
        ...[...content.matchAll(SERVER_ELEMENT)].map((match) => match[1] ?? ''),
        ...[...content.matchAll(SERVER_ATTRIBUTE)].map(
          (match) => match[1] ?? match[2] ?? '',
        ),
      ].filter((server) => !SERVERS.has(server)),
    'dashed IP': (content) =>
      [...content.matchAll(DASHED_IP)].map((match) => match[0]),
    user: (content) => [
      ...[...content.matchAll(USER_FIELD)]
        .map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? '')
        .filter((user) => user !== '' && !USERS.has(user)),
      ...[...content.matchAll(USER_ELEMENT)]
        .map((match) => match[2] ?? '')
        .filter((user) => user !== '' && !USERS.has(user)),
    ],
  };

  it.each(Object.keys(detectors))(
    "names no %s but a placeholder or SAP's own",
    (kind) => {
      const detect = detectors[kind] ?? (() => []);
      const offenders = files.flatMap((name) =>
        detect(text(name)).map((found) => `${name}: ${found}`),
      );
      expect(offenders).toEqual([]);
    },
  );

  // The detectors themselves: each refuses what it is there to refuse, so a
  // detector that stops matching fails here even on a clean corpus.
  it.each([
    ['host', '<a href="https://host.realcorp.net:44300/sap/bc/adt"/>'],
    ['host', '<a href="https://abap.example.com@private.realcorp.net/sap"/>'],
    ['server', '<trc:host>realhost</trc:host>'],
    ['server', '<mi:originalServer>realhost_00</mi:originalServer>'],
    ['server', '<x serverName="realhost_PRD_00"/>'],
    ['server', '<x debuggeeSessionId="3D000000BA5F00  realhost_PRD_00"/>'],
    ['dashed IP', '<trc:host>10-1-2-3</trc:host>'],
    ['user', '<x adtcore:changedBy="REALUSER"/>'],
    ['user', '<x user="SAPUSER01 REALUSER"/>'],
    ['user', "<x user='REALUSER'/>"],
    ['user', '{"user": " REALUSER"}'],
    ['user', '{"body": "<x responsible=\\"REALUSER\\"/>"}'],
    ['user', '/sap/bc/adt/x?requestUser=REALUSER&a=b'],
    ['user', '<trc:user>REALUSER</trc:user>'],
    ['user', '<mi:originalUser>REALUSER</mi:originalUser>'],
    ['user', '<DEBUGGEE_USER>REALUSER</DEBUGGEE_USER>'],
    ['user', '<atom:name>REALUSER</atom:name>'],
    ['user', '{"userName":"SAPUSER01","userFullName":"Jane Smith"}'],
    ['user', '{"userFullName":"SAPUSER01\\" Jane Smith"}'],
  ])('the %s detector refuses %s', (kind, planted) => {
    const detect = detectors[kind] ?? (() => []);
    expect(detect(planted)).not.toEqual([]);
  });

  it.each([
    ['host', '<a href="https://abap.example.com:44300/sap/bc/adt"/>'],
    ['server', '<trc:host>appserver</trc:host>'],
    [
      'server',
      '<x serverName="appserver_SYS_00" debuggeeSessionId="3D00  appserver_SYS_00"/>',
    ],
    ['user', '{"userName":"SAPUSER01","userFullName":"SAPUSER01"}'],
    [
      'user',
      '<x changedBy="SAPUSER01" user="" /><atom:name>SAP SE</atom:name>',
    ],
    ['user', '{"body": "<x responsible=\\"SAPUSER01\\"/>"}'],
  ])('the %s detector lets a placeholder through: %s', (kind, allowed) => {
    const detect = detectors[kind] ?? (() => []);
    expect(detect(allowed)).toEqual([]);
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
