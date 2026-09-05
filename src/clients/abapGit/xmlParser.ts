/**
 * XML parsers for abapGit responses.
 *
 * Uses fast-xml-parser (already a project dependency). Namespace
 * prefixes are stripped via removeNSPrefix; elements are indexed by
 * local name only. Element names and atom-link types below reflect
 * Phase Z live-probe findings.
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoBranch,
  IAbapGitExternalRepoInfo,
  IAbapGitRepoStatus,
} from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
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

export interface IRepoEntityAtomLinks {
  pullLink?: string;
  logLink?: string;
  // Phase Z confirmed no edit_link / delete_link is emitted by the server.
  // Delete is performed via DELETE /repos/{key}, not via an atom link.
  // Additional link types (check_link, status_link, stage_link, push_link,
  // modifiedobjects_link) exist but are out of v1 scope.
}

export interface IRepoEntityParsed extends IAbapGitRepoStatus {
  atomLinks: IRepoEntityAtomLinks;
}

function parseAtomLinks(repoNode: any): IRepoEntityAtomLinks {
  const links = Array.isArray(repoNode?.link) ? repoNode.link : [];
  const out: IRepoEntityAtomLinks = {};
  for (const link of links) {
    const type = asString(link?.type);
    const href = asString(link?.href);
    if (!href) continue;
    if (type === 'pull_link') out.pullLink = href;
    else if (type === 'log_link') out.logLink = href;
  }
  return out;
}

function parseRepoEntity(repoNode: any): IRepoEntityParsed {
  return {
    package: asString(repoNode?.package),
    url: asString(repoNode?.url),
    branchName: asString(repoNode?.branchName),
    status: asString(repoNode?.status),
    statusText: asString(repoNode?.statusText),
    createdBy: asString(repoNode?.createdBy) || undefined,
    createdAt: asString(repoNode?.createdAt) || undefined,
    repositoryId: asString(repoNode?.key) || undefined,
    atomLinks: parseAtomLinks(repoNode),
  };
}

export function parseRepoList(xml: string): IRepoEntityParsed[] {
  const parsed = parser.parse(xml) as any;
  // Phase Z confirmed root element name: 'repositories'.
  const repos = parsed?.repositories?.repository ?? [];
  return (Array.isArray(repos) ? repos : [repos])
    .filter(Boolean)
    .map(parseRepoEntity);
}

export function parseErrorLog(xml: string): IAbapGitErrorLogEntry[] {
  const parsed = parser.parse(xml) as any;
  const items = parsed?.abapObjects?.abapObject ?? [];
  return (Array.isArray(items) ? items : [items])
    .filter(Boolean)
    .map((o: any) => ({
      msgType: asString(o?.msgType),
      objectType: asString(o?.type),
      objectName: asString(o?.name),
      messageText: asString(o?.msgText),
    }));
}

export function parseExternalRepoInfo(xml: string): IAbapGitExternalRepoInfo {
  const parsed = parser.parse(xml) as any;
  // Phase Z confirmed root: <abapgitexternalrepo:externalRepoInfo>.
  const root = parsed?.externalRepoInfo ?? {};
  const rawBranches = root?.branch ?? [];
  const branches: IAbapGitExternalRepoBranch[] = (
    Array.isArray(rawBranches) ? rawBranches : [rawBranches]
  )
    .filter(Boolean)
    .map((b: any) => ({
      name: asString(b?.name),
      sha1: asString(b?.sha1),
      // SAP-XML boolean: 'X' = true, empty element = false.
      isHead: String(asString(b?.isHead)).toUpperCase() === 'X',
      type: asString(b?.type) || undefined,
    }));
  return {
    branches,
    accessMode: asString(root?.accessMode) || undefined,
  };
}
