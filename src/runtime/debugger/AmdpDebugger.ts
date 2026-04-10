import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getAmdpBreakpoints,
  getAmdpBreakpointsLlang,
  getAmdpBreakpointsTableFunctions,
  getAmdpDebuggee,
  getAmdpVariable,
  type IStartAmdpDebuggerOptions,
  lookupAmdp,
  resumeAmdpDebugger,
  setAmdpVariable,
  startAmdpDebugger,
  stepContinueAmdp,
  stepOverAmdp,
  terminateAmdpDebugger,
} from './amdp';
import {
  getAmdpCellSubstring,
  getAmdpDataPreview,
  type IGetAmdpCellSubstringOptions,
  type IGetAmdpDataPreviewOptions,
} from './amdpDataPreview';

/**
 * @experimental
 * AMDP debugger domain object — wraps all AMDP debugger and data preview operations.
 */
export class AmdpDebugger implements IRuntimeAnalysisObject {
  readonly kind = 'amdpDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async start(options?: IStartAmdpDebuggerOptions): Promise<AxiosResponse> {
    return startAmdpDebugger(this.connection, options);
  }

  async resume(mainId: string): Promise<AxiosResponse> {
    return resumeAmdpDebugger(this.connection, mainId);
  }

  async terminate(mainId: string, hardStop?: boolean): Promise<AxiosResponse> {
    return terminateAmdpDebugger(this.connection, mainId, hardStop);
  }

  async getDebuggee(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return getAmdpDebuggee(this.connection, mainId, debuggeeId);
  }

  async getVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<AxiosResponse> {
    return getAmdpVariable(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      offset,
      length,
    );
  }

  async setVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    setNull?: boolean,
  ): Promise<AxiosResponse> {
    return setAmdpVariable(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      setNull,
    );
  }

  async lookup(
    mainId: string,
    debuggeeId: string,
    name?: string,
  ): Promise<AxiosResponse> {
    return lookupAmdp(this.connection, mainId, debuggeeId, name);
  }

  async stepOver(mainId: string, debuggeeId: string): Promise<AxiosResponse> {
    return stepOverAmdp(this.connection, mainId, debuggeeId);
  }

  async stepContinue(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepContinueAmdp(this.connection, mainId, debuggeeId);
  }

  async getBreakpoints(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpoints(this.connection, mainId);
  }

  async getBreakpointsLlang(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsLlang(this.connection, mainId);
  }

  async getBreakpointsTableFunctions(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsTableFunctions(this.connection, mainId);
  }

  async getDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<AxiosResponse> {
    return getAmdpDataPreview(this.connection, options);
  }

  async getCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<AxiosResponse> {
    return getAmdpCellSubstring(this.connection, options);
  }
}
