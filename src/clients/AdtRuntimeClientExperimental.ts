/**
 * AdtRuntimeClientExperimental
 *
 * Experimental runtime APIs that are still in progress and may change.
 * Current scope:
 * - AMDP debugger APIs
 * - AMDP debugger data preview APIs
 */

import type { IAdtResponse as AxiosResponse } from '@mcp-abap-adt/interfaces';
import {
  getAmdpBreakpointsLlang as getAmdpBreakpointsLlangUtil,
  getAmdpBreakpointsTableFunctions as getAmdpBreakpointsTableFunctionsUtil,
  getAmdpBreakpoints as getAmdpBreakpointsUtil,
  getAmdpDebuggee as getAmdpDebuggeeUtil,
  getAmdpVariable as getAmdpVariableUtil,
  type IStartAmdpDebuggerOptions,
  lookupAmdp as lookupAmdpUtil,
  resumeAmdpDebugger as resumeAmdpDebuggerUtil,
  setAmdpVariable as setAmdpVariableUtil,
  startAmdpDebugger as startAmdpDebuggerUtil,
  stepContinueAmdp as stepContinueAmdpUtil,
  stepOverAmdp as stepOverAmdpUtil,
  terminateAmdpDebugger as terminateAmdpDebuggerUtil,
} from '../runtime/debugger/amdp';
import {
  getAmdpCellSubstring as getAmdpCellSubstringUtil,
  getAmdpDataPreview as getAmdpDataPreviewUtil,
  type IGetAmdpCellSubstringOptions,
  type IGetAmdpDataPreviewOptions,
} from '../runtime/debugger/amdpDataPreview';
import { AdtRuntimeClient } from './AdtRuntimeClient';

export type {
  IStartAmdpDebuggerOptions,
  IGetAmdpCellSubstringOptions,
  IGetAmdpDataPreviewOptions,
};

/**
 * @experimental
 * AMDP runtime APIs are in progress and not finalized yet.
 */
export class AdtRuntimeClientExperimental extends AdtRuntimeClient {
  /**
   * Start AMDP debugger session.
   */
  async startAmdpDebugger(
    options?: IStartAmdpDebuggerOptions,
  ): Promise<AxiosResponse> {
    return startAmdpDebuggerUtil(this.connection, options);
  }

  /**
   * Resume AMDP debugger session.
   */
  async resumeAmdpDebugger(mainId: string): Promise<AxiosResponse> {
    return resumeAmdpDebuggerUtil(this.connection, mainId);
  }

  /**
   * Terminate AMDP debugger session.
   */
  async terminateAmdpDebugger(
    mainId: string,
    hardStop?: boolean,
  ): Promise<AxiosResponse> {
    return terminateAmdpDebuggerUtil(this.connection, mainId, hardStop);
  }

  /**
   * Get AMDP debuggee information.
   */
  async getAmdpDebuggee(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return getAmdpDebuggeeUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Get AMDP variable value.
   */
  async getAmdpVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<AxiosResponse> {
    return getAmdpVariableUtil(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      offset,
      length,
    );
  }

  /**
   * Set AMDP variable value.
   */
  async setAmdpVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    setNull?: boolean,
  ): Promise<AxiosResponse> {
    return setAmdpVariableUtil(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      setNull,
    );
  }

  /**
   * Lookup objects/variables in AMDP debugger.
   */
  async lookupAmdp(
    mainId: string,
    debuggeeId: string,
    name?: string,
  ): Promise<AxiosResponse> {
    return lookupAmdpUtil(this.connection, mainId, debuggeeId, name);
  }

  /**
   * Step over in AMDP debugger.
   */
  async stepOverAmdp(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepOverAmdpUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Continue execution in AMDP debugger.
   */
  async stepContinueAmdp(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepContinueAmdpUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Get AMDP breakpoints.
   */
  async getAmdpBreakpoints(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsUtil(this.connection, mainId);
  }

  /**
   * Get AMDP breakpoints for LLang.
   */
  async getAmdpBreakpointsLlang(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsLlangUtil(this.connection, mainId);
  }

  /**
   * Get AMDP breakpoints for table functions.
   */
  async getAmdpBreakpointsTableFunctions(
    mainId: string,
  ): Promise<AxiosResponse> {
    return getAmdpBreakpointsTableFunctionsUtil(this.connection, mainId);
  }

  /**
   * Get AMDP debugger data preview.
   */
  async getAmdpDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<AxiosResponse> {
    return getAmdpDataPreviewUtil(this.connection, options);
  }

  /**
   * Get cell substring from AMDP debugger data preview.
   */
  async getAmdpCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<AxiosResponse> {
    return getAmdpCellSubstringUtil(this.connection, options);
  }
}
