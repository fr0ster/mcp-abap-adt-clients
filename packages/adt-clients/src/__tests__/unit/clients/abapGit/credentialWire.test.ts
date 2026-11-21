/**
 * A credential is written exactly where its route reads it, and nowhere else
 * (spec §3.1): R2 and the `repo.v3` pulls in `abapgitrepo:remoteUser` /
 * `remotePassword`; the selective pull in `abapgitpullrequest:user` /
 * `password`; R13 and R14 in `abapgitexternalrepo:user` / `password` (the new
 * form only — the deprecated `checkExternalRepo` keeps 46.1.0's ignored
 * `remoteUser`, `legacyForms46.test.ts`); the key-addressed routes in the
 * headers `Username` and `Password` (base64). R7, R8 and R1 carry none.
 */

import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import {
  CANARIES,
  CREDENTIALS,
  exception,
  gitClient,
  holdsCanary,
  ok,
  ScriptedConnection,
} from './abapGitHelpers';

const HEADERS = {
  accept: 'application/abapgit.adt.repo.object.v2+xml',
  contentType: 'application/abapgit.adt.repo.v3+xml',
};
const SELECTION = {
  overwriteObjects: [
    {
      uri: '/sap/bc/adt/oo/classes/zcl_demo',
      type: 'CLAS/OC',
      name: 'ZCL_DEMO',
      packageName: 'ZPKG',
      action: 2,
    },
  ],
  packageWarningObjects: [],
};
const BASE64_PASSWORD = CANARIES.base64Password;

type Credentials = typeof CREDENTIALS | null;
type Where = 'body' | 'headers' | 'none';

interface Form {
  readonly name: string;
  readonly where: Where;
  /** The elements a body form writes the user and the password in. */
  readonly tags?: readonly [string, string];
  readonly call: (git: AdtAbapGitClient, credentials: Credentials) => unknown;
}

