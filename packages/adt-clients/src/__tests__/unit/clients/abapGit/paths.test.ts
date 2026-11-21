/**
 * Every abapGit request addressed by a repository is built from its key, one
 * encoded segment at a time, and the two members that still take a link
 * (`pull`, `getErrorLog`, deprecated) send only to the path they would build
 * themselves: the link is taken apart, its segments decoded and rebuilt, and
 * anything else is refused in fixed words with nothing sent.
 */

import { repoPath } from '../../../../clients/abapGit/paths';
import { gitClient, ScriptedConnection } from './abapGitHelpers';

const HEADERS = {
  accept: 'application/abapgit.adt.repo.object.v2+xml',
  contentType: 'application/abapgit.adt.repo.v3+xml',
};

describe('repoPath', () => {
  it('encodes each segment, a key holding / ? # included', () => {
    expect(repoPath('A/B?C#D', 'log', 'L 1')).toBe(
      '/sap/bc/adt/abapgit/repos/A%2FB%3FC%23D/log/L%201',
    );
    expect(repoPath('000001')).toBe('/sap/bc/adt/abapgit/repos/000001');
  });

  it.each([
    ['an empty key', ['']],
    ['a key "."', ['.']],
    ['a key ".."', ['..']],
    ['an empty segment', ['K', '']],
    ['a segment "."', ['K', '.']],
    ['a segment ".."', ['K', 'pull', '..']],
  ])('refuses %s in fixed words', (_name, [key, ...segments]) => {
    expect(() => repoPath(key, ...segments)).toThrow(
      'abapGit: a repository key or path segment is empty, "." or ".."; nothing was sent',
    );
  });
});

const REFUSED_LINK =
  'abapGit: the link is not a repository path this client sends to; nothing was sent';

/** Links neither wrapper sends to, each with the shape of the one it is not. */
function badLinks(tail: string): Array<[string, string]> {
  return [
    [
      'an absolute URL',
      `https://evil.invalid/sap/bc/adt/abapgit/repos/K/${tail}`,
    ],
    ['a foreign host', `//evil.invalid/sap/bc/adt/abapgit/repos/K/${tail}`],
    ['a query', `/sap/bc/adt/abapgit/repos/K/${tail}?sap-client=001`],
    ['a fragment', `/sap/bc/adt/abapgit/repos/K/${tail}#x`],
    ['a ".." key', `/sap/bc/adt/abapgit/repos/../${tail}`],
    ['an encoded ".." key', `/sap/bc/adt/abapgit/repos/%2E%2E/${tail}`],
    ['an empty key', `/sap/bc/adt/abapgit/repos//${tail}`],
    ['a malformed escape', `/sap/bc/adt/abapgit/repos/%E0%A4%A/${tail}`],
    ['another path', '/sap/bc/adt/oo/classes/zcl_demo'],
    ['an extra segment', `/sap/bc/adt/abapgit/repos/K/${tail}/more`],
    ['a missing prefix', `/sap/bc/adt/abapgit/K/${tail}`],
  ];
}

describe('getErrorLog (deprecated): the log link', () => {
  it('sends a valid encoded href to its destination exactly', async () => {
    const connection = new ScriptedConnection();

    await gitClient(connection).getErrorLog(
      '/sap/bc/adt/abapgit/repos/A%2FB/log/L1',
    );

    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/A%2FB/log/L1',
        timeout: 0,
        headers: { Accept: 'application/abapgit.adt.repo.object.v2+xml' },
      },
    ]);
  });

  it.each([
    ...badLinks('log/L1'),
    ['an ".." log id', '/sap/bc/adt/abapgit/repos/K/log/..'],
    ['an empty log id', '/sap/bc/adt/abapgit/repos/K/log/'],
    ['a pull link', '/sap/bc/adt/abapgit/repos/K/pull'],
  ])('refuses %s with nothing sent', async (_name, link) => {
    const connection = new ScriptedConnection();

    await expect(gitClient(connection).getErrorLog(link)).rejects.toThrow(
      REFUSED_LINK,
    );
    expect(connection.sent).toHaveLength(0);
  });
});

