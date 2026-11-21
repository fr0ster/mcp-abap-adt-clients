/**
 * What the facts reducer refuses (review of #326): a document that is not
 * well-formed XML, an R7 answer that is not SAP's fixed text, an R12 answer
 * that is not a text body, a T100 number that is not three digits, a git
 * host's status outside R11, and an `appLogKey` left encoded.
 */

import { ABAPGIT_ERROR_MESSAGES } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  abapGitModifiedObjects,
  abapGitRepoRunStates,
  abapGitStaging,
} from '../results/abapGit';
import { abapGitErrorFacts, abapGitFacts } from '../results/abapGitFacts';
import {
  answer,
  CANARIES,
  cloudRepos,
  exception,
  externalRepo,
  modifiedObjects,
  objectResults,
  staging,
} from './abapGitDocuments';

const UNREADABLE = ABAPGIT_ERROR_MESSAGES.unreadableAnswer;
const HTML = `<html><body>Sign in ${CANARIES.user} ${CANARIES.token}</body></html>`;
const OBJECT = { page: HTML, token: CANARIES.token };

const withData = (data: unknown, headers: Record<string, string> = {}) =>
  ({ ...answer(''), data, headers }) as IAdtWireResponse;

/** The document with its first closing tag of `name` misspelled. */
function mismatched(document: string, name: string): string {
  const close = `</${name}>`;
  const at = document.indexOf(close);
  if (at < 0) throw new Error(`no ${close}`);
  return `${document.slice(0, at)}</${name}X>${document.slice(at + close.length)}`;
}

describe('a document that is not well-formed XML is unreadable', () => {
  it.each([
    [
      'R1 reposFacts',
      () =>
        abapGitFacts.reposFacts(
          answer(mismatched(cloudRepos('E', 'L1'), 'abapgitrepo:url')),
        ),
    ],
    [
      'R1 run states',
      () =>
        abapGitRepoRunStates(
          answer(mismatched(cloudRepos('E', 'L1'), 'abapgitrepo:url')),
        ),
    ],
    [
      'R2/R4/R8 objects',
      () =>
        abapGitFacts.runLog(
          answer(mismatched(objectResults, 'abapObjects:name')),
        ),
    ],
    [
      'R6 modified objects',
      () =>
        abapGitModifiedObjects(
          answer(
            mismatched(
              modifiedObjects,
              'agitpullmodifiedobjects:overwriteObjects',
            ),
          ),
        ),
    ],
    [
      'R9 staging',
      () =>
        abapGitStaging(
          answer(mismatched(staging, 'abapgitstaging:unstaged_objects')),
        ),
    ],
    [
      'R13 external repo',
      () =>
        abapGitFacts.externalRepoFacts(
          answer(mismatched(externalRepo('sha1'), 'abapgitexternalrepo:name')),
        ),
    ],
    [
      'R14 branch info',
      () =>
        abapGitFacts.branchInfo(
          answer(
            mismatched(
              externalRepo('sha', { folderLogic: true }),
              'abapgitexternalrepo:name',
            ),
          ),
        ),
    ],
  ])('%s', (_name, read) => {
    expect(read).toThrow(UNREADABLE);
  });

  it('an exception document that is not well-formed yields the status alone', () => {
    expect(
      abapGitErrorFacts(answer(mismatched(exception(), 'message'), 500)),
    ).toEqual({
      status: 500,
      messageClass: undefined,
      messageNumber: undefined,
      gitHttpStatus: undefined,
    });
  });
});

describe('R7 status: SAP’s fixed text and nothing else', () => {
  it('reads DEMO STATUS', () => {
    expect(abapGitFacts.status(answer('DEMO STATUS'))).toEqual({
      status: 200,
      facts: { text: 'DEMO STATUS' },
    });
  });

  it.each([
    ['an HTML page', HTML],
    ['an object', OBJECT],
    ['another text', `STATUS ${CANARIES.token}`],
  ])('%s is unreadable', (_name, data) => {
    expect(() => abapGitFacts.status(withData(data))).toThrow(UNREADABLE);
  });
});

describe('R12 file: a text body', () => {
  const args = { filename: 'zcl_demo.clas.abap', version: 'remote' } as const;

  it('reads a text/plain body', () => {
    expect(
      abapGitFacts.file(
        withData('CLASS zcl_demo.', {
          'content-type': 'text/plain; charset=utf-8',
        }),
        args,
      ).facts.content,
    ).toBe('CLASS zcl_demo.');
  });

  it.each([
    [
      'an HTML page',
      withData(HTML, { 'content-type': 'text/html; charset=utf-8' }),
    ],
    ['an object', withData(OBJECT)],
    ['a number', withData(42)],
  ])('%s is unreadable', (_name, wire) => {
    expect(() => abapGitFacts.file(wire, args)).toThrow(UNREADABLE);
  });
});

describe('abapGitErrorFacts: the T100 number and the git host', () => {
  /** An exception document whose T100 number is `number`. */
  const numbered = (number: string) =>
    exception().replace(
      '<entry key="T100KEY-NO">017</entry>',
      `<entry key="T100KEY-NO">${number}</entry>`,
    );

  it.each(['17', '0170', '01a', ' 17', ''])(
    'a T100 number %j is not three digits: absent',
    (number) => {
      expect(
        abapGitErrorFacts(answer(numbered(number), 500)).messageNumber,
      ).toBeUndefined();
    },
  );

  it('three digits are kept as SAP writes them', () => {
    expect(abapGitErrorFacts(answer(numbered('007'), 500)).messageNumber).toBe(
      '007',
    );
  });

  it('the git host’s status is read for R11 only', () => {
    const wire = answer(exception({ httpStatus: '401' }), 500);
    expect(abapGitErrorFacts(wire, 'checked').gitHttpStatus).toBe(401);
    expect(abapGitErrorFacts(wire, 'staging').gitHttpStatus).toBeUndefined();
    expect(abapGitErrorFacts(wire).gitHttpStatus).toBeUndefined();
  });
});

describe('appLogKey: decoded from the log link once', () => {
  const repos = (id: string) =>
    cloudRepos('E', 'L1').replace(
      '/sap/bc/adt/abapgit/repos/000001/log/L1',
      `/sap/bc/adt/abapgit/repos/000001/log/${id}`,
    );

  it('an encoded segment is decoded: A%2FB is A/B', () => {
    expect(abapGitRepoRunStates(answer(repos('A%2FB')))[0]?.appLogKey).toBe(
      'A/B',
    );
  });

  it.each(['%2E%2E', '.', '%E0%A4%A', ''])(
    'a segment %j that decodes to nothing usable yields none',
    (id) => {
      expect(
        abapGitRepoRunStates(answer(repos(id)))[0]?.appLogKey,
      ).toBeUndefined();
    },
  );
});
