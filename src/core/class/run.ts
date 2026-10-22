/**
 * Class run operations - execute ABAP classes that implement if_oo_adt_classrun
 */

import type { IDebuggeeIds } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CLASS } from '../../endpoints/objects';
import { debuggeePassport } from '../../runtime/debugger/passport';
import { escapeXmlAttr } from '../../utils/xml';

/**
 * Run an ABAP class that implements if_oo_adt_classrun interface.
 *
 * This executes the class's main() method and returns execution output.
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
 * @returns Response with execution output from the class execution
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
  _sessionId?: string,
  debuggee?: IDebuggeeIds,
): Promise<IAdtWireResponse> {
  if (!runnable) {
    throw new Error(
      `Class ${className} is not marked as runnable (does not implement if_oo_adt_classrun)`,
    );
  }

  const url = `/sap/bc/adt/oo/classrun/${className}`;

  const headers: Record<string, string> = {
    Accept: ACCEPT_SOURCE,
    ...(debuggee && { 'SAP-PASSPORT': debuggeePassport(debuggee) }),
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    headers,
  });
}

// =============================================================================
// ABAP Unit helper functions
// =============================================================================

// Re-export interfaces from interfaces package
export type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
} from '@mcp-abap-adt/interfaces-adt';

function boolAttr(value: boolean | undefined, fallback: boolean) {
  return (value ?? fallback) ? 'true' : 'false';
}

import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
} from '@mcp-abap-adt/interfaces-adt';
import { ACCEPT_SOURCE, CT_UNIT_TEST_RUN } from '../../constants/contentTypes';
import {
  getUnitTestRunResult,
  getUnitTestRunStatus,
  startUnitTestRunByObject,
} from '../shared/abapUnit';

export async function startClassUnitTestRun(
  connection: IAbapConnection,
  tests: IClassUnitTestDefinition[],
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

  const testsXml = tests
    .map(
      (test) =>
        // XML attributes, not URLs — see `core/shared/abapUnit`.
        `<aunit:test containerClass="${escapeXmlAttr(test.containerClass.toUpperCase())}" class="${escapeXmlAttr(test.testClass)}"/>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" title="${escapeXmlAttr(options?.title || tests[0].testClass)}" context="${escapeXmlAttr(options?.context || 'MCP ABAP ADT Client')}">
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
    timeout: 0,
    data: xml,
    headers: {
      'Content-Type': CT_UNIT_TEST_RUN,
    },
  });
}

/** Poll a run. The run id is ADT's, not a class's — see `core/shared/abapUnit`. */
export const getClassUnitTestStatus = getUnitTestRunStatus;

/** A finished run's result document — see `core/shared/abapUnit`. */
export const getClassUnitTestResult = getUnitTestRunResult;

/**
 * Start ABAP Unit test run for a whole class, by object.
 * Uses osl:objectSet instead of aunit:tests, so every test class in the
 * container runs without the caller naming one.
 */
export async function startClassUnitTestRunByObject(
  connection: IAbapConnection,
  className: string,
  options?: IClassUnitTestRunOptions,
): Promise<IAdtWireResponse> {
  return startUnitTestRunByObject(
    connection,
    { name: className, type: 'CLAS' },
    options,
  );
}

// =============================================================================
// The synchronous runner: /abapunit/testruns
// =============================================================================

const CT_TESTRUNS = 'application/xml';
const ACCEPT_TESTRUNS = 'application/xml';

/**
 * Run the ABAP Unit tests of whole classes and answer the finished result —
 * `POST /sap/bc/adt/abapunit/testruns`, one request, no run to poll.
 *
 * The one implementation of this endpoint: the regular runner's `runSync` and
 * the legacy runner's `run` both send it.
 *
 * **Measured:** synchronous on a modern and a legacy on-prem system, over HTTP
 * and over RFC — `<aunit:runResult>` in the POST's answer, no `Location` — and
 * the typed and `application/xml` bodies byte-identical; the legacy system
 * ignores a typed `Accept` and answers `application/xml` either way. Advertised
 * (2026-10-22) by an on-prem system and an ABAP Cloud system alike, beside
 * `/abapunit/runs`; and on an on-prem S/4HANA 2023 that has no `/runs` at all
 * (fr0ster/mcp-abap-adt#286).
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
 *   classes: the format has no way to name one test class inside its
 *   container;
 * - `application/xml` for `Content-Type` and `Accept`.
 *
 * `options` absent sends no `<options>` element — the body the legacy runner
 * has always sent, unchanged. Given, the scope, risk levels and durations go in
 * `<options>` with the same defaults `/runs` gets; `title` and `context` have
 * no place in this format and are not sent.
 */
export async function startClassUnitTestRunSync(
  connection: IAbapConnection,
  classNames: string[],
  options?: IClassUnitTestRunOptions,
): Promise<IAdtWireResponse> {
  const objectRefs = classNames
    .map((name) => {
      return `        <adtcore:objectReference adtcore:uri="${escapeXmlAttr(CLASS.uri(name))}"/>`;
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
