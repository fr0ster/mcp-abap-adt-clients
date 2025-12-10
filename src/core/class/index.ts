/**
 * Class operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IClassConfig, IClassState } from './types';

export * from './types';
// Legacy type aliases for backward compatibility
export type IClassBuilderConfig = IClassConfig;
export type IClassBuilderState = IClassState;
export { ClassBuilder } from './ClassBuilder';
export { AdtClass } from './AdtClass';

// Type alias for AdtClass
export type AdtClassType = IAdtObject<IClassConfig, IClassState>;
export { AdtLocalTestClass, type ILocalTestClassConfig } from './AdtLocalTestClass';
export { AdtLocalTypes, type ILocalTypesConfig } from './AdtLocalTypes';
export { AdtLocalDefinitions, type ILocalDefinitionsConfig } from './AdtLocalDefinitions';
export { AdtLocalMacros, type ILocalMacrosConfig } from './AdtLocalMacros';
export {
  startClassUnitTestRun,
  startClassUnitTestRunByObject,
  getClassUnitTestStatus,
  getClassUnitTestResult,
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions
} from './run';
