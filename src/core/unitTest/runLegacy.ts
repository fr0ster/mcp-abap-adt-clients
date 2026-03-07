/**
 * ABAP Unit test run operations for legacy systems (BASIS < 7.50)
 *
 * Legacy systems use:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml for Content-Type and Accept (not versioned vnd.sap.adt.api.abapunit.* types)
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
} from './types';

const CT_XML = 'application/xml';
const ACCEPT_XML = 'application/xml';

function boolAttr(value: boolean | undefined, fallback: boolean) {
  return (value ?? fallback) ? 'true' : 'false';
}

/**
 * Start ABAP Unit test run on legacy systems
 * Uses /sap/bc/adt/abapunit/testruns endpoint with application/xml content type
 */
export async function startClassUnitTestRunLegacy(
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
    url: '/sap/bc/adt/abapunit/testruns',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xml,
    headers: {
      'Content-Type': CT_XML,
      Accept: ACCEPT_XML,
    },
  });
}

export async function getClassUnitTestStatusLegacy(
  connection: IAbapConnection,
  runId: string,
  withLongPolling: boolean = true,
): Promise<AxiosResponse> {
  if (!runId) {
    throw new Error('runId is required');
  }
  const query = withLongPolling ? '?withLongPolling=true' : '';
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/abapunit/testruns/${runId}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_XML,
    },
  });
}

export async function getClassUnitTestResultLegacy(
  connection: IAbapConnection,
  runId: string,
  options?: { withNavigationUris?: boolean },
): Promise<AxiosResponse> {
  if (!runId) {
    throw new Error('runId is required');
  }
  const params: string[] = [];
  if (options?.withNavigationUris === false) {
    params.push('withNavigationUris=false');
  }
  const query = params.length ? `?${params.join('&')}` : '';

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/abapunit/testruns/${runId}/results${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_XML,
    },
  });
}
