/**
 * ABAP Unit test run operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_JUNIT_RESULT,
  ACCEPT_UNIT_TEST_RESULT,
  ACCEPT_UNIT_TEST_RUNS_RESULT,
  ACCEPT_UNIT_TEST_STATUS,
  CT_UNIT_TEST_RUN,
  CT_UNIT_TEST_RUNS_CONFIG,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestAlert,
  IUnitTestMethodResult,
  IUnitTestRunSyncOptions,
  IUnitTestSummary,
  UnitTestObjectType,
} from './types';

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
  options?: IClassUnitTestRunOptions,
): Promise<AxiosResponse> {
  if (!tests.length) {
    throw new Error('At least one test definition is required');
  }

  const scope = options?.scope ?? {
    ownTests: true,
    foreignTests: false,
    addForeignTestsAsPreview: true,
  };
  const risk = options?.riskLevel ?? {
    harmless: true,
    dangerous: true,
    critical: true,
  };
  const duration = options?.duration ?? {
    short: true,
    medium: true,
    long: true,
  };

  const testsXml = tests
    .map(
      (test) =>
        `<aunit:test containerClass="${encodeSapObjectName(test.containerClass).toUpperCase()}" class="${test.testClass}"/>`,
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
      'Content-Type': CT_UNIT_TEST_RUN,
    },
  });
}

/**
 * Start ABAP Unit test run by object (for CDS unit tests)
 * Uses osl:objectSet instead of aunit:tests
 */
export async function startClassUnitTestRunByObject(
  connection: IAbapConnection,
  className: string,
  options?: IClassUnitTestRunOptions,
): Promise<AxiosResponse> {
  if (!className) {
    throw new Error('className is required');
  }

  const scope = options?.scope ?? {
    ownTests: true,
    foreignTests: false,
    addForeignTestsAsPreview: true,
  };
  const risk = options?.riskLevel ?? {
    harmless: true,
    dangerous: true,
    critical: true,
  };
  const duration = options?.duration ?? {
    short: true,
    medium: true,
    long: true,
  };

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
      'Content-Type': CT_UNIT_TEST_RUN,
    },
  });
}

export async function getClassUnitTestStatus(
  connection: IAbapConnection,
  runId: string,
  withLongPolling: boolean = true,
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
      Accept: ACCEPT_UNIT_TEST_STATUS,
    },
  });
}

export async function getClassUnitTestResult(
  connection: IAbapConnection,
  runId: string,
  options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
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
    format === 'junit' ? ACCEPT_JUNIT_RESULT : ACCEPT_UNIT_TEST_RESULT;

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/abapunit/results/${runId}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: accept,
    },
  });
}

// =============================================================================
// Synchronous object-based run (/sap/bc/adt/abapunit/testruns)
// =============================================================================

/**
 * Build the ADT object URI for an ABAP-Unit-testable object.
 * Matches the URI families the /testruns objectReference accepts.
 */
export function buildUnitTestObjectUri(
  objectType: UnitTestObjectType,
  objectName: string,
): string {
  const encoded = encodeSapObjectName(objectName).toUpperCase();
  switch (objectType) {
    case 'class':
      return `/sap/bc/adt/oo/classes/${encoded}`;
    case 'program':
    case 'include':
      return `/sap/bc/adt/programs/programs/${encoded}`;
    case 'function_group':
      return `/sap/bc/adt/functions/groups/${encoded}`;
    case 'package':
      return `/sap/bc/adt/packages/${encoded}`;
    default: {
      const exhaustive: never = objectType;
      throw new Error(
        `Unsupported unit test object type: ${String(exhaustive)}`,
      );
    }
  }
}

/**
 * Start a synchronous ABAP Unit run for a single object and return the full
 * result in one response. Unlike startClassUnitTestRun (async /runs + polling),
 * this posts to /testruns with the runConfiguration payload — the shape Eclipse
 * ADT uses for object-based runs, supported on 7.5x.
 */
