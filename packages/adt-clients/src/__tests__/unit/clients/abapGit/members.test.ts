/**
 * The new abapGit members (spec §3.2): one request each — its method, its path
 * built from the key, its query, its media types, its body — with `timeout: 0`
 * and the three flags every new form sends (`noLog`, `noResend`, `stateless`),
 * answered by the facts reading unless the caller's result set names its own.
 */

import { abapGitFacts } from '@mcp-abap-adt/adt-strategies';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import { abapGitDocuments } from '../../../../clients/abapGit/types';
import {
  externalRepo,
  gitClient,
  modifiedObjects,
  objectResults,
  ok,
  repos,
  ScriptedConnection,
  staging,
} from './abapGitHelpers';

const HEADERS = {
  accept: 'application/x-accept',
  contentType: 'application/x-content',
};
const PAIR = {
  Accept: 'application/x-accept',
  'Content-Type': 'application/x-content',
};
const FLAGS = { timeout: 0, noLog: true, noResend: true, stateless: true };
const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const REPO_NS =
  'xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories"';
const EXT_NS =
  'xmlns:abapgitexternalrepo="http://www.sap.com/adt/abapgit/externalRepo"';

describe('the requests of the new members', () => {
  it('listReposQuiet: GET /repos, Accept repos.v2', async () => {
    const connection = new ScriptedConnection(() => ok(repos));
    await gitClient(connection).listReposQuiet();
    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos',
        headers: { Accept: 'application/abapgit.adt.repos.v2+xml' },
        ...FLAGS,
      },
    ]);
  });

  it('link (new form): POST /repos, the caller’s pair, folderLogic', async () => {
    const connection = new ScriptedConnection(() => ok(objectResults));
    await gitClient(connection).link(
      {
        package: 'ZPKG',
        url: 'https://git.example.invalid/r',
        branchName: 'refs/heads/main',
        transportRequest: 'DEVK900001',
        folderLogic: 'PREFIX',
      },
      { headers: HEADERS, credentials: null },
    );
    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos',
        headers: PAIR,
        data:
          `${XML}<abapgitrepo:repository ${REPO_NS}>` +
          '<abapgitrepo:package>ZPKG</abapgitrepo:package>' +
          '<abapgitrepo:url>https://git.example.invalid/r</abapgitrepo:url>' +
          '<abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
          '<abapgitrepo:transportRequest>DEVK900001</abapgitrepo:transportRequest>' +
          '<abapgitrepo:folderLogic>PREFIX</abapgitrepo:folderLogic>' +
          '</abapgitrepo:repository>',
        ...FLAGS,
      },
    ]);
  });

  it('pullRepo: POST /repos/{key}/pull, repo.v3 body', async () => {
    const connection = new ScriptedConnection();
    await gitClient(connection).pullRepo(
      {
        key: 'A/B',
        branchName: 'refs/heads/main',
        transportRequest: 'DEVK900001',
      },
      { headers: HEADERS },
    );
    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos/A%2FB/pull',
        headers: PAIR,
        data:
          `${XML}<abapgitrepo:repository ${REPO_NS}>` +
          '<abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
          '<abapgitrepo:transportRequest>DEVK900001</abapgitrepo:transportRequest>' +
          '</abapgitrepo:repository>',
        ...FLAGS,
      },
    ]);
  });

  it('pullRepoInDialog: POST /repos/{key}/pull/v2', async () => {
    const connection = new ScriptedConnection();
    await gitClient(connection).pullRepoInDialog(
      { key: '000001', branchName: 'refs/heads/main' },
      { headers: HEADERS },
    );
    expect(connection.sent[0]).toMatchObject({
      method: 'POST',
      url: '/sap/bc/adt/abapgit/repos/000001/pull/v2',
      headers: PAIR,
      ...FLAGS,
    });
  });

  it('getModifiedObjects: GET …/pull/modifiedobjects, its exact Accept', async () => {
    const connection = new ScriptedConnection(() => ok(modifiedObjects));
    await gitClient(connection).getModifiedObjects({ key: '000001' });
    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/000001/pull/modifiedobjects',
        headers: {
          Accept: 'application/abapgit.adt.repo.pull.modified.objs.v1+xml',
        },
        ...FLAGS,
      },
    ]);
  });

  it('getStatus: GET …/status with Content-Type repos.v2', async () => {
    const connection = new ScriptedConnection(() => ok('DEMO STATUS'));
    await gitClient(connection).getStatus({ key: '000001' });
    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/000001/status',
        headers: { 'Content-Type': 'application/abapgit.adt.repos.v2+xml' },
        ...FLAGS,
      },
    ]);
  });

  it('getRunLog: GET …/log/{appLogKey}', async () => {
    const connection = new ScriptedConnection(() => ok(objectResults));
    await gitClient(connection).getRunLog({ key: '000001', appLogKey: 'L 1' });
    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/000001/log/L%201',
        headers: { Accept: 'application/abapgit.adt.repo.object.v2+xml' },
        ...FLAGS,
      },
    ]);
  });

  it('getStaging: GET …/stage, Accept stage.v1', async () => {
    const connection = new ScriptedConnection(() => ok(staging));
    await gitClient(connection).getStaging({ key: '000001' });
    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/000001/stage',
        headers: { Accept: 'application/abapgit.adt.repo.stage.v1+xml' },
        ...FLAGS,
      },
    ]);
  });

  it('push: POST …/push, the abapgitstaging document', async () => {
    const connection = new ScriptedConnection();
    await gitClient(connection).push({
      key: '000001',
      staged: [
        {
          wbkey: 'CLASZCL_DEMO',
          version: 'active',
          uri: '/sap/bc/adt/oo/classes/zcl_demo',
          type: 'CLAS/OC',
          name: 'ZCL_DEMO',
          packageName: 'ZPKG',
          files: [
            {
              name: 'zcl_demo.clas.abap',
              path: '/src/',
              localState: 'M',
              remoteState: '',
            },
          ],
        },
      ],
      comment: {
        text: 'Fix "quotes" & <tags>',
        author: { name: 'Ada', email: 'ada@example.invalid' },
        committer: { name: 'Carl', email: 'carl@example.invalid' },
      },
    });
    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos/000001/push',
        headers: {
          'Content-Type': 'application/abapgit.adt.repo.stage.v1+xml',
        },
        data:
          `${XML}<abapgitstaging:abapgitstaging xmlns:abapgitstaging="http://www.sap.com/adt/abapgit/staging" xmlns:adtcore="http://www.sap.com/adt/core">` +
          // `ABAPGIT_ST_REPO_STAGE` cloud L14, L25, L36 (and onprem's twin):
          // the three lists are required, in this order.
          '<abapgitstaging:unstaged_objects></abapgitstaging:unstaged_objects>' +
          '<abapgitstaging:staged_objects>' +
          '<abapgitstaging:abapgitobject abapgitstaging:wbkey="CLASZCL_DEMO" abapgitstaging:version="active" adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS/OC" adtcore:name="ZCL_DEMO" adtcore:packageName="ZPKG">' +
          '<abapgitstaging:abapgitfile abapgitstaging:name="zcl_demo.clas.abap" abapgitstaging:path="/src/" abapgitstaging:localState="M" abapgitstaging:remoteState=""/>' +
          '</abapgitstaging:abapgitobject>' +
          '</abapgitstaging:staged_objects>' +
          '<abapgitstaging:ignored_objects></abapgitstaging:ignored_objects>' +
          '<abapgitstaging:abapgit_comment abapgitstaging:comment="Fix &quot;quotes&quot; &amp; &lt;tags&gt;">' +
          '<abapgitstaging:author abapgitstaging:name="Ada" abapgitstaging:email="ada@example.invalid"/>' +
          '<abapgitstaging:committer abapgitstaging:name="Carl" abapgitstaging:email="carl@example.invalid"/>' +
          '</abapgitstaging:abapgit_comment>' +
          '</abapgitstaging:abapgitstaging>',
        ...FLAGS,
      },
    ]);
  });

  it('checkRepo: POST …/checks, no body', async () => {
    const connection = new ScriptedConnection();
    await gitClient(connection).checkRepo({ key: '000001' });
    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos/000001/checks',
        headers: {},
        ...FLAGS,
      },
    ]);
  });

  it('getFile: GET …/files with filename and version, Accept text/plain', async () => {
    const connection = new ScriptedConnection(() => ok('CLASS zcl_demo.'));
    await gitClient(connection).getFile({
      key: '000001',
      filename: 'zcl_demo.clas.abap',
      version: 'local',
    });
    expect(connection.sent).toEqual([
      {
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos/000001/files',
        params: { filename: 'zcl_demo.clas.abap', version: 'local' },
        headers: { Accept: 'text/plain' },
        ...FLAGS,
      },
    ]);
  });

  it('checkExternalRepo (new form): POST /externalrepoinfo, url alone', async () => {
    const connection = new ScriptedConnection(() => ok(externalRepo));
    await gitClient(connection).checkExternalRepo(
      { url: 'https://git.example.invalid/r' },
      { headers: HEADERS, credentials: null },
    );
    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/externalrepoinfo',
        headers: PAIR,
        data:
          `${XML}<abapgitexternalrepo:externalRepoInfoRequest ${EXT_NS}>` +
          '<abapgitexternalrepo:url>https://git.example.invalid/r</abapgitexternalrepo:url>' +
          '</abapgitexternalrepo:externalRepoInfoRequest>',
        ...FLAGS,
      },
    ]);
  });

  it('getBranchInfo: POST /externalrepoinfo/branchinfo, branch and package', async () => {
    const connection = new ScriptedConnection(() => ok(externalRepo));
    await gitClient(connection).getBranchInfo(
      {
        url: 'https://git.example.invalid/r',
        branch: 'refs/heads/main',
        package: 'ZPKG',
      },
      { headers: HEADERS },
    );
    expect(connection.sent).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/abapgit/externalrepoinfo/branchinfo',
        headers: PAIR,
        data:
          `${XML}<abapgitexternalrepo:externalRepoInfoRequest ${EXT_NS}>` +
          '<abapgitexternalrepo:url>https://git.example.invalid/r</abapgitexternalrepo:url>' +
          '<abapgitexternalrepo:branch>refs/heads/main</abapgitexternalrepo:branch>' +
          '<abapgitexternalrepo:package>ZPKG</abapgitexternalrepo:package>' +
          '</abapgitexternalrepo:externalRepoInfoRequest>',
        ...FLAGS,
      },
    ]);
  });

  it.each([
    [true, { create: 'true' }],
    [false, undefined],
  ])(
    'switchBranch create=%s: POST …/branches/{branch}, ?create=true only when true',
    async (create, params) => {
      const connection = new ScriptedConnection();
      await gitClient(connection).switchBranch({
        key: '000001',
        branch: 'refs/heads/dev',
        create,
      });
      expect(connection.sent).toEqual([
        {
          method: 'POST',
          url: '/sap/bc/adt/abapgit/repos/000001/branches/refs%2Fheads%2Fdev',
          headers: {},
          ...(params === undefined ? {} : { params }),
          ...FLAGS,
        },
      ]);
    },
  );
});

