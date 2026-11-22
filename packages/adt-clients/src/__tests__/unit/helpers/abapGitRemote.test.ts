/**
 * The abapGit live suite's branch cleanup: a branch is deleted in the remote
 * its ledger entry recorded, and retired only once its absence is confirmed —
 * `204` deleted, `404` from that remote absent; a `422` proves nothing until
 * the exact ref reads `404`.
 */

import {
  GitHubFixtures,
  gitHubRepoOf,
  type IAbapGitRemote,
} from '../../helpers/abapGitRemote';

const configured: IAbapGitRemote = {
  url: 'https://github.com/owner/now.git',
  user: 'u',
  token: 't0ken',
  owner: 'owner',
  repo: 'now',
};

interface ISent {
  readonly method: string;
  readonly url: string;
}

/** `fetch` answering the statuses in turn, recording each request. */
function stubFetch(statuses: number[]): ISent[] {
  const sent: ISent[] = [];
  let at = 0;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    sent.push({ method: String(init?.method), url: String(input) });
    const status = statuses[Math.min(at, statuses.length - 1)] ?? 500;
    at += 1;
    return new Response(status === 204 ? null : '{}', { status });
  });
  return sent;
}

afterEach(() => jest.restoreAllMocks());

describe('gitHubRepoOf', () => {
  it('takes https://github.com/<owner>/<repo>[.git] apart, nothing else', () => {
    expect(gitHubRepoOf('https://github.com/o/r.git')).toEqual({
      owner: 'o',
      repo: 'r',
    });
    expect(gitHubRepoOf('https://github.com/o/r')).toEqual({
      owner: 'o',
      repo: 'r',
    });
    expect(gitHubRepoOf('https://git.example.invalid/o/r.git')).toBeUndefined();
    expect(gitHubRepoOf('https://github.com/o/r/x')).toBeUndefined();
  });
});

describe('deleteBranch, in the recorded remote', () => {
  const recorded = new GitHubFixtures(configured).forUrl(
    'https://github.com/owner/then.git',
  );

  it('deletes in the remote the entry recorded, not the configured one', async () => {
    const sent = stubFetch([204]);
    await expect(recorded.deleteBranch('abapgit-live-x')).resolves.toBe(
      'deleted',
    );
    expect(sent).toEqual([
      {
        method: 'DELETE',
        url: 'https://api.github.com/repos/owner/then/git/refs/heads/abapgit-live-x',
      },
    ]);
  });

  it('a 404 from that remote is absence', async () => {
    stubFetch([404]);
    await expect(recorded.deleteBranch('b')).resolves.toBe('absent');
  });

  it('a 422 is absence only once the exact ref reads 404', async () => {
    const sent = stubFetch([422, 404]);
    await expect(recorded.deleteBranch('b')).resolves.toBe('absent');
    expect(sent[1]).toEqual({
      method: 'GET',
      url: 'https://api.github.com/repos/owner/then/git/ref/heads/b',
    });
  });

  it('a 422 with the ref still there throws, so the ledger keeps it', async () => {
    stubFetch([422, 200]);
    await expect(recorded.deleteBranch('b')).rejects.toThrow(/still exists/);
  });

  it('a 422 whose ref cannot be read throws', async () => {
    stubFetch([422, 500]);
    await expect(recorded.deleteBranch('b')).rejects.toThrow();
  });

  it('refuses a recorded remote that is not GitHub', () => {
    expect(() =>
      new GitHubFixtures(configured).forUrl('https://git.example.invalid/r'),
    ).toThrow(/not https:\/\/github.com/);
  });
});
