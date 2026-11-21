import type {
  IAbapGitErrorFacts,
  IAbapGitFactsResponse,
  IAbapGitFileArgs,
  IAbapGitModifiedObject,
  IAbapGitPullSelection,
  IAbapGitStagedObject,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { at, field, listOf } from '../parsed';
import {
  abapGitBranchInfo,
  abapGitModifiedObjects,
  abapGitObjectResults,
  abapGitStaging,
  type IAbapGitBranchReading,
  type IAbapGitModifiedObjectReading,
  type IAbapGitPerson,
  type IAbapGitStagingObjectReading,
  integerOf,
  parsedDocument,
  repoEntries,
  textOf,
  unreadableAnswer,
} from './abapGit';

/**
 * The facts reducer: what an abapGit answer is reduced to before anything —
 * a log line, a tool answer, a background-run record — sees it.
 *
 * Structure and facts only, no redactor (spec §5.3): each route keeps the
 * fields its row names, built field by field from the document, and drops
 * everything else — bodies, headers, status texts, message texts, exception
 * texts, message variables, properties, links. Names, paths, branches and
 * people are the user's and the repository's data and pass as they are; no
 * attempt is made to find a credential in them.
 *
 * `abapGitFacts[route](answer)` reduces a success; `abapGitErrorFacts(answer)`
 * a failure, to its status and T100 key. A success that is not the route's
 * document throws the fixed `ABAPGIT_ERROR_MESSAGES.unreadableAnswer`.
 */

/** R1 (`listReposQuiet`): one repository. */
export interface IAbapGitRepoFacts {
  readonly key: string;
  readonly package: string;
  readonly url: string;
  readonly branchName: string;
  /** `undefined` when the entry carries no status (onprem). */
  readonly runStatus: string | undefined;
  readonly statusText: string | undefined;
  /** From the `log_link` path only. */
  readonly appLogKey: string | undefined;
}

export interface IAbapGitReposFacts {
  readonly repos: readonly IAbapGitRepoFacts[];
}

/** R2, R4 (onprem), R8: one object result; `msgText` is dropped. */
export interface IAbapGitObjectFacts {
  readonly type: string;
  readonly name: string;
  readonly package: string;
  readonly status: string;
  /** SAP's message type: `S`, `I`, `W`, `E` or `A`. */
  readonly messageType: string;
}

export interface IAbapGitObjectsFacts {
  readonly objects: readonly IAbapGitObjectFacts[];
}

/** R6: the selection `pullRepo` takes back unchanged; `@actionDescription` dropped. */
export type IAbapGitModifiedObjectsFacts = IAbapGitPullSelection;

/** R9: links, transports and `@comment` dropped. */
export interface IAbapGitStagingFacts {
  readonly unstaged: readonly IAbapGitStagedObject[];
  readonly staged: readonly IAbapGitStagedObject[];
  readonly ignored: readonly IAbapGitStagedObject[];
  readonly author: IAbapGitPerson;
  readonly committer: IAbapGitPerson;
}

/** R13: one branch; `displayName` and links dropped. */
export interface IAbapGitBranchFacts {
  readonly sha1: string;
  readonly name: string;
  readonly type: string;
  readonly isHead: boolean;
}

export interface IAbapGitExternalRepoFacts {
  readonly accessMode: string;
  readonly branches: readonly IAbapGitBranchFacts[];
}

/** R14: a branch with its folder logic (`FULL` or `PREFIX`; `''` when absent). */
export interface IAbapGitBranchInfoBranchFacts extends IAbapGitBranchFacts {
  readonly folderLogic: string;
}

export interface IAbapGitBranchInfoFacts {
  readonly accessMode: string;
  readonly branches: readonly IAbapGitBranchInfoBranchFacts[];
}

/** R12: the file's content, with the name and version it was asked for. */
export interface IAbapGitFileFacts {
  readonly filename: string;
  readonly version: IAbapGitFileArgs['version'];
  readonly content: string;
}

/** R7: the text SAP answers (a fixed one). */
export interface IAbapGitStatusFacts {
  readonly text: string;
}

/** R5, R10, R11, R15: the status alone. */
export type IAbapGitNoFacts = Readonly<Record<string, never>>;

type Reducer<F> = (answer: IAdtWireResponse) => IAbapGitFactsResponse<F>;

/** One reducer per new-form result slot of `AdtAbapGitClient`. */
export interface IAbapGitFactsReducers {
  /** R1 `listReposQuiet`. */
  readonly reposFacts: Reducer<IAbapGitReposFacts>;
  /** R2, the new form of `link`. */
  readonly linkedFacts: Reducer<IAbapGitObjectsFacts>;
  /** R4 `pullRepo`. */
  readonly repoPulled: Reducer<IAbapGitObjectsFacts>;
  /** R5 `pullRepoInDialog`. */
  readonly repoPulledInDialog: Reducer<IAbapGitNoFacts>;
  /** R6 `getModifiedObjects`. */
  readonly modifiedObjects: Reducer<IAbapGitModifiedObjectsFacts>;
  /** R7 `getStatus`. */
  readonly status: Reducer<IAbapGitStatusFacts>;
  /** R8 `getRunLog`. */
  readonly runLog: Reducer<IAbapGitObjectsFacts>;
  /** R9 `getStaging`. */
  readonly staging: Reducer<IAbapGitStagingFacts>;
  /** R10 `push`. */
  readonly pushed: Reducer<IAbapGitNoFacts>;
  /** R11 `checkRepo`. */
  readonly checked: Reducer<IAbapGitNoFacts>;
  /**
   * R12 `getFile`. The answer names neither the file nor the version, so they
   * come from the call's arguments.
   */
  readonly file: (
    answer: IAdtWireResponse,
    args: Pick<IAbapGitFileArgs, 'filename' | 'version'>,
  ) => IAbapGitFactsResponse<IAbapGitFileFacts>;
  /** R13, the new form of `checkExternalRepo`. */
  readonly externalRepoFacts: Reducer<IAbapGitExternalRepoFacts>;
  /** R14 `getBranchInfo`. */
  readonly branchInfo: Reducer<IAbapGitBranchInfoFacts>;
  /** R15 `switchBranch`. */
  readonly switched: Reducer<IAbapGitNoFacts>;
}

function respond<F>(
  answer: IAdtWireResponse,
  facts: F,
): IAbapGitFactsResponse<F> {
  return { status: answer.status, facts };
}

function objectsFacts(
  answer: IAdtWireResponse,
): IAbapGitFactsResponse<IAbapGitObjectsFacts> {
  return respond(answer, {
    objects: abapGitObjectResults(answer).map((object) => ({
      type: object.type,
      name: object.name,
      package: object.package,
      status: object.status,
      messageType: object.msgType,
    })),
  });
}

function modifiedFacts(
  objects: IAbapGitModifiedObjectReading[],
): IAbapGitModifiedObject[] {
  return objects.map((object) => ({
    uri: object.uri,
    type: object.type,
    name: object.name,
    packageName: object.packageName,
    action: object.action,
  }));
}

function stagedFacts(
  objects: IAbapGitStagingObjectReading[],
): IAbapGitStagedObject[] {
  return objects.map((object) => ({
    wbkey: object.wbkey,
    version: object.version,
    uri: object.uri,
    type: object.type,
    name: object.name,
    packageName: object.packageName,
    files: object.files.map((file) => ({
      name: file.name,
      path: file.path,
      localState: file.localState,
      remoteState: file.remoteState,
    })),
  }));
}

function branchFacts(branch: IAbapGitBranchReading): IAbapGitBranchFacts {
  return {
    sha1: branch.sha1,
    name: branch.name,
    type: branch.type,
    isHead: branch.isHead,
  };
}

const NO_PERSON: IAbapGitPerson = { name: '', email: '' };

/** The one text R7 answers. */
const R7_TEXT = 'DEMO STATUS';

/** The header's value, whatever its letter case; `undefined` when absent. */
function headerOf(answer: IAdtWireResponse, name: string): string | undefined {
  const headers = (answer.headers ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(headers))
    if (key.toLowerCase() === name && typeof value === 'string') return value;
  return undefined;
}

/**
 * R12's body: text, as SAP serves it (`text/plain`). A body that is not a
 * string, or one served as another media type (a sign-in page), is not the
 * file. An absent `Content-Type` is not refused: the text is the file.
 */
function fileText(answer: IAdtWireResponse): string {
  const body = answer.data;
  if (typeof body !== 'string') throw unreadableAnswer();
  const type = headerOf(answer, 'content-type');
  if (type !== undefined && !type.toLowerCase().startsWith('text/plain'))
    throw unreadableAnswer();
  return body;
}

/** `T100KEY-NO`: exactly three digits, as SAP writes it; else not a fact. */
function messageNumberOf(value: string | undefined): string | undefined {
  if (value === undefined || value.length !== 3) return undefined;
  for (const char of value) if (char < '0' || char > '9') return undefined;
  return value;
}

const noFacts: Reducer<IAbapGitNoFacts> = (answer) => respond(answer, {});

/** The facts reducers, one per new-form result slot. */
export const abapGitFacts: IAbapGitFactsReducers = Object.freeze({
  reposFacts: (answer: IAdtWireResponse) =>
    respond(answer, {
      repos: repoEntries(answer).map((entry) => ({
        key: entry.key,
        package: entry.package,
        url: entry.url,
        branchName: entry.branchName,
        runStatus: entry.runStatus,
        statusText: entry.statusText,
        appLogKey: entry.appLogKey,
      })),
    }),
  linkedFacts: objectsFacts,
  repoPulled: objectsFacts,
  repoPulledInDialog: noFacts,
  modifiedObjects: (answer: IAdtWireResponse) => {
    const read = abapGitModifiedObjects(answer);
    return respond(answer, {
      overwriteObjects: modifiedFacts(read.overwriteObjects),
      packageWarningObjects: modifiedFacts(read.packageWarningObjects),
    });
  },
  // R7 answers one fixed text (cloud `RES_REPO_PULL->get` L139); anything
  // else — a sign-in page, an object, another text — is not its answer.
  status: (answer: IAdtWireResponse) => {
    if (answer.data !== R7_TEXT) throw unreadableAnswer();
    return respond(answer, { text: R7_TEXT });
  },
  runLog: objectsFacts,
  staging: (answer: IAdtWireResponse) => {
    const read = abapGitStaging(answer);
    return respond(answer, {
      unstaged: stagedFacts(read.unstaged),
      staged: stagedFacts(read.staged),
      ignored: stagedFacts(read.ignored),
      author: { ...(read.comment?.author ?? NO_PERSON) },
      committer: { ...(read.comment?.committer ?? NO_PERSON) },
    });
  },
  pushed: noFacts,
  checked: noFacts,
  file: (
    answer: IAdtWireResponse,
    args: Pick<IAbapGitFileArgs, 'filename' | 'version'>,
  ) =>
    respond(answer, {
      filename: args.filename,
      version: args.version,
      content: fileText(answer),
    }),
  externalRepoFacts: (answer: IAdtWireResponse) => {
    const read = abapGitBranchInfo(answer);
    return respond(answer, {
      accessMode: read.accessMode,
      branches: read.branches.map(branchFacts),
    });
  },
  branchInfo: (answer: IAdtWireResponse) => {
    const read = abapGitBranchInfo(answer);
    return respond(answer, {
      accessMode: read.accessMode,
      branches: read.branches.map((branch) => ({
        ...branchFacts(branch),
        folderLogic: branch.folderLogic ?? '',
      })),
    });
  },
  switched: noFacts,
});

/**
 * A failed abapGit answer's facts: its status and, from an `exc:exception`
 * document, `T100KEY-ID` / `T100KEY-NO` and R11's `http_status` (an integer,
 * else absent). Nothing else of the document is read; an answer that is no
 * exception document is its status alone.
 */
export function abapGitErrorFacts(
  answer: IAdtWireResponse,
  /**
   * The route's slot. `http_status` is read for R11 (`checked`) alone: only
   * `CL_ABAPGIT_REPOSITORY_AUTH` on the checks route writes it.
   */
  route?: keyof IAbapGitFactsReducers,
): IAbapGitErrorFacts {
  const properties = new Map<string, string>();
  for (const entry of listOf(
    at(field(parsedDocument(answer), 'exception'), 'properties', 'entry'),
  )) {
    const key = textOf(field(entry, '@key'));
    if (key === undefined || properties.has(key)) continue;
    properties.set(key, textOf(entry) ?? '');
  }
  const gitHttpStatus = properties.get('http_status');
  return {
    status: answer.status,
    messageClass: properties.get('T100KEY-ID') || undefined,
    messageNumber: messageNumberOf(properties.get('T100KEY-NO')),
    gitHttpStatus:
      route !== 'checked' || gitHttpStatus === undefined
        ? undefined
        : integerOf(gitHttpStatus),
  };
}
