/**
 * XML builders for abapGit request envelopes.
 *
 * link/pull use the 'repositories' namespace; externalRepoInfo uses a
 * separate 'externalRepo' namespace (Phase Z confirmed — capital R,
 * no 'info' suffix). Null/undefined fields are omitted from the body
 * (sapcli parity).
 */

import type {
  IAbapGitCredentials,
  IAbapGitExternalRepoCredentials,
  IAbapGitLinkArgs,
  IAbapGitLinkNewArgs,
  IAbapGitPullArgs,
  IAbapGitPullRepoArgs,
  IAbapGitPullSelection,
  IAbapGitPushArgs,
  IAbapGitStagedObject,
} from '@mcp-abap-adt/interfaces-adt';
import { escapeXmlAttr, escapeXmlText } from '../../utils/xml';

const NS_ABAPGITREPO = 'http://www.sap.com/adt/abapgit/repositories';
const NS_ABAPGIT_EXTERNAL_REPO = 'http://www.sap.com/adt/abapgit/externalRepo';

function childRepo(tag: string, value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return `<abapgitrepo:${tag}>${escapeXmlText(value)}</abapgitrepo:${tag}>`;
}

function childExternalRepo(tag: string, value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return `<abapgitexternalrepo:${tag}>${escapeXmlText(value)}</abapgitexternalrepo:${tag}>`;
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
  resolvedBranch?: string,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    childRepo('package', args.package) +
    childRepo('branchName', resolvedBranch ?? args.branchName ?? '') +
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

/*
 * The new forms (46.2.0). A credential is written exactly where its route's
 * transformation reads it (spec §3.1), and only when one is given: `null` is
 * an anonymous call and writes no credential element at all.
 */

const NS_ABAPGIT_STAGING = 'http://www.sap.com/adt/abapgit/staging';
const NS_ADTCORE = 'http://www.sap.com/adt/core';
// Inference, not read: the namespace and element names of the selective pull
// (`ABAPGIT_ST_REPO_SELECTIVE_PULL`, cloud) were not read. `user` and
// `password` are the spec's (§3.1); the entries mirror R6's document
// (`ABAPGIT_ST_PULL_MODIFIED_OBJS`), which the selection hands back. The live
// run (T5.6) is what settles it; the server never sends a selection (§4.3).
const NS_ABAPGIT_PULL_REQUEST =
  'http://www.sap.com/adt/abapgit/abapgitpullrequest';

function child(prefix: string, tag: string, value: string | undefined): string {
  if (value === undefined) return '';
  return `<${prefix}:${tag}>${escapeXmlText(value)}</${prefix}:${tag}>`;
}

function attribute(name: string, value: string): string {
  return ` ${name}="${escapeXmlAttr(value)}"`;
}

/** R2, the new form: `remoteUser` / `remotePassword` from the credential. */
export function buildLinkBodyNew(
  args: IAbapGitLinkNewArgs,
  credentials: IAbapGitCredentials | null,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    child('abapgitrepo', 'package', args.package) +
    child('abapgitrepo', 'url', args.url) +
    child('abapgitrepo', 'branchName', args.branchName) +
    child('abapgitrepo', 'remoteUser', credentials?.user) +
    child('abapgitrepo', 'remotePassword', credentials?.password) +
    child('abapgitrepo', 'transportRequest', args.transportRequest) +
    // Cloud only. Its place after `transportRequest` is Inference: the
    // transformation `ABAPGIT_ST_REPO_POST_V3` was not read.
    child('abapgitrepo', 'folderLogic', args.folderLogic) +
    `</abapgitrepo:repository>`
  );
}

/** R4/R5 `repo.v3`: the branch, the credential, the request. */
export function buildPullRepoBody(
  args: IAbapGitPullRepoArgs,
  credentials: IAbapGitCredentials | null,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    child('abapgitrepo', 'branchName', args.branchName) +
    child('abapgitrepo', 'remoteUser', credentials?.user) +
    child('abapgitrepo', 'remotePassword', credentials?.password) +
    child('abapgitrepo', 'transportRequest', args.transportRequest) +
    `</abapgitrepo:repository>`
  );
}

