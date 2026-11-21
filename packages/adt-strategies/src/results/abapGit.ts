import {
  ABAPGIT_ERROR_MESSAGES,
  type IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import { field, isElement, listOf } from '../parsed';
import { rawOf } from '../result';

/**
 * Readings of what `/sap/bc/adt/abapgit/*` answers.
 *
 * They lived in `@mcp-abap-adt/adt-clients` as the shapes its abapGit client
 * returned, which made the library read every answer for its caller. Since the
 * client answers documents as they arrived, a caller who wants these shapes
 * passes these strategies when they construct it:
 *
 * ```typescript
 * const git = AdtAbapGitClient.create(connection, {
 *   logger,
 *   results: { ...abapGitDocuments, repos: abapGitRepos },
 * });
 * const repo = (await git.listRepos()).getResult().value.find((r) => r.package === 'ZPKG');
 * await git.getErrorLog(repo.logLink);
 * ```
 *
 * Element names and atom-link types are as the live system answered them when
 * the client was written (its "Phase Z" probe); no recorded answer for these
 * endpoints is in `corpus/adt/answers` yet.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  // Text kept as SAP wrote it. With the default a repository key `000001` read
  // as the number 1 — and `unlink` is addressed by that key, so it would have
  // been sent to a repository that does not exist. adt-clients' parser had the
  // same default until this move; read.ts's T100 note is the same trap.
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) =>
    name === 'repository' ||
    name === 'abapObject' ||
    name === 'branch' ||
    name === 'link',
});

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

/** An atom link as SAP writes it: `href`, `rel`, and `type` when it has one. */
export interface IAbapGitLink {
  href: string;
  rel: string;
  type?: string;
}

/** One linked repository, as `/sap/bc/adt/abapgit/repos` reports it. */
export interface IAbapGitRepo {
  package: string;
  url: string;
  branchName: string;
  /** `R` while a pull runs. */
  status: string;
  statusText: string;
  createdBy?: string;
  createdAt?: string;
  /** `abapgitrepo:key` — what `unlink` is addressed by. */
  repositoryId?: string;
  /** Where a pull is posted (`pull_link`). */
  pullLink?: string;
  /** Where the last run's log is read (`log_link`) — what `getErrorLog` takes. */
  logLink?: string;
  /** Cloud only: `FULL` or `PREFIX`. */
  folderLogic?: string;
  createdEmail?: string;
  deserializedBy?: string;
  deserializedEmail?: string;
  deserializedAt?: string;
  /**
   * Every link of the entry, in document order. Onprem writes its pull link
   * with a `rel` and no `type`, so `pullLink` (read by `type`) misses it there;
   * the `rel` names it.
   */
  links?: IAbapGitLink[];
}

/** One line of a pull's error log. */
export interface IAbapGitErrorLogEntry {
  msgType: string;
  objectType: string;
  objectName: string;
  messageText: string;
}

/** One branch of an external repository. */
export interface IAbapGitExternalRepoBranch {
  name: string;
  sha1: string;
  isHead: boolean;
  type?: string;
}

/** What the external-repository probe answers. */
export interface IAbapGitExternalRepoInfo {
  branches: IAbapGitExternalRepoBranch[];
  /** Measured: the field is `accessMode`, not `access`. */
  accessMode?: string;
}

function linksOf(repoNode: unknown): {
  pullLink?: string;
  logLink?: string;
  links?: IAbapGitLink[];
} {
  const out: { pullLink?: string; logLink?: string; links?: IAbapGitLink[] } =
    {};
  const links = field(repoNode, 'link');
  const list: unknown[] = Array.isArray(links) ? links : [];
  const all: IAbapGitLink[] = [];
  for (const link of list) {
    const href = asString(field(link, 'href'));
    if (!href) continue;
    const type = asString(field(link, 'type'));
    all.push({
      href,
      rel: asString(field(link, 'rel')),
      ...(type ? { type } : {}),
    });
    if (type === 'pull_link') out.pullLink = href;
    else if (type === 'log_link') out.logLink = href;
  }
  if (all.length > 0) out.links = all;
  return out;
}

/** A field added in 0.27.0: present only when SAP wrote it with a value. */
function optionalText(node: unknown, name: string): Record<string, string> {
  const value = asString(field(node, name));
  return value ? { [name]: value } : {};
}

/** The repositories list, one entry per linked repository. */
export const abapGitRepos: IResultStrategy<IAbapGitRepo[]> = (answer) => {
  const parsed: unknown = parser.parse(rawOf(answer));
  const repos = field(field(parsed, 'repositories'), 'repository') ?? [];
  return listOf(repos)
    .filter(Boolean)
    .map((node) => ({
      package: asString(field(node, 'package')),
      url: asString(field(node, 'url')),
      branchName: asString(field(node, 'branchName')),
      status: asString(field(node, 'status')),
      statusText: asString(field(node, 'statusText')),
      createdBy: asString(field(node, 'createdBy')) || undefined,
      createdAt: asString(field(node, 'createdAt')) || undefined,
      repositoryId: asString(field(node, 'key')) || undefined,
      ...optionalText(node, 'folderLogic'),
      ...optionalText(node, 'createdEmail'),
      ...optionalText(node, 'deserializedBy'),
      ...optionalText(node, 'deserializedEmail'),
      ...optionalText(node, 'deserializedAt'),
      ...linksOf(node),
    }));
};

/** A run's error log, one entry per object it reports. */
export const abapGitErrorLog: IResultStrategy<IAbapGitErrorLogEntry[]> = (
  answer,
) => {
  const parsed: unknown = parser.parse(rawOf(answer));
  const items = field(field(parsed, 'abapObjects'), 'abapObject') ?? [];
  return listOf(items)
    .filter(Boolean)
    .map((o) => ({
      msgType: asString(field(o, 'msgType')),
      objectType: asString(field(o, 'type')),
      objectName: asString(field(o, 'name')),
      messageText: asString(field(o, 'msgText')),
    }));
};

/** An external repository's branches and access mode. */
export const abapGitExternalRepo: IResultStrategy<IAbapGitExternalRepoInfo> = (
  answer,
) => {
  const parsed: unknown = parser.parse(rawOf(answer));
  const root = field(parsed, 'externalRepoInfo') ?? {};
  const raw = field(root, 'branch') ?? [];
  return {
    branches: listOf(raw)
      .filter(Boolean)
      .map(
        (b): IAbapGitExternalRepoBranch => ({
          name: asString(field(b, 'name')),
          sha1: asString(field(b, 'sha1')),
          // SAP-XML boolean: 'X' is true, an empty element is false.
          isHead: asString(field(b, 'isHead')).toUpperCase() === 'X',
          type: asString(field(b, 'type')) || undefined,
        }),
      ),
    accessMode: asString(field(root, 'accessMode')) || undefined,
  };
};

// ---------------------------------------------------------------------------
// The readings added in 0.27.0, and the documents the facts reducer reads.
//
// These read from the root element the route answers and refuse any other
// answer in fixed words (`ABAPGIT_ERROR_MESSAGES.unreadableAnswer`), never with
// the parser's message or the document's text: a sign-in page or an exception
// in a 2xx is not an empty list. An absent element that SAP's transformation
// omits when its value is initial reads as that initial value (`''`, `0`).
// No regular expression runs over a document; a path is split, not matched.
// ---------------------------------------------------------------------------

const documentParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) =>
    name === 'repository' ||
    name === 'link' ||
    name === 'abapObject' ||
    name === 'abapgitobjects' ||
    name === 'abapgitobject' ||
    name === 'abapgitfile' ||
    name === 'branch' ||
    name === 'entry',
});