describe('pull (deprecated): the pull link', () => {
  it('sends to the rebuilt link, with no branchName as before', async () => {
    const connection = new ScriptedConnection();

    await gitClient(connection).pull(
      { package: 'ZPKG', pullLink: '/sap/bc/adt/abapgit/repos/A%2FB/pull' },
      { headers: HEADERS },
    );

    expect(connection.sent).toHaveLength(1);
    expect(connection.sent[0]?.url).toBe(
      '/sap/bc/adt/abapgit/repos/A%2FB/pull',
    );
    expect(connection.sent[0]?.data).toContain(
      '<abapgitrepo:branchName></abapgitrepo:branchName>',
    );
  });

  it.each([
    ...badLinks('pull'),
    ['a log link', '/sap/bc/adt/abapgit/repos/K/log/L1'],
    ['the dialog pull', '/sap/bc/adt/abapgit/repos/K/pull/v2'],
  ])('refuses %s with nothing sent', async (_name, pullLink) => {
    const connection = new ScriptedConnection();

    await expect(
      gitClient(connection).pull(
        { package: 'ZPKG', pullLink },
        { headers: HEADERS },
      ),
    ).rejects.toThrow(REFUSED_LINK);
    expect(connection.sent).toHaveLength(0);
  });
});

describe('the key-addressed members: a key or segment no path may hold', () => {
  const COMMIT = {
    text: 't',
    author: { name: 'a', email: 'a@x.invalid' },
    committer: { name: 'c', email: 'c@x.invalid' },
  };
  const calls: Array<
    [
      string,
      (git: ReturnType<typeof gitClient>, bad: string) => Promise<unknown>,
    ]
  > = [
    [
      'pullRepo',
      (g, bad) =>
        g.pullRepo({ key: bad, branchName: 'main' }, { headers: HEADERS }),
    ],
    [
      'pullRepoInDialog',
      (g, bad) =>
        g.pullRepoInDialog(
          { key: bad, branchName: 'main' },
          { headers: HEADERS },
        ),
    ],
    ['getModifiedObjects', (g, bad) => g.getModifiedObjects({ key: bad })],
    ['getStatus', (g, bad) => g.getStatus({ key: bad })],
    ['getRunLog (key)', (g, bad) => g.getRunLog({ key: bad, appLogKey: 'L1' })],
    [
      'getRunLog (appLogKey)',
      (g, bad) => g.getRunLog({ key: 'K', appLogKey: bad }),
    ],
    ['getStaging', (g, bad) => g.getStaging({ key: bad })],
    ['push', (g, bad) => g.push({ key: bad, staged: [], comment: COMMIT })],
    ['checkRepo', (g, bad) => g.checkRepo({ key: bad })],
    [
      'getFile',
      (g, bad) => g.getFile({ key: bad, filename: 'f', version: 'local' }),
    ],
    [
      'switchBranch (key)',
      (g, bad) => g.switchBranch({ key: bad, branch: 'dev', create: false }),
    ],
    [
      'switchBranch (branch)',
      (g, bad) => g.switchBranch({ key: 'K', branch: bad, create: true }),
    ],
  ];

  it.each(
    calls.flatMap(([name, call]) =>
      ['', '.', '..'].map(
        (bad) => [name, JSON.stringify(bad), bad, call] as const,
      ),
    ),
  )(
    '%s with %s is refused with nothing sent',
    async (_name, _shown, bad, call) => {
      const connection = new ScriptedConnection();

      await expect(call(gitClient(connection), bad)).rejects.toThrow(
        'abapGit: a repository key or path segment is empty, "." or ".."; nothing was sent',
      );
      expect(connection.sent).toHaveLength(0);
    },
  );
});
