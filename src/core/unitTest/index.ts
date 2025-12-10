/**
 * Unit test operations - exports
 * 
 * All functionality is available through builders.
 * Low-level functions are internal and not exported.
 */

import { IAdtObject, IUnitTestBuilderConfig } from '@mcp-abap-adt/interfaces';

export { ClassUnitTestBuilder, ClassUnitTestBuilderConfig } from './ClassUnitTestBuilder';
export { CdsUnitTestBuilder, CdsUnitTestBuilderConfig } from './CdsUnitTestBuilder';
export { AdtUnitTest } from './AdtUnitTest';

// Type alias for AdtUnitTest
export type AdtUnitTestType = IAdtObject<IUnitTestBuilderConfig, IUnitTestBuilderConfig>;