/** The fixed failure of an answer that is not the route's document. */
export function unreadableAnswer(): Error {
  return new Error(ABAPGIT_ERROR_MESSAGES.unreadableAnswer);
}

/**
 * The parsed document, or `undefined` when the parser refuses it. The parser's
 * own message quotes the document, so it is dropped here.
 */
export function parsedDocument(answer: IAdtWireResponse): unknown {
  try {
    return documentParser.parse(rawOf(answer));
  } catch {
    return undefined;
  }
}

/** The route's root element, or the fixed unreadable failure. */
function rootOf(answer: IAdtWireResponse, name: string): unknown {
  const root = field(parsedDocument(answer), name);
  if (root === undefined) throw unreadableAnswer();
  return root;
}

/** An element's text: a leaf as it is, an element's `#text`, else `undefined`. */
export function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isElement(value)) {
    const text = value['#text'];
    return typeof text === 'string' ? text : '';
  }
  return undefined;
}

function text(node: unknown, name: string): string {
  return textOf(field(node, name)) ?? '';
}

/** A non-negative integer written as decimal digits, else `undefined`. */
export function integerOf(value: string): number | undefined {
  if (value.length === 0 || value.length > 9) return undefined;
  for (const char of value) if (char < '0' || char > '9') return undefined;
  return Number(value);
}

function linkList(node: unknown): IAbapGitLink[] {
  return listOf(field(node, 'link')).flatMap((link) => {
    const href = text(link, '@href');
    if (!href) return [];
    const type = text(link, '@type');
    return [{ href, rel: text(link, '@rel'), ...(type ? { type } : {}) }];
  });
}

