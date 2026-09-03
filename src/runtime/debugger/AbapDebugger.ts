import type {
  IAbapConnection,
  IAbapDebugger,
  IAbapDebuggerStepMethod,
  IAdtWireResponse,
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

  async launch(options?: ILaunchDebuggerOptions): Promise<IAdtWireResponse> {
    return launchDebugger(this.connection, options);
  }

  async stop(options?: IStopDebuggerOptions): Promise<IAdtWireResponse> {
    return stopDebugger(this.connection, options);
  }

  async get(options?: IGetDebuggerOptions): Promise<IAdtWireResponse> {
    return getDebugger(this.connection, options);
  }

  async getMemorySizes(includeAbap?: boolean): Promise<IAdtWireResponse> {
    return getMemorySizes(this.connection, includeAbap);
  }

  async getSystemArea(
    systemarea: string,
    options?: IGetSystemAreaOptions,
  ): Promise<IAdtWireResponse> {
    return getSystemArea(this.connection, systemarea, options);
  }

  async synchronizeBreakpoints(
    checkConflict?: boolean,
  ): Promise<IAdtWireResponse> {
    return synchronizeBreakpoints(this.connection, checkConflict);
  }

  async getBreakpointStatements(): Promise<IAdtWireResponse> {
    return getBreakpointStatements(this.connection);
  }

  async getBreakpointMessageTypes(): Promise<IAdtWireResponse> {
    return getBreakpointMessageTypes(this.connection);
  }

  async getBreakpointConditions(): Promise<IAdtWireResponse> {
    return getBreakpointConditions(this.connection);
  }

  async validateBreakpoints(): Promise<IAdtWireResponse> {
    return validateBreakpoints(this.connection);
  }

  async getVitBreakpoints(): Promise<IAdtWireResponse> {
    return getVitBreakpoints(this.connection);
  }

  async getVariableMaxLength(
    variableName: string,
    part: string,
    maxLength?: number,
  ): Promise<IAdtWireResponse> {
    return getVariableMaxLength(this.connection, variableName, part, maxLength);
  }

  async getVariableSubcomponents(
    variableName: string,
    part: string,
    component?: string,
    line?: number,
  ): Promise<IAdtWireResponse> {
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
  ): Promise<IAdtWireResponse> {
    return getVariableAsCsv(this.connection, variableName, part, options);
  }

  async getVariableAsJson(
    variableName: string,
    part: string,
    options?: IGetVariableAsJsonOptions,
  ): Promise<IAdtWireResponse> {
    return getVariableAsJson(this.connection, variableName, part, options);
  }

  async getVariableValueStatement(
    variableName: string,
    part: string,
    options?: IGetVariableValueStatementOptions,
  ): Promise<IAdtWireResponse> {
    return getVariableValueStatement(
      this.connection,
      variableName,
      part,
      options,
    );
  }

  async executeAction(
    action: string,
    value?: string,
  ): Promise<IAdtWireResponse> {
    return executeDebuggerAction(this.connection, action, value);
  }

  async getCallStack(): Promise<IAdtWireResponse> {
    return getCallStack(this.connection);
  }

  async insertWatchpoint(
    variableName: string,
    condition?: string,
  ): Promise<IAdtWireResponse> {
    return insertWatchpoint(this.connection, variableName, condition);
  }

  async getWatchpoints(): Promise<IAdtWireResponse> {
    return getWatchpoints(this.connection);
  }

  async executeBatchRequest(requests: string): Promise<IAdtWireResponse> {
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
  ): Promise<IAdtWireResponse> {
    return executeDebuggerStepBatch(this.connection, stepMethod);
  }

  async stepIntoBatch(): Promise<IAdtWireResponse> {
    return stepIntoDebuggerBatch(this.connection);
  }

  async stepOutBatch(): Promise<IAdtWireResponse> {
    return stepOutDebuggerBatch(this.connection);
  }

  async stepContinueBatch(): Promise<IAdtWireResponse> {
    return stepContinueDebuggerBatch(this.connection);
  }
}