describe('the selection R6 answers, fed back to a pull', () => {
  it.each(['pullRepo', 'pullRepoInDialog'] as const)(
    '%s writes the pull.req.v1 document with exactly its entries',
    async (member) => {
      const read = new ScriptedConnection(() => ok(modifiedObjects));
      const modified = await gitClient(read).getModifiedObjects({
        key: '000001',
      });
      if (!modified.ok) throw new Error('expected the reading');
      const selection = modified.getResult().value.facts;
      const connection = new ScriptedConnection();

      await gitClient(connection)[member](
        { key: '000001', branchName: 'refs/heads/main', selection },
        { headers: HEADERS },
      );

      const data = String(connection.sent[0]?.data);
      // `ABAPGIT_ST_REPO_SELECTIVE_PULL` L5, L42, L55 and
      // `ABAPGIT_ST_PULL_MODIFIED_OBJS` L46, L52 (Code, cloud): the lists,
      // their entries and `action` are in R6's namespace, not the request's.
      expect(
        data.startsWith(
          `${XML}<abapgitpullrequest:abapgitpullrequest xmlns:abapgitpullrequest="http://www.sap.com/adt/abapgit/abapgitpullrequest" xmlns:agitpullmodifiedobjects="http://www.sap.com/adt/abapgit/agitpullmodifiedobjects" xmlns:adtcore="http://www.sap.com/adt/core">`,
        ),
      ).toBe(true);
      expect(data).not.toContain('abapgitpullrequest:overwriteObjects');
      expect(data).not.toContain('abapgitpullrequest:abapgitobjects');
      const overwrite = data
        .split('<agitpullmodifiedobjects:overwriteObjects>')[1]
        ?.split('</agitpullmodifiedobjects:overwriteObjects>')[0];
      const warning = data
        .split('<agitpullmodifiedobjects:packageWarningObjects>')[1]
        ?.split('</agitpullmodifiedobjects:packageWarningObjects>')[0];
      expect(overwrite).toBe(
        '<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS/OC" adtcore:name="ZCL_DEMO" adtcore:packageName="ZPKG" agitpullmodifiedobjects:action="2"/>',
      );
      expect(warning).toBe(
        '<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/programs/programs/zdemo" adtcore:type="PROG/P" adtcore:name="ZDEMO" adtcore:packageName="ZOTHER" agitpullmodifiedobjects:action="3"/>',
      );
      expect(data).toContain(
        '<abapgitpullrequest:branchName>refs/heads/main</abapgitpullrequest:branchName>',
      );
    },
  );
});

