import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
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
  type IAbapDebuggerStepMethod,
  type IDebuggerBatchPayload,
  type IGetDebuggerOptions,
  type IGetSystemAreaOptions,
  type IGetVariableAsCsvOptions,
  type IGetVariableAsJsonOptions,
  type IGetVariableValueStatementOptions,
  type ILaunchDebuggerOptions,
  type IStopDebuggerOptions,
  insertWatchpoint,
  launchDebugger,
  stepContinueDebuggerBatch,
  stepIntoDebuggerBatch,
  stepOutDebuggerBatch,
  stopDebugger,
  synchronizeBreakpoints,
  validateBreakpoints,
} from './abap';

export class AbapDebugger implements IRuntimeAnalysisObject {
  readonly kind = 'abapDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async launch(options?: ILaunchDebuggerOptions): Promise<AxiosResponse> {
    return launchDebugger(this.connection, options);
  }

  async stop(options?: IStopDebuggerOptions): Promise<AxiosResponse> {
    return stopDebugger(this.connection, options);
  }

  async get(options?: IGetDebuggerOptions): Promise<AxiosResponse> {
    return getDebugger(this.connection, options);
  }

  async getMemorySizes(includeAbap?: boolean): Promise<AxiosResponse> {
    return getMemorySizes(this.connection, includeAbap);
  }

  async getSystemArea(
    systemarea: string,
    options?: IGetSystemAreaOptions,
  ): Promise<AxiosResponse> {
    return getSystemArea(this.connection, systemarea, options);
  }

  async synchronizeBreakpoints(
    checkConflict?: boolean,
  ): Promise<AxiosResponse> {
    return synchronizeBreakpoints(this.connection, checkConflict);
  }

  async getBreakpointStatements(): Promise<AxiosResponse> {
    return getBreakpointStatements(this.connection);
  }

  async getBreakpointMessageTypes(): Promise<AxiosResponse> {
    return getBreakpointMessageTypes(this.connection);
  }

  async getBreakpointConditions(): Promise<AxiosResponse> {
    return getBreakpointConditions(this.connection);
  }

  async validateBreakpoints(): Promise<AxiosResponse> {
    return validateBreakpoints(this.connection);
  }

  async getVitBreakpoints(): Promise<AxiosResponse> {
    return getVitBreakpoints(this.connection);
  }

  async getVariableMaxLength(
    variableName: string,
    part: string,
    maxLength?: number,
  ): Promise<AxiosResponse> {
    return getVariableMaxLength(this.connection, variableName, part, maxLength);
  }

  async getVariableSubcomponents(
    variableName: string,
    part: string,
    component?: string,
    line?: number,
  ): Promise<AxiosResponse> {
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
  ): Promise<AxiosResponse> {
    return getVariableAsCsv(this.connection, variableName, part, options);
  }

  async getVariableAsJson(
    variableName: string,
    part: string,
    options?: IGetVariableAsJsonOptions,
  ): Promise<AxiosResponse> {
    return getVariableAsJson(this.connection, variableName, part, options);
  }

  async getVariableValueStatement(
    variableName: string,
    part: string,
    options?: IGetVariableValueStatementOptions,
  ): Promise<AxiosResponse> {
    return getVariableValueStatement(
      this.connection,
      variableName,
      part,
      options,
    );
  }

  async executeAction(action: string, value?: string): Promise<AxiosResponse> {
    return executeDebuggerAction(this.connection, action, value);
  }

  async getCallStack(): Promise<AxiosResponse> {
    return getCallStack(this.connection);
  }

  async insertWatchpoint(
    variableName: string,
    condition?: string,
  ): Promise<AxiosResponse> {
    return insertWatchpoint(this.connection, variableName, condition);
  }

  async getWatchpoints(): Promise<AxiosResponse> {
    return getWatchpoints(this.connection);
  }

  async executeBatchRequest(requests: string): Promise<AxiosResponse> {
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
  ): Promise<AxiosResponse> {
    return executeDebuggerStepBatch(this.connection, stepMethod);
  }

  async stepIntoBatch(): Promise<AxiosResponse> {
    return stepIntoDebuggerBatch(this.connection);
  }

  async stepOutBatch(): Promise<AxiosResponse> {
    return stepOutDebuggerBatch(this.connection);
  }

  async stepContinueBatch(): Promise<AxiosResponse> {
    return stepContinueDebuggerBatch(this.connection);
  }
}
