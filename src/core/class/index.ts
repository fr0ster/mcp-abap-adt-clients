/**
 * Class operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IClassConfig, IClassState } from './types';

export { AdtClass } from './AdtClass';
export * from './types';

// Type alias for AdtClass
export type AdtClassType = IAdtObject<IClassConfig, IClassState>;
export {
  AdtLocalDefinitions,
  type ILocalDefinitionsConfig,
} from './AdtLocalDefinitions';
export { AdtLocalMacros, type ILocalMacrosConfig } from './AdtLocalMacros';
export {
  AdtLocalTestClass,
  type ILocalTestClassConfig,
} from './AdtLocalTestClass';
export { AdtLocalTypes, type ILocalTypesConfig } from './AdtLocalTypes';
export {
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions,
  getClassUnitTestResult,
  getClassUnitTestStatus,
  startClassUnitTestRun,
  startClassUnitTestRunByObject,
} from './run';