describe('the answers of the new members', () => {
  it.each([
    ['pullRepo (cloud: the job accepted)', 'pullRepo'],
    ['pullRepoInDialog (finished in the request)', 'pullRepoInDialog'],
  ] as const)(
    '%s: a 202 is a success with its status, after one request',
    async (_name, member) => {
      const connection = new ScriptedConnection(() => ok('', 202));
      const answer = await gitClient(connection)[member](
        { key: '000001', branchName: 'refs/heads/main' },
        { headers: HEADERS },
      );
      expect(connection.sent).toHaveLength(1);
      expect(answer.ok && answer.getResult().value.status).toBe(202);
    },
  );

  it('push (cloud): a 202 is a success with its status, after one request', async () => {
    const connection = new ScriptedConnection(() => ok('', 202));
    const answer = await gitClient(connection).push({
      key: '000001',
      staged: [],
      comment: {
        text: 't',
        author: { name: 'a', email: 'a@x.invalid' },
        committer: { name: 'c', email: 'c@x.invalid' },
      },
    });
    expect(connection.sent).toHaveLength(1);
    expect(answer.ok && answer.getResult().value).toEqual({
      status: 202,
      facts: {},
    });
  });

  it('onprem pullRepo: a 200 is finished, its objects read', async () => {
    const connection = new ScriptedConnection(() => ok(objectResults));
    const answer = await gitClient(connection).pullRepo(
      { key: '000001', branchName: 'refs/heads/main' },
      { headers: HEADERS },
    );
    expect(answer.ok && answer.getResult().value).toEqual(
      abapGitFacts.repoPulled(ok(objectResults)),
    );
  });

  it.each([404, 500])(
    'a %s without an analyser is the error',
    async (status) => {
      // A readable staging document: the status alone makes it a failure.
      const connection = new ScriptedConnection(() => ok(staging, status));
      const answer = await gitClient(connection).getStaging({ key: '000001' });
      expect(answer.ok).toBe(false);
      if (answer.ok) throw new Error('expected a failure');
      expect(answer.getError().facts.status).toBe(status);
    },
  );

  it('a 2xx without an analyser is a success', async () => {
    const connection = new ScriptedConnection(() => ok(staging, 200));
    const answer = await gitClient(connection).getStaging({ key: '000001' });
    expect(answer.ok).toBe(true);
  });

  it('getFile: the content with the filename and version asked for', async () => {
    const connection = new ScriptedConnection(() => ok('CLASS zcl_demo.'));
    const answer = await gitClient(connection).getFile({
      key: '000001',
      filename: 'zcl_demo.clas.abap',
      version: 'remote',
    });
    expect(answer.ok && answer.getResult().value).toEqual({
      status: 200,
      facts: {
        filename: 'zcl_demo.clas.abap',
        version: 'remote',
        content: 'CLASS zcl_demo.',
      },
    });
  });

  it('a custom reposFacts reader: its result, while the analyser gets the facts', async () => {
    const connection = new ScriptedConnection(() => ok(repos));
    const git = AdtAbapGitClient.create(connection, {
      results: {
        ...abapGitDocuments,
        reposFacts: (answer) => answer.facts.repos.length,
      },
    });
    const seen: unknown[] = [];

    const answer = await git.listReposQuiet({
      analyse: (verdict, facts) => {
        seen.push(facts);
        return verdict;
      },
    });

    expect(answer.ok && answer.getResult().value).toBe(1);
    expect(seen).toEqual([abapGitFacts.reposFacts(ok(repos))]);
    const count: number = answer.ok ? answer.getResult().value : 0;
    void count;
  });

  it('an analyser clears a failure only when the answer could be read', async () => {
    const connection = new ScriptedConnection(() => ok('', 500));
    const answer = await gitClient(connection).checkRepo(
      { key: '000001' },
      { analyse: () => ADT_NO_FAILURE },
    );
    expect(answer.ok).toBe(false);
  });
});

