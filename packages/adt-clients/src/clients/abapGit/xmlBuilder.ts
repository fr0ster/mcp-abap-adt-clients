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
// The selective pull (`ABAPGIT_ST_REPO_SELECTIVE_PULL`, cloud; Code): the root,
// `branchName`, `transportRequest`, `user` and `password` in its own namespace
// (L4, L14–38), the two lists, their entries and `action` in R6's
// (`agitpullmodifiedobjects`, L5, L42, L55; `ABAPGIT_ST_PULL_MODIFIED_OBJS`
// L46, L52). The root is `extensible="deep"`: a list in another namespace is
// skipped silently, and the pull selects nothing.
const NS_ABAPGIT_PULL_REQUEST =
  'http://www.sap.com/adt/abapgit/abapgitpullrequest';
const NS_ABAPGIT_MODIFIED_OBJECTS =
  'http://www.sap.com/adt/abapgit/agitpullmodifiedobjects';

function child(prefix: string, tag: string, value: string | undefined): string {
  if (value === undefined) return '';
  return `<${prefix}:${tag}>${escapeXmlText(value)}</${prefix}:${tag}>`;
}

function attribute(name: string, value: string): string {
  return ` ${name}="${escapeXmlAttr(value)}"`;
}

/**
 * An attribute SAP reads under `tt:cond check="not-initial(…)"`: written only
 * when it has a value. On deserialization the check runs on the value read, so
 * an attribute present and empty fails the whole document with
 * `CX_ST_COND_CHECK_FAIL`. Measured for the push only, on premise
 * (2026-11-22): a new file's `remoteState=""` answered 400, T100 00/001
 * "Check of condition failed". The selective pull's refusal of an empty
 * attribute is read from its transformation (Code), not measured. The conds are on every file attribute
 * (`ZABAPGIT_ST_REPO_STAGE_OBJECT` L41–54, `ABAPGIT_ST_REPO_STAGE_OBJECT`
 * L76–90), on the comment and the people (`…ST_REPO_STAGE` L44–72 onprem,
 * L52–83 cloud), and on the object reference's `uri`, `type` and
 * `packageName` (`SADT_OBJECT_REFERENCE` L38–56, both systems; Code). Its
 * `name` is under `s-check`, which deserialization does not run.
 */
function presentAttribute(name: string, value: string): string {
  return value === '' ? '' : attribute(name, value);
}

/** The object reference attributes, as `SADT_OBJECT_REFERENCE` reads them. */
function objectReference(object: {
  readonly uri: string;
  readonly type: string;
  readonly name: string;
  readonly packageName: string;
}): string {
  return (
    presentAttribute('adtcore:uri', object.uri) +
    presentAttribute('adtcore:type', object.type) +
    attribute('adtcore:name', object.name) +
    presentAttribute('adtcore:packageName', object.packageName)
  );
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
    // Cloud only (`ABAPGIT_ST_REPO_POST_V3` L20–24; Code). Its members sit in
    // a `tt:group` (L9), so the order is free. Onprem's `ZABAPGIT_ST_REPO_POST`
    // has no such field and skips it silently (`extensible="deep"`, L8).
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
        '<agitpullmodifiedobjects:abapgitobjects' +
        objectReference(object) +
        attribute('agitpullmodifiedobjects:action', String(object.action)) +
        '/>',
    )
    .join('');
  return `<agitpullmodifiedobjects:${tag}>${entries}</agitpullmodifiedobjects:${tag}>`;
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
    `<abapgitpullrequest:abapgitpullrequest xmlns:abapgitpullrequest="${NS_ABAPGIT_PULL_REQUEST}" xmlns:agitpullmodifiedobjects="${NS_ABAPGIT_MODIFIED_OBJECTS}" xmlns:adtcore="${NS_ADTCORE}">` +
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
 * R14 adds the branch and the package (`ABAPGIT_ST_REPO_INFO_EXT_RQ_V2`
 * L23–32; Code), members of a `tt:group` (L7), so the order is free.
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
        presentAttribute('abapgitstaging:name', file.name) +
        presentAttribute('abapgitstaging:path', file.path) +
        presentAttribute('abapgitstaging:localState', file.localState) +
        presentAttribute('abapgitstaging:remoteState', file.remoteState) +
        '/>',
    )
    .join('');
  return (
    '<abapgitstaging:abapgitobject' +
    // Both `not-initial` in `ABAPGIT_ST_REPO_STAGE_OBJECT` (cloud L23–30,
    // onprem L20–26).
    presentAttribute('abapgitstaging:wbkey', object.wbkey) +
    presentAttribute('abapgitstaging:version', object.version) +
    objectReference(object) +
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
    // The three lists are literal elements of `ABAPGIT_ST_REPO_STAGE`, in this
    // order (cloud L14, L25, L36; onprem `ZABAPGIT_ST_REPO_STAGE` the same):
    // a push sends its objects as `staged_objects` and the other two empty.
    '<abapgitstaging:unstaged_objects></abapgitstaging:unstaged_objects>' +
    `<abapgitstaging:staged_objects>${args.staged.map(stagedObject).join('')}</abapgitstaging:staged_objects>` +
    '<abapgitstaging:ignored_objects></abapgitstaging:ignored_objects>' +
    `<abapgitstaging:abapgit_comment${presentAttribute('abapgitstaging:comment', comment.text)}>` +
    `<abapgitstaging:author${presentAttribute('abapgitstaging:name', comment.author.name)}${presentAttribute('abapgitstaging:email', comment.author.email)}/>` +
    `<abapgitstaging:committer${presentAttribute('abapgitstaging:name', comment.committer.name)}${presentAttribute('abapgitstaging:email', comment.committer.email)}/>` +
    '</abapgitstaging:abapgit_comment>' +
    '</abapgitstaging:abapgitstaging>'
  );
}
