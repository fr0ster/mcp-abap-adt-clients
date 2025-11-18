/**
 * Unit test for ProgramBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/ProgramBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { ProgramBuilder, ProgramBuilderLogger } from '../../../core/program';
import { deleteProgram } from '../../../core/program/delete';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: ProgramBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('ProgramBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function deleteProgramIfExists(programName: string): Promise<void> {
    try {
      await deleteProgram(connection, { program_name: programName });
    } catch (error: any) {
      if (error.response?.status !== 404 && !error.message?.includes('not found')) {
        throw error;
      }
    }
  }

  describe('Builder methods', () => {
    it('should chain builder methods', () => {
      const builder = new ProgramBuilder(connection, builderLogger, {
        programName: 'Z_TEST',
        packageName: 'ZPKG',
        sourceCode: 'REPORT Z_TEST.'
      });

      const result = builder
        .setPackage('ZPKG2')
        .setRequest('TR001')
        .setName('Z_TEST2')
        .setCode('REPORT Z_TEST2.')
        .setDescription('Test')
        .setProgramType('executable');

      expect(result).toBe(builder);
      expect(builder.getProgramName()).toBe('Z_TEST2');
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then()', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_program', 'builder_program');
      if (!testCase) {
        return;
      }

      const programName = testCase.params.program_name;
      await deleteProgramIfExists(programName);

      let builder: ProgramBuilder | null = null;
      try {
        builder = new ProgramBuilder(connection, builderLogger, {
        programName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        programType: testCase.params.program_type,
        sourceCode: testCase.params.source_code
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate());

      expect(builder.getCreateResult()).toBeDefined();
      expect(builder.getActivateResult()).toBeDefined();
      } finally {
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        await deleteProgramIfExists(programName);
      }
    }, getTimeout('test'));

    it('should interrupt chain on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new ProgramBuilder(connection, builderLogger, {
        programName: 'Z_TEST_INVALID',
        packageName: 'INVALID_PACKAGE',
        sourceCode: 'REPORT Z_TEST_INVALID.'
      });

      let errorCaught = false;
      try {
        await builder.create();
      } catch (error) {
        errorCaught = true;
        expect(builder.getErrors().length).toBeGreaterThan(0);
      }

      expect(errorCaught).toBe(true);
    }, 30000);
  });

  describe('Error handling', () => {
    it('should execute .catch() on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new ProgramBuilder(connection, builderLogger, {
        programName: 'Z_TEST_ERROR',
        packageName: 'INVALID',
        sourceCode: 'REPORT Z_TEST_ERROR.'
      });

      let catchExecuted = false;
      await builder
        .create()
        .catch(() => {
          catchExecuted = true;
        });

      expect(catchExecuted).toBe(true);
    }, 30000);

    it('should execute .finally() even on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new ProgramBuilder(connection, builderLogger, {
        programName: 'Z_TEST_FINALLY',
        packageName: 'INVALID',
        sourceCode: 'REPORT Z_TEST_FINALLY.'
      });

      let finallyExecuted = false;
      try {
        await builder.create();
      } catch (error) {
        // Error expected
      } finally {
        finallyExecuted = true;
      }

      expect(finallyExecuted).toBe(true);
    }, 30000);
  });

  describe('Result storage', () => {
    it('should store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_program', 'builder_program');
      if (!testCase) {
        return;
      }

      const programName = testCase.params.program_name;
      await deleteProgramIfExists(programName);

      let builder: ProgramBuilder | null = null;
      try {
        builder = new ProgramBuilder(connection, builderLogger, {
        programName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        programType: testCase.params.program_type,
        sourceCode: testCase.params.source_code
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate());

      const results = builder.getResults();
      expect(results.create).toBeDefined();
      expect(results.update).toBeDefined();
      expect(results.check).toBeDefined();
      expect(results.unlock).toBeDefined();
      expect(results.activate).toBeDefined();
      } finally {
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        await deleteProgramIfExists(programName);
      }
    }, getTimeout('test'));
  });

  describe('Full workflow', () => {
    it('should execute full workflow and store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_program', 'builder_program');
      if (!testCase) {
        return;
      }

      const programName = testCase.params.program_name;
      await deleteProgramIfExists(programName);

      let builder: ProgramBuilder | null = null;
      try {
        builder = new ProgramBuilder(connection, builderLogger, {
        programName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        programType: testCase.params.program_type,
        sourceCode: testCase.params.source_code
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
          .then(b => b.activate());

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);
      } finally {
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        await deleteProgramIfExists(programName);
      }
    }, getTimeout('test'));
  });

  describe('Getters', () => {
    it('should return correct values from getters', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_program', 'builder_program');
      if (!testCase) {
        return;
      }

      const programName = testCase.params.program_name;
      await deleteProgramIfExists(programName);

      const builder = new ProgramBuilder(connection, builderLogger, {
        programName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        sourceCode: testCase.params.source_code
      });

      expect(builder.getProgramName()).toBe(programName);
      expect(builder.getSessionId()).toBeDefined();
      expect(builder.getLockHandle()).toBeUndefined();

      await builder.create();
      expect(builder.getCreateResult()).toBeDefined();
    }, 30000);
  });
});

