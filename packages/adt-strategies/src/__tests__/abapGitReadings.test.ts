import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  abapGitErrorLog,
  abapGitExternalRepo,
  abapGitRepos,
} from '../results/abapGit';

/**
 * The abapGit readings, moved from adt-clients' parser.
 *
 * No answer for these endpoints is recorded in `corpus/adt` yet, so the
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
      },
    ]);
  });

  it('an empty list is an empty list', () => {
    expect(abapGitRepos(answer('<repositories/>'))).toEqual([]);
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
