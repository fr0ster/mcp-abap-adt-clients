/**
 * Unit test operations - exports
 *
 * All functionality is available through builders.
 * Low-level functions are internal and not exported.
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IUnitTestConfig, IUnitTestState } from './types';

export type { ICdsUnitTestConfig, ICdsUnitTestState } from './AdtCdsUnitTest';
export { AdtCdsUnitTest } from './AdtCdsUnitTest';
export { AdtUnitTest } from './AdtUnitTest';
export {
  CdsUnitTestBuilder,
  CdsUnitTestBuilderConfig,
} from './CdsUnitTestBuilder';
export {
  ClassUnitTestBuilder,
  ClassUnitTestBuilderConfig,
} from './ClassUnitTestBuilder';
export type { IUnitTestConfig, IUnitTestState } from './types';

// Type alias for AdtUnitTest
export type AdtUnitTestType = IAdtObject<IUnitTestConfig, IUnitTestState>;
