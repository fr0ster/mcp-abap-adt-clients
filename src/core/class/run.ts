/**
 * Class run operations - execute ABAP classes that implement if_oo_adt_classrun
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Run an ABAP class that implements if_oo_adt_classrun interface.
 *
 * This executes the class's main() method and returns console output.
 * The class must implement if_oo_adt_classrun interface to be executable.
 *
 * Endpoint: POST /sap/bc/adt/oo/classrun/{className}
 *
 * Use cases:
 * - Execute test/demo classes
 * - Run data migration scripts
 * - Execute batch processing classes
 * - Quick code testing without creating programs
 *
 * @param connection - SAP connection
 * @param className - Name of the class to run (must implement if_oo_adt_classrun)
 * @param runnable - Optional flag to check if class is runnable (default: true, throws error if false)
 * @param sessionId - Optional session ID for session-based requests
 * @returns Response with console output from the class execution
 * @throws Error if runnable is false, or if class doesn't implement if_oo_adt_classrun or execution fails
 *
 * @example
 * ```typescript
 * // Class must implement if_oo_adt_classrun:
 * // CLASS zcl_test DEFINITION PUBLIC FINAL CREATE PUBLIC.
 * //   PUBLIC SECTION.
 * //     INTERFACES if_oo_adt_classrun.
 * // ENDCLASS.
 * //
 * // CLASS zcl_test IMPLEMENTATION.
 * //   METHOD if_oo_adt_classrun~main.
 * //     out->write( 'Hello World' ).
 * //   ENDMETHOD.
 * // ENDCLASS.
 *
 * const result = await runClass(connection, 'ZCL_TEST', true);
 * console.log(result.data); // Console output from the class
 *
 * // Check if class is runnable before attempting to run
 * if (classConfig.runnable) {
 *   const result = await runClass(connection, 'ZCL_TEST', true);
 * }
 * ```
 */
export async function runClass(
  connection: IAbapConnection,
  className: string,
  runnable: boolean = true,
  sessionId?: string
): Promise<AxiosResponse> {
  if (!runnable) {
    throw new Error(`Class ${className} is not marked as runnable (does not implement if_oo_adt_classrun)`);
  }

  const url = `/sap/bc/adt/oo/classrun/${className}`;

  const headers = {
    'Accept': 'text/plain'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers
  });
}

// =============================================================================
// ABAP Unit helper functions
// =============================================================================

// Re-export interfaces from interfaces package
export type {
  IClassUnitTestDefinition as ClassUnitTestDefinition,
  IClassUnitTestRunOptions as ClassUnitTestRunOptions
} from '../unitTest/types';

function boolAttr(value: boolean | undefined, fallback: boolean) {
  return (value ?? fallback) ? 'true' : 'false';
}

import type { IClassUnitTestDefinition, IClassUnitTestRunOptions } from '../unitTest/types';

export async function startClassUnitTestRun(
  connection: IAbapConnection,
  tests: IClassUnitTestDefinition[],
  options?: IClassUnitTestRunOptions
): Promise<AxiosResponse> {
  if (!tests.length) {
    throw new Error('At least one test definition is required');
  }

  const scope = options?.scope ?? { ownTests: true, foreignTests: false, addForeignTestsAsPreview: true };
  const risk = options?.riskLevel ?? { harmless: true, dangerous: true, critical: true };
  const duration = options?.duration ?? { short: true, medium: true, long: true };

  const testsXml = tests
    .map(
      test => `<aunit:test containerClass="${encodeSapObjectName(test.containerClass).toUpperCase()}" class="${test.testClass}"/>`
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" title="${options?.title || tests[0].testClass}" context="${options?.context || 'MCP ABAP ADT Client'}">
  <aunit:options>
    <aunit:scope ownTests="${boolAttr(scope.ownTests, true)}" foreignTests="${boolAttr(scope.foreignTests, false)}" addForeignTestsAsPreview="${boolAttr(scope.addForeignTestsAsPreview, true)}"/>
    <aunit:riskLevel harmless="${boolAttr(risk.harmless, true)}" dangerous="${boolAttr(risk.dangerous, true)}" critical="${boolAttr(risk.critical, true)}"/>
    <aunit:duration short="${boolAttr(duration.short, true)}" medium="${boolAttr(duration.medium, true)}" long="${boolAttr(duration.long, true)}"/>
  </aunit:options>
  <aunit:tests>
    ${testsXml}
  </aunit:tests>
</aunit:run>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/abapunit/runs',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xml,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.api.abapunit.run.v2+xml'
    }
  });
}

export async function getClassUnitTestStatus(
  connection: IAbapConnection,
  runId: string,
  withLongPolling: boolean = true
): Promise<AxiosResponse> {
  if (!runId) {
    throw new Error('runId is required');
  }
  const query = withLongPolling ? '?withLongPolling=true' : '';
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/abapunit/runs/${runId}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml'
    }
  });
}

export async function getClassUnitTestResult(
  connection: IAbapConnection,
  runId: string,
  options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' }
): Promise<AxiosResponse> {
  if (!runId) {
    throw new Error('runId is required');
  }
  const params: string[] = [];
  if (options?.withNavigationUris === false) {
    params.push('withNavigationUris=false');
  }
  const query = params.length ? `?${params.join('&')}` : '';
  const format = options?.format || 'abapunit';
  const accept =
    format === 'junit'
      ? 'application/vnd.sap.adt.api.junit.run-result.v1+xml'
      : 'application/vnd.sap.adt.api.abapunit.run-result.v1+xml';

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/abapunit/results/${runId}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: accept
    }
  });
}

/**
 * Start ABAP Unit test run by object (for CDS unit tests)
 * Uses osl:objectSet instead of aunit:tests
 */
export async function startClassUnitTestRunByObject(
  connection: IAbapConnection,
  className: string,
  options?: IClassUnitTestRunOptions
): Promise<AxiosResponse> {
  if (!className) {
    throw new Error('className is required');
  }

  const scope = options?.scope ?? { ownTests: true, foreignTests: false, addForeignTestsAsPreview: true };
  const risk = options?.riskLevel ?? { harmless: true, dangerous: true, critical: true };
  const duration = options?.duration ?? { short: true, medium: true, long: true };

  const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:osl="http://www.sap.com/api/osl" title="${options?.title || className}" context="${options?.context || 'MCP ABAP ADT Client'}">
  <aunit:options>
    <aunit:scope ownTests="${boolAttr(scope.ownTests, true)}" foreignTests="${boolAttr(scope.foreignTests, false)}" addForeignTestsAsPreview="${boolAttr(scope.addForeignTestsAsPreview, true)}"/>
    <aunit:riskLevel harmless="${boolAttr(risk.harmless, true)}" dangerous="${boolAttr(risk.dangerous, true)}" critical="${boolAttr(risk.critical, true)}"/>
    <aunit:duration short="${boolAttr(duration.short, true)}" medium="${boolAttr(duration.medium, true)}" long="${boolAttr(duration.long, true)}"/>
  </aunit:options>
  <osl:objectSet xsi:type="osl:flatObjectSet">
    <osl:object name="${encodeSapObjectName(className).toUpperCase()}" type="CLAS"/>
  </osl:objectSet>
</aunit:run>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/abapunit/runs',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xml,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.api.abapunit.run.v2+xml'
    }
  });
}
