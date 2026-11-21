import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  abapGitBranchInfo,
  abapGitErrorLog,
  abapGitExternalRepo,
  abapGitModifiedObjects,
  abapGitObjectResults,
  abapGitRepoRunStates,
  abapGitRepos,
  abapGitStaging,
} from '../results/abapGit';
import {
  cloudRepos,
  answer as doc,
  externalRepo,
  modifiedObjects,
  objectResults,
  onpremRepos,
  staging,
} from './abapGitDocuments';
// Compiled with this file: a consumer of `IAbapGitRepo.status: string`.
import { statusOfFirst } from './typechecks/abapGitRepoContract';

/**
 * The abapGit readings, moved from adt-clients' parser.
 *
 * No answer for these endpoints is recorded in `corpus/adt/answers` yet, so the
 * documents below are built from the element names and link types the client's
 * parser was written against (its live probe). They hold the shape; a capture
 * would hold the claim.
 */
const answer = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

describe('abapGit readings', () => {
  it('reads a repository with its key and both links', () => {
    const repos = abapGitRepos(
      answer(
        '<abapgitrepo:repositories xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories" xmlns:atom="http://www.w3.org/2005/Atom">' +
          '<abapgitrepo:repository><abapgitrepo:key>000001</abapgitrepo:key><abapgitrepo:package>ZPKG</abapgitrepo:package>' +
          '<abapgitrepo:url>https://example.invalid/r.git</abapgitrepo:url><abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
          '<abapgitrepo:status>A</abapgitrepo:status><abapgitrepo:statusText>Active</abapgitrepo:statusText>' +
          '<atom:link href="/sap/bc/adt/abapgit/repos/000001/pull" type="pull_link"/>' +
          '<atom:link href="/sap/bc/adt/abapgit/repos/000001/log/1" type="log_link"/>' +
          '</abapgitrepo:repository></abapgitrepo:repositories>',
      ),
    );
    expect(repos).toEqual([
      {
        package: 'ZPKG',
        url: 'https://example.invalid/r.git',
        branchName: 'refs/heads/main',
        status: 'A',
        statusText: 'Active',
        createdBy: undefined,
        createdAt: undefined,
        repositoryId: '000001',
        pullLink: '/sap/bc/adt/abapgit/repos/000001/pull',
        logLink: '/sap/bc/adt/abapgit/repos/000001/log/1',
        // Since 0.27.0: every link, with its `rel` (none written here).
        links: [
          {
            href: '/sap/bc/adt/abapgit/repos/000001/pull',
            rel: '',
            type: 'pull_link',
          },
          {
            href: '/sap/bc/adt/abapgit/repos/000001/log/1',
            rel: '',
            type: 'log_link',
          },
        ],
      },
    ]);
  });

  it('an empty list is an empty list', () => {
    expect(abapGitRepos(answer('<repositories/>'))).toEqual([]);
  });

  it('a document that is none of these reads as the empty shape', () => {
    // The parsed document is held as `unknown` and read field by field, so a
    // root the reading does not know — an exception, a logon page, plain text —
    // yields nothing rather than a throw.
    for (const data of [
      '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><message>no</message></exc:exception>',
      'not xml at all',
      '',
    ]) {
      expect(abapGitRepos(answer(data))).toEqual([]);
      expect(abapGitErrorLog(answer(data))).toEqual([]);
      expect(abapGitExternalRepo(answer(data))).toEqual({
        branches: [],
        accessMode: undefined,
      });
    }
  });

  it('a text-only repository element reads as an entry of empty fields', () => {
    // As before the move to `unknown`: a non-element entry has no fields, so
    // every field reads as empty instead of being dropped.
    expect(
      abapGitRepos(
        answer('<repositories><repository>x</repository></repositories>'),
      ),
    ).toEqual([
      {
        package: '',
        url: '',
        branchName: '',
        status: '',
        statusText: '',
        createdBy: undefined,
        createdAt: undefined,
        repositoryId: undefined,
      },
    ]);
  });

  it('reads an error log entry per object', () => {
    expect(
      abapGitErrorLog(
        answer(
          '<abapObjects><abapObject><msgType>E</msgType><type>CLAS</type><name>ZCL_X</name><msgText>Syntax error</msgText></abapObject></abapObjects>',
        ),
      ),
    ).toEqual([
      {
        msgType: 'E',
        objectType: 'CLAS',
        objectName: 'ZCL_X',
        messageText: 'Syntax error',
      },
    ]);
  });

  it('reads branches, with X as the head marker', () => {
    expect(
      abapGitExternalRepo(
        answer(
          '<externalRepoInfo><accessMode>PUBLIC</accessMode><branch><name>refs/heads/main</name><sha1>abc</sha1><isHead>X</isHead></branch><branch><name>refs/heads/dev</name><sha1>def</sha1><isHead/></branch></externalRepoInfo>',
        ),
      ),
    ).toEqual({
      accessMode: 'PUBLIC',
      branches: [
        { name: 'refs/heads/main', sha1: 'abc', isHead: true, type: undefined },
        { name: 'refs/heads/dev', sha1: 'def', isHead: false, type: undefined },
      ],
    });
  });
});

