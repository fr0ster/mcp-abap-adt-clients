/**
 * Unit test operations - exports
 *
 * All functionality is available through Adt* classes.
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IUnitTestConfig, IUnitTestState } from './types';

export type { ICdsUnitTestConfig, ICdsUnitTestState } from './AdtCdsUnitTest';
export { AdtCdsUnitTest } from './AdtCdsUnitTest';
export { AdtUnitTest } from './AdtUnitTest';
export { AdtUnitTestLegacy } from './AdtUnitTestLegacy';
export {
  buildUnitTestObjectUri,
  parseUnitTestRunResult,
  startObjectUnitTestRunSync,
} from './run';
export type {
  IUnitTestConfig,
  IUnitTestRunSyncOptions,
  IUnitTestState,
  IUnitTestSummary,
  UnitTestObjectType,
  UnitTestRunScope,
} from './types';

// Type alias for AdtUnitTest
export type AdtUnitTestType = IAdtObject<IUnitTestConfig, IUnitTestState>;
