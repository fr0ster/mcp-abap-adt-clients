/**
 * Class run operations - execute ABAP classes that implement if_oo_adt_classrun
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';
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
): Promise<IAdtWireResponse> {
  if (!runnable) {
    throw new Error(
      `Class ${className} is not marked as runnable (does not implement if_oo_adt_classrun)`,
    );
  }

  const url = `/sap/bc/adt/oo/classrun/${className}`;

  const headers = {
    Accept: ACCEPT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
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
