/**
 * Unit tests for AdtServiceDefinition.update() readiness polling.
 *
 * A fake IAbapConnection is used to observe which version the post-update
 * readiness read targets. A live system cannot prove this deterministically:
 * the readiness read is wrapped in try/catch, so a wrong version is swallowed
 * as a warning and the flow still reports success.
 *
 * All object parameters come from test-config.yaml via TestConfigResolver.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtServiceDefinition } from '../../../core/serviceDefinition/AdtServiceDefinition';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestStart,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const testsLogger: ILogger = createTestsLogger();

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>HANDLE123</LOCK_HANDLE></DATA></asx:values></asx:abap>';

/**
 * Fake connection: answers LOCK with a handle, 404s any read of the active
 * version (a freshly created service definition has no active version yet),
 * and answers everything else with 200/empty.
 */
function fakeConnection(): { conn: IAbapConnection; calls: any[] } {
  const calls: any[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    const url = String(req.url);
    if (url.includes('_action=LOCK')) {
      return { status: 200, data: LOCK_XML };
    }
    if (req.method === 'GET' && url.includes('version=active')) {
      const error: any = new Error('Not Found');
      error.response = { status: 404, data: '' };
      throw error;
    }
    return { status: 200, data: '' };
  });
  const setSessionType = jest.fn();
  return {
    conn: { makeAdtRequest, setSessionType } as unknown as IAbapConnection,
    calls,
  };
}

describe('AdtServiceDefinition update readiness read', () => {
  const resolver = new TestConfigResolver({
    handlerName: 'create_service_definition',
    testCaseName: 'adt_service_definition',
    logger: testsLogger,
  });
  const params = resolver.getParams();
  const serviceDefinitionName: string = params.service_definition_name;
  const sourceCode: string =
    params.source_code ||
    `@EndUserText.label: 'test'\ndefine service ${serviceDefinitionName} {\n}`;

  it('polls the version it just wrote (inactive), not the active one', async () => {
    logTestStart(
      testsLogger,
      'ServiceDefinition update - readiness read targets inactive',
      {
        name: 'update_readiness_read_inactive',
        params: { service_definition_name: serviceDefinitionName },
      },
    );

    const { conn, calls } = fakeConnection();
    const handler = new AdtServiceDefinition(conn, testsLogger);

    await handler.update({ serviceDefinitionName, sourceCode });

    const putIndex = calls.findIndex(
      (c) => c.method === 'PUT' && String(c.url).includes('/source/main'),
    );
    expect(putIndex).toBeGreaterThanOrEqual(0);

    const readinessRead = calls
      .slice(putIndex + 1)
      .find(
        (c) => c.method === 'GET' && String(c.url).includes('withLongPolling'),
      );

    expect(readinessRead).toBeDefined();
    expect(String(readinessRead.url)).toContain('version=inactive');

    logTestSuccess(
      testsLogger,
      'ServiceDefinition update - readiness read targets inactive',
    );
    logTestEnd(
      testsLogger,
      'ServiceDefinition update - readiness read targets inactive',
    );
  });
});
