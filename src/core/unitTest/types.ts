/**
 * Unit test module type definitions.
 *
 * Managing a class's tests and running them are two different things, and the
 * result set says so: `created`/`source`/`updated`/`deleted` are the container
 * class and its include, while `run`/`status`/`result` are a run.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICdsUnitTestConfig,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestConfig,
} from '@mcp-abap-adt/interfaces-adt';

/** One strategy per member of a unit-test implementation. */
export interface IUnitTestResults {
  /** The container class's create. */
  readonly created: IResultStrategy<unknown>;
  /** The `testclasses` include, read whole. */
  readonly source: IResultStrategy<unknown>;
  /** The container class's metadata — an include carries none of its own. */
  readonly metadata: IResultStrategy<unknown>;
  /** What a name check or a source check answers. */
  readonly validation: IResultStrategy<unknown>;
  /** What writing the include answers. */
  readonly updated: IResultStrategy<unknown>;
  /** What emptying the include answers. */
  readonly deleted: IResultStrategy<unknown>;
  /** What starting a run answers. `unitTestRunId` in adt-strategies reads the id. */
  readonly run: IResultStrategy<unknown>;
  /** What polling a run answers. */
  readonly status: IResultStrategy<unknown>;
  /** What a finished run's result document answers. */
  readonly result: IResultStrategy<unknown>;
  /** What the CDS test-doubles check answers. */
  readonly cdsCheck: IResultStrategy<unknown>;
}

/**
 * The shipped default: documents as they arrived. A run's id is in a header of
 * the start's answer, not its body, so a caller who wants it passes
 * `unitTestRunId` from @mcp-abap-adt/adt-strategies for `run`.
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
  run: rawDocument,
  status: rawDocument,
  result: rawDocument,
  cdsCheck: rawDocument,
} satisfies IUnitTestResults;
