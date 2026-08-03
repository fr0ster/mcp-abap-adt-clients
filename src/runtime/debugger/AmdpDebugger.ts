import type {
  IAbapConnection,
  IAdtResponse,
  IAmdpDebugger,
  IGetAmdpCellSubstringOptions,
  IGetAmdpDataPreviewOptions,
  ILogger,
  IStartAmdpDebuggerOptions,
} from '@mcp-abap-adt/interfaces';
import {
  getAmdpBreakpoints,
  getAmdpBreakpointsLlang,
  getAmdpBreakpointsTableFunctions,
  getAmdpDebuggee,
  getAmdpVariable,
  lookupAmdp,
  resumeAmdpDebugger,
  setAmdpVariable,
  startAmdpDebugger,
  stepContinueAmdp,
  stepOverAmdp,
  terminateAmdpDebugger,
} from './amdp';
import { getAmdpCellSubstring, getAmdpDataPreview } from './amdpDataPreview';

/**
 * @experimental
 * AMDP debugger domain object — wraps all AMDP debugger and data preview operations.
 */
export class AmdpDebugger implements IAmdpDebugger {
  readonly kind = 'amdpDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async start(options?: IStartAmdpDebuggerOptions): Promise<IAdtResponse> {
    return startAmdpDebugger(this.connection, options);
  }

  async resume(mainId: string): Promise<IAdtResponse> {
    return resumeAmdpDebugger(this.connection, mainId);
  }

  async terminate(mainId: string, hardStop?: boolean): Promise<IAdtResponse> {
    return terminateAmdpDebugger(this.connection, mainId, hardStop);
  }

  async getDebuggee(mainId: string, debuggeeId: string): Promise<IAdtResponse> {
    return getAmdpDebuggee(this.connection, mainId, debuggeeId);
  }

  async getVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<IAdtResponse> {
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
  ): Promise<IAdtResponse> {
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
  ): Promise<IAdtResponse> {
    return lookupAmdp(this.connection, mainId, debuggeeId, name);
  }

  async stepOver(mainId: string, debuggeeId: string): Promise<IAdtResponse> {
    return stepOverAmdp(this.connection, mainId, debuggeeId);
  }

  async stepContinue(
    mainId: string,
    debuggeeId: string,
  ): Promise<IAdtResponse> {
    return stepContinueAmdp(this.connection, mainId, debuggeeId);
  }

  async getBreakpoints(mainId: string): Promise<IAdtResponse> {
    return getAmdpBreakpoints(this.connection, mainId);
  }

  async getBreakpointsLlang(mainId: string): Promise<IAdtResponse> {
    return getAmdpBreakpointsLlang(this.connection, mainId);
  }

  async getBreakpointsTableFunctions(mainId: string): Promise<IAdtResponse> {
    return getAmdpBreakpointsTableFunctions(this.connection, mainId);
  }

  async getDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<IAdtResponse> {
    return getAmdpDataPreview(this.connection, options);
  }

  async getCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<IAdtResponse> {
    return getAmdpCellSubstring(this.connection, options);
  }
}