const REL = 'http://www.sap.com/adt/abapgit/relations';

describe('abapGitRepos, every field R1 sends', () => {
  it('reads the cloud entry: folder logic, the e-mail fields, every link with its rel', () => {
    const [repo] = abapGitRepos(doc(cloudRepos('E', 'LOG0001')));
    expect(repo).toEqual({
      package: 'ZPKG_CLOUD',
      url: 'https://git.example.invalid/team/repo.git',
      branchName: 'refs/heads/main',
      status: 'E',
      statusText: 'Pull finished with errors',
      createdBy: 'DEVELOPER',
      createdAt: '20261121101500',
      repositoryId: '000001',
      pullLink: '/sap/bc/adt/abapgit/repos/000001/pull',
      logLink: '/sap/bc/adt/abapgit/repos/000001/log/LOG0001',
      folderLogic: 'PREFIX',
      createdEmail: 'developer@example.invalid',
      deserializedBy: 'PULLER',
      deserializedEmail: 'puller@example.invalid',
      deserializedAt: '20261121111500',
      links: [
        {
          href: '/sap/bc/adt/abapgit/repos/000001/pull/v2',
          rel: `${REL}/pull/v2`,
          type: 'pull_link_v2',
        },
        {
          href: '/sap/bc/adt/abapgit/repos/000001/pull',
          rel: `${REL}/pull`,
          type: 'pull_link',
        },
        {
          href: '/sap/bc/adt/abapgit/repos/000001/stage',
          rel: `${REL}/stage`,
          type: 'stage_link',
        },
        {
          href: '/sap/bc/adt/abapgit/repos/000001/status/LOG0001',
          rel: `${REL}/status`,
          type: 'status_link',
        },
        {
          href: '/sap/bc/adt/abapgit/repos/000001/log/LOG0001',
          rel: `${REL}/log`,
          type: 'log_link',
        },
      ],
    });
  });

  it('onprem R1 has no status: `status` and `statusText` stay `""` (the contract)', () => {
    const [repo] = abapGitRepos(doc(onpremRepos));
    expect(repo?.status).toBe('');
    expect(repo?.statusText).toBe('');
    expect(repo?.folderLogic).toBeUndefined();
    // Onprem writes its pull link without a `type`; the rel still names it.
    expect(repo?.links).toEqual([
      { href: '/sap/bc/adt/abapgit/repos/000042/pull', rel: `${REL}/pull` },
      {
        href: '/sap/bc/adt/abapgit/repos/000042/stage',
        rel: `${REL}/stage`,
        type: 'stage_link',
      },
    ]);
    expect(statusOfFirst(abapGitRepos(doc(onpremRepos)))).toBe('');
  });
});

