/**
 * Unit test module type definitions.
 *
 * Managing a class's tests and running them are two different things, and the
 * result set says so: `created`/`source`/`updated`/`deleted` are the container
 * class and its include, while `run`/`status`/`result` are a run.
 */

import type {
  IAdtWireResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { headerValueToString } from '../../utils/internalUtils';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICdsUnitTestConfig,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestConfig,
} from '@mcp-abap-adt/interfaces';

/**
 * The id of a started run, read out of the answer.
 *
 * ADT does not put it in the body in any one place: the `Location`,
 * `Content-Location` or `sap-adt-location` header carries it, and the body's
 * `aunit:run@uri` carries it when none of them does. This is the reading that
 * knows all four, and it is a strategy rather than a private helper because a
 * run's id is what `run` answers — a consumer who wants the whole document
 * supplies `rawDocument` instead.
 */
export const runId: IResultStrategy<string> = (answer: IAdtWireResponse) => {
  const fromHeader =
    headerValueToString(answer.headers?.location) ||
    headerValueToString(answer.headers?.['content-location']) ||
    headerValueToString(answer.headers?.['sap-adt-location']);
  const inHeader = /\/runs\/([^/]+)/.exec(fromHeader ?? '');
  if (inHeader) return inHeader[1];

  const data = answer.data;
  if (typeof data === 'string') {
    const uri =
      /<aunit:run[^>]*uri="([^"]+)"/.exec(data)?.[1] ??
      /uri="([^"]+)"/.exec(data)?.[1];
    const inBody = /\/runs\/([^/]+)/.exec(uri ?? '');
    if (inBody) return inBody[1];
  } else if ((data as { uri?: string })?.uri) {
    const inObject = /\/runs\/([^/]+)/.exec((data as { uri: string }).uri);
    if (inObject) return inObject[1];
  }

  // Empty rather than a guess. Whether an id-less answer is a failure is the
  // error strategy's question — see `startedRun` in AdtUnitTest.
  return '';
};

/** One strategy per member of a unit-test implementation. */
export interface IUnitTestResults<
  TCreated = string,
  TSource = string,
  TMetadata = string,
  TValidation = string,
  TUpdated = string,
  TDeleted = string,
  TRun = string,
  TStatus = string,
  TResult = string,
  TCdsCheck = string,
> {
  /** The container class's create. */
  readonly created: IResultStrategy<TCreated>;
  /** The `testclasses` include, read whole. */
  readonly source: IResultStrategy<TSource>;
  /** The container class's metadata — an include carries none of its own. */
  readonly metadata: IResultStrategy<TMetadata>;
  /** What a name check or a source check answers. */
  readonly validation: IResultStrategy<TValidation>;
  /** What writing the include answers. */
  readonly updated: IResultStrategy<TUpdated>;
  /** What emptying the include answers. */
  readonly deleted: IResultStrategy<TDeleted>;
  /** What starting a run answers — its id, by default. */
  readonly run: IResultStrategy<TRun>;
  /** What polling a run answers. */
  readonly status: IResultStrategy<TStatus>;
  /** What a finished run's result document answers. */
  readonly result: IResultStrategy<TResult>;
  /** What the CDS test-doubles check answers. */
  readonly cdsCheck: IResultStrategy<TCdsCheck>;
}

/**
 * The shipped default: documents as they arrived, and a run's id for `run`.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const unitTestDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  validation: rawDocument,
  updated: rawDocument,
  deleted: rawDocument,
  run: runId,
  status: rawDocument,
  result: rawDocument,
  cdsCheck: rawDocument,
} satisfies IUnitTestResults;
