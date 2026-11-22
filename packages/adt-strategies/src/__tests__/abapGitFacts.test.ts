import { abapGitErrorFacts, abapGitFacts } from '../results/abapGitFacts';
import {
  answer,
  CANARIES,
  cloudRepos,
  exception,
  externalRepo,
  modifiedObjects,
  objectResults,
  onpremRepos,
  staging,
} from './abapGitDocuments';

/**
 * The facts reducer: spec §5.3's kept-field list, and nothing else.
 *
 * Each route's facts are compared by their key set — the top level and every
 * item — so a field that is added (a message text kept) or dropped (a kept
 * fact lost) turns its case red. The canaries sit in every place §5.3 drops:
 * body text, `msgText`, `actionDescription`, `displayName`, links, `@comment`,
 * the exception's texts, `T100KEY-V1…V4` and `LONGTEXT`.
 */

const canaryValues = Object.values(CANARIES);

function holdsNoCanary(value: unknown): void {
  const text = JSON.stringify(value);
  for (const canary of canaryValues) expect(text).not.toContain(canary);
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

const OBJECT_KEYS = ['messageType', 'name', 'package', 'status', 'type'];
const MODIFIED_KEYS = ['action', 'name', 'packageName', 'type', 'uri'];
const STAGED_KEYS = [
  'files',
  'name',
  'packageName',
  'type',
  'uri',
  'version',
  'wbkey',
];
const FILE_KEYS = ['localState', 'name', 'path', 'remoteState'];
const BRANCH_KEYS = ['isHead', 'name', 'sha1', 'type'];

describe('abapGitFacts — the kept fields per route', () => {
  it('R1 reposFacts: key, package, url, branchName, runStatus, statusText, appLogKey', () => {
    const reduced = abapGitFacts.reposFacts(answer(cloudRepos('E', 'LOG0001')));
    expect(keysOf(reduced)).toEqual(['facts', 'status']);
    expect(reduced.status).toBe(200);
    expect(keysOf(reduced.facts)).toEqual(['repos']);
    expect(reduced.facts.repos).toEqual([
      {
        key: '000001',
        package: 'ZPKG_CLOUD',
        url: 'https://git.example.invalid/team/repo.git',
        branchName: 'refs/heads/main',
        runStatus: 'E',
        statusText: 'Pull finished with errors',
        appLogKey: 'LOG0001',
      },
    ]);
    for (const repo of reduced.facts.repos)
      expect(keysOf(repo)).toEqual([
        'appLogKey',
        'branchName',
        'key',
        'package',
        'runStatus',
        'statusText',
        'url',
      ]);
  });

  it('R1 onprem: the run state is absent, not blank', () => {
    const [repo] = abapGitFacts.reposFacts(answer(onpremRepos)).facts.repos;
    expect(repo?.runStatus).toBeUndefined();
    expect(repo?.statusText).toBeUndefined();
    expect(repo?.appLogKey).toBeUndefined();
  });

  it.each([
    ['linkedFacts', 200],
    ['repoPulled', 200],
    ['runLog', 200],
  ] as const)(
    '%s: objects of type, name, package, status, messageType',
    (route, status) => {
      const reduced = abapGitFacts[route](answer(objectResults, status));
      expect(reduced.status).toBe(status);
      expect(keysOf(reduced.facts)).toEqual(['objects']);
      expect(reduced.facts.objects).toHaveLength(2);
      for (const object of reduced.facts.objects)
        expect(keysOf(object)).toEqual(OBJECT_KEYS);
      expect(reduced.facts.objects[0]).toEqual({
        type: 'CLAS',
        name: 'ZCL_DEMO',
        package: 'ZPKG',
        status: 'E',
        messageType: 'E',
      });
      holdsNoCanary(reduced);
    },
  );

  it('R4 onprem answers an empty document; cloud a 202 with no body', () => {
    expect(
      abapGitFacts.repoPulled(
        answer(
          '<abapObjects:abapObjects xmlns:abapObjects="http://www.sap.com/adt/abapgit/abapObjects"/>',
        ),
      ),
    ).toEqual({ status: 200, facts: { objects: [] } });
    expect(abapGitFacts.repoPulled(answer('', 202))).toEqual({
      status: 202,
      facts: { objects: [] },
    });
  });

  it('R6 modifiedObjects: uri, type, name, packageName, action', () => {
    const reduced = abapGitFacts.modifiedObjects(answer(modifiedObjects));
    expect(keysOf(reduced.facts)).toEqual([
      'overwriteObjects',
      'packageWarningObjects',
    ]);
    for (const object of [
      ...reduced.facts.overwriteObjects,
      ...reduced.facts.packageWarningObjects,
    ])
      expect(keysOf(object)).toEqual(MODIFIED_KEYS);
    expect(reduced.facts.overwriteObjects[0]).toEqual({
      uri: '/sap/bc/adt/oo/classes/zcl_demo',
      type: 'CLAS/OC',
      name: 'ZCL_DEMO',
      packageName: 'ZPKG',
      action: 2,
    });
    expect(reduced.facts.packageWarningObjects[0]?.action).toBe(3);
    holdsNoCanary(reduced);
  });

  it('R9 staging: the three lists with their files, author and committer', () => {
    const reduced = abapGitFacts.staging(answer(staging));
    expect(keysOf(reduced.facts)).toEqual([
      'author',
      'committer',
      'ignored',
      'staged',
      'unstaged',
    ]);
    const objects = [
      ...reduced.facts.unstaged,
      ...reduced.facts.staged,
      ...reduced.facts.ignored,
    ];
    expect(objects).toHaveLength(2);
    for (const object of objects) {
      expect(keysOf(object)).toEqual(STAGED_KEYS);
      for (const file of object.files) expect(keysOf(file)).toEqual(FILE_KEYS);
    }
    expect(reduced.facts.unstaged[0]?.files).toEqual([
      {
        name: 'zcl_demo.clas.abap',
        path: '/src/',
        localState: 'M',
        remoteState: '',
      },
      {
        name: 'zcl_demo.clas.xml',
        path: '/src/',
        localState: 'A',
        remoteState: 'D',
      },
    ]);
    expect(reduced.facts.author).toEqual({
      name: 'Ada Author',
      email: 'ada@example.invalid',
    });
    expect(reduced.facts.committer).toEqual({
      name: 'Carl Committer',
      email: 'carl@example.invalid',
    });
    holdsNoCanary(reduced);
  });

  it.each([
    ['sha1', 'onprem'],
    ['sha', 'cloud'],
  ] as const)(
    'R13 externalRepoFacts: accessMode and branches (%s, %s)',
    (hash, _system) => {
      const reduced = abapGitFacts.externalRepoFacts(
        answer(externalRepo(hash)),
      );
      expect(keysOf(reduced.facts)).toEqual(['accessMode', 'branches']);
      expect(reduced.facts.accessMode).toBe('PRIVATE');
      for (const branch of reduced.facts.branches)
        expect(keysOf(branch)).toEqual(BRANCH_KEYS);
      expect(reduced.facts.branches).toEqual([
        {
          sha1: '0123456789abcdef0123456789abcdef01234567',
          name: 'refs/heads/main',
          type: 'HD',
          isHead: true,
        },
        {
          sha1: 'fedcba9876543210fedcba9876543210fedcba98',
          name: 'refs/heads/dev',
          type: 'HD',
          isHead: false,
        },
      ]);
      holdsNoCanary(reduced);
    },
  );

  it('R14 branchInfo: also the folder logic, which SAP writes in the branch', () => {
    const reduced = abapGitFacts.branchInfo(
      answer(externalRepo('sha', { folderLogic: true })),
    );
    expect(keysOf(reduced.facts)).toEqual(['accessMode', 'branches']);
    for (const branch of reduced.facts.branches)
      expect(keysOf(branch)).toEqual([...BRANCH_KEYS, 'folderLogic'].sort());
    expect(reduced.facts.branches[0]?.folderLogic).toBe('FULL');
    expect(reduced.facts.branches[0]?.sha1).toBe(
      '0123456789abcdef0123456789abcdef01234567',
    );
    holdsNoCanary(reduced);
  });

  it('R12 file: the content, with the filename and version it was asked for', () => {
    const reduced = abapGitFacts.file(answer('CLASS zcl_demo DEFINITION.'), {
      filename: 'zcl_demo.clas.abap',
      version: 'remote',
    });
    expect(reduced).toEqual({
      status: 200,
      facts: {
        filename: 'zcl_demo.clas.abap',
        version: 'remote',
        content: 'CLASS zcl_demo DEFINITION.',
      },
    });
  });

  it('R7 status: the fixed text SAP answers', () => {
    expect(abapGitFacts.status(answer('DEMO STATUS'))).toEqual({
      status: 200,
      facts: { text: 'DEMO STATUS' },
    });
  });

  it.each(['pushed', 'checked', 'switched', 'repoPulledInDialog'] as const)(
    '%s: the status alone, whatever the body says',
    (route) => {
      const reduced = abapGitFacts[route](
        answer(`a body holding ${CANARIES.token}`, 202),
      );
      expect(reduced).toEqual({ status: 202, facts: {} });
    },
  );

  it('a canary in a kept field passes as data: names are the user’s', () => {
    const document = externalRepo('sha1').replace(
      'refs/heads/dev',
      `refs/heads/${CANARIES.user}`,
    );
    const reduced = abapGitFacts.externalRepoFacts(answer(document));
    expect(reduced.facts.branches[1]?.name).toBe(`refs/heads/${CANARIES.user}`);
  });

  it('an answer that is not the route’s document is unreadable, in fixed words', () => {
    for (const [route, data] of [
      ['reposFacts', `<html>${CANARIES.token}</html>`],
      ['staging', exception()],
      ['modifiedObjects', `not xml ${CANARIES.user}`],
      ['externalRepoFacts', ''],
      // The parser refuses this one, and its message quotes the document.
      ['staging', `<a b="${CANARIES.token}></a>`],
    ] as const) {
      let thrown: unknown;
      try {
        abapGitFacts[route](answer(data));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(
        'The answer to the abapGit request could not be read.',
      );
      holdsNoCanary({
        message: (thrown as Error).message,
        stack: (thrown as Error).stack,
        cause: (thrown as Error).cause,
      });
    }
  });

  it('a non-integer action is unreadable', () => {
    expect(() =>
      abapGitFacts.modifiedObjects(
        answer(modifiedObjects.replace('action="2"', 'action="2x"')),
      ),
    ).toThrow('The answer to the abapGit request could not be read.');
  });
});

describe('abapGitErrorFacts', () => {
  it('keeps the status and the T100 key, nothing of the texts', () => {
    const facts = abapGitErrorFacts(answer(exception(), 500));
    expect(facts).toEqual({
      status: 500,
      messageClass: 'ABAPGIT_MSG',
      messageNumber: '017',
      gitHttpStatus: undefined,
    });
    expect(keysOf(facts)).toEqual([
      'gitHttpStatus',
      'messageClass',
      'messageNumber',
      'status',
    ]);
    holdsNoCanary(facts);
  });

  it('R11 auth failure: also the git host’s status, as an integer', () => {
    const facts = abapGitErrorFacts(
      answer(exception({ httpStatus: '401' }), 500),
      'checked',
    );
    expect(facts.gitHttpStatus).toBe(401);
    expect(facts.messageNumber).toBe('017');
    holdsNoCanary(facts);
  });

  it('a non-integer `http_status` is not a fact', () => {
    expect(
      abapGitErrorFacts(
        answer(exception({ httpStatus: '40x' }), 500),
        'checked',
      ).gitHttpStatus,
    ).toBeUndefined();
  });

  it('no T100 key, or no exception document: the status alone', () => {
    for (const data of [
      exception({ t100: false }),
      `<html>${CANARIES.token}</html>`,
      `plain ${CANARIES.user}`,
      `<a b="${CANARIES.token}></a>`,
      '',
    ]) {
      const facts = abapGitErrorFacts(answer(data, 409));
      expect(facts).toEqual({
        status: 409,
        messageClass: undefined,
        messageNumber: undefined,
        gitHttpStatus: undefined,
      });
    }
  });
});
