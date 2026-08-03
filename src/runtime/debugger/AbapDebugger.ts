import type {
  IAbapConnection,
  IAbapDebugger,
  IAbapDebuggerStepMethod,
  IAdtResponse,
  IGetDebuggerOptions,
  IGetSystemAreaOptions,
  IGetVariableAsCsvOptions,
  IGetVariableAsJsonOptions,
  IGetVariableValueStatementOptions,
  ILaunchDebuggerOptions,
  ILogger,
  IStopDebuggerOptions,
} from '@mcp-abap-adt/interfaces';
import {
  buildDebuggerBatchPayload,
  buildDebuggerStepWithStackBatchPayload,
  executeBatchRequest,
  executeDebuggerAction,
  executeDebuggerStepBatch,
  getBreakpointConditions,
  getBreakpointMessageTypes,
  getBreakpointStatements,
  getCallStack,
  getDebugger,
  getMemorySizes,
  getSystemArea,
  getVariableAsCsv,
  getVariableAsJson,
  getVariableMaxLength,
  getVariableSubcomponents,
  getVariableValueStatement,
  getVitBreakpoints,
  getWatchpoints,
  type IDebuggerBatchPayload,
  insertWatchpoint,
  launchDebugger,
  stepContinueDebuggerBatch,
  stepIntoDebuggerBatch,
  stepOutDebuggerBatch,
  stopDebugger,
  synchronizeBreakpoints,
  validateBreakpoints,
} from './abap';

export class AbapDebugger implements IAbapDebugger {
  readonly kind = 'abapDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async launch(options?: ILaunchDebuggerOptions): Promise<IAdtResponse> {
    return launchDebugger(this.connection, options);
  }

  async stop(options?: IStopDebuggerOptions): Promise<IAdtResponse> {
    return stopDebugger(this.connection, options);
  }

  async get(options?: IGetDebuggerOptions): Promise<IAdtResponse> {
    return getDebugger(this.connection, options);
  }

  async getMemorySizes(includeAbap?: boolean): Promise<IAdtResponse> {
    return getMemorySizes(this.connection, includeAbap);
  }

  async getSystemArea(
    systemarea: string,
    options?: IGetSystemAreaOptions,
  ): Promise<IAdtResponse> {
    return getSystemArea(this.connection, systemarea, options);
  }

  async synchronizeBreakpoints(checkConflict?: boolean): Promise<IAdtResponse> {
    return synchronizeBreakpoints(this.connection, checkConflict);
  }

  async getBreakpointStatements(): Promise<IAdtResponse> {
    return getBreakpointStatements(this.connection);
  }

  async getBreakpointMessageTypes(): Promise<IAdtResponse> {
    return getBreakpointMessageTypes(this.connection);
  }

  async getBreakpointConditions(): Promise<IAdtResponse> {
    return getBreakpointConditions(this.connection);
  }

  async validateBreakpoints(): Promise<IAdtResponse> {
    return validateBreakpoints(this.connection);
  }

  async getVitBreakpoints(): Promise<IAdtResponse> {
    return getVitBreakpoints(this.connection);
  }

  async getVariableMaxLength(
    variableName: string,
    part: string,
    maxLength?: number,
  ): Promise<IAdtResponse> {
    return getVariableMaxLength(this.connection, variableName, part, maxLength);
  }

  async getVariableSubcomponents(
    variableName: string,
    part: string,
    component?: string,
    line?: number,
  ): Promise<IAdtResponse> {
    return getVariableSubcomponents(
      this.connection,
      variableName,
      part,
      component,
      line,
    );
  }

  async getVariableAsCsv(
    variableName: string,
    part: string,
    options?: IGetVariableAsCsvOptions,
  ): Promise<IAdtResponse> {
    return getVariableAsCsv(this.connection, variableName, part, options);
  }

  async getVariableAsJson(
    variableName: string,
    part: string,
    options?: IGetVariableAsJsonOptions,
  ): Promise<IAdtResponse> {
    return getVariableAsJson(this.connection, variableName, part, options);
  }

  async getVariableValueStatement(
    variableName: string,
    part: string,
    options?: IGetVariableValueStatementOptions,
  ): Promise<IAdtResponse> {
    return getVariableValueStatement(
      this.connection,
      variableName,
      part,
      options,
    );
  }

  async executeAction(action: string, value?: string): Promise<IAdtResponse> {
    return executeDebuggerAction(this.connection, action, value);
  }

  async getCallStack(): Promise<IAdtResponse> {
    return getCallStack(this.connection);
  }

  async insertWatchpoint(
    variableName: string,
    condition?: string,
  ): Promise<IAdtResponse> {
    return insertWatchpoint(this.connection, variableName, condition);
  }

  async getWatchpoints(): Promise<IAdtResponse> {
    return getWatchpoints(this.connection);
  }

  async executeBatchRequest(requests: string): Promise<IAdtResponse> {
    return executeBatchRequest(this.connection, requests);
  }

  buildBatchPayload(requests: string[]): IDebuggerBatchPayload {
    return buildDebuggerBatchPayload(requests);
  }

  buildStepWithStackBatchPayload(
    stepMethod: IAbapDebuggerStepMethod,
  ): IDebuggerBatchPayload {
    return buildDebuggerStepWithStackBatchPayload(stepMethod);
  }

  async executeStepBatch(
    stepMethod: IAbapDebuggerStepMethod,
  ): Promise<IAdtResponse> {
    return executeDebuggerStepBatch(this.connection, stepMethod);
  }

  async stepIntoBatch(): Promise<IAdtResponse> {
    return stepIntoDebuggerBatch(this.connection);
  }

  async stepOutBatch(): Promise<IAdtResponse> {
    return stepOutDebuggerBatch(this.connection);
  }

  async stepContinueBatch(): Promise<IAdtResponse> {
    return stepContinueDebuggerBatch(this.connection);
  }
}
