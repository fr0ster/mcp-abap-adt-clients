/**
 * ABAP Unit on the wire, for whichever object type holds the tests.
 *
 * A run is started for an object and then asked about by its id. The id is
 * ADT's and knows no object type, so polling and fetching the result are one
 * pair of functions for every runner; starting differs only in the `type` of
 * the one `osl:object` the run names.
 *
 * Measured on premise (2026-09-30), `POST /abapunit/runs` with an
 * `osl:flatObjectSet`: `type="CLAS"` runs a class's test classes; `type="PROG"`
 * (what Eclipse sends) and `type="PROG/P"` both run a report's, whether the
 * test class is in the report's own source or in an include it pulls in;
 * `type="PROG/I"` runs the test classes of that include alone.
 */

import type { IClassUnitTestRunOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_JUNIT_RESULT,
  ACCEPT_UNIT_TEST_RESULT,
  ACCEPT_UNIT_TEST_STATUS,
  CT_UNIT_TEST_RUN,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';

function boolAttr(value: boolean | undefined, fallback: boolean) {
  return (value ?? fallback) ? 'true' : 'false';
}

/** The one object a run names, as `osl:object` spells it. */
export interface IUnitTestRunObject {
  name: string;
  /** `CLAS`, `PROG`, … — the short type Eclipse sends. */
  type: string;
}

/** Start a run of every test class the object holds. */
export async function startUnitTestRunByObject(
  connection: IAbapConnection,
  object: IUnitTestRunObject,
  options?: IClassUnitTestRunOptions,
): Promise<IAdtWireResponse> {
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
  // An XML attribute, not a URL: a namespaced name keeps its slashes
  // (`/ACME/REPORT`), escaped for XML only. URL-encoding it here sent
  // `%2FACME%2FREPORT`, which XML does not decode — a different name.
  const name = escapeXmlAttr(object.name.toUpperCase());
  const title = escapeXmlAttr(options?.title || object.name.toUpperCase());
  const context = escapeXmlAttr(options?.context || 'MCP ABAP ADT Client');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:osl="http://www.sap.com/api/osl" title="${title}" context="${context}">
  <aunit:options>
    <aunit:scope ownTests="${boolAttr(scope.ownTests, true)}" foreignTests="${boolAttr(scope.foreignTests, false)}" addForeignTestsAsPreview="${boolAttr(scope.addForeignTestsAsPreview, true)}"/>
    <aunit:riskLevel harmless="${boolAttr(risk.harmless, true)}" dangerous="${boolAttr(risk.dangerous, true)}" critical="${boolAttr(risk.critical, true)}"/>
    <aunit:duration short="${boolAttr(duration.short, true)}" medium="${boolAttr(duration.medium, true)}" long="${boolAttr(duration.long, true)}"/>
  </aunit:options>
  <osl:objectSet xsi:type="osl:flatObjectSet">
    <osl:object name="${name}" type="${escapeXmlAttr(object.type)}"/>
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

/** Poll a run. */
export async function getUnitTestRunStatus(
  connection: IAbapConnection,
  runId: string,
  withLongPolling: boolean = true,
): Promise<IAdtWireResponse> {
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

/** A finished run's result document. */
export async function getUnitTestRunResult(
  connection: IAbapConnection,
  runId: string,
  options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
): Promise<IAdtWireResponse> {
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
