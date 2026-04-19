/**
 * AbapGit client integration tests.
 *
 * AdtAbapGitClient is a standalone top-level class, instantiated
 * directly — not accessed via a factory on AdtClient (which is
 * reserved for IAdtObject implementations only).
 *
 * - listRepos: always runs (read-only, no mutation)
 * - checkExternalRepo: always runs (read-only probe)
 * - link_pull_unlink_flow: gated behind the test-config enabled flag
 *   AND available_in. Mutates the target system.
 *
 * Debug flags:
 *   DEBUG_ADT_TESTS=true     — test harness logs
 *   DEBUG_ADT_LIBS=true      — library runtime logs
 */

import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import type { IAdtAbapGitClient } from '../../../../clients/abapGit';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

dotenv.config();

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  getTimeout,
} = require('../../../helpers/test-helper');

describe('AbapGit (standalone AdtAbapGitClient)', () => {
  let connection: IAbapConnection;
  let abapGit: IAdtAbapGitClient;
  let isCloudSystem = false;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, createConnectionLogger());
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      abapGit = new AdtAbapGitClient(connection, createLibraryLogger());
      hasConfig = true;
    } catch (err) {
      createTestsLogger().warn(
        `beforeAll setup failed: ${(err as Error).message}`,
      );
    }
  }, 120_000);

  afterAll(async () => {
    if (connection) await (connection as any).disconnect?.();
  });

  const listCase = getTestCaseDefinition('abapgit', 'list_repos');
  const listAvailable = listCase
    ? (listCase.available_in as string[]).includes(
        isCloudSystem ? 'cloud' : 'onprem',
      )
    : false;

  (listAvailable ? it : it.skip)(
    'should list abapGit repositories',
    async () => {
      if (!hasConfig) throw new Error('test config missing');
      const repos = await abapGit.listRepos();
      expect(Array.isArray(repos)).toBe(true);
      for (const r of repos) {
        expect(typeof r.package).toBe('string');
        expect(typeof r.url).toBe('string');
        expect(typeof r.status).toBe('string');
      }
    },
    getTimeout('test'),
  );

  const checkCase = getEnabledTestCase('abapgit', 'check_external_repo');
  (checkCase ? it : it.skip)(
    'should probe an external repo',
    async () => {
      if (!hasConfig || !checkCase) throw new Error('test config missing');
      const info = await abapGit.checkExternalRepo({
        url: checkCase.params.url,
      });
      expect(Array.isArray(info.branches)).toBe(true);
    },
    getTimeout('test'),
  );

  const flowCase = getEnabledTestCase('abapgit', 'link_pull_unlink_flow');
  (flowCase ? it : it.skip)(
    'should execute link → pull → unlink flow',
    async () => {
      if (!hasConfig || !flowCase) throw new Error('test config missing');

      await abapGit.link({
        package: flowCase.params.package,
        url: flowCase.params.url,
        branchName: flowCase.params.branch,
      });

      const pullResult = await abapGit.pull({
        package: flowCase.params.package,
        branchName: flowCase.params.branch,
        pollIntervalMs: 2000,
        maxPollDurationMs: 300_000,
      });
      expect(pullResult.finalStatus.status).not.toBe('R');

      if (typeof (abapGit as any).unlink === 'function') {
        await abapGit.unlink({ package: flowCase.params.package });
      }
    },
    getTimeout('test'),
  );
});
