/**
 * ABAP Debugger (Standard)
 *
 * Provides functions for managing ABAP debugger sessions:
 * - Debugger listeners (launch, stop, get)
 * - Memory sizes
 * - System areas
 * - Breakpoints (synchronize, statements, message types, conditions, validation, VIT)
 * - Variables (max length, subcomponents, CSV, JSON, value statement)
 * - Actions (execute debugger actions)
 * - Call stack
 * - Watchpoints (insert, get)
 * - Batch requests
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  createBatchBoundary,
  createRequestId,
} from '../../batch/buildBatchPayload';
import { getTimeout } from '../../utils/timeouts';

/**
 * Launch debugger
 *
 * @param connection - ABAP connection
 * @param options - Debugger launch options
 * @returns Axios response with debugger session
 */
export interface ILaunchDebuggerOptions {
  debuggingMode?: string;
  requestUser?: string;
  terminalId?: string;
  ideId?: string;
  timeout?: number;
  checkConflict?: boolean;
  isNotifiedOnConflict?: boolean;
}

export async function launchDebugger(
  connection: IAbapConnection,
  options?: ILaunchDebuggerOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/listeners`;
  const params: Record<string, any> = {};

  if (options?.debuggingMode) params.debuggingMode = options.debuggingMode;
  if (options?.requestUser) params.requestUser = options.requestUser;
  if (options?.terminalId) params.terminalId = options.terminalId;
  if (options?.ideId) params.ideId = options.ideId;
  if (options?.timeout !== undefined) params.timeout = options.timeout;
  if (options?.checkConflict !== undefined)
    params.checkConflict = options.checkConflict;
  if (options?.isNotifiedOnConflict !== undefined)
    params.isNotifiedOnConflict = options.isNotifiedOnConflict;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/launch',
    },
  });
}

/**
 * Stop debugger
 *
 * @param connection - ABAP connection
 * @param options - Debugger stop options
 * @returns Axios response
 */
export interface IStopDebuggerOptions {
  debuggingMode?: string;
  requestUser?: string;
  terminalId?: string;
  ideId?: string;
  checkConflict?: boolean;
  notifyConflict?: boolean;
}

export async function stopDebugger(
  connection: IAbapConnection,
  options?: IStopDebuggerOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/listeners`;
  const params: Record<string, any> = {};

  if (options?.debuggingMode) params.debuggingMode = options.debuggingMode;
  if (options?.requestUser) params.requestUser = options.requestUser;
  if (options?.terminalId) params.terminalId = options.terminalId;
  if (options?.ideId) params.ideId = options.ideId;
  if (options?.checkConflict !== undefined)
    params.checkConflict = options.checkConflict;
  if (options?.notifyConflict !== undefined)
    params.notifyConflict = options.notifyConflict;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/stop',
    },
  });
}

/**
 * Get debugger session
 *
 * @param connection - ABAP connection
 * @param options - Debugger get options
 * @returns Axios response with debugger session
 */
export interface IGetDebuggerOptions {
  debuggingMode?: string;
  requestUser?: string;
  terminalId?: string;
  ideId?: string;
  checkConflict?: boolean;
}