const FORMS: readonly Form[] = [
  {
    name: 'link (new form)',
    where: 'body',
    tags: ['abapgitrepo:remoteUser', 'abapgitrepo:remotePassword'],
    call: (git, credentials) =>
      git.link(
        {
          package: 'ZPKG',
          url: 'https://git.example.invalid/r',
          branchName: 'refs/heads/main',
        },
        { headers: HEADERS, credentials },
      ),
  },
  {
    name: 'pullRepo',
    where: 'body',
    tags: ['abapgitrepo:remoteUser', 'abapgitrepo:remotePassword'],
    call: (git, credentials) =>
      git.pullRepo(
        { key: '000001', branchName: 'refs/heads/main' },
        { headers: HEADERS, ...(credentials ? { credentials } : {}) },
      ),
  },
  {
    name: 'pullRepo with a selection',
    where: 'body',
    tags: ['abapgitpullrequest:user', 'abapgitpullrequest:password'],
    call: (git, credentials) =>
      git.pullRepo(
        { key: '000001', branchName: 'refs/heads/main', selection: SELECTION },
        { headers: HEADERS, ...(credentials ? { credentials } : {}) },
      ),
  },
  {
    name: 'pullRepoInDialog',
    where: 'body',
    tags: ['abapgitrepo:remoteUser', 'abapgitrepo:remotePassword'],
    call: (git, credentials) =>
      git.pullRepoInDialog(
        { key: '000001', branchName: 'refs/heads/main' },
        { headers: HEADERS, ...(credentials ? { credentials } : {}) },
      ),
  },
  {
    name: 'checkExternalRepo (new form)',
    where: 'body',
    tags: ['abapgitexternalrepo:user', 'abapgitexternalrepo:password'],
    call: (git, credentials) =>
      git.checkExternalRepo(
        { url: 'https://git.example.invalid/r' },
        { headers: HEADERS, credentials },
      ),
  },
  {
    name: 'getBranchInfo',
    where: 'body',
    tags: ['abapgitexternalrepo:user', 'abapgitexternalrepo:password'],
    call: (git, credentials) =>
      git.getBranchInfo(
        {
          url: 'https://git.example.invalid/r',
          branch: 'refs/heads/main',
          package: 'ZPKG',
        },
        { headers: HEADERS, ...(credentials ? { credentials } : {}) },
      ),
  },
  {
    name: 'getModifiedObjects',
    where: 'headers',
    call: (git, credentials) =>
      git.getModifiedObjects(
        { key: '000001' },
        credentials ? { credentials } : {},
      ),
  },
  {
    name: 'getStaging',
    where: 'headers',
    call: (git, credentials) =>
      git.getStaging({ key: '000001' }, credentials ? { credentials } : {}),
  },
  {
    name: 'push',
    where: 'headers',
    call: (git, credentials) =>
      git.push(
        {
          key: '000001',
          staged: [],
          comment: {
            text: 'a commit',
            author: { name: 'Ada', email: 'ada@example.invalid' },
            committer: { name: 'Carl', email: 'carl@example.invalid' },
          },
        },
        credentials ? { credentials } : {},
      ),
  },
  {
    name: 'checkRepo',
    where: 'headers',
    call: (git, credentials) =>
      git.checkRepo({ key: '000001' }, credentials ? { credentials } : {}),
  },
  {
    name: 'getFile',
    where: 'headers',
    call: (git, credentials) =>
      git.getFile(
        { key: '000001', filename: 'zcl_demo.clas.abap', version: 'remote' },
        credentials ? { credentials } : {},
      ),
  },
  {
    name: 'switchBranch',
    where: 'headers',
    call: (git, credentials) =>
      git.switchBranch(
        { key: '000001', branch: 'refs/heads/dev', create: false },
        credentials ? { credentials } : {},
      ),
  },
  {
    name: 'getStatus (R7 reads none)',
    where: 'none',
    call: (git, credentials) =>
      git.getStatus({ key: '000001' }, credentials ? { credentials } : {}),
  },
  {
    name: 'getRunLog (R8 reads none)',
    where: 'none',
    call: (git, credentials) =>
      git.getRunLog(
        { key: '000001', appLogKey: 'L1' },
        credentials ? { credentials } : {},
      ),
  },
  {
    name: 'listReposQuiet (sends none)',
    where: 'none',
    call: (git) => git.listReposQuiet(),
  },
];

