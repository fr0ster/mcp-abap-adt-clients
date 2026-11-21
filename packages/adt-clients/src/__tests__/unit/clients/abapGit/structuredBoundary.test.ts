/**
 * The facts exchange is the boundary every new form crosses (spec §5.3): an
 * answer is reduced by `abapGitFacts[route]`, a failure — answered or thrown —
 * by `abapGitErrorFacts` into a fresh `IAbapGitStructuredError`, before the
 * caller's reader or analyser, or the client's own logger, sees anything. SAP's
 * text, the thrown message and the document stay behind.
 */

import {
  ABAPGIT_ERROR_MESSAGES,
  ADT_NO_FAILURE,
  type IAbapGitFactsResponse,
  type IAbapGitStructuredError,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import type {
  AbapGitFactsSlot,
  AbapGitValues,
} from '../../../../clients/abapGit/types';
import { abapGitDocuments } from '../../../../clients/abapGit/types';
import {
  CANARIES,
  CREDENTIALS,
  exception,
  externalRepo,
  gitClient,
  holdsCanary,
  modifiedObjects,
  objectResults,
  ok,
  recordingLogger,
  repos,
  type Script,
  ScriptedConnection,
  staging,
} from './abapGitHelpers';

const HEADERS = {
  accept: 'application/x-accept',
  contentType: 'application/x-content',
};
const COMMIT = {
  text: `commit ${CANARIES.token}`,
  author: { name: 'Ada', email: 'ada@example.invalid' },
  committer: { name: 'Carl', email: 'carl@example.invalid' },
};

type Analyser = (
  verdict: IAbapGitStructuredError | typeof ADT_NO_FAILURE,
  answer?: IAbapGitFactsResponse<unknown>,
) => IAbapGitStructuredError | typeof ADT_NO_FAILURE;
type Call = (
  git: AdtAbapGitClient<AbapGitValues>,
  analyse?: Analyser,
) => Promise<unknown>;

/** Every new form: its slot, a success document holding canaries, and the call. */
const NEW_FORMS: ReadonlyArray<readonly [AbapGitFactsSlot, string, Call]> = [
  [
    'reposFacts',
    repos,
    (g, analyse) => g.listReposQuiet(analyse ? { analyse } : {}),
  ],
  [
    'linkedFacts',
    objectResults,
    (g, analyse) =>
      g.link(
        {
          package: 'ZPKG',
          url: 'https://git.example.invalid/r',
          branchName: 'refs/heads/main',
        },
        {
          headers: HEADERS,
          credentials: CREDENTIALS,
          ...(analyse ? { analyse } : {}),
        },
      ),
  ],
  [
    'externalRepoFacts',
    externalRepo,
    (g, analyse) =>
      g.checkExternalRepo(
        { url: 'https://git.example.invalid/r' },
        {
          headers: HEADERS,
          credentials: CREDENTIALS,
          ...(analyse ? { analyse } : {}),
        },
      ),
  ],
  [
    'repoPulled',
    objectResults,
    (g, analyse) =>
      g.pullRepo(
        { key: '000001', branchName: 'refs/heads/main' },
        {
          headers: HEADERS,
          credentials: CREDENTIALS,
          ...(analyse ? { analyse } : {}),
        },
      ),
  ],
  [
    'repoPulledInDialog',
    '',
    (g, analyse) =>
      g.pullRepoInDialog(
        { key: '000001', branchName: 'refs/heads/main' },
        {
          headers: HEADERS,
          credentials: CREDENTIALS,
          ...(analyse ? { analyse } : {}),
        },
      ),
  ],
  [
    'runLog',
    objectResults,
    (g, analyse) =>
      g.getRunLog(
        { key: '000001', appLogKey: 'L1' },
        analyse ? { analyse } : {},
      ),
  ],
  [
    'modifiedObjects',
    modifiedObjects,
    (g, analyse) =>
      g.getModifiedObjects(
        { key: '000001' },
        { credentials: CREDENTIALS, ...(analyse ? { analyse } : {}) },
      ),
  ],
  [
    'status',
    'DEMO STATUS',
    (g, analyse) => g.getStatus({ key: '000001' }, analyse ? { analyse } : {}),
  ],
  [
    'staging',
    staging,
    (g, analyse) =>
      g.getStaging(
        { key: '000001' },
        { credentials: CREDENTIALS, ...(analyse ? { analyse } : {}) },
      ),
  ],
  [
    'pushed',
    '',
    (g, analyse) =>
      g.push(
        { key: '000001', staged: [], comment: COMMIT },
        { credentials: CREDENTIALS, ...(analyse ? { analyse } : {}) },
      ),
  ],
  [
    'checked',
    '',
    (g, analyse) =>
      g.checkRepo(
        { key: '000001' },
        { credentials: CREDENTIALS, ...(analyse ? { analyse } : {}) },
      ),
  ],
  [
    'file',
    'CLASS zcl_demo.',
    (g, analyse) =>
      g.getFile(
        { key: '000001', filename: 'zcl_demo.clas.abap', version: 'remote' },
        { credentials: CREDENTIALS, ...(analyse ? { analyse } : {}) },
      ),
  ],
  [
    'branchInfo',
    externalRepo,
    (g, analyse) =>
      g.getBranchInfo(
        {
          url: 'https://git.example.invalid/r',
          branch: 'refs/heads/main',
          package: 'ZPKG',
        },
        {
          headers: HEADERS,
          credentials: CREDENTIALS,
          ...(analyse ? { analyse } : {}),
        },
      ),
  ],
  [
    'switched',
    '',
    (g, analyse) =>
      g.switchBranch(
        { key: '000001', branch: 'dev', create: true },
        { credentials: CREDENTIALS, ...(analyse ? { analyse } : {}) },
      ),
  ],
];

const answeredFailure: Script = () => ok(exception({ httpStatus: '401' }), 500);
const thrownFailure: Script = (request: IAbapRequestOptions) => {
  throw Object.assign(
    new Error(
      `Request failed: ${CANARIES.user} ${CANARIES.token} ${CANARIES.password}`,
    ),
    { response: ok(exception(), 500), request },
  );
};

/** A recording reader for every facts slot, and a recording analyser. */
function recorded() {
  const read: unknown[] = [];
  const analysed: unknown[] = [];
  const reader = (answer: unknown) => {
    read.push(answer);
    return answer;
  };
  const results = {
    ...abapGitDocuments,
    reposFacts: reader,
    linkedFacts: reader,
    externalRepoFacts: reader,
    repoPulled: reader,
    repoPulledInDialog: reader,
    runLog: reader,
    modifiedObjects: reader,
    status: reader,
    staging: reader,
    pushed: reader,
    checked: reader,
    file: reader,
    branchInfo: reader,
    switched: reader,
  };
  const analyse: Analyser = (verdict, answer) => {
    analysed.push([verdict, answer]);
    return verdict;
  };
  return { read, analysed, results, analyse };
}

describe('the facts exchange, per new form', () => {
  it.each(NEW_FORMS.map(([slot, , call]) => [slot, call] as const))(
    '%s: an answered failure reaches the analyser as facts alone',
    async (_slot, call) => {
      const { read, analysed, results, analyse } = recorded();
      const git = new AdtAbapGitClient(
        new ScriptedConnection(answeredFailure),
        { results },
      );

      const answer = (await call(git, analyse)) as {
        ok: boolean;
        getError(): IAbapGitStructuredError;
      };

      expect(read).toEqual([]);
      expect(analysed).toHaveLength(1);
      expect(holdsCanary(analysed)).toEqual([]);
      expect(JSON.stringify(analysed)).not.toContain(CANARIES.password);
      expect(answer.ok).toBe(false);
      const error = answer.getError();
      expect(error.response).toBeUndefined();
      expect(error.facts).toEqual({
        status: 500,
        messageClass: 'ABAPGIT_MSG',
        messageNumber: '017',
        gitHttpStatus: 401,
      });
      expect(error.message).toBe(ABAPGIT_ERROR_MESSAGES.gitHostRefused);
      expect(error.request?.path).not.toContain('?');
    },
  );

  it.each(NEW_FORMS.map(([slot, , call]) => [slot, call] as const))(
    '%s: a thrown failure is reduced before the analyser, its message and response dropped',
    async (_slot, call) => {
      const { analysed, results, analyse } = recorded();
      const git = new AdtAbapGitClient(new ScriptedConnection(thrownFailure), {
        results,
      });

      const answer = (await call(git, analyse)) as {
        ok: boolean;
        getError(): IAbapGitStructuredError;
      };

      expect(holdsCanary(analysed)).toEqual([]);
      expect(JSON.stringify(analysed)).not.toContain(CANARIES.password);
      expect(answer.ok).toBe(false);
      const error = answer.getError();
      expect(Object.keys(error).sort()).toEqual([
        'facts',
        'message',
        'origin',
        'request',
      ]);
      expect(error.message).toBe(ABAPGIT_ERROR_MESSAGES.refusedWithMessage);
      expect(error.facts).toEqual({
        status: 500,
        messageClass: 'ABAPGIT_MSG',
        messageNumber: '017',
        gitHttpStatus: undefined,
      });
    },
  );

  it.each(
    NEW_FORMS.map(([slot, document, call]) => [slot, document, call] as const),
  )(
    '%s: a success reaches the reader as its facts, nothing of the document else',
    async (slot, document, call) => {
      const { read, analysed, results, analyse } = recorded();
      const git = new AdtAbapGitClient(
        new ScriptedConnection(() => ok(document)),
        { results },
      );

      const answer = (await call(git, analyse)) as { ok: boolean };

      expect(answer.ok).toBe(true);
      expect(read).toHaveLength(1);
      expect(analysed).toEqual([[ADT_NO_FAILURE, read[0]]]);
      // The file is the repository's own content and passes as data.
      if (slot !== 'file' && slot !== 'status')
        expect(holdsCanary(read)).toEqual([]);
      expect(Object.keys(read[0] as object).sort()).toEqual([
        'facts',
        'status',
      ]);
    },
  );

  it.each(NEW_FORMS.map(([slot, , call]) => [slot, call] as const))(
    '%s: sends timeout 0, noLog, noResend and stateless',
    async (_slot, call) => {
      const connection = new ScriptedConnection();

      await call(gitClient(connection));

      expect(connection.sent).toHaveLength(1);
      expect(connection.sent[0]).toMatchObject({
        timeout: 0,
        noLog: true,
        noResend: true,
        stateless: true,
      });
    },
  );

  it.each(
    NEW_FORMS.map(([slot, document, call]) => [slot, document, call] as const),
  )(
    '%s: the default log output holds no canary, on success and on a throw',
    async (_slot, document, call) => {
      const { logger, lines } = recordingLogger();

      await call(gitClient(new ScriptedConnection(() => ok(document)), logger));
      await call(gitClient(new ScriptedConnection(thrownFailure), logger));
      await call(gitClient(new ScriptedConnection(answeredFailure), logger));

      expect(holdsCanary(lines)).toEqual([]);
      expect(lines.join('\n')).not.toContain(CANARIES.password);
    },
  );

  it('R11: SAP reports the git host’s refusal (gitHttpStatus)', async () => {
    const connection = new ScriptedConnection(() =>
      ok(exception({ t100: false, httpStatus: '403' }), 500),
    );

    const answer = await gitClient(connection).checkRepo(
      { key: '000001' },
      { credentials: CREDENTIALS },
    );

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().facts).toEqual({
      status: 500,
      messageClass: undefined,
      messageNumber: undefined,
      gitHttpStatus: 403,
    });
    expect(answer.getError().message).toBe(
      ABAPGIT_ERROR_MESSAGES.gitHostRefused,
    );
  });

  it('a failure with no answer is noResponse, status 0', async () => {
    const connection = new ScriptedConnection(() => {
      throw new Error(`socket hang up ${CANARIES.token}`);
    });

    const answer = await gitClient(connection).getStaging({ key: '000001' });

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError()).toEqual({
      origin: 'connection',
      message: ABAPGIT_ERROR_MESSAGES.noResponse,
      facts: { status: 0 },
      request: {
        method: 'GET',
        path: '/sap/bc/adt/abapgit/repos/000001/stage',
      },
    });
  });

  it('a 2xx that is not the route’s document is unreadableAnswer', async () => {
    const connection = new ScriptedConnection(() =>
      ok(`<html>${CANARIES.token}</html>`),
    );

    const answer = await gitClient(connection).getStaging({ key: '000001' });

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().message).toBe(
      ABAPGIT_ERROR_MESSAGES.unreadableAnswer,
    );
    expect(holdsCanary(answer.getError())).toEqual([]);
  });

  it('the request an error describes is the method and the path, without the query', async () => {
    const connection = new ScriptedConnection(() => ok('', 500));

    const answer = await gitClient(connection).getFile({
      key: '000001',
      filename: CANARIES.user,
      version: 'remote',
    });

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().request).toEqual({
      method: 'GET',
      path: '/sap/bc/adt/abapgit/repos/000001/files',
    });
  });

  it('unlink keeps its 46.1.0 options: none of the three flags', async () => {
    const connection = new ScriptedConnection();

    await gitClient(connection).unlink({ repositoryId: '000001' });

    expect(connection.sent[0]).not.toHaveProperty('noLog');
    expect(connection.sent[0]).not.toHaveProperty('noResend');
    expect(connection.sent[0]).not.toHaveProperty('stateless');
  });
});