/** One repository's run state, as cloud's R1 writes it. */
export interface IAbapGitRepoRunState {
  /** `abapgitrepo:key`. */
  key: string;
  /**
   * `abapgitrepo:status` — `''` (initial), `R`, `S`, `W`, `E`, `A` — or
   * `undefined` when the entry has none (onprem R1 writes none).
   */
  runStatus: string | undefined;
  /** `abapgitrepo:statusText`, `undefined` when absent. */
  statusText: string | undefined;
  /**
   * The application log key, from the `log_link` href
   * (`/sap/bc/adt/abapgit/repos/{key}/log/{appLogKey}`) and from nowhere else:
   * `undefined` when there is no such link or its path has another shape.
   */
  appLogKey: string | undefined;
}

const REPOS_PATH = '/sap/bc/adt/abapgit/repos/';

function appLogKeyOf(links: IAbapGitLink[]): string | undefined {
  const href = links.find((link) => link.type === 'log_link')?.href;
  if (href === undefined || !href.startsWith(REPOS_PATH)) return undefined;
  const segments = href.slice(REPOS_PATH.length).split('/');
  if (segments.length !== 3) return undefined;
  const [key, log, id] = segments;
  if (!key || log !== 'log' || !id) return undefined;
  if (id.includes('?') || id.includes('#')) return undefined;
  return id;
}

/** R1's entries, read from `abapgitrepo:repositories`; internal to the facts. */
export function repoEntries(
  answer: IAdtWireResponse,
): Array<
  IAbapGitRepoRunState & { package: string; url: string; branchName: string }
> {
  return listOf(field(rootOf(answer, 'repositories'), 'repository')).map(
    (node) => ({
      key: text(node, 'key'),
      package: text(node, 'package'),
      url: text(node, 'url'),
      branchName: text(node, 'branchName'),
      runStatus: textOf(field(node, 'status')),
      statusText: textOf(field(node, 'statusText')),
      appLogKey: appLogKeyOf(linkList(node)),
    }),
  );
}

/**
 * The run state of every repository R1 lists, with absence kept: where
 * `abapGitRepos` answers `status: ''` for an entry without a status (its
 * published contract), this answers `runStatus: undefined`.
 */
export const abapGitRepoRunStates: IResultStrategy<IAbapGitRepoRunState[]> = (
  answer,
) =>
  repoEntries(answer).map(({ key, runStatus, statusText, appLogKey }) => ({
    key,
    runStatus,
    statusText,
    appLogKey,
  }));

/** One object of a link's, pull's or run log's results (R2, R4, R8). */
export interface IAbapGitObjectResult {
  type: string;
  name: string;
  package: string;
  status: string;
  /** SAP's message type: `S`, `I`, `W`, `E` or `A`. */
  msgType: string;
  /** SAP's message text, as it wrote it. */
  msgText: string;
}

/**
 * The object results R2, R4 and R8 answer (`abapObjects:abapObjects`). An empty
 * body is no objects: onprem R4 answers its result table unfilled, cloud R4 a
 * `202` with no document.
 */
export const abapGitObjectResults: IResultStrategy<IAbapGitObjectResult[]> = (
  answer,
) => {
  if (rawOf(answer).trim() === '') return [];
  return listOf(field(rootOf(answer, 'abapObjects'), 'abapObject')).map(
    (node) => ({
      type: text(node, 'type'),
      name: text(node, 'name'),
      package: text(node, 'package'),
      status: text(node, 'status'),
      msgType: text(node, 'msgType'),
      msgText: text(node, 'msgText'),
    }),
  );
};

/** One object R6 lists: its object reference and SAP's action. */
export interface IAbapGitModifiedObjectReading {
  uri: string;
  type: string;
  name: string;
  packageName: string;
  /** `@agitpullmodifiedobjects:action`; `0` when SAP omits it (initial). */
  action: number;
  /** `@agitpullmodifiedobjects:actionDescription`, SAP's text. */
  actionDescription: string | undefined;
}

/** What a pull would overwrite (R6). */
export interface IAbapGitModifiedObjectsReading {
  overwriteObjects: IAbapGitModifiedObjectReading[];
  packageWarningObjects: IAbapGitModifiedObjectReading[];
}

function modifiedObjectsOf(
  container: unknown,
): IAbapGitModifiedObjectReading[] {
  return listOf(field(container, 'abapgitobjects')).map((node) => {
    const written = textOf(field(node, '@action'));
    const action = written === undefined ? 0 : integerOf(written);
    if (action === undefined) throw unreadableAnswer();
    return {
      uri: text(node, '@uri'),
      type: text(node, '@type'),
      name: text(node, '@name'),
      packageName: text(node, '@packageName'),
      action,
      actionDescription: textOf(field(node, '@actionDescription')),
    };
  });
}

/** R6's two lists, read from `agitpullmodifiedobjects:abapgitpullmodifiedobjects`. */
export const abapGitModifiedObjects: IResultStrategy<
  IAbapGitModifiedObjectsReading
