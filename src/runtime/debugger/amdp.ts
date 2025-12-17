/**
 * AMDP Debugger for ADT
 * 
 * Provides functions for managing AMDP (ABAP Managed Database Procedures) debugger sessions:
 * - Debugger session management (start, resume, terminate)
 * - Debuggee operations
 * - Variable operations (get, set)
 * - Lookup operations
 * - Step operations (step over, continue)
 * - Breakpoint operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * Start AMDP debugger
 * 
 * @param connection - ABAP connection
 * @param options - Debugger start options
 * @returns Axios response with debugger session
 */
export interface IStartAmdpDebuggerOptions {
  stopExisting?: boolean;
  requestUser?: string;
  cascadeMode?: string;
}

export async function startAmdpDebugger(
  connection: IAbapConnection,
  options?: IStartAmdpDebuggerOptions
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main`;
  const params: Record<string, any> = {};
  
  if (options?.stopExisting !== undefined) params.stopExisting = options.stopExisting;
  if (options?.requestUser) params.requestUser = options.requestUser;
  if (options?.cascadeMode) params.cascadeMode = options.cascadeMode;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/start'
    }
  });
}

/**
 * Resume AMDP debugger
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with debugger session
 */
export async function resumeAmdpDebugger(
  connection: IAbapConnection,
  mainId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/resume'
    }
  });
}

/**
 * Terminate AMDP debugger
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param hardStop - Whether to perform hard stop
 * @returns Axios response
 */
export async function terminateAmdpDebugger(
  connection: IAbapConnection,
  mainId: string,
  hardStop?: boolean
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}`;
  const params: Record<string, any> = {};
  
  if (hardStop !== undefined) params.hardStop = hardStop;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/terminate'
    }
  });
}

/**
 * Get debuggee information
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response with debuggee information
 */
export async function getAmdpDebuggee(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/debuggee'
    }
  });
}

/**
 * Get variable value
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param varname - Variable name
 * @param offset - Offset for variable value
 * @param length - Length of variable value to retrieve
 * @returns Axios response with variable value
 */
export async function getAmdpVariable(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string,
  varname: string,
  offset?: number,
  length?: number
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}/variables/${varname}`;
  const params: Record<string, any> = {};
  
  if (offset !== undefined) params.offset = offset;
  if (length !== undefined) params.length = length;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/vars'
    }
  });
}

/**
 * Set variable value
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param varname - Variable name
 * @param setNull - Whether to set variable to null
 * @returns Axios response
 */
export async function setAmdpVariable(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string,
  varname: string,
  setNull?: boolean
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}/variables/${varname}`;
  const params: Record<string, any> = {};
  
  if (setNull !== undefined) params.setNull = setNull;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/setvars'
    }
  });
}

/**
 * Lookup objects/variables
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param name - Name to lookup
 * @returns Axios response with lookup results
 */
export async function lookupAmdp(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string,
  name?: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}/lookup`;
  const params: Record<string, any> = {};
  
  if (name) params.name = name;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/lookup'
    }
  });
}

/**
 * Step over in AMDP debugger
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response
 */
export async function stepOverAmdp(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params: { step: 'over' },
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/step/over'
    }
  });
}

/**
 * Continue execution in AMDP debugger
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response
 */
export async function stepContinueAmdp(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params: { step: 'continue' },
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/step/continue'
    }
  });
}

/**
 * Get breakpoints
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with breakpoints
 */
export async function getAmdpBreakpoints(
  connection: IAbapConnection,
  mainId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/breakpoints`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/breakpoints'
    }
  });
}

/**
 * Get breakpoints for LLang
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with LLang breakpoints
 */
export async function getAmdpBreakpointsLlang(
  connection: IAbapConnection,
  mainId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/breakpoints`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/breakpoints/llang'
    }
  });
}

/**
 * Get breakpoints for table functions
 * 
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with table function breakpoints
 */
export async function getAmdpBreakpointsTableFunctions(
  connection: IAbapConnection,
  mainId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/breakpoints`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/breakpoints/tablefunctions'
    }
  });
}

