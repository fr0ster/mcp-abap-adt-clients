/**
 * The generic ABAP Unit runner on 7.40: no `/abapunit/runs`, so an object
 * target and a package target are refused without a request, and so are the
 * poll and the result; the URI run goes to `/abapunit/testruns`, as on a
 * modern system.
 */

import { AbapUnitTestRunner } from '@mcp-abap-adt/adt-clients';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { expectFailure } from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { RecordingConnection } from '../../../../../adt-clients/src/__tests__/helpers/recordingConnection';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { AbapUnitTestRunnerLegacy } from '../../../executors/abapUnit/AbapUnitTestRunnerLegacy';

const HEADERS = { accept: 'application/xml', contentType: 'application/xml' };

describe('AbapUnitTestRunnerLegacy', () => {
  it('refuses an object target without a request', async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunnerLegacy(connection);

    const refusal = expectFailure(
      // @ts-expect-error -- 7.40 has no /abapunit/runs; the refusal is for a caller outside the type system
      await runner.run({ kind: 'object', name: 'ZCL_TESTED', type: 'CLAS/OC' }),
      'object target',
    );

    expect(refusal.origin).toBe('refusal');
    expect(refusal.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(refusal.message).toContain('no /sap/bc/adt/abapunit/runs');
    expect(connection.sent).toEqual([]);
  });

  it('refuses a package target without a request', async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunnerLegacy(connection);

    const refusal = expectFailure(
      // @ts-expect-error -- 7.40 has no /abapunit/runs; the refusal is for a caller outside the type system
      await runner.run({
        kind: 'package',
        name: '$ZAC_PKG',
        includeSubpackages: true,
      }),
      'package target',
    );

    expect(refusal.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(refusal.message).toContain('no /sap/bc/adt/abapunit/runs');
    expect(connection.sent).toEqual([]);
  });

  it('refuses to poll or fetch without a request', async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunnerLegacy(connection);

    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    const status = expectFailure(await runner.getStatus(), 'status');
    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    const result = expectFailure(await runner.getResult(), 'result');

    expect(status.message).toContain('no run to poll');
    expect(result.message).toContain('no result to fetch');
    expect(connection.sent).toEqual([]);
  });

  it('keeps the URI run on /testruns: the modern request, byte for byte', async () => {
    const legacy = new RecordingConnection();
    const modern = new RecordingConnection();
    const uris = ['/sap/bc/adt/oo/classes/zcl_tested'] as const;

    await new AbapUnitTestRunnerLegacy(legacy).runSync(uris, {
      headers: HEADERS,
    });
    await new AbapUnitTestRunner(modern).runSync(uris, { headers: HEADERS });

    expect(legacy.sent).toHaveLength(1);
    expect(legacy.sent[0]?.url).toBe('/sap/bc/adt/abapunit/testruns');
    expect(legacy.sent[0]?.headers).toEqual({
      Accept: 'application/xml',
      'Content-Type': 'application/xml',
    });
    expect(legacy.sent).toEqual(modern.sent);
  });

  it('is what AdtExecutorLegacy hands out', () => {
    expect(
      new AdtExecutorLegacy(new RecordingConnection()).getAbapUnitTestRunner(),
    ).toBeInstanceOf(AbapUnitTestRunnerLegacy);
  });
});
