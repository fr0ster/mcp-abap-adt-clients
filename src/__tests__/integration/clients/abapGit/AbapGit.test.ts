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

import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { expectResult } from '../../../helpers/contract';
import {
  createTestConnection,
  releaseTestConnection,
} from '../../../helpers/sessionConfig';
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
  let connection: IAbapConnection & ISessionLifecycleAware;
  let abapGit: AdtAbapGitClient;
  let isCloudSystem = false;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(createConnectionLogger());
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
    await releaseTestConnection(connection);
  });

  // Case definitions resolved at declaration time (test-config is static).
  // Environment-dependent gating happens INSIDE each it() via runtime
  // isCloudSystem, because beforeAll runs after these declarations.
  const listCase = getTestCaseDefinition('abapgit', 'list_repos');
  const checkCase = getTestCaseDefinition('abapgit', 'check_external_repo');
  const flowCaseDef = getTestCaseDefinition('abapgit', 'link_pull_unlink_flow');

  function isAvailable(
    testCase: { available_in?: string[] } | null | undefined,
  ): boolean {
    if (!testCase?.available_in) return false;
    return testCase.available_in.includes(isCloudSystem ? 'cloud' : 'onprem');
  }

  it(
    'should list abapGit repositories',
    async () => {
      if (!hasConfig || !listCase || !isAvailable(listCase)) return;
      const repos = expectResult(await abapGit.listRepos(), 'list repos');
      expect(Array.isArray(repos)).toBe(true);
      for (const r of repos) {
        expect(typeof r.package).toBe('string');
        expect(typeof r.url).toBe('string');
        expect(typeof r.status).toBe('string');
      }
    },
    getTimeout('test'),
  );

  it(
    'should probe an external repo',
    async () => {
      if (
        !hasConfig ||
        !checkCase ||
        !checkCase.enabled ||
        !isAvailable(checkCase)
      ) {
        return;
      }
      const info = expectResult(
        await abapGit.checkExternalRepo({ url: checkCase.params.url }),
        'check external repo',
      );
      expect(Array.isArray(info.branches)).toBe(true);
    },
    getTimeout('test'),
  );

  it(
    'should execute link → pull → unlink flow',
    async () => {
      if (
        !hasConfig ||
        !flowCaseDef ||
        !flowCaseDef.enabled ||
        !isAvailable(flowCaseDef)
      ) {
        return;
      }

      await abapGit.link({
        package: flowCaseDef.params.package,
        url: flowCaseDef.params.url,
        branchName: flowCaseDef.params.branch,
      });

      // Four steps since 19.0.0, because a pull was four requests: find the
      // link, post, wait, and read the log if the status says to. The waiting
      // is here because it belongs to whoever is waiting.
      const repos = expectResult(await abapGit.listRepos(), 'repositories');
      const repo = repos.find(
        (r) =>
          r.package.toUpperCase() === flowCaseDef.params.package.toUpperCase(),
      );
      if (!repo?.pullLink) {
        throw new Error(
          `abapGit repository for ${flowCaseDef.params.package} reported no pull link`,
        );
      }

      expectResult(
        await abapGit.pull({
          package: flowCaseDef.params.package,
          pullLink: repo.pullLink,
          branchName: flowCaseDef.params.branch,
        }),
        'pull',
      );

      const deadline = Date.now() + 300_000;
      let status = repo;
      while (status.status === 'R' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        status = expectResult(
          await abapGit.getRepo(flowCaseDef.params.package),
          'repository status',
        ) as typeof repo;
      }
      expect(status.status).not.toBe('R');

      if (typeof (abapGit as any).unlink === 'function') {
        await abapGit.unlink({ package: flowCaseDef.params.package });
      }
    },
    getTimeout('test'),
  );
});