describe('review of #326: the run log key, the pull media types', () => {
  it('an appLogKey read from the log link is encoded once: A%2FB', async () => {
    const encoded = repos.replace(
      '/sap/bc/adt/abapgit/repos/000001/log/L1',
      '/sap/bc/adt/abapgit/repos/000001/log/A%2FB',
    );
    const listing = new ScriptedConnection(() => ok(encoded));
    const listed = await gitClient(listing).listReposQuiet();
    if (!listed.ok) throw new Error('expected the list');
    const entry = listed.getResult().value.facts.repos[0];
    if (entry?.appLogKey === undefined) throw new Error('no appLogKey');
    const connection = new ScriptedConnection(() => ok(objectResults));

    await gitClient(connection).getRunLog({
      key: entry.key,
      appLogKey: entry.appLogKey,
    });

    expect(connection.sent[0]?.url).toBe(
      '/sap/bc/adt/abapgit/repos/000001/log/A%2FB',
    );
  });

  it.each([
    ['repo.v3', 'application/abapgit.adt.repo.v3+xml'],
    ['pull.req.v1', 'application/abapgit.adt.repo.pull.req.v1+xml'],
  ])(
    'both pulls send the %s Content-Type exactly, with no charset suffix',
    async (_name, contentType) => {
      // SAP picks the pull document by the exact Content-Type string; a
      // `; charset=…` suffix answers 400 (cloud `RES_REPO_PULL` L167–182).
      const connection = new ScriptedConnection();
      const git = gitClient(connection);
      const headers = {
        accept: 'application/abapgit.adt.repo.object.v2+xml',
        contentType,
      };

      await git.pullRepo({ key: 'K', branchName: 'main' }, { headers });
      await git.pullRepoInDialog({ key: 'K', branchName: 'main' }, { headers });

      for (const request of connection.sent)
        expect(
          (request.headers as Record<string, string>)['Content-Type'],
        ).toBe(contentType);
    },
  );
});

describe('push: wbkey and version only when they are not empty', () => {
  it('omits an empty wbkey and an empty version, as SAP’s own answer does', async () => {
    // `ABAPGIT_ST_REPO_STAGE_OBJECT` cloud L23–30: both `not-initial`.
    const connection = new ScriptedConnection();
    await gitClient(connection).push({
      key: 'K',
      staged: [
        {
          wbkey: '',
          version: '',
          uri: '/sap/bc/adt/oo/classes/zcl_demo',
          type: 'CLAS/OC',
          name: 'ZCL_DEMO',
          packageName: 'ZPKG',
          files: [],
        },
      ],
      comment: {
        text: 't',
        author: { name: 'a', email: 'a@x.invalid' },
        committer: { name: 'c', email: 'c@x.invalid' },
      },
    });
    const data = String(connection.sent[0]?.data);
    expect(data).toContain(
      '<abapgitstaging:abapgitobject adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo"',
    );
    expect(data).not.toContain('wbkey');
    expect(data).not.toContain('abapgitstaging:version');
  });
});
