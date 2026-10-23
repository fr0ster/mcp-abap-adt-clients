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
    timeout: 0,
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
    timeout: 0,
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
    timeout: 0,
    headers: {
      Accept: accept,
    },
  });
}

// =============================================================================
// The synchronous runner: /abapunit/testruns
// =============================================================================

const CT_TESTRUNS = 'application/xml';
const ACCEPT_TESTRUNS = 'application/xml';

/**
 * Run the ABAP Unit tests of whole objects and answer the finished result —
 * `POST /sap/bc/adt/abapunit/testruns`, one request, no run to poll. The
 * objects are named by their ADT URIs: a class, a report, a function group, a
 * function module.
 *
 * The one implementation of this endpoint: every runner's `runSync` sends it.
 *
 * **Measured:** synchronous on a modern and a legacy on-prem system, over HTTP
 * and over RFC — `<aunit:runResult>` in the POST's answer, no `Location` — and
 * the typed and `application/xml` bodies byte-identical; the legacy system
 * ignores a typed `Accept` and answers `application/xml` either way. Advertised
 * (2026-10-22) by an on-prem system and an ABAP Cloud system alike, beside
 * `/abapunit/runs`; and on an on-prem S/4HANA 2023 that has no `/runs` at all
 * (fr0ster/mcp-abap-adt#286).
 *
 * **`<options>` decides whether anything runs for a report or a function
 * group.** Measured on premise (SAP_BASIS 816, 2026-10-23): with `<options>`, a
 * report (test class in its own source or in an include it pulls in), a
 * function group and a function module each ran the same tests with the same
 * alerts as `/abapunit/runs`; the same body without `<options>` answered `200`
 * with an empty `<aunit:runResult/>` for all four. An include's own URI
 * answered empty even with `<options>` — its tests run through the report. So
 * every runner sends `<options>`.
 *
 * **Reading the result: `kind` carries the distinction, `severity` does not.**
 * A failed assertion and an uncaught exception both come back
 * `severity="critical"`, so a parser classifying on severity reports a short
 * dump as a failed test. `kind` separates them: `failedAssertion`,
 * `exception`, `noTestClasses`.
 *
 * The format differs from `/runs`:
 * - root `aunit:runConfiguration` in `http://www.sap.com/adt/aunit` (not
 *   `aunit:run` in `http://www.sap.com/adt/api/aunit`);
 * - objects by URI in `adtcore:objectReferences` — so a run covers whole
 *   objects: the format has no way to name one test class inside its
 *   container;
 * - `application/xml` for `Content-Type` and `Accept`.
 *
 * `options` absent sends no `<options>` element. Given (`{}` included), the scope, risk
 * levels and durations go in `<options>` with the same defaults `/runs` gets;
 * `title` and `context` have no place in this format and are not sent.
 */
export async function startUnitTestRunSync(
  connection: IAbapConnection,
  objectUris: string[],
  options?: IClassUnitTestRunOptions,
): Promise<IAdtWireResponse> {
  const objectRefs = objectUris
    .map((uri) => {
      return `        <adtcore:objectReference adtcore:uri="${escapeXmlAttr(uri)}"/>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
${options ? testRunsOptions(options) : ''}  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
${objectRefs}
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/abapunit/testruns',
    method: 'POST',
    timeout: 0,
    data: xml,
    headers: {
      'Content-Type': CT_TESTRUNS,
      Accept: ACCEPT_TESTRUNS,
    },
  });
}

/**
 * `<options>` of a `runConfiguration`, as Eclipse sends it. The scope's three
 * flags are `testDeterminationStrategy`'s: own tests are `sameProgram`,
 * foreign tests `assignedTests`, their preview `appendAssignedTestsPreview`.
 */
function testRunsOptions(options: IClassUnitTestRunOptions): string {
  const scope = options.scope ?? {};
  const risk = options.riskLevel ?? {};
  const duration = options.duration ?? {};
  return `  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="${boolAttr(scope.ownTests, true)}" assignedTests="${boolAttr(scope.foreignTests, false)}" appendAssignedTestsPreview="${boolAttr(scope.addForeignTestsAsPreview, true)}"/>
    <testRiskLevels harmless="${boolAttr(risk.harmless, true)}" dangerous="${boolAttr(risk.dangerous, true)}" critical="${boolAttr(risk.critical, true)}"/>
    <testDurations short="${boolAttr(duration.short, true)}" medium="${boolAttr(duration.medium, true)}" long="${boolAttr(duration.long, true)}"/>
    <withNavigationUri enabled="true"/>
  </options>
`;
}