> = (answer) => {
  const root = rootOf(answer, 'abapgitpullmodifiedobjects');
  return {
    overwriteObjects: modifiedObjectsOf(field(root, 'overwriteObjects')),
    packageWarningObjects: modifiedObjectsOf(
      field(root, 'packageWarningObjects'),
    ),
  };
};

/** One file of a staged object. */
export interface IAbapGitStagingFileReading {
  name: string;
  path: string;
  localState: string;
  remoteState: string;
  links: IAbapGitLink[];
}

/** One object of R9's staging, with its files, transport and links. */
export interface IAbapGitStagingObjectReading {
  wbkey: string;
  version: string;
  uri: string;
  type: string;
  name: string;
  packageName: string;
  /** Cloud only: the request the object is in. */
  transport: { number: string; links: IAbapGitLink[] } | undefined;
  files: IAbapGitStagingFileReading[];
  links: IAbapGitLink[];
}

/** A person of the staging's comment. */
export interface IAbapGitPerson {
  name: string;
  email: string;
}

/** R9's staging (`abapgitstaging:abapgitstaging`). */
export interface IAbapGitStagingReading {
  unstaged: IAbapGitStagingObjectReading[];
  staged: IAbapGitStagingObjectReading[];
  ignored: IAbapGitStagingObjectReading[];
  /** `abapgit_comment`, absent when SAP writes none. */
  comment:
    | { text: string; author: IAbapGitPerson; committer: IAbapGitPerson }
    | undefined;
  links: IAbapGitLink[];
}

function personOf(node: unknown): IAbapGitPerson {
  return { name: text(node, '@name'), email: text(node, '@email') };
}

function stagingObjectsOf(container: unknown): IAbapGitStagingObjectReading[] {
  return listOf(field(container, 'abapgitobject')).map((node) => {
    const transport = field(node, 'transport');
    return {
      wbkey: text(node, '@wbkey'),
      version: text(node, '@version'),
      uri: text(node, '@uri'),
      type: text(node, '@type'),
      name: text(node, '@name'),
      packageName: text(node, '@packageName'),
      transport:
        transport === undefined
          ? undefined
          : { number: text(transport, 'number'), links: linkList(transport) },
      files: listOf(field(node, 'abapgitfile')).map((file) => ({
        name: text(file, '@name'),
        path: text(file, '@path'),
        localState: text(file, '@localState'),
        remoteState: text(file, '@remoteState'),
        links: linkList(file),
      })),
      links: linkList(node),
    };
  });
}

/** R9's staging, every field SAP sends. */
export const abapGitStaging: IResultStrategy<IAbapGitStagingReading> = (
  answer,
) => {
  const root = rootOf(answer, 'abapgitstaging');
  const comment = field(root, 'abapgit_comment');
  return {
    unstaged: stagingObjectsOf(field(root, 'unstaged_objects')),
    staged: stagingObjectsOf(field(root, 'staged_objects')),
    ignored: stagingObjectsOf(field(root, 'ignored_objects')),
    comment:
      comment === undefined
        ? undefined
        : {
            text: text(comment, '@comment'),
            author: personOf(field(comment, 'author')),
            committer: personOf(field(comment, 'committer')),
          },
    links: linkList(root),
  };
};

/** One branch of an external repository (R13, R14). */
export interface IAbapGitBranchReading {
  /** `sha1` (onprem) or `sha` (cloud), whichever SAP wrote. */
  sha1: string;
  name: string;
  type: string;
  /** SAP-XML boolean: `X` is true. */
  isHead: boolean;
  displayName: string;
  /** R14: `FULL` or `PREFIX`, written in the branch; `undefined` when absent. */
  folderLogic: string | undefined;
  links: IAbapGitLink[];
}

/** R13's and R14's answer (`abapgitexternalrepo:externalRepoInfo`). */
export interface IAbapGitBranchInfoReading {
  accessMode: string;
  branches: IAbapGitBranchReading[];
}

/** An external repository's access mode and branches, every field SAP sends. */
export const abapGitBranchInfo: IResultStrategy<IAbapGitBranchInfoReading> = (
  answer,
) => {
  const root = rootOf(answer, 'externalRepoInfo');
  return {
    accessMode: text(root, 'accessMode'),
    branches: listOf(field(root, 'branch')).map((node) => ({
      sha1: textOf(field(node, 'sha1')) ?? text(node, 'sha'),
      name: text(node, 'name'),
      type: text(node, 'type'),
      isHead: text(node, 'isHead').toUpperCase() === 'X',
      displayName: text(node, 'displayName'),
      folderLogic: textOf(field(node, 'folderLogic')),
      links: linkList(node),
    })),
  };
};
