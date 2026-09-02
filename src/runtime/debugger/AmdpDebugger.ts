import type {
  IAbapConnection,
  IAdtWireResponse,
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

  async start(options?: IStartAmdpDebuggerOptions): Promise<IAdtWireResponse> {
    return startAmdpDebugger(this.connection, options);
  }

  async resume(mainId: string): Promise<IAdtWireResponse> {
    return resumeAmdpDebugger(this.connection, mainId);
  }

  async terminate(
    mainId: string,
    hardStop?: boolean,
  ): Promise<IAdtWireResponse> {
    return terminateAmdpDebugger(this.connection, mainId, hardStop);
  }

  async getDebuggee(
    mainId: string,
    debuggeeId: string,
  ): Promise<IAdtWireResponse> {
    return getAmdpDebuggee(this.connection, mainId, debuggeeId);
  }

  async getVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<IAdtWireResponse> {
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
  ): Promise<IAdtWireResponse> {
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
  ): Promise<IAdtWireResponse> {
    return lookupAmdp(this.connection, mainId, debuggeeId, name);
  }

  async stepOver(
    mainId: string,
    debuggeeId: string,
  ): Promise<IAdtWireResponse> {
    return stepOverAmdp(this.connection, mainId, debuggeeId);
  }

  async stepContinue(
    mainId: string,
    debuggeeId: string,
  ): Promise<IAdtWireResponse> {
    return stepContinueAmdp(this.connection, mainId, debuggeeId);
  }

  async getBreakpoints(mainId: string): Promise<IAdtWireResponse> {
    return getAmdpBreakpoints(this.connection, mainId);
  }

  async getBreakpointsLlang(mainId: string): Promise<IAdtWireResponse> {
    return getAmdpBreakpointsLlang(this.connection, mainId);
  }

  async getBreakpointsTableFunctions(
    mainId: string,
  ): Promise<IAdtWireResponse> {
    return getAmdpBreakpointsTableFunctions(this.connection, mainId);
  }

  async getDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<IAdtWireResponse> {
    return getAmdpDataPreview(this.connection, options);
  }

  async getCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<IAdtWireResponse> {
    return getAmdpCellSubstring(this.connection, options);
  }
}
