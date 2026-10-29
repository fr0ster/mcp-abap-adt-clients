import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
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

/**
 * A field of a parsed element, or `undefined` when the value is not an element
 * or has no such field. Parsed XML is data from outside the type system, so it
 * is held as `unknown` and read through this.
 */
function field(node: unknown, key: string): unknown {
  return isElement(node) ? node[key] : undefined;
}

/** A parsed element: what the parser makes of an element with children. */
function isElement(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A value that may be one element or several, as a list. */
function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
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

function linksOf(repoNode: unknown): { pullLink?: string; logLink?: string } {
  const out: { pullLink?: string; logLink?: string } = {};
  const links = field(repoNode, 'link');
  const list: unknown[] = Array.isArray(links) ? links : [];
  for (const link of list) {
    const href = asString(field(link, 'href'));
    if (!href) continue;
    const type = asString(field(link, 'type'));
    if (type === 'pull_link') out.pullLink = href;
    else if (type === 'log_link') out.logLink = href;
  }
  return out;
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
