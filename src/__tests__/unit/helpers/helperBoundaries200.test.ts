/**
 * The three helpers whose calls were typed through hand-narrowed interfaces
 * judge every answer: an `exc:exception` inside an HTTP 200 fails the lock
 * targets' leftover lookup and delete, and an ABAP Unit run's poll and result
 * fetch. Each member below honours the `analyse` it is passed, as the
 * library's members do. (The function-group route has its own cases in
 * functionGroupRoute.test.ts.)
 */
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import { runToCompletion } from '../../helpers/abapUnitRun';
import {
  deleteDomain,
  removeLeftoverDataElement,
} from '../../helpers/lockTargets';

const EXCEPTION =
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="ExceptionResourceNoAccess"/><message lang="EN">No authorization</message></exc:exception>';
const RESULT =
  '<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core"><program><testClasses><testClass adtcore:name="LTC"><testMethods><testMethod adtcore:name="OK"/></testMethods></testClass></testClasses></program></aunit:runResult>';

const ok = (value: unknown = '') => ({
  ok: true,
  getResult: () => ({ value }),
});

/** A member answering `data` in a 200, honouring the analyse it is passed. */
function honouring(data: string, value: unknown = data) {
  return jest.fn(async (...args: unknown[]) => {
    const options = args.find(
      (a) => a !== null && typeof a === 'object' && 'analyse' in a,
    ) as { analyse?: (v: unknown, w: unknown) => unknown } | undefined;
    const verdict = options?.analyse
      ? options.analyse(ADT_NO_FAILURE, { status: 200, data })
      : ADT_NO_FAILURE;
    return verdict === ADT_NO_FAILURE
      ? ok(value)
      : { ok: false, getError: () => verdict };
  });
}

describe('lock targets', () => {
  it('fail a leftover lookup answered with an exception document, deleting nothing', async () => {
    const del = jest.fn(async () => ok());
    const client = {
      getDataElement: () => ({
        readMetadata: honouring(EXCEPTION),
        delete: del,
      }),
    };
    await expect(
      removeLeftoverDataElement(
        client as never,
        {
          dataElementName: 'ZX',
        } as never,
      ),
    ).rejects.toThrow(/look for leftover .*No authorization/);
    expect(del).not.toHaveBeenCalled();
  });

  it('fail a delete answered with an exception document', async () => {
    const client = {
      getDomain: () => ({ delete: honouring(EXCEPTION, '') }),
    };
    await expect(
      deleteDomain(client as never, { domainName: 'ZX' } as never),
    ).rejects.toThrow(/No authorization/);
  });
});

describe('runToCompletion', () => {
  const runner = (status: jest.Mock, result: jest.Mock) => ({
    run: jest.fn(async () => ok('RUN1')),
    getStatus: status,
    getResult: result,
  });

  it('fails a poll answered with an exception document, though the result reads fine', async () => {
    await expect(
      runToCompletion(
        runner(
          honouring(EXCEPTION, ''),
          jest.fn(async () => ok(RESULT)),
        ) as never,
        'ZCL_X',
      ),
    ).rejects.toThrow(/poll the run failed .*No authorization/);
  });

  it('fails a result fetch answered with an exception document', async () => {
    await expect(
      runToCompletion(
        runner(
          jest.fn(async () => ok('')),
          honouring(EXCEPTION, RESULT),
        ) as never,
        'ZCL_X',
      ),
    ).rejects.toThrow(/fetch the run result failed .*No authorization/);
  });
});