describe('abapGitRepoRunStates', () => {
  it('reads the run state and the log key from `log_link`', () => {
    expect(abapGitRepoRunStates(doc(cloudRepos('E', 'LOG0001')))).toEqual([
      {
        key: '000001',
        runStatus: 'E',
        statusText: 'Pull finished with errors',
        appLogKey: 'LOG0001',
      },
    ]);
  });

  it('an absent status is `undefined`, not `""` (onprem R1)', () => {
    expect(abapGitRepoRunStates(doc(onpremRepos))).toEqual([
      {
        key: '000042',
        runStatus: undefined,
        statusText: undefined,
        appLogKey: undefined,
      },
    ]);
  });

  it('a blank status is present and blank: the initial state, not absence', () => {
    const [state] = abapGitRepoRunStates(doc(cloudRepos('', null)));
    expect(state?.runStatus).toBe('');
    expect(state?.appLogKey).toBeUndefined();
  });

  it('a `status_link` alone yields no `appLogKey`', () => {
    const [state] = abapGitRepoRunStates(
      doc(cloudRepos('R', 'LOG0002', { statusLink: true, logLink: false })),
    );
    expect(state?.runStatus).toBe('R');
    expect(state?.appLogKey).toBeUndefined();
  });

  it('a `log_link` of another shape yields no `appLogKey`', () => {
    for (const href of [
      '/sap/bc/adt/abapgit/repos/000001/log/',
      '/sap/bc/adt/abapgit/repos/000001/log/A/B',
      '/sap/bc/adt/abapgit/repos/000001/status/LOG1',
      'https://host.invalid/sap/bc/adt/abapgit/repos/000001/log/LOG1',
      '/sap/bc/adt/abapgit/repos/000001/log/LOG1?x=1',
    ]) {
      const document = cloudRepos('E', 'LOG0001').replace(
        '/sap/bc/adt/abapgit/repos/000001/log/LOG0001',
        href,
      );
      expect(abapGitRepoRunStates(doc(document))[0]?.appLogKey).toBeUndefined();
    }
  });
});

describe('abapGitObjectResults (R2, R4, R8)', () => {
  it('reads every field of every object, the message text included', () => {
    const objects = abapGitObjectResults(doc(objectResults));
    expect(objects).toHaveLength(2);
    expect(objects[1]).toEqual({
      type: 'INTF',
      name: 'ZIF_DEMO',
      package: 'ZPKG',
      status: 'S',
      msgType: 'S',
      msgText: 'Imported',
    });
    expect(objects[0]?.msgText.startsWith('Syntax error')).toBe(true);
  });
});

describe('abapGitModifiedObjects (R6)', () => {
  it('reads both lists with the object reference and the action', () => {
    const read = abapGitModifiedObjects(doc(modifiedObjects));
    expect(read.overwriteObjects).toHaveLength(2);
    expect(read.overwriteObjects[1]).toEqual({
      uri: '/sap/bc/adt/oo/interfaces/zif_demo',
      type: 'INTF/OI',
      name: 'ZIF_DEMO',
      packageName: 'ZPKG',
      action: 1,
      actionDescription: undefined,
    });
    expect(read.packageWarningObjects).toEqual([
      {
        uri: '/sap/bc/adt/programs/programs/zdemo',
        type: 'PROG/P',
        name: 'ZDEMO',
        packageName: 'ZOTHER',
        action: 3,
        actionDescription: 'Package differs',
      },
    ]);
  });
});