export async function startObjectUnitTestRunSync(
  connection: IAbapConnection,
  objectType: UnitTestObjectType,
  objectName: string,
  options?: IUnitTestRunSyncOptions,
): Promise<AxiosResponse> {
  if (!objectName) {
    throw new Error('objectName is required');
  }
  const objectUri = buildUnitTestObjectUri(objectType, objectName);
  const withCoverage = options?.withCoverage ?? false;

  // Map test scope to the testDeterminationStrategy attributes.
  let sameProgram = true;
  let assignedTests = false;
  switch (options?.testScope) {
    case 'foreign_tests':
      sameProgram = false;
      assignedTests = true;
      break;
    case 'all_tests':
      sameProgram = true;
      assignedTests = true;
      break;
    default: // own_tests
      sameProgram = true;
      assignedTests = false;
      break;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="${withCoverage ? 'true' : 'false'}"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="${sameProgram ? 'true' : 'false'}" assignedTests="${assignedTests ? 'true' : 'false'}"/>
    <testRiskLevels harmless="true" dangerous="true" critical="true"/>
    <testDurations short="true" medium="true" long="true"/>
    <withNavigationUri enabled="true"/>
  </options>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
        <adtcore:objectReference adtcore:uri="${objectUri}"/>
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/abapunit/testruns',
    method: 'POST',
    timeout: getTimeout('long'),
    data: xml,
    headers: {
      'Content-Type': CT_UNIT_TEST_RUNS_CONFIG,
      Accept: ACCEPT_UNIT_TEST_RUNS_RESULT,
    },
  });
}

function attr(attrs: string, name: string): string {
  // Match `name="..."` or `ns:name="..."` (e.g. adtcore:name).
  const m = attrs.match(new RegExp(`(?:[\\w-]+:)?${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

/**
 * Parse an aunit:runResult (testruns.result.v2) into a flat pass/fail summary.
 *
 * Severity drives classification (more reliable than alert kind across releases):
 * - any alert severity "fatal"    -> error  (uncaught exception / short dump)
 * - any alert severity "critical" -> failed (failed assertion)
 * - otherwise                     -> passed (tolerable / warnings do not fail)
 */
export function parseUnitTestRunResult(xml: string): IUnitTestSummary {
  const methods: IUnitTestMethodResult[] = [];

  const testClassRe = /<testClass\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testClass>)/g;
  let tc: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((tc = testClassRe.exec(xml)) !== null) {
    const testClassName = attr(tc[1], 'name');
    const tcBody = tc[2] ?? '';

    const methodRe = /<testMethod\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testMethod>)/g;
    let tm: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
    while ((tm = methodRe.exec(tcBody)) !== null) {
      const methodName = attr(tm[1], 'name');
      const body = tm[2] ?? '';

      const alerts: IUnitTestAlert[] = [];
      const alertRe = /<alert\b([^>]*)>([\s\S]*?)<\/alert>/g;
      let al: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
      while ((al = alertRe.exec(body)) !== null) {
        const titleMatch = al[2].match(/<title>([\s\S]*?)<\/title>/);
        alerts.push({
          kind: attr(al[1], 'kind'),
          severity: attr(al[1], 'severity').toLowerCase(),
          title: titleMatch ? titleMatch[1].trim() : '',
        });
      }

      let status: IUnitTestMethodResult['status'] = 'passed';
      if (alerts.some((a) => a.severity === 'fatal')) {
        status = 'error';
      } else if (alerts.some((a) => a.severity === 'critical')) {
        status = 'failed';
      }

      methods.push({
        testClass: testClassName,
        name: methodName,
        status,
        alerts,
      });
    }
  }

  return {
    total: methods.length,
    passed: methods.filter((m) => m.status === 'passed').length,
    failed: methods.filter((m) => m.status === 'failed').length,
    errors: methods.filter((m) => m.status === 'error').length,
    methods,
  };
}
