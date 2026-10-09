/**
 * ABAP Unit test run operations for legacy systems (BASIS < 7.50)
 *
 * Legacy systems use:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml for Content-Type and Accept (not versioned vnd.sap.adt.api.abapunit.* types)
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CLASS } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

const CT_XML = 'application/xml';
const ACCEPT_XML = 'application/xml';

/**
 * Start ABAP Unit test run on legacy systems
 * Uses /sap/bc/adt/abapunit/testruns endpoint with aunit:runConfiguration format
 *
 * There is only a start here. `getClassUnitTestStatusLegacy` and
 * `getClassUnitTestResultLegacy` polled `testruns/{runId}` and
 * `testruns/{runId}/results`, and were removed once the endpoint was measured:
 * the POST answers with the finished result, so there was never a run to poll.
 * Nothing called them — `ClassTestRunnerLegacy` serves both from the response the
 * POST returned — so they were an unmeasured contract kept alive by nobody
 * looking.
 *
 * **Reading the result: `kind` carries the distinction, `severity` does not.** A
 * failed assertion and an uncaught exception both come back
 * `severity="critical"`, measured on one release — so a parser classifying on
 * severity reports a short dump as a failed test. The field that separates them
 * is `kind`: `failedAssertion`, `exception`, `noTestClasses`.
 *
 * Also measured: this endpoint is **synchronous** on both a modern and a legacy
 * on-prem system, over HTTP and over RFC — `<aunit:runResult>` with no
 * `Location`, and the typed and `application/xml` bodies byte-identical. The
 * legacy system ignores the typed `Accept` altogether and answers
 * `application/xml` either way.
 *
 * Legacy format differs from modern:
 * - Root element: aunit:runConfiguration (not aunit:run)
 * - Namespace: http://www.sap.com/adt/aunit (not http://www.sap.com/adt/api/aunit)
 * - Objects via adtcore:objectReferences with URI (not aunit:tests with containerClass/class)
 *   — so a run covers whole classes: this format has no way to name one test
 *   class inside its container, and a caller's test class name is not sent.
 * - Content-Type/Accept: application/xml (not versioned vnd.sap.adt.api.abapunit.*)
 */
export async function startClassUnitTestRunLegacy(
  connection: IAbapConnection,
  classNames: string[],
): Promise<IAdtWireResponse> {
  const objectRefs = classNames
    .map((name) => {
      return `        <adtcore:objectReference adtcore:uri="${CLASS.uri(name)}"/>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
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
    timeout: getTimeout('default'),
    data: xml,
    headers: {
      'Content-Type': CT_XML,
      Accept: ACCEPT_XML,
    },
  });
}
