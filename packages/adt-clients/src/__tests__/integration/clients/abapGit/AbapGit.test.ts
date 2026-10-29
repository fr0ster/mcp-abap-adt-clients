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

import {
  abapGitExternalRepo,
  abapGitRepos,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import { abapGitDocuments } from '../../../../clients/abapGit/types';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
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

const { getTimeout } = require('../../../helpers/test-helper');

describe('AbapGit (standalone AdtAbapGitClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  // Read with the adt-strategies readings: the client answers documents, and
  // these assertions are about the shapes a consumer asks for.
  const results = {
    ...abapGitDocuments,
    repos: abapGitRepos,
    externalRepo: abapGitExternalRepo,
  };
  let abapGit: AdtAbapGitClient<typeof results>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(createConnectionLogger());
      abapGit = new AdtAbapGitClient(connection, {
        logger: createLibraryLogger(),
        results,
      });
    } catch (err) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(err, createTestsLogger());
    }
  }, 120_000);

  afterAll(async () => {
    await releaseTestConnection(connection);
  });

  function configured(name: string) {
    const testCase = configuredCase('abapgit', name);
    if (!testCase) throw new Error(missingCaseMessage('abapgit', name));
    return testCase;
  }

  gate('abapgit', 'list_repos')(
    'should list abapGit repositories',
    async () => {
      const repos = expectResult(
        await abapGit.listRepos({ analyse: analyseException }),
        'list repos',
      );
      expect(Array.isArray(repos)).toBe(true);
      for (const r of repos) {
        expect(typeof r.package).toBe('string');
        expect(typeof r.url).toBe('string');
        expect(typeof r.status).toBe('string');
      }
    },
    getTimeout('test'),
  );

  gate('abapgit', 'check_external_repo')(
    'should probe an external repo',
    async () => {
      const checkCase = configured('check_external_repo');
      const info = expectResult(
        await abapGit.checkExternalRepo(
          { url: checkCase.params.url },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(abapGit, 'checkExternalRepo'),
          },
        ),
        'check external repo',
      );
      expect(Array.isArray(info.branches)).toBe(true);
    },
    getTimeout('test'),
  );

  gate('abapgit', 'link_pull_unlink_flow')(
    'should execute link → pull → unlink flow',
    async () => {
      const flowCaseDef = configured('link_pull_unlink_flow');

      expectResult(
        await abapGit.link(
          {
            package: flowCaseDef.params.package,
            url: flowCaseDef.params.url,
            branchName: flowCaseDef.params.branch,
          },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(abapGit, 'link'),
          },
        ),
        'link',
      );

      // Four steps since 19.0.0, because a pull was four requests: find the
      // link, post, wait, and read the log if the status says to. The waiting
      // is here because it belongs to whoever is waiting.
      const repos = expectResult(
        await abapGit.listRepos({ analyse: analyseException }),
        'repositories',
      );
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
        await abapGit.pull(
          {
            package: flowCaseDef.params.package,
            pullLink: repo.pullLink,
            branchName: flowCaseDef.params.branch,
          },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(abapGit, 'pull'),
          },
        ),
        'pull',
      );

      // The first read is unconditional. `repo` was fetched *before* the POST,
      // so its status says nothing about this pull — starting the loop on it
      // would skip the wait entirely and let `unlink` run against a job still
      // in progress. There is no `getRepo` since interfaces-adt 11: the list,
      // read by the caller's strategy, is the one resource, and finding the
      // row is the caller's.
      const readStatus = async () => {
        const row = expectResult(
          await abapGit.listRepos({ analyse: analyseException }),
          'repository status',
        ).find((r) => r.repositoryId === repo.repositoryId);
        if (!row) throw new Error(`repository ${repo.repositoryId} vanished`);
        return row;
      };

      const deadline = Date.now() + 300_000;
      let status = await readStatus();
      while (status.status === 'R' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        status = await readStatus();
      }
      expect(status.status).not.toBe('R');

      if (!repo.repositoryId) {
        throw new Error(
          'listRepos reported no key, so there is nothing to unlink by',
        );
      }
      expectResult(
        await abapGit.unlink(
          { repositoryId: repo.repositoryId },
          { analyse: analyseException },
        ),
        'unlink',
      );
    },
    getTimeout('test'),
  );
});