describe('abapGitStaging (R9)', () => {
  it('reads objects, files, transports, links and the comment', () => {
    const read = abapGitStaging(doc(staging));
    expect(read.ignored).toEqual([]);
    expect(read.staged).toEqual([
      {
        wbkey: 'INTFZIF_DEMO',
        version: 'active',
        uri: '/sap/bc/adt/oo/interfaces/zif_demo',
        type: 'INTF/OI',
        name: 'ZIF_DEMO',
        packageName: 'ZPKG',
        transport: undefined,
        files: [
          {
            name: 'zif_demo.intf.abap',
            path: '/src/',
            localState: 'M',
            remoteState: 'M',
            links: [],
          },
        ],
        links: [],
      },
    ]);
    const [unstaged] = read.unstaged;
    expect(unstaged?.transport?.number).toBe('DEVK900001');
    expect(unstaged?.transport?.links).toHaveLength(1);
    expect(
      unstaged?.files.map((f) => [f.name, f.localState, f.remoteState]),
    ).toEqual([
      ['zcl_demo.clas.abap', 'M', ''],
      ['zcl_demo.clas.xml', 'A', 'D'],
    ]);
    expect(unstaged?.files[0]?.links[0]?.type).toBe('file_link');
    expect(unstaged?.links).toEqual([
      {
        href: '/sap/bc/adt/oo/classes/zcl_demo',
        rel: 'http://www.sap.com/adt/relations/objects',
        type: 'object_link',
      },
    ]);
    expect(read.comment?.text.startsWith('Commit ')).toBe(true);
    expect(read.comment?.author).toEqual({
      name: 'Ada Author',
      email: 'ada@example.invalid',
    });
    expect(read.comment?.committer).toEqual({
      name: 'Carl Committer',
      email: 'carl@example.invalid',
    });
    expect(read.links.map((l) => l.type)).toEqual(['push_link']);
  });

  it('a staging without a comment has no comment', () => {
    const open = '<abapgitstaging:abapgit_comment';
    const close = '</abapgitstaging:abapgit_comment>';
    const document =
      staging.slice(0, staging.indexOf(open)) +
      staging.slice(staging.indexOf(close) + close.length);
    expect(abapGitStaging(doc(document)).comment).toBeUndefined();
  });
});

describe('abapGitBranchInfo (R13, R14)', () => {
  it('reads `sha1` (onprem) into `sha1`', () => {
    const read = abapGitBranchInfo(doc(externalRepo('sha1')));
    expect(read.accessMode).toBe('PRIVATE');
    expect(read.branches.map((b) => [b.name, b.sha1, b.isHead])).toEqual([
      ['refs/heads/main', '0123456789abcdef0123456789abcdef01234567', true],
      ['refs/heads/dev', 'fedcba9876543210fedcba9876543210fedcba98', false],
    ]);
  });

  it('reads `sha` (cloud) into `sha1`', () => {
    const read = abapGitBranchInfo(doc(externalRepo('sha')));
    expect(read.branches.map((b) => b.sha1)).toEqual([
      '0123456789abcdef0123456789abcdef01234567',
      'fedcba9876543210fedcba9876543210fedcba98',
    ]);
  });

  it('reads every field of a branch: type, display name, folder logic, links', () => {
    const [main] = abapGitBranchInfo(
      doc(externalRepo('sha1', { folderLogic: true })),
    ).branches;
    expect(main?.type).toBe('HD');
    expect(main?.displayName.startsWith('main ')).toBe(true);
    expect(main?.folderLogic).toBe('FULL');
    expect(main?.links).toHaveLength(1);
    expect(
      abapGitBranchInfo(doc(externalRepo('sha1'))).branches[0]?.folderLogic,
    ).toBeUndefined();
  });
});

describe('the 0.27.0 readings read their route’s document only', () => {
  it('another document is unreadable, in fixed words', () => {
    const unreadable = 'The answer to the abapGit request could not be read.';
    for (const data of [
      '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><message>no</message></exc:exception>',
      'not xml at all',
      '<html><body>sign in</body></html>',
    ]) {
      expect(() => abapGitRepoRunStates(doc(data))).toThrow(unreadable);
      expect(() => abapGitObjectResults(doc(data))).toThrow(unreadable);
      expect(() => abapGitModifiedObjects(doc(data))).toThrow(unreadable);
      expect(() => abapGitStaging(doc(data))).toThrow(unreadable);
      expect(() => abapGitBranchInfo(doc(data))).toThrow(unreadable);
    }
  });

  it('an empty body is no object results (onprem R4, cloud R4 202)', () => {
    expect(abapGitObjectResults(doc(''))).toEqual([]);
  });
});
