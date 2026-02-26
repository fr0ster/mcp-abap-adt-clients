/**
 * Integration test for AdtClientBatch — batch read operations
 *
 * Sends multiple independent read/readMetadata calls in a single
 * multipart/mixed HTTP round-trip via /sap/bc/adt/debugger/batch.
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ADT library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=batch/BatchClient
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClientBatch } from '../../../batch/AdtClientBatch';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const { getTimeout } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

describe('AdtClientBatch read operations', () => {
  let connection: IAbapConnection | null = null;
  let hasConfig = false;
  let isCloud = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      if (!config) {
        testsLogger.warn?.(
          'Skipping tests: No .env file or SAP configuration found',
        );
        return;
      }

      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      isCloud = await isCloudEnvironment(connection);

      testsLogger.info?.(
        `AdtClientBatch test environment setup complete (${isCloud ? 'cloud' : 'onprem'})`,
      );
    } catch (error: any) {
      testsLogger.error?.('Failed to setup test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (connection) {
      testsLogger.info?.('AdtClientBatch test environment cleanup complete');
    }
  });

  function getDataLength(data: unknown): number {
    if (typeof data === 'string') {
      return data.length;
    }
    if (data) {
      try {
        return JSON.stringify(data).length;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  describe('batch readMetadata - class + program', () => {
    it(
      'should read class and program metadata in a single batch',
      async () => {
        const testName = 'Batch - class + program readMetadata';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });

        const standardClass = resolver.getStandardObject('class');
        const standardProgram = resolver.getStandardObject('program');

        if (!standardClass) {
          logTestSkip(
            testsLogger,
            testName,
            `Standard class not configured for ${isCloud ? 'cloud' : 'on-premise'}`,
          );
          return;
        }

        // On cloud there are no standard programs — test with class only
        const hasProgramObject = !!standardProgram;

        logTestStart(testsLogger, testName, {
          name: 'batch_read_class_program',
          params: {
            className: standardClass.name,
            programName: standardProgram?.name ?? '(skipped)',
          },
        });

        try {
          const batch = new AdtClientBatch(connection, connectionLogger);

          logTestStep(
            `recording readMetadata for class ${standardClass.name}`,
            testsLogger,
          );
          const classPromise = batch
            .getClass()
            .readMetadata({ className: standardClass.name });

          let programPromise: Promise<any> | undefined;
          if (hasProgramObject) {
            logTestStep(
              `recording readMetadata for program ${standardProgram!.name}`,
              testsLogger,
            );
            programPromise = batch
              .getProgram()
              .readMetadata({ programName: standardProgram!.name });
          }

          logTestStep(
            `executing batch (${hasProgramObject ? 2 : 1} requests)`,
            testsLogger,
          );
          const batchResults = await batch.batchExecute();
          logTestStep(
            `batch returned ${batchResults.length} response(s)`,
            testsLogger,
          );

          expect(batchResults.length).toBe(hasProgramObject ? 2 : 1);

          const classState = await classPromise;
          expect(classState).toBeDefined();
          expect(
            classState?.metadataResult || classState?.readResult,
          ).toBeDefined();
          logTestStep(
            `class metadata length: ${getDataLength(classState?.metadataResult?.data || classState?.readResult?.data)}`,
            testsLogger,
          );

          if (hasProgramObject && programPromise) {
            const programState = await programPromise;
            expect(programState).toBeDefined();
            expect(
              programState?.metadataResult || programState?.readResult,
            ).toBeDefined();
            logTestStep(
              `program metadata length: ${getDataLength(programState?.metadataResult?.data || programState?.readResult?.data)}`,
              testsLogger,
            );
          }

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('batch readMetadata - class + interface', () => {
    it(
      'should read class and interface metadata in a single batch',
      async () => {
        const testName = 'Batch - class + interface readMetadata';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });

        const standardClass = resolver.getStandardObject('class');
        const standardInterface = resolver.getStandardObject('interface');

        if (!standardClass || !standardInterface) {
          logTestSkip(
            testsLogger,
            testName,
            `Standard class or interface not configured for ${isCloud ? 'cloud' : 'on-premise'}`,
          );
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_read_class_interface',
          params: {
            className: standardClass.name,
            interfaceName: standardInterface.name,
          },
        });

        try {
          const batch = new AdtClientBatch(connection, connectionLogger);

          logTestStep(
            `recording readMetadata for class ${standardClass.name}`,
            testsLogger,
          );
          const classPromise = batch
            .getClass()
            .readMetadata({ className: standardClass.name });

          logTestStep(
            `recording readMetadata for interface ${standardInterface.name}`,
            testsLogger,
          );
          const interfacePromise = batch
            .getInterface()
            .readMetadata({ interfaceName: standardInterface.name });

          logTestStep('executing batch (2 requests)', testsLogger);
          const batchResults = await batch.batchExecute();
          logTestStep(
            `batch returned ${batchResults.length} response(s)`,
            testsLogger,
          );

          expect(batchResults.length).toBe(2);

          const classState = await classPromise;
          expect(classState).toBeDefined();
          expect(
            classState?.metadataResult || classState?.readResult,
          ).toBeDefined();
          logTestStep(
            `class metadata length: ${getDataLength(classState?.metadataResult?.data || classState?.readResult?.data)}`,
            testsLogger,
          );

          const interfaceState = await interfacePromise;
          expect(interfaceState).toBeDefined();
          expect(
            interfaceState?.metadataResult || interfaceState?.readResult,
          ).toBeDefined();
          logTestStep(
            `interface metadata length: ${getDataLength(interfaceState?.metadataResult?.data || interfaceState?.readResult?.data)}`,
            testsLogger,
          );

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('batch readMetadata - domain + data element + structure', () => {
    it(
      'should read domain, data element and structure metadata in a single batch',
      async () => {
        const testName =
          'Batch - domain + dataElement + structure readMetadata';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });

        const standardDomain = resolver.getStandardObject('domain');
        const standardDataElement = resolver.getStandardObject('dataElement');
        const standardStructure = resolver.getStandardObject('structure');

        if (!standardDomain || !standardDataElement || !standardStructure) {
          logTestSkip(
            testsLogger,
            testName,
            `Standard DDIC objects not configured for ${isCloud ? 'cloud' : 'on-premise'}`,
          );
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_read_ddic',
          params: {
            domainName: standardDomain.name,
            dataElementName: standardDataElement.name,
            structureName: standardStructure.name,
          },
        });

        try {
          const batch = new AdtClientBatch(connection, connectionLogger);

          logTestStep(
            `recording readMetadata for domain ${standardDomain.name}`,
            testsLogger,
          );
          const domainPromise = batch
            .getDomain()
            .readMetadata({ domainName: standardDomain.name });

          logTestStep(
            `recording readMetadata for data element ${standardDataElement.name}`,
            testsLogger,
          );
          const dataElementPromise = batch
            .getDataElement()
            .readMetadata({ dataElementName: standardDataElement.name });

          logTestStep(
            `recording readMetadata for structure ${standardStructure.name}`,
            testsLogger,
          );
          const structurePromise = batch
            .getStructure()
            .readMetadata({ structureName: standardStructure.name });

          logTestStep('executing batch (3 requests)', testsLogger);
          const batchResults = await batch.batchExecute();
          logTestStep(
            `batch returned ${batchResults.length} response(s)`,
            testsLogger,
          );

          expect(batchResults.length).toBe(3);

          const domainState = await domainPromise;
          expect(domainState).toBeDefined();
          expect(
            domainState?.metadataResult || domainState?.readResult,
          ).toBeDefined();
          logTestStep(
            `domain metadata length: ${getDataLength(domainState?.metadataResult?.data || domainState?.readResult?.data)}`,
            testsLogger,
          );

          const deState = await dataElementPromise;
          expect(deState).toBeDefined();
          expect(deState?.metadataResult || deState?.readResult).toBeDefined();
          logTestStep(
            `data element metadata length: ${getDataLength(deState?.metadataResult?.data || deState?.readResult?.data)}`,
            testsLogger,
          );

          const structureState = await structurePromise;
          expect(structureState).toBeDefined();
          expect(
            structureState?.metadataResult || structureState?.readResult,
          ).toBeDefined();
          logTestStep(
            `structure metadata length: ${getDataLength(structureState?.metadataResult?.data || structureState?.readResult?.data)}`,
            testsLogger,
          );

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('batch reset', () => {
    it(
      'should reset recorded requests without executing',
      async () => {
        const testName = 'Batch - reset without execute';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });

        const standardClass = resolver.getStandardObject('class');
        if (!standardClass) {
          logTestSkip(
            testsLogger,
            testName,
            `Standard class not configured for ${isCloud ? 'cloud' : 'on-premise'}`,
          );
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_reset',
          params: { className: standardClass.name },
        });

        try {
          const batch = new AdtClientBatch(connection, connectionLogger);

          // Record a request
          batch.getClass().readMetadata({ className: standardClass.name });
          const recorder = batch.getRecorder();
          expect(recorder.getRecordedParts().length).toBe(1);
          logTestStep('recorded 1 request', testsLogger);

          // Reset
          batch.reset();
          expect(recorder.getRecordedParts().length).toBe(0);
          logTestStep('reset — 0 requests', testsLogger);

          // batchExecute on empty should return []
          const results = await batch.batchExecute();
          expect(results.length).toBe(0);
          logTestStep('batchExecute on empty returned []', testsLogger);

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('batch sequential usage', () => {
    it(
      'should support multiple sequential batch executions',
      async () => {
        const testName = 'Batch - sequential executions';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });

        const standardClass = resolver.getStandardObject('class');
        const standardDomain = resolver.getStandardObject('domain');

        if (!standardClass || !standardDomain) {
          logTestSkip(
            testsLogger,
            testName,
            `Standard objects not configured for ${isCloud ? 'cloud' : 'on-premise'}`,
          );
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_sequential',
          params: {
            className: standardClass.name,
            domainName: standardDomain.name,
          },
        });

        try {
          const batch = new AdtClientBatch(connection, connectionLogger);

          // First batch: read class
          logTestStep(
            `batch 1: readMetadata class ${standardClass.name}`,
            testsLogger,
          );
          const classPromise = batch
            .getClass()
            .readMetadata({ className: standardClass.name });
          const results1 = await batch.batchExecute();
          expect(results1.length).toBe(1);
          const classState = await classPromise;
          expect(classState).toBeDefined();
          logTestStep(
            `batch 1: class metadata length ${getDataLength(classState?.metadataResult?.data || classState?.readResult?.data)}`,
            testsLogger,
          );

          // Second batch: read domain (recorder was auto-reset after batchExecute)
          logTestStep(
            `batch 2: readMetadata domain ${standardDomain.name}`,
            testsLogger,
          );
          const domainPromise = batch
            .getDomain()
            .readMetadata({ domainName: standardDomain.name });
          const results2 = await batch.batchExecute();
          expect(results2.length).toBe(1);
          const domainState = await domainPromise;
          expect(domainState).toBeDefined();
          logTestStep(
            `batch 2: domain metadata length ${getDataLength(domainState?.metadataResult?.data || domainState?.readResult?.data)}`,
            testsLogger,
          );

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });
});
