/**
 * ATC (ABAP Test Cockpit) operations - exports
 *
 * All functionality is available through the AdtAtc class.
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IAtcConfig, IAtcState } from './types';

export { AdtAtc } from './AdtAtc';
export type { IAtcPollOptions } from './AdtAtc';
export {
  buildAtcObjectUri,
  createAtcWorklist,
  extractAtcRunId,
  extractAtcWorklistId,
  getAtcCustomizing,
  getAtcRunStatus,
  getAtcWorklistFindings,
  listAtcVariants,
  parseSystemDefaultVariant,
  startAtcRun,
} from './run';
export type {
  AtcFindingsFormat,
  AtcObjectType,
  IAtcConfig,
  IAtcFindingsOptions,
  IAtcListVariantsOptions,
  IAtcRunOptions,
  IAtcState,
} from './types';

export type AdtAtcType = IAdtObject<IAtcConfig, IAtcState>;