/** The request's parts other than where the credential belongs. */
function elsewhere(request: IAbapRequestOptions, form: Form): unknown {
  const { Username, Password, ...headers } = (request.headers ?? {}) as Record<
    string,
    string
  >;
  void Username;
  void Password;
  let data = typeof request.data === 'string' ? request.data : '';
  if (form.tags) {
    data = data
      .replace(`<${form.tags[0]}>${CANARIES.user}</${form.tags[0]}>`, '')
      .replace(`<${form.tags[1]}>${CANARIES.password}</${form.tags[1]}>`, '');
  }
  return {
    url: request.url,
    params: request.params,
    headers: form.where === 'headers' ? headers : request.headers,
    data,
  };
}

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe('a credential on the wire, per new form', () => {
  it.each(FORMS.map((form) => [form.name, form] as const))(
    '%s: the credential where the route reads it, and nowhere else',
    async (_name, form) => {
      const connection = new ScriptedConnection();

      await form.call(gitClient(connection), CREDENTIALS);

      expect(connection.sent).toHaveLength(1);
      const request = connection.sent[0];
      if (request === undefined) throw new Error('no request');
      const data = typeof request.data === 'string' ? request.data : '';
      const headers = (request.headers ?? {}) as Record<string, string>;
      if (form.where === 'body' && form.tags) {
        expect(
          count(data, `<${form.tags[0]}>${CANARIES.user}</${form.tags[0]}>`),
        ).toBe(1);
        expect(
          count(
            data,
            `<${form.tags[1]}>${CANARIES.password}</${form.tags[1]}>`,
          ),
        ).toBe(1);
        expect(headers.Username).toBeUndefined();
        expect(headers.Password).toBeUndefined();
      }
      if (form.where === 'headers') {
        expect(headers.Username).toBe(CANARIES.user);
        expect(headers.Password).toBe(BASE64_PASSWORD);
      }
      if (form.where === 'none') {
        expect(headers.Username).toBeUndefined();
        expect(headers.Password).toBeUndefined();
      }
      // Nowhere else: not the URL, the query, another header or element.
      expect(holdsCanary(elsewhere(request, form))).toEqual([]);
      expect(JSON.stringify(elsewhere(request, form))).not.toContain(
        CANARIES.password,
      );
    },
  );

  it.each(FORMS.map((form) => [form.name, form] as const))(
    '%s: an anonymous call writes no credential field at all',
    async (_name, form) => {
      const connection = new ScriptedConnection();

      await form.call(gitClient(connection), null);

      const request = connection.sent[0];
      if (request === undefined) throw new Error('no request');
      const data = typeof request.data === 'string' ? request.data : '';
      const headers = (request.headers ?? {}) as Record<string, string>;
      expect(headers.Username).toBeUndefined();
      expect(headers.Password).toBeUndefined();
      for (const tag of form.tags ?? []) expect(data).not.toContain(`<${tag}>`);
      expect(data).not.toContain('remoteUser');
      expect(data).not.toContain('remotePassword');
    },
  );

  it.each(
    FORMS.filter((form) => form.where !== 'none').map(
      (form) => [form.name, form] as const,
    ),
  )('%s: no credential in the result or the error', async (_name, form) => {
    const echoing = new ScriptedConnection(() => ok(exception(), 500));
    const thrown = new ScriptedConnection((request) => {
      throw Object.assign(
        new Error(`Request failed for ${CANARIES.user}:${CANARIES.password}`),
        { response: ok(exception(), 500), request },
      );
    });

    const answered = await form.call(gitClient(echoing), CREDENTIALS);
    const raised = await form.call(gitClient(thrown), CREDENTIALS);

    expect(holdsCanary(answered)).toEqual([]);
    expect(holdsCanary(raised)).toEqual([]);
    expect(JSON.stringify(answered)).not.toContain(CANARIES.password);
    expect(JSON.stringify(raised)).not.toContain(CANARIES.password);
    for (const answer of [answered, raised] as Array<{
      ok: boolean;
      getError?: () => unknown;
    }>) {
      expect(answer.ok).toBe(false);
      const error = answer.getError?.();
      expect(holdsCanary(error)).toEqual([]);
      expect(JSON.stringify(error)).not.toContain(CANARIES.password);
    }
  });

  it.each([
    'https://gitlab.example.invalid/group/sub/project',
    'https://bitbucket.example.invalid/scm/team/repo.git',
    'https://git.self-hosted.invalid:8443/a/b',
    'https://dev.azure.example.invalid/org/project/_git/repo',
  ])(
    'sends the remote URL %s as given: no host parsed, no .git added',
    async (url) => {
      const connection = new ScriptedConnection();
      const git = gitClient(connection);

      await git.link(
        { package: 'ZPKG', url, branchName: 'refs/heads/main' },
        { headers: HEADERS, credentials: CREDENTIALS },
      );
      await git.checkExternalRepo(
        { url },
        { headers: HEADERS, credentials: null },
      );
      await git.getBranchInfo(
        { url, branch: 'refs/heads/main', package: 'ZPKG' },
        { headers: HEADERS },
      );

      expect(connection.sent[0]?.data).toContain(
        `<abapgitrepo:url>${url}</abapgitrepo:url>`,
      );
      expect(connection.sent[1]?.data).toContain(
        `<abapgitexternalrepo:url>${url}</abapgitexternalrepo:url>`,
      );
      expect(connection.sent[2]?.data).toContain(
        `<abapgitexternalrepo:url>${url}</abapgitexternalrepo:url>`,
      );
    },
  );
});
