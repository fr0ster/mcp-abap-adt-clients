/**
 * Integration test for FeedRepository
 * Tests feed reader APIs using AdtRuntimeClient.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Runtime client library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/feeds/FeedRepository.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import type { FeedRepository } from '../../../../runtime/feeds/FeedRepository';
import {
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  getTimeout,
  isHttpStatusAllowed,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('FeedRepository (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let runtime: AdtRuntimeClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it(
    'should list available feeds from feed catalog',
    async () => {
      const testName = 'FeedRepository - list';
      const testCase = getEnabledTestCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'runtime_feeds/adt_feeds not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        logTestStep('list feed catalog', testsLogger);
        const feeds = await runtime.getFeeds().list();
        expect(feeds).toBeDefined();
        expect(Array.isArray(feeds)).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should list feed variants',
    async () => {
      const testName = 'FeedRepository - variants';
      const testCase = getEnabledTestCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'runtime_feeds/adt_feeds not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        logTestStep('list feed variants', testsLogger);
        // The endpoint requires a category; a run without one answers 400 and
        // this test used to call that a skip.
        // `getFeeds()` is typed `IFeedRepository`, and that contract — which
        // lives in @mcp-abap-adt/interfaces — still declares `variants()` with
        // no parameter, while the endpoint requires a category. The cast is the
        // seam between the two, and goes when the contract catches up —
        // fr0ster/mcp-abap-adt-interfaces#54.
        const variants = await (runtime.getFeeds() as FeedRepository).variants(
          'dumps',
        );
        expect(variants).toBeDefined();
        expect(Array.isArray(variants)).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        const status = (error as any)?.response?.status;
        if (status === 406) {
          logTestSkip(
            testsLogger,
            testName,
            `HTTP ${status} — endpoint not acceptable on this system`,
          );
          return;
        }
        // 400 is no longer skipped. It meant one thing and the comment here
        // named it correctly — the missing `category` — and skipping on it left
        // the method broken and the note unread. Measured on E19: without a
        // category the endpoint answers 400 SADT_RESOURCE/017, with one it
        // answers 200. If a 400 comes back now, it is news.
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should get dumps via feed',
    async () => {
      const testName = 'FeedRepository - dumps';
      const testCase = getEnabledTestCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'runtime_feeds/adt_feeds not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        logTestStep('get dumps via feed', testsLogger);
        const entries = await runtime.getFeeds().dumps();
        expect(entries).toBeDefined();
        expect(Array.isArray(entries)).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should fetch arbitrary feed by URL',
    async () => {
      const testName = 'FeedRepository - byUrl';
      const testCase = getEnabledTestCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'runtime_feeds/adt_feeds not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        logTestStep('fetch feed by URL /sap/bc/adt/runtime/dumps', testsLogger);
        const entries = await (runtime.getFeeds() as FeedRepository).byUrl(
          '/sap/bc/adt/runtime/dumps',
        );
        expect(entries).toBeDefined();
        expect(Array.isArray(entries)).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
