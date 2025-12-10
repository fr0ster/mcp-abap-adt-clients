/**
 * Unit test operations - exports
 * 
 * All functionality is available through builders.
 * Low-level functions are internal and not exported.
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IUnitTestConfig, IUnitTestState } from './types';

export { ClassUnitTestBuilder, ClassUnitTestBuilderConfig } from './ClassUnitTestBuilder';
export { CdsUnitTestBuilder, CdsUnitTestBuilderConfig } from './CdsUnitTestBuilder';
export { AdtUnitTest } from './AdtUnitTest';
export type { IUnitTestConfig, IUnitTestState } from './types';

// Type alias for AdtUnitTest
export type AdtUnitTestType = IAdtObject<IUnitTestConfig, IUnitTestState>;