export async function getDebugger(
  connection: IAbapConnection,
  options?: IGetDebuggerOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/listeners`;
  const params: Record<string, any> = {};

  if (options?.debuggingMode) params.debuggingMode = options.debuggingMode;
  if (options?.requestUser) params.requestUser = options.requestUser;
  if (options?.terminalId) params.terminalId = options.terminalId;
  if (options?.ideId) params.ideId = options.ideId;
  if (options?.checkConflict !== undefined)
    params.checkConflict = options.checkConflict;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/get',
    },
  });
}

/**
 * Get memory sizes
 *
 * @param connection - ABAP connection
 * @param includeAbap - Include ABAP memory (optional)
 * @returns Axios response with memory sizes
 */
export async function getMemorySizes(
  connection: IAbapConnection,
  includeAbap?: boolean,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/memorysizes`;
  const params: Record<string, any> = {};

  if (includeAbap !== undefined) params.includeAbap = includeAbap;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get system area
 *
 * @param connection - ABAP connection
 * @param systemarea - System area name
 * @param options - System area options
 * @returns Axios response with system area data
 */
export interface IGetSystemAreaOptions {
  offset?: number;
  length?: number;
  element?: string;
  isSelection?: boolean;
  selectedLine?: number;
  selectedColumn?: number;
  programContext?: string;
  filter?: string;
}

export async function getSystemArea(
  connection: IAbapConnection,
  systemarea: string,
  options?: IGetSystemAreaOptions,
): Promise<AxiosResponse> {
  if (!systemarea) {
    throw new Error('System area is required');
  }

  const url = `/sap/bc/adt/debugger/systemareas/${encodeURIComponent(systemarea)}`;
  const params: Record<string, any> = {};

  if (options?.offset !== undefined) params.offset = options.offset;
  if (options?.length !== undefined) params.length = options.length;
  if (options?.element) params.element = options.element;
  if (options?.isSelection !== undefined)
    params.isSelection = options.isSelection;
  if (options?.selectedLine !== undefined)
    params.selectedLine = options.selectedLine;
  if (options?.selectedColumn !== undefined)
    params.selectedColumn = options.selectedColumn;
  if (options?.programContext) params.programContext = options.programContext;
  if (options?.filter) params.filter = options.filter;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Synchronize breakpoints
 *
 * @param connection - ABAP connection
 * @param checkConflict - Check for conflicts (optional)
 * @returns Axios response with breakpoints
 */
export async function synchronizeBreakpoints(
  connection: IAbapConnection,
  checkConflict?: boolean,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/breakpoints`;
  const params: Record<string, any> = {};

  if (checkConflict !== undefined) params.checkConflict = checkConflict;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/debugger/relations/synchronize',
    },
  });
}

/**
 * Get breakpoint statements
 *
 * @param connection - ABAP connection
 * @returns Axios response with breakpoint statements
 */
export async function getBreakpointStatements(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/breakpoints/statements`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get breakpoint message types
 *
 * @param connection - ABAP connection
 * @returns Axios response with message types
 */
export async function getBreakpointMessageTypes(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/breakpoints/messagetypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get breakpoint conditions
 *
 * @param connection - ABAP connection
 * @returns Axios response with breakpoint conditions
 */
export async function getBreakpointConditions(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/breakpoints/conditions`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Validate breakpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with validation results
 */
export async function validateBreakpoints(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/breakpoints/validations`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get VIT breakpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with VIT breakpoints
 */
export async function getVitBreakpoints(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/breakpoints/vit`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get variable max length
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param maxLength - Max length (optional)
 * @returns Axios response with max length
 */
export async function getVariableMaxLength(
  connection: IAbapConnection,
  variableName: string,
  part: string,
  maxLength?: number,
): Promise<AxiosResponse> {
  if (!variableName || !part) {
    throw new Error('Variable name and part are required');
  }

  const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
  const params: Record<string, any> = {};

  if (maxLength !== undefined) params.maxLength = maxLength;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/debugger/relations/maxlength',
    },
  });
}

/**
 * Get variable subcomponents
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param component - Component name (optional)
 * @param line - Line number (optional)
 * @returns Axios response with subcomponents
 */
export async function getVariableSubcomponents(
  connection: IAbapConnection,
  variableName: string,
  part: string,
  component?: string,
  line?: number,
): Promise<AxiosResponse> {
  if (!variableName || !part) {
    throw new Error('Variable name and part are required');
  }

  const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
  const params: Record<string, any> = {};

  if (component) params.component = component;
  if (line !== undefined) params.line = line;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/debugger/relations/subcomponents',
    },
  });
}

/**
 * Get variable as CSV
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param options - CSV options
 * @returns Axios response with CSV data
 */
export interface IGetVariableAsCsvOptions {
  offset?: number;
  length?: number;
  filter?: string;
  sortComponent?: string;
  sortDirection?: string;
  whereClause?: string;
  c?: string; // Additional column parameter
}

export async function getVariableAsCsv(
  connection: IAbapConnection,
  variableName: string,
  part: string,
  options?: IGetVariableAsCsvOptions,
): Promise<AxiosResponse> {
  if (!variableName || !part) {
    throw new Error('Variable name and part are required');
  }

  const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
  const params: Record<string, any> = {};

  if (options?.offset !== undefined) params.offset = options.offset;
  if (options?.length !== undefined) params.length = options.length;
  if (options?.filter) params.filter = options.filter;
  if (options?.sortComponent) params.sortComponent = options.sortComponent;
  if (options?.sortDirection) params.sortDirection = options.sortDirection;
  if (options?.whereClause) params.whereClause = options.whereClause;
  if (options?.c) params.c = options.c;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'text/csv',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/csv',
    },
  });
}

/**
 * Get variable as JSON
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param options - JSON options
 * @returns Axios response with JSON data
 */
export interface IGetVariableAsJsonOptions {
  offset?: number;
  length?: number;
  filter?: string;
  sortComponent?: string;
  sortDirection?: string;
  whereClause?: string;
  c?: string; // Additional column parameter
}

export async function getVariableAsJson(
  connection: IAbapConnection,
  variableName: string,
  part: string,
  options?: IGetVariableAsJsonOptions,
): Promise<AxiosResponse> {
  if (!variableName || !part) {
    throw new Error('Variable name and part are required');
  }

  const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
  const params: Record<string, any> = {};

  if (options?.offset !== undefined) params.offset = options.offset;
  if (options?.length !== undefined) params.length = options.length;
  if (options?.filter) params.filter = options.filter;
  if (options?.sortComponent) params.sortComponent = options.sortComponent;
  if (options?.sortDirection) params.sortDirection = options.sortDirection;
  if (options?.whereClause) params.whereClause = options.whereClause;
  if (options?.c) params.c = options.c;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/json',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/json',
    },
  });
}

/**
 * Get variable value statement
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param options - Value statement options
 * @returns Axios response with value statement
 */
export interface IGetVariableValueStatementOptions {
  rows?: number;
  maxStringLength?: number;
  maxNestingLevel?: number;
  maxTotalSize?: number;
  ignoreInitialValues?: boolean;
  c?: string; // Additional column parameter
  lineBreakThreshold?: number;
}

export async function getVariableValueStatement(
  connection: IAbapConnection,
  variableName: string,
  part: string,
  options?: IGetVariableValueStatementOptions,
): Promise<AxiosResponse> {
  if (!variableName || !part) {
    throw new Error('Variable name and part are required');
  }

  const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
  const params: Record<string, any> = {};

  if (options?.rows !== undefined) params.rows = options.rows;
  if (options?.maxStringLength !== undefined)
    params.maxStringLength = options.maxStringLength;
  if (options?.maxNestingLevel !== undefined)
    params.maxNestingLevel = options.maxNestingLevel;
  if (options?.maxTotalSize !== undefined)
    params.maxTotalSize = options.maxTotalSize;
  if (options?.ignoreInitialValues !== undefined)
    params.ignoreInitialValues = options.ignoreInitialValues;
  if (options?.c) params.c = options.c;
  if (options?.lineBreakThreshold !== undefined)
    params.lineBreakThreshold = options.lineBreakThreshold;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/debugger/relations/valueStatement',
    },
  });
}

/**
 * Execute debugger action
 *
 * @param connection - ABAP connection
 * @param action - Action name
 * @param value - Action value (optional)
 * @returns Axios response
 */
export async function executeDebuggerAction(
  connection: IAbapConnection,
  action: string,
  value?: string,
): Promise<AxiosResponse> {
  if (!action) {
    throw new Error('Action is required');
  }
  if (
    action === 'stepInto' ||
    action === 'stepOut' ||
    action === 'stepContinue'
  ) {
    throw new Error(
      `Debugger action "${action}" must be executed via debugger batch (use stepIntoDebuggerBatch/stepOutDebuggerBatch/stepContinueDebuggerBatch)`,
    );
  }

  const url = `/sap/bc/adt/debugger/actions`;
  const params: Record<string, any> = { action };

  if (value) params.value = value;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/action',
    },
  });
}

/**
 * Get call stack
 *
 * @param connection - ABAP connection
 * @returns Axios response with call stack
 */
export async function getCallStack(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/stack`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Insert watchpoint
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param condition - Watchpoint condition (optional)
 * @returns Axios response
 */
export async function insertWatchpoint(
  connection: IAbapConnection,
  variableName: string,
  condition?: string,
): Promise<AxiosResponse> {
  if (!variableName) {
    throw new Error('Variable name is required');
  }

  const url = `/sap/bc/adt/debugger/watchpoints`;
  const params: Record<string, any> = { variableName };

  if (condition) params.condition = condition;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/insert',
    },
  });
}

/**
 * Get watchpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with watchpoints
 */
export async function getWatchpoints(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/debugger/watchpoints`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/get',
    },
  });
}

/**
 * Execute batch request
 *
 * @param connection - ABAP connection
 * @param requests - Batch requests (XML body)
 * @returns Axios response with batch results
 */
export async function executeBatchRequest(
  connection: IAbapConnection,
  requests: string,
): Promise<AxiosResponse> {
  if (!requests) {
    throw new Error('Requests are required');
  }

  const url = `/sap/bc/adt/debugger/batch`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: requests,
    headers: {
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    },
  });
}

export type IAbapDebuggerStepMethod = 'stepInto' | 'stepOut' | 'stepContinue';

export interface IDebuggerBatchPayload {
  boundary: string;
  body: string;
}

export function buildDebuggerBatchPayload(
  requests: string[],
  boundary = createBatchBoundary(),
): IDebuggerBatchPayload {
  if (!requests.length) {
    throw new Error('At least one batch request is required');
  }

  const parts = requests
    .map((request) => {
      if (!request.trim()) {
        throw new Error('Batch request part must not be empty');
      }
      // Do NOT trim — inner requests must preserve trailing \r\n\r\n
      return [
        `--${boundary}`,
        'Content-Type: application/http',
        'content-transfer-encoding: binary',
        '',
        request,
        '',
      ].join('\r\n');
    })
    .join('');

  return {
    boundary,
    body: `${parts}--${boundary}--\r\n`,
  };
}

export function buildDebuggerStepWithStackBatchPayload(
  stepMethod: IAbapDebuggerStepMethod,
): IDebuggerBatchPayload {
  const stepRequest = [
    `POST /sap/bc/adt/debugger?method=${stepMethod} HTTP/1.1`,
    `sap-adt-request-id:${createRequestId()}`,
    'Accept:application/xml',
  ].join('\r\n');

  const stackRequest = [
    'POST /sap/bc/adt/debugger?emode=_&semanticURIs=true&method=getStack HTTP/1.1',
    `sap-adt-request-id:${createRequestId()}`,
    'Accept:application/xml',
  ].join('\r\n');

  return buildDebuggerBatchPayload([stepRequest, stackRequest]);
}

export async function executeDebuggerStepBatch(
  connection: IAbapConnection,
  stepMethod: IAbapDebuggerStepMethod,
): Promise<AxiosResponse> {
  const payload = buildDebuggerStepWithStackBatchPayload(stepMethod);

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/debugger/batch',
    method: 'POST',
    timeout: getTimeout('default'),
    data: payload.body,
    headers: {
      'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
      Accept: 'multipart/mixed',
    },
  });
}

export async function stepIntoDebuggerBatch(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  return executeDebuggerStepBatch(connection, 'stepInto');
}

export async function stepOutDebuggerBatch(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  return executeDebuggerStepBatch(connection, 'stepOut');
}

export async function stepContinueDebuggerBatch(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  return executeDebuggerStepBatch(connection, 'stepContinue');
}
