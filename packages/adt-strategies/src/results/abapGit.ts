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
 * const git = new AdtAbapGitClient(connection, logger, undefined, {
 *   ...abapGitDocuments,
 *   repos: abapGitRepos,
 * });
 * const repo = (await git.listRepos()).getResult().value.find((r) => r.package === 'ZPKG');
 * await git.getErrorLog(repo.logLink);
 * ```
 *
 * Element names and atom-link types are as the live system answered them when
 * the client was written (its "Phase Z" probe); no recorded answer for these
 * endpoints is in `corpus/adt` yet.
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

function linksOf(repoNode: any): { pullLink?: string; logLink?: string } {
  const out: { pullLink?: string; logLink?: string } = {};
  for (const link of Array.isArray(repoNode?.link) ? repoNode.link : []) {
    const href = asString(link?.href);
    if (!href) continue;
    const type = asString(link?.type);
    if (type === 'pull_link') out.pullLink = href;
    else if (type === 'log_link') out.logLink = href;
  }
  return out;
}

/** The repositories list, one entry per linked repository. */
export const abapGitRepos: IResultStrategy<IAbapGitRepo[]> = (answer) => {
  const parsed = parser.parse(rawOf(answer)) as any;
  const repos = parsed?.repositories?.repository ?? [];
  return (Array.isArray(repos) ? repos : [repos])
    .filter(Boolean)
    .map((node: any) => ({
      package: asString(node?.package),
      url: asString(node?.url),
      branchName: asString(node?.branchName),
      status: asString(node?.status),
      statusText: asString(node?.statusText),
      createdBy: asString(node?.createdBy) || undefined,
      createdAt: asString(node?.createdAt) || undefined,
      repositoryId: asString(node?.key) || undefined,
      ...linksOf(node),
    }));
};

/** A run's error log, one entry per object it reports. */
export const abapGitErrorLog: IResultStrategy<IAbapGitErrorLogEntry[]> = (
  answer,
) => {
  const parsed = parser.parse(rawOf(answer)) as any;
  const items = parsed?.abapObjects?.abapObject ?? [];
  return (Array.isArray(items) ? items : [items])
    .filter(Boolean)
    .map((o: any) => ({
      msgType: asString(o?.msgType),
      objectType: asString(o?.type),
      objectName: asString(o?.name),
      messageText: asString(o?.msgText),
    }));
};

/** An external repository's branches and access mode. */
export const abapGitExternalRepo: IResultStrategy<IAbapGitExternalRepoInfo> = (
  answer,
) => {
  const parsed = parser.parse(rawOf(answer)) as any;
  const root = parsed?.externalRepoInfo ?? {};
  const raw = root?.branch ?? [];
  return {
    branches: (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(
      (b: any): IAbapGitExternalRepoBranch => ({
        name: asString(b?.name),
        sha1: asString(b?.sha1),
        // SAP-XML boolean: 'X' is true, an empty element is false.
        isHead: asString(b?.isHead).toUpperCase() === 'X',
        type: asString(b?.type) || undefined,
      }),
    ),
    accessMode: asString(root?.accessMode) || undefined,
  };
};
