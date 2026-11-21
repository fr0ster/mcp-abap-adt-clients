/**
 * The legacy forms keep 46.1.0's request and answer exactly (owner's ruling):
 * `link`, `pull` and `checkExternalRepo` with `remoteUser`/`remotePassword`,
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
  it('link with remoteUser/remotePassword', async () => {
    const connection = new ScriptedConnection(() => ok('<linked/>'));

    const answer = await gitClient(connection).link(
      {
        package: 'ZPKG',
        url: 'https://git.example.invalid/team/repo.git',
        remoteUser: 'old-user',
        remotePassword: 'old-password',
        transportRequest: 'DEVK900001',
      },
      { headers: HEADERS },
    );

    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos',
        timeout: 0,
        headers: PAIR,
        data:
          `${XML}<abapgitrepo:repository ${NS}>` +
          '<abapgitrepo:package>ZPKG</abapgitrepo:package>' +
          '<abapgitrepo:url>https://git.example.invalid/team/repo.git</abapgitrepo:url>' +
          '<abapgitrepo:branchName>refs/heads/master</abapgitrepo:branchName>' +
          '<abapgitrepo:remoteUser>old-user</abapgitrepo:remoteUser>' +
          '<abapgitrepo:remotePassword>old-password</abapgitrepo:remotePassword>' +
          '<abapgitrepo:transportRequest>DEVK900001</abapgitrepo:transportRequest>' +
          '</abapgitrepo:repository>',
      },
    ]);
    // `linked`'s shipped default is the document as it arrived.
    expect(answer.ok && answer.getResult()).toEqual({ value: '<linked/>' });
  });

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

  it('checkExternalRepo with remoteUser/remotePassword', async () => {
    const connection = new ScriptedConnection(() => ok('<info/>'));

    const answer = await gitClient(connection).checkExternalRepo(
      {
        url: 'https://git.example.invalid/team/repo.git',
        remoteUser: 'old-user',
        remotePassword: 'old-password',
      },
      { headers: HEADERS },
    );

    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/externalrepoinfo',
        timeout: 0,
        headers: PAIR,
        data:
          `${XML}<abapgitexternalrepo:externalRepoInfoRequest xmlns:abapgitexternalrepo="http://www.sap.com/adt/abapgit/externalRepo">` +
          '<abapgitexternalrepo:url>https://git.example.invalid/team/repo.git</abapgitexternalrepo:url>' +
          '<abapgitexternalrepo:remoteUser>old-user</abapgitexternalrepo:remoteUser>' +
          '<abapgitexternalrepo:remotePassword>old-password</abapgitexternalrepo:remotePassword>' +
          '</abapgitexternalrepo:externalRepoInfoRequest>',
      },
    ]);
    expect(answer.ok && answer.getResult()).toEqual({ value: '<info/>' });
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
