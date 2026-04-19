/**
 * XML builders for abapGit request envelopes.
 *
 * link/pull use the 'repositories' namespace; externalRepoInfo uses a
 * separate 'externalRepo' namespace (Phase Z confirmed — capital R,
 * no 'info' suffix). Null/undefined fields are omitted from the body
 * (sapcli parity).
 */

import type {
  IAbapGitExternalRepoCredentials,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
} from './types';

const NS_ABAPGITREPO = 'http://www.sap.com/adt/abapgit/repositories';
const NS_ABAPGIT_EXTERNAL_REPO = 'http://www.sap.com/adt/abapgit/externalRepo';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function childRepo(tag: string, value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return `<abapgitrepo:${tag}>${escapeXml(value)}</abapgitrepo:${tag}>`;
}

function childExternalRepo(tag: string, value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return `<abapgitexternalrepo:${tag}>${escapeXml(value)}</abapgitexternalrepo:${tag}>`;
}

export function buildLinkBody(args: IAbapGitLinkArgs): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    childRepo('package', args.package) +
    childRepo('url', args.url) +
    childRepo('branchName', args.branchName ?? 'refs/heads/master') +
    childRepo('remoteUser', args.remoteUser) +
    childRepo('remotePassword', args.remotePassword) +
    childRepo('transportRequest', args.transportRequest) +
    `</abapgitrepo:repository>`
  );
}

export function buildPullBody(
  args: IAbapGitPullArgs,
  resolvedBranch: string,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    childRepo('package', args.package) +
    childRepo('branchName', resolvedBranch) +
    childRepo('remoteUser', args.remoteUser) +
    childRepo('remotePassword', args.remotePassword) +
    childRepo('transportRequest', args.transportRequest) +
    `</abapgitrepo:repository>`
  );
}

export function buildExternalRepoInfoBody(
  args: IAbapGitExternalRepoCredentials,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitexternalrepo:externalRepoInfoRequest xmlns:abapgitexternalrepo="${NS_ABAPGIT_EXTERNAL_REPO}">` +
    childExternalRepo('url', args.url) +
    childExternalRepo('remoteUser', args.remoteUser) +
    childExternalRepo('remotePassword', args.remotePassword) +
    `</abapgitexternalrepo:externalRepoInfoRequest>`
  );
}
