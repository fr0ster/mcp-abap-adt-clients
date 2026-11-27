/**
 * The legacy forms keep 46.1.0's request and answer exactly (owner's ruling):
 * `pull` with `remoteUser`/`remotePassword` (the old form of `link` and
 * `checkExternalRepo` is refused since #304, C4),
 * `listRepos`, `unlink` and `getErrorLog`. Each request below is the one
 * 46.1.0 sent, recorded before 46.2.0 changed anything; none carries the new
 * forms' `noLog`, `noResend` or `stateless`, and each answer is the document
 * as it arrived (`unlink`: nothing).
 */

import { gitClient, ok, ScriptedConnection } from './abapGitHelpers';

const HEADERS = {
  accept: 'application/abapgit.adt.repo.object.v2+xml',
  contentType: 'application/abapgit.adt.repo.v3+xml',
};
const PAIR = {
  Accept: 'application/abapgit.adt.repo.object.v2+xml',
  'Content-Type': 'application/abapgit.adt.repo.v3+xml',
};
const NS = 'xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories"';
const XML = '<?xml version="1.0" encoding="UTF-8"?>';

describe('the deprecated abapGit forms, as 46.1.0 sent and answered them', () => {
  it('pull with remoteUser/remotePassword, to its pull link', async () => {
    const connection = new ScriptedConnection(() => ok('<pulled/>'));

    const answer = await gitClient(connection).pull(
      {
        package: 'ZPKG',
        pullLink: '/sap/bc/adt/abapgit/repos/000001/pull',
        branchName: 'refs/heads/main',
        remoteUser: 'old-user',
        remotePassword: 'old-password',
      },
      { headers: HEADERS },
    );

    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos/000001/pull',
        timeout: 0,
        headers: PAIR,
        data:
          `${XML}<abapgitrepo:repository ${NS}>` +
          '<abapgitrepo:package>ZPKG</abapgitrepo:package>' +
          '<abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
          '<abapgitrepo:remoteUser>old-user</abapgitrepo:remoteUser>' +
          '<abapgitrepo:remotePassword>old-password</abapgitrepo:remotePassword>' +
          '</abapgitrepo:repository>',
      },
    ]);
    expect(answer.ok && answer.getResult()).toEqual({ value: '<pulled/>' });
  });

  it('refuses the old form of link and checkExternalRepo (C4 of #304)', () => {
    // Compiled, never called: each old-form call is refused by the types.
    const _refused = (connection: ScriptedConnection) => {
      // @ts-expect-error -- remoteUser/remotePassword are the old form, gone
      void gitClient(connection).link(
        { package: 'ZPKG', url: 'u', remoteUser: 'u', remotePassword: 'p' },
        { headers: HEADERS },
      );
      // @ts-expect-error -- remoteUser/remotePassword are the old form, gone
      void gitClient(connection).checkExternalRepo(
        { url: 'u', remoteUser: 'u', remotePassword: 'p' },
        { headers: HEADERS },
      );
    };
    expect(typeof _refused).toBe('function');
  });

  it('listRepos', async () => {
    const connection = new ScriptedConnection(() => ok('<repos/>'));

    const answer = await gitClient(connection).listRepos();

    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos',
        timeout: 0,
        headers: { Accept: 'application/abapgit.adt.repos.v2+xml' },
      },
    ]);
    expect(answer.ok && answer.getResult()).toEqual({ value: '<repos/>' });
  });

  it('unlink', async () => {
    const connection = new ScriptedConnection();

    const answer = await gitClient(connection).unlink({
      repositoryId: 'A/B',
      transportRequest: 'DEVK900001',
    });

    expect(connection.sent).toEqual([
      {
        method: 'DELETE',
        url: '/sap/bc/adt/abapgit/repos/A%2FB',
        timeout: 0,
        params: { corrNr: 'DEVK900001' },
      },
    ]);
    expect(answer.ok && answer.getResult()).toEqual({ value: undefined });
  });

  it('getErrorLog', async () => {
    const connection = new ScriptedConnection(() => ok('<log/>'));

    const answer = await gitClient(connection).getErrorLog(
      '/sap/bc/adt/abapgit/repos/000001/log/L1',
    );

    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/000001/log/L1',
        timeout: 0,
        headers: { Accept: 'application/abapgit.adt.repo.object.v2+xml' },
      },
    ]);
    expect(answer.ok && answer.getResult()).toEqual({ value: '<log/>' });
  });

  it('a deprecated form’s failure is SAP’s answer with its text, as before', async () => {
    const connection = new ScriptedConnection(() => ok('<exc/>', 500));

    const answer = await gitClient(connection).listRepos();

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().response?.data).toBe('<exc/>');
  });
});
