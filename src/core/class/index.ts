/**
 * Class operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IClassConfig, IClassState } from './types';

export * from './types';
// Legacy type aliases for backward compatibility
export type IClassBuilderConfig = IClassConfig;
export type IClassBuilderState = IClassState;
export { AdtClass } from './AdtClass';
export { ClassBuilder } from './ClassBuilder';

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