function selectedObjects(
  tag: string,
  objects: IAbapGitPullSelection['overwriteObjects'],
): string {
  const entries = objects
    .map(
      (object) =>
        '<abapgitpullrequest:abapgitobjects' +
        attribute('adtcore:uri', object.uri) +
        attribute('adtcore:type', object.type) +
        attribute('adtcore:name', object.name) +
        attribute('adtcore:packageName', object.packageName) +
        attribute('abapgitpullrequest:action', String(object.action)) +
        '/>',
    )
    .join('');
  return `<abapgitpullrequest:${tag}>${entries}</abapgitpullrequest:${tag}>`;
}

/**
 * R4/R5 `pull.req.v1` (cloud): the selection R6 answered, handed back with
 * exactly its entries, and the credential in `user` / `password`.
 */
export function buildSelectivePullBody(
  args: IAbapGitPullRepoArgs & { readonly selection: IAbapGitPullSelection },
  credentials: IAbapGitCredentials | null,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitpullrequest:abapgitpullrequest xmlns:abapgitpullrequest="${NS_ABAPGIT_PULL_REQUEST}" xmlns:adtcore="${NS_ADTCORE}">` +
    child('abapgitpullrequest', 'branchName', args.branchName) +
    child('abapgitpullrequest', 'transportRequest', args.transportRequest) +
    child('abapgitpullrequest', 'user', credentials?.user) +
    child('abapgitpullrequest', 'password', credentials?.password) +
    selectedObjects('overwriteObjects', args.selection.overwriteObjects) +
    selectedObjects(
      'packageWarningObjects',
      args.selection.packageWarningObjects,
    ) +
    `</abapgitpullrequest:abapgitpullrequest>`
  );
}

/**
 * R13, the new form, and R14: `user` / `password` — the fields SAP reads
 * (`…INFO_EXT_REQ`, `…RQ_V2`), not 46.1.0's `remoteUser`, which it ignores.
 * R14 adds the branch and the package; their place after the credential is
 * Inference (the transformation was not read).
 */
export function buildExternalRepoRequestBody(
  args: {
    readonly url: string;
    readonly branch?: string;
    readonly package?: string;
  },
  credentials: IAbapGitCredentials | null,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitexternalrepo:externalRepoInfoRequest xmlns:abapgitexternalrepo="${NS_ABAPGIT_EXTERNAL_REPO}">` +
    child('abapgitexternalrepo', 'url', args.url) +
    child('abapgitexternalrepo', 'user', credentials?.user) +
    child('abapgitexternalrepo', 'password', credentials?.password) +
    child('abapgitexternalrepo', 'branch', args.branch) +
    child('abapgitexternalrepo', 'package', args.package) +
    `</abapgitexternalrepo:externalRepoInfoRequest>`
  );
}

function stagedObject(object: IAbapGitStagedObject): string {
  const files = object.files
    .map(
      (file) =>
        '<abapgitstaging:abapgitfile' +
        attribute('abapgitstaging:name', file.name) +
        attribute('abapgitstaging:path', file.path) +
        attribute('abapgitstaging:localState', file.localState) +
        attribute('abapgitstaging:remoteState', file.remoteState) +
        '/>',
    )
    .join('');
  return (
    '<abapgitstaging:abapgitobject' +
    attribute('abapgitstaging:wbkey', object.wbkey) +
    attribute('abapgitstaging:version', object.version) +
    attribute('adtcore:uri', object.uri) +
    attribute('adtcore:type', object.type) +
    attribute('adtcore:name', object.name) +
    attribute('adtcore:packageName', object.packageName) +
    `>${files}</abapgitstaging:abapgitobject>`
  );
}

/**
 * R10: the staging document R9 answers, with the objects to push as
 * `staged_objects` and the commit as `abapgit_comment`.
 */
export function buildPushBody(args: IAbapGitPushArgs): string {
  const { comment } = args;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitstaging:abapgitstaging xmlns:abapgitstaging="${NS_ABAPGIT_STAGING}" xmlns:adtcore="${NS_ADTCORE}">` +
    `<abapgitstaging:staged_objects>${args.staged.map(stagedObject).join('')}</abapgitstaging:staged_objects>` +
    `<abapgitstaging:abapgit_comment${attribute('abapgitstaging:comment', comment.text)}>` +
    `<abapgitstaging:author${attribute('abapgitstaging:name', comment.author.name)}${attribute('abapgitstaging:email', comment.author.email)}/>` +
    `<abapgitstaging:committer${attribute('abapgitstaging:name', comment.committer.name)}${attribute('abapgitstaging:email', comment.committer.email)}/>` +
    '</abapgitstaging:abapgit_comment>' +
    '</abapgitstaging:abapgitstaging>'
  );
}
