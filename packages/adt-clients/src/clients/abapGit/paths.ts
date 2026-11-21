/**
 * The one place an abapGit repository's address is built.
 *
 * Every member addressed by a repository builds its path from the key the
 * caller passes, one encoded segment at a time, and no member takes a URL to
 * send to. The two that still take a link (`pull`, `getErrorLog`, deprecated)
 * take it apart here, decode its segments and rebuild it through the same
 * builder, so what they send is what a key would have built; anything else is
 * refused before a request exists.
 *
 * Plain string code, no regular expression: the link is the caller's input,
 * and the checks are a fixed prefix, no `?` or `#`, and a segment count.
 */

/** Where every abapGit route lives. */
export const ABAPGIT_ROOT = '/sap/bc/adt/abapgit';
/** R1, R2: the repository list, and a new link. */
export const ABAPGIT_REPOS = `${ABAPGIT_ROOT}/repos`;
/** R13: an external repository, before anything is linked to it. */
export const ABAPGIT_EXTERNAL_REPO_INFO = `${ABAPGIT_ROOT}/externalrepoinfo`;
/** R14: one branch of an external repository, for a package. */
export const ABAPGIT_BRANCH_INFO = `${ABAPGIT_EXTERNAL_REPO_INFO}/branchinfo`;

/** The refusal of a segment no path may hold. */
export const SEGMENT_REFUSED =
  'abapGit: a repository key or path segment is empty, "." or ".."; nothing was sent';

/** The refusal of a link the deprecated members do not send to. */
export const LINK_REFUSED =
  'abapGit: the link is not a repository path this client sends to; nothing was sent';

/**
 * One segment, encoded. Empty, `.` and `..` are refused: an HTTP client
 * resolves dot segments (`/repos/./pull` reaches `/repos/pull`), and an empty
 * one changes which route answers.
 */
function segment(value: string): string {
  if (value === '' || value === '.' || value === '..')
    throw new Error(SEGMENT_REFUSED);
  return encodeURIComponent(value);
}

/** `/sap/bc/adt/abapgit/repos/{key}/{segments…}`, each segment encoded. */
export function repoPath(key: string, ...segments: string[]): string {
  return [ABAPGIT_REPOS, segment(key), ...segments.map(segment)].join('/');
}

/** A segment of a link, decoded; `undefined` when it is no valid escape. */
function decoded(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/**
 * A link's segments after the repository list, decoded, when it is exactly
 * `/sap/bc/adt/abapgit/repos/…` with no query and no fragment.
 */
function linkSegments(link: string): string[] {
  const prefix = `${ABAPGIT_REPOS}/`;
  if (!link.startsWith(prefix) || link.includes('?') || link.includes('#'))
    throw new Error(LINK_REFUSED);
  const parts: string[] = [];
  for (const part of link.slice(prefix.length).split('/')) {
    const value = decoded(part);
    if (value === undefined || value === '' || value === '.' || value === '..')
      throw new Error(LINK_REFUSED);
    parts.push(value);
  }
  return parts;
}

/** `pull`'s link: exactly `/sap/bc/adt/abapgit/repos/{key}/pull`, rebuilt. */
export function pullLinkPath(link: string): string {
  const parts = linkSegments(link);
  const [key, tail] = parts;
  if (parts.length !== 2 || key === undefined || tail !== 'pull')
    throw new Error(LINK_REFUSED);
  return repoPath(key, 'pull');
}

/** `getErrorLog`'s link: exactly `/sap/bc/adt/abapgit/repos/{key}/log/{id}`, rebuilt. */
export function logLinkPath(link: string): string {
  const parts = linkSegments(link);
  const [key, tail, id] = parts;
  if (
    parts.length !== 3 ||
    key === undefined ||
    tail !== 'log' ||
    id === undefined
  )
    throw new Error(LINK_REFUSED);
  return repoPath(key, 'log', id);
}
