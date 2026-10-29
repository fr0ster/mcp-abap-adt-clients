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
import {
  analyseException,
  feedDescriptors,
  feedEntries,
  feedGatewayErrorDetail,
  feedGatewayErrors,
  feedSystemMessages,
  feedVariants,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { FeedRepository } from '../../../../runtime/feeds/FeedRepository';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
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
  getTimeout,
  isHttpStatusAllowed,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const feedReading = {
  feeds: feedDescriptors,
  variants: feedVariants,
  entries: feedEntries,
  systemMessages: feedSystemMessages,
  gatewayErrors: feedGatewayErrors,
  gatewayErrorDetail: feedGatewayErrorDetail,
};

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('FeedRepository (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  // Built here rather than taken from `feeds`: the repository
  // answers each feed as its document by default, and these cases assert the
  // entries, so they construct it with the Atom readings.
  let feeds: FeedRepository<typeof feedReading>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      feeds = new FeedRepository(connection, {
        logger: libraryLogger,
        results: feedReading,
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gate('runtime_feeds', 'adt_feeds')(
    'should list available feeds from feed catalog',
    async () => {
      const testName = 'FeedRepository - list';
      const testCase = configuredCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(missingCaseMessage('runtime_feeds', 'adt_feeds'));
      }

      try {
        logTestStep('list feed catalog', testsLogger);
        const catalog = expectResult(
          await feeds.list({ analyse: analyseException }),
          'feed catalog',
        );
        expect(Array.isArray(catalog)).toBe(true);

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

  gate('runtime_feeds', 'adt_feeds')(
    'should list feed variants',
    async () => {
      const testName = 'FeedRepository - variants';
      const testCase = configuredCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(missingCaseMessage('runtime_feeds', 'adt_feeds'));
      }

      try {
        logTestStep('list feed variants', testsLogger);
        // The endpoint requires a category; a run without one answers 400 and
        // this test used to call that a skip.
        // No cast since `@mcp-abap-adt/interfaces@26.0.0` — `IFeedRepository`
        // declares the parameter, so the contract and the endpoint agree.
        const variants = expectResult(
          await feeds.variants('dumps', { analyse: analyseException }),
          'feed variants',
        );
        expect(Array.isArray(variants)).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        const status = (error as any)?.response?.status;
        // 400 is no longer skipped. It meant one thing and the comment here
        // named it correctly — the missing `category` — and skipping on it left
        // the method broken and the note unread. Measured on premise (BASIS 816): without a
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

  gate('runtime_feeds', 'adt_feeds')(
    'should get dumps via feed',
    async () => {
      const testName = 'FeedRepository - dumps';
      const testCase = configuredCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(missingCaseMessage('runtime_feeds', 'adt_feeds'));
      }

      try {
        logTestStep('get dumps via feed', testsLogger);
        const entries = expectResult(
          await feeds.dumps({ analyse: analyseException }),
          'dumps feed',
        );
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

  gate('runtime_feeds', 'adt_feeds')(
    'should fetch arbitrary feed by URL',
    async () => {
      const testName = 'FeedRepository - byUrl';
      const testCase = configuredCase('runtime_feeds', 'adt_feeds');

      logTestStart(testsLogger, testName, {
        name: 'adt_feeds',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(missingCaseMessage('runtime_feeds', 'adt_feeds'));
      }

      try {
        logTestStep('fetch feed by URL /sap/bc/adt/runtime/dumps', testsLogger);
        const entries = expectResult(
          await feeds.byUrl('/sap/bc/adt/runtime/dumps', {
            analyse: analyseException,
          }),
          'feed by URL',
        );
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
