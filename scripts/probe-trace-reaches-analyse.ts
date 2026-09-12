/**
 * Does the trace `withRequestTrace` writes reach a strategy's failure?
 *
 * The two packages met through a field name, and the name was wrong: the
 * strategy read `config`, the wrapper writes `request`. A unit test on either
 * side passes with that mismatch in place, so this crosses the seam with a
 * stub connection and no SAP system.
 *
 * Usage: npx ts-node scripts/probe-trace-reaches-analyse.ts
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { analyseException } from '../packages/adt-strategies/src/refusals/analyse';
import { withRequestTrace } from '../src/utils/requestTrace';

const REFUSAL =
  '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNoAccess"/><message lang="EN">no</message></exc:exception>';

async function main(): Promise<void> {
  const connection = withRequestTrace({
    makeAdtRequest: async (request: { method?: string; url?: string }) => ({
      data: REFUSAL,
      status: 200,
      statusText: 'OK',
      headers: {},
    }),
  } as unknown as IAbapConnection);

  const answer = await connection.makeAdtRequest({
    url: '/sap/bc/adt/oo/classes/zcl_probe',
    method: 'POST',
    timeout: 1000,
  });

  const verdict = analyseException(ADT_NO_FAILURE, answer);
  if (verdict === ADT_NO_FAILURE) {
    throw new Error('the refusal was not recognised at all');
  }
  process.stdout.write(
    `request on the failure: ${JSON.stringify(verdict.request)}\n`,
  );
  if (verdict.request?.url !== '/sap/bc/adt/oo/classes/zcl_probe') {
    throw new Error('the trace did not survive the seam');
  }
  process.stdout.write('the trace survives the seam\n');
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
