/**
 * ABAP Unit test run operations
 */

import type { IAbapConnection, IClassUnitTestDefinition, IClassUnitTestRunOptions } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

function boolAttr(value: boolean | undefined, fallback: boolean) {
  return (value ?? fallback) ? 'true' : 'false';
}

/**
 * Start ABAP Unit test run for specific test classes
 * Uses aunit:tests format (for regular class unit tests)
 */
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

