/**
 * abapGit live suite — every AdtAbapGitClient member on the system that
 * serves it, against a private git repository, on run-owned fixtures.
 *
 * **Where it runs.** On an on-premise and on a cloud system, one backend per
 * run (`environment.system`). A member runs where its route is served: the
 * route set by system kind (the template's `available_in`), abapGit at all by
 * discovery (`/sap/bc/adt/abapgit/repos`). It skips, saying why, without
 * `~/.config/mcp-abap-adt/sessions/abapgit-live.env`, without a SAP system,
 * where discovery does not list abapGit, and where the token cannot create
 * branches.
 *
 * **What it runs.** With `ABAPGIT_CLIENT_UNDER_TEST` naming an isolated
 * install of the packed tarballs, adt-clients, adt-strategies and connection
 * are loaded from there alone (`helpers/abapGitUnderTest.ts` proves every
 * resolved file is inside it); without it, the workspace build — the title
 * says which.
 *
 * **Fixtures.** Each run makes its own: two branches of an object-empty
 * commit (GitHub's API, the test token), a package and an interface named
 * with the run id. Onprem: a local package `$ZAGL_<run>`, top level, in
 * software component LOCAL, no request — it deletes completely, where a
 * transportable package keeps every deleted object's directory entry until
 * its request is released (ERRATA). Cloud: `ZAGL_<run>`, a child of the
 * create-package case's parent, in its component (the local one), no
 * request.
 *
 * **Recovery.** Every fixture is in the ledger (`helpers/abapGitLedger.ts`)
 * before it is relied on. A cloud job is correlated by a new log key and a
 * terminal status before anything is cleaned up; a run that cannot correlate
 * keeps its fixtures for the next run, which works the ledger first. Nothing
 * the ledger does not name is deleted; every lock is released with its own
 * handle; the suite's session is logged off at the end.
 *
 * **Gates.** Per backend: functional (every member case available there ran
 * and passed) and T100 (a refusal for the run's key carries `T100KEY-ID` /
 * `T100KEY-NO`). A gate closes only on an executed, passing assertion; a skip
 * leaves it open. One summary line per backend and gate is printed at the end.
 *
 * The token is never printed or logged.
 */

import { randomUUID } from 'node:crypto';
import type {
  IAbapGitReposFacts,
  IAbapGitStagingFacts,
} from '@mcp-abap-adt/adt-strategies';
import {
  ABAPGIT_ERROR_MESSAGES,
  type IAbapGitCredentials,
  type IAbapGitPullSelection,
  type IAbapGitStagedObject,
  type IAbapGitStructuredError,
  type IAdtHeaders,
  type IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import { analyseAbapGitFacts } from '../../../helpers/abapGitFacts';
import {
  type AbapGitBackend,
  AbapGitLedger,
  acquireRunLock,
  cleanUpEntry,
  type ICleanupSteps,
  type ILedgerEntry,
  type IPendingRun,
  type IRunRow,
  RunWaitCancelled,
  waitForRun,
} from '../../../helpers/abapGitLedger';
import {
  GitHubFixtures,
  GitHubRefusal,
  type IAbapGitRemote,
  readRemote,
} from '../../../helpers/abapGitRemote';
import {
  type IAbapGitModules,
  type IConnectionUnderTest,
  loadAbapGitModules,
  openConnectionUnderTest,
  originLabel,
  originLabelFromEnv,
} from '../../../helpers/abapGitUnderTest';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { gate } from '../../../helpers/caseGate';
import {
  expectFailure,
  expectResult,
  releasing,
} from '../../../helpers/contract';
import { judged } from '../../../helpers/judged';
import { presenceOf, removeLeftover } from '../../../helpers/objectPresence';
import {
  getConfig,
  getTargetSystem,
  resolveSystemContext,
  sapIsConfigured,
  targetOf,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createRunIntegrityLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const { loadTestConfig, loadTestEnv } = require('../../../helpers/test-helper');

loadTestEnv();

/** How long the suite waits for one cloud job: the test's own cancel. */
const CLOUD_RUN_WAIT_MS = Number(
  process.env.ABAPGIT_RUN_WAIT_MS ?? 15 * 60_000,
);
const STEP_TIMEOUT_MS = CLOUD_RUN_WAIT_MS + 5 * 60_000;

/** R2/R4/R5 `repo.v3` (the pair recorded for `link` and `pull`). */
const REPO_V3: IAdtHeaders = {
  accept: 'application/abapgit.adt.repo.v3+xml',
  contentType: 'application/abapgit.adt.repo.v3+xml',
};
/** R4 with a selection: the `pull.req.v1` document. */
const PULL_SELECTIVE: IAdtHeaders = {
  accept: 'application/abapgit.adt.repo.v3+xml',
  contentType: 'application/abapgit.adt.repo.pull.req.v1+xml',
};
/** R14, as R13. */
const EXTERNAL_INFO: IAdtHeaders = {
  accept: 'application/abapgit.adt.repo.info.ext.response.v2+xml',
  contentType: 'application/abapgit.adt.repo.info.ext.request.v2+xml',
};

// --- The run's names: every one carries the run id. ---
const RUN = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
/** The run's package: `$ZAGL_<run>` on premise, `ZAGL_<run>` on cloud (set in `beforeAll`). */
let PACKAGE = `ZAGL_${RUN}`;
const INTERFACE = `ZIF_AGL_${RUN}`;
/** A second run-owned interface: changed with the first, left out of the selective pull. */
const INTERFACE_B = `ZIF_AGL_${RUN}_B`;
const BRANCH = `abapgit-live-${RUN.toLowerCase()}`;
const SECOND_BRANCH = `${BRANCH}-b`;
const ref = (branch: string) => `refs/heads/${branch}`;
const marker = (version: string, name: string = INTERFACE) =>
  `run-${RUN.toLowerCase()}${name === INTERFACE_B ? '-b' : ''}-${version}`;
const interfaceSource = (name: string, version: string) =>
  `INTERFACE ${name.toLowerCase()}\n  PUBLIC.\n  CONSTANTS c_marker TYPE string VALUE '${marker(version, name)}'.\nENDINTERFACE.\n`;

// --- Gates. ---
const GATE_CASE_T100 = 't100_refusal';
const BACKENDS: readonly AbapGitBackend[] = ['onprem', 'cloud'];

interface IGateRecord {
  readonly passed: Set<string>;
  t100?: string;
  /** Cases whose assertion is a measured SAP handler fault, not our pass. */
  readonly faults: Set<string>;
}
const gates = new Map<AbapGitBackend, IGateRecord>(
  BACKENDS.map((backend) => [
    backend,
    { passed: new Set<string>(), faults: new Set<string>() },
  ]),
);

/** The member cases the template makes available on `backend`. */
function memberCasesOf(backend: AbapGitBackend): string[] {
  try {
    const cases: { name: string; available_in?: string[] }[] =
      loadTestConfig()?.abapgit?.test_cases ?? [];
    return cases
      .filter((c) => c.name !== GATE_CASE_T100)
      .filter((c) => !c.available_in || c.available_in.includes(backend))
      .map((c) => c.name);
  } catch {
    return [];
  }
}

function backendOrUndefined(): AbapGitBackend | undefined {
  try {
    return getTargetSystem();
  } catch {
    return undefined;
  }
}

function summaryLines(
  thisRun: AbapGitBackend | undefined,
  skipped: string | undefined,
  origin: string,
): string[] {
  return BACKENDS.flatMap((backend) => {
    const record = gates.get(backend) as IGateRecord;
    const required = memberCasesOf(backend);
    const missing = required.filter((name) => !record.passed.has(name));
    // No backend known (no SAP here): every gate is open for the skip.
    const why =
      thisRun !== undefined && backend !== thisRun
        ? `not this run's backend (this run: ${thisRun})`
        : skipped
          ? `skipped: ${skipped}`
          : thisRun === undefined
            ? 'no backend ran'
            : undefined;
    const functional =
      why === undefined && required.length > 0 && missing.length === 0
        ? `CLOSED — ${required.length}/${required.length} member cases passed${record.faults.size > 0 ? ` (${[...record.faults].join('; ')})` : ''}`
        : `OPEN — ${why ?? `${required.length - missing.length}/${required.length} passed; not passed: ${missing.join(', ')}`}`;
    const t100 =
      why === undefined && record.t100
        ? `CLOSED — ${record.t100}`
        : `OPEN — ${why ?? 'the T100 refusal case did not pass'}`;
    return [
      `abapGit gate functional ${backend}: ${functional} [${origin}]`,
      `abapGit gate T100 ${backend}: ${t100} [${origin}]`,
    ];
  });
}

function printSummary(
  skipped: string | undefined,
  origin: string,
  thisRun: AbapGitBackend | undefined,
): void {
  const logger = createRunIntegrityLogger();
  for (const line of summaryLines(thisRun, skipped, origin))
    logger.info?.(line);
}

const remote = readRemote();
const remoteMissing = 'missing' in remote ? remote.missing : undefined;
const registrationSkip =
  remoteMissing ??
  (sapIsConfigured() ? undefined : 'no SAP system configured (MCP_ENV_PATH)');
// A suite whose tests are all skipped runs no hook: the summary is said here.
if (registrationSkip)
  printSummary(
    registrationSkip,
    originLabelFromEnv(),
    sapIsConfigured() ? backendOrUndefined() : undefined,
  );
const describeLive = remoteMissing ? describe.skip : describe;

describeLive(
  `abapGit live — ${originLabelFromEnv()}${remoteMissing ? ` — skipped: ${remoteMissing}` : ''}`,
  () => {
    const testsLogger = createTestsLogger();
    const ledger = new AbapGitLedger();
    const theRemote = remote as IAbapGitRemote;
    const credentials: IAbapGitCredentials = {
      user: theRemote.user,
      password: theRemote.token,
    };
    const github = new GitHubFixtures(theRemote);

    let modules: IAbapGitModules | undefined;
    let opened: IConnectionUnderTest | undefined;
    let backend: AbapGitBackend;
    let systemKey: string;
    let transportRequest: string | undefined;
    /** Why every step returns at once, the gates left open. */
    let skipReason: string | undefined;
    /** A cloud job that could not be correlated: its fixtures stay. */
    let uncorrelated = false;
    let cleanedUp = false;

    let client: ReturnType<typeof makeAdtClient>;
    let abapGit: ReturnType<typeof makeAbapGit>;

    // What the flow learns as it goes.
    let repoKey: string | undefined;
    let staged: readonly IAbapGitStagedObject[] = [];
    let sourceFile: { name: string; path: string } | undefined;
    let sourceFileB: { name: string; path: string } | undefined;
    /** The run lock's release; set once this run holds the lock. */
    let releaseLock: (() => void) | undefined;
    /** The system id (onprem: `environment.default_master_system`). */
    let systemId: string | undefined;
    let currentVersion = 'v1';
    let currentVersionB = 'v1';
    /** The selective pull's log key (`recovery`): its log names the objects. */
    let pullLogKey: string | undefined;
    let selection: IAbapGitPullSelection | undefined;

    function loaded(): IAbapGitModules {
      if (!modules) throw new Error('the modules under test were not loaded');
      return modules;
    }

    function makeAdtClient(
      context: Awaited<ReturnType<typeof resolveSystemContext>>,
      connection: IConnectionUnderTest['connection'],
    ) {
      return new (loaded().clients.AdtClient)(
        connection,
        createLibraryLogger(),
        context,
      );
    }

    function makeAbapGit(connection: IConnectionUnderTest['connection']) {
      const { clients, strategies } = loaded();
      return clients.AdtAbapGitClient.create(connection, {
        logger: createLibraryLogger(),
        results: {
          ...clients.abapGitDocuments,
          repos: strategies.abapGitRepos,
        },
      });
    }

    function requireKey(): string {
      if (!repoKey) throw new Error('link recorded no repository key');
      return repoKey;
    }

    function requireFile(): { name: string; path: string } {
      if (!sourceFile)
        throw new Error('staging found no source file of the interface');
      return sourceFile;
    }

    /** One member case: runs where its gate says, counts once it passed. */
    function memberCase(
      name: string,
      title: string,
      body: () => Promise<void>,
    ): void {
      gate('abapgit', name)(
        `${name}: ${title}`,
        async () => {
          if (skipReason) {
            testsLogger.warn?.(`abapGit ${name} skipped: ${skipReason}`);
            return;
          }
          await body();
          gates.get(backend)?.passed.add(name);
        },
        STEP_TIMEOUT_MS,
      );
    }

    /** R1, quietly: the run's repository row, or `undefined`. */
    async function repoRow(
      key: string,
    ): Promise<IAbapGitReposFacts['repos'][number] | undefined> {
      const answer = expectResult(
        await abapGit.listReposQuiet({ analyse: analyseAbapGitFacts }),
        'list repositories (quiet)',
      );
      return answer.facts.repos.find((row) => row.key === key);
    }

    async function runRow(key: string): Promise<IRunRow | undefined> {
      const row = await repoRow(key);
      return row && { runStatus: row.runStatus, appLogKey: row.appLogKey };
    }

    /** Record a cloud job before its submit: R1's log key now is `L0`. */
    async function notePending(what: string): Promise<IPendingRun> {
      const pending: IPendingRun = {
        what,
        l0: (await runRow(requireKey()))?.appLogKey ?? null,
      };
      ledger.amend(RUN, (entry) => ({ ...entry, pending }));
      return pending;
    }

    /**
     * A cloud submit SAP refused with an answer scheduled no job: the handler
     * schedules it as its last step and rolls back on any exception before
     * (`CL_ABAPGIT_RES_REPO_PUSH->post` L100, L110–114;
     * `CL_ABAPGIT_RES_REPO_PULL->post` L253, L262–267; Code). Its pending
     * entry goes, or the next run waits for a log key that never comes.
     *
     * Only a positively identified handler refusal clears it: an abapGit
     * route answered a failing status with a T100 key — what
     * `cx_adt_rest_abapgit=>raise_with_error` writes. A bare status (a
     * gateway's 502, a 500 page), an unreadable answer or no answer at all
     * keeps it: the job may exist, and the wait or the next run's recovery
     * finds its terminal log key.
     */
    function settleRefusedSubmit(
      answer: IAdtResponse<unknown, IAbapGitStructuredError>,
    ): void {
      if (answer.ok) return;
      const failure = answer.getError();
      const { status, messageClass, messageNumber } = failure.facts;
      const handlerRefusal =
        failure.message === ABAPGIT_ERROR_MESSAGES.refusedWithMessage &&
        status >= 400 &&
        !!messageClass &&
        !!messageNumber &&
        (failure.request?.path ?? '').startsWith('/sap/bc/adt/abapgit/repos/');
      if (handlerRefusal)
        ledger.amend(RUN, (entry) => ({ ...entry, pending: undefined }));
    }

    function fixturesOf(entry: ILedgerEntry | undefined): string {
      if (!entry) return '(no ledger entry)';
      return [
        `run ${entry.runId}`,
        entry.repoKey && `repository ${entry.repoKey}`,
        entry.package && `package ${entry.package}`,
        ...entry.interfaces.map((name) => `interface ${name}`),
        ...entry.branches.map((name) => `branch ${name}`),
      ]
        .filter(Boolean)
        .join(', ');
    }

    /** Wait for a cloud job to end under a new log key; clear it from the ledger. */
    async function awaitCloudRun(pending: IPendingRun): Promise<string> {
      const key = requireKey();
      let row: IRunRow & { readonly appLogKey: string };
      try {
        row = await waitForRun(
          () => runRow(key),
          pending,
          AbortSignal.timeout(CLOUD_RUN_WAIT_MS),
        );
      } catch (error) {
        if (error instanceof RunWaitCancelled) {
          uncorrelated = true;
          throw new Error(
            `${error.message}. The fixtures stay for the next run's ledger: ${fixturesOf(ledger.find(RUN))}`,
          );
        }
        throw error;
      }
      ledger.amend(RUN, (entry) => ({ ...entry, pending: undefined }));
      createRunIntegrityLogger().info?.(
        `abapGit ${pending.what} on ${backend}: status ${row.runStatus}, log key ${row.appLogKey} (before: ${pending.l0 ?? 'none'})`,
      );
      expect(['S', 'W']).toContain(row.runStatus);
      return row.appLogKey;
    }

    async function readSource(
      version: 'active' | 'inactive' = 'active',
      name: string = INTERFACE,
    ): Promise<string> {
      const intf = client.getInterface();
      return String(
        expectResult(
          await intf.read({ interfaceName: name }, version, {
            analyse: loaded().strategies.analyseException,
          }),
          `read ${name} (${version})`,
        ),
      );
    }

    const readActiveSource = () => readSource('active');

    /** Whether `name` is on the system's inactive-objects list. */
    async function isInactive(name: string): Promise<boolean> {
      const list = String(
        expectResult(
          await client.getUtils().getInactiveObjects({
            analyse: loaded().strategies.analyseException,
          }),
          'inactive objects',
        ),
      );
      return list.includes(`adtcore:name="${name}"`);
    }

    /**
     * A cloud pull imports inactive: on SAP Cloud Platform the deserializer
     * writes the inactive worklist instead of activating ("Object activation
     * rejected in SAP Cloud Platform, ABAP Environment -> import inactive
     * version(!)", `CL_ABAPGIT_OBJECTS` L1127–1133; Code; measured
     * 2026-11-22: the job ends `S`, the inactive version holds the pulled
     * source, the active one the previous). So the active version is read
     * still holding the previous source, the pull's change in the inactive
     * one, then the interface is activated, as a user would, and the active
     * version holds it.
     */
    async function activatePulled(
      previous: string,
      version: string,
    ): Promise<void> {
      expect(await readActiveSource()).toContain(marker(previous));
      expect(await readActiveSource()).not.toContain(marker(version));
      expect(await isInactive(INTERFACE)).toBe(true);
      expect(await readSource('inactive')).toContain(marker(version));
      const intf = client.getInterface();
      expectResult(
        await intf.activate(
          { interfaceName: INTERFACE },
          {
            headers: integrationHeadersOf(intf, 'activate'),
            analyse: judged(loaded().strategies.analyseActivation),
          },
        ),
        `activate ${INTERFACE} after the pull`,
      );
      expect(await readActiveSource()).toContain(marker(version));
    }

    /** Change an interface's file in the remote to `version`. */
    async function changeRemote(
      version: string,
      name: string = INTERFACE,
    ): Promise<void> {
      const file = name === INTERFACE_B ? sourceFileB : requireFile();
      if (!file) throw new Error(`staging found no source file of ${name}`);
      const path = `${file.path.replace(/^\/+/, '')}${file.name}`;
      const current = await github.readFile(BRANCH, path);
      if (!current) throw new Error(`the remote branch holds no ${path}`);
      const was = name === INTERFACE_B ? currentVersionB : currentVersion;
      const from = `'${marker(was, name)}'`;
      if (!current.text.includes(from))
        throw new Error(`${path} in the remote does not hold ${from}`);
      await github.writeFile(
        BRANCH,
        path,
        current.text.replace(from, `'${marker(version, name)}'`),
        current.sha,
        `abapGit live test ${RUN}: ${name} ${version}`,
      );
      if (name === INTERFACE_B) currentVersionB = version;
      else currentVersion = version;
    }

    const cleanupSteps = (): ICleanupSteps => ({
      readRow: (key) => runRow(key),
      unlink: async (key) => {
        expectResult(
          await abapGit.unlink(
            { repositoryId: key },
            { analyse: loaded().strategies.analyseException },
          ),
          `unlink ${key}`,
        );
      },
      deleteInterface: async (name, request) => {
        const intf = client.getInterface();
        await removeLeftover(
          `delete interface ${name}`,
          () =>
            intf.readMetadata(
              { interfaceName: name },
              { analyse: loaded().strategies.analyseException },
            ),
          () =>
            intf.delete(
              { interfaceName: name, transportRequest: request },
              {
                headers: integrationHeadersOf(intf, 'delete'),
                analyse: judged(loaded().strategies.analyseDeletion),
              },
            ),
        );
      },
      deletePackage: async (name, request) => {
        // A session that has not saved the package: CL_PACKAGE's session
        // buffer refuses a delete from the session that created it (#176).
        const fresh = await openConnectionUnderTest(
          loaded(),
          createConnectionLogger(),
        );
        try {
          const context = await resolveSystemContext(
            fresh.connection,
            backend === 'cloud',
          );
          const pkg = makeAdtClient(context, fresh.connection).getPackage();
          await removeLeftover(
            `delete package ${name}`,
            () =>
              pkg.readMetadata(
                { packageName: name },
                { analyse: loaded().strategies.analyseException },
              ),
            () =>
              pkg.delete(
                { packageName: name, transportRequest: request },
                {
                  headers: integrationHeadersOf(pkg, 'delete'),
                  analyse: judged(loaded().strategies.analyseDeletion),
                },
              ),
          );
        } finally {
          await fresh.logOff();
        }
      },
      deleteBranch: async (name, remoteUrl) => {
        // In the remote the entry recorded; resolves only once the branch is
        // confirmed absent there, so the ledger retires nothing unconfirmed.
        await github.forUrl(remoteUrl).deleteBranch(name);
      },
    });

    beforeAll(async () => {
      if (!sapIsConfigured()) return;
      // Before anything: recovery and every ledger write below hold only
      // while this run is the one run. A live holder refuses this run.
      releaseLock = acquireRunLock();
      backend = getTargetSystem();
      modules = loadAbapGitModules();
      opened = await openConnectionUnderTest(modules, createConnectionLogger());
      const context = await resolveSystemContext(
        opened.connection,
        backend === 'cloud',
      );
      systemId = context.masterSystem;
      client = makeAdtClient(context, opened.connection);
      abapGit = makeAbapGit(opened.connection);
      systemKey = `${targetOf(getConfig())} client=${process.env.SAP_CLIENT?.split('#')[0]?.trim() ?? ''}`;

      const endpoints = await modules.clients.fetchDiscoveryEndpoints(
        opened.connection,
      );
      if (!endpoints.has('/sap/bc/adt/abapgit/repos')) {
        skipReason =
          'abapGit is not served by this system (discovery lists no /sap/bc/adt/abapgit/repos)';
        return;
      }

      // Work the ledger first: what an earlier run left, on this backend
      // and system only.
      for (const left of ledger.entriesOf(backend, systemKey)) {
        try {
          await cleanUpEntry(
            ledger,
            left.runId,
            cleanupSteps(),
            AbortSignal.timeout(CLOUD_RUN_WAIT_MS),
          );
          createRunIntegrityLogger().info?.(
            `abapGit ledger: cleaned up run ${left.runId}`,
          );
        } catch (error) {
          throw new Error(
            `the ledger holds fixtures of an earlier run that could not be cleaned up — ${fixturesOf(ledger.find(left.runId))}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const config = loadTestConfig();
      const packageCase = (
        config.create_package?.test_cases as
          | { name: string; params?: Record<string, unknown> }[]
          | undefined
      )?.find((c) => c.name === 'adt_package');
      const params = packageCase?.params ?? {};
      const parent = String(params.package_name ?? '');
      if (backend === 'cloud' && !parent)
        throw new Error(
          'create_package[adt_package].params.package_name is not configured: the cloud run package is created under it',
        );
      // Onprem: local, so nothing is recorded and the package deletes
      // completely. A Z package must record changes there, and a deleted
      // object keeps its directory entry until the request is released
      // (measured 2026-11-22; ERRATA).
      if (backend === 'onprem') PACKAGE = `$ZAGL_${RUN}`;
      transportRequest = undefined;

      ledger.put({
        runId: RUN,
        backend,
        systemKey,
        url: theRemote.url,
        branches: [],
        interfaces: [],
        transportRequest,
      });

      // The branches: an object-empty commit, two refs of it.
      let commit: string;
      try {
        commit = await github.createEmptyCommit();
      } catch (error) {
        if (
          error instanceof GitHubRefusal &&
          (error.status === 403 || error.status === 404)
        ) {
          skipReason = `the token cannot write to the repository (${error.message})`;
          ledger.remove(RUN);
          return;
        }
        throw error;
      }
      for (const name of [BRANCH, SECOND_BRANCH]) {
        ledger.amend(RUN, (e) => ({ ...e, branches: [...e.branches, name] }));
        try {
          await github.createBranch(name, commit);
        } catch (error) {
          if (
            error instanceof GitHubRefusal &&
            (error.status === 403 || error.status === 404)
          ) {
            skipReason = `the token cannot create branches (${error.message})`;
            return;
          }
          throw error;
        }
      }

      // The package, recorded before it is created: its name is the run's.
      ledger.amend(RUN, (e) => ({ ...e, package: PACKAGE }));
      const pkg = client.getPackage();
      expectResult(
        await pkg.create(
          {
            packageName: PACKAGE,
            superPackage: backend === 'onprem' ? '' : parent,
            description: `abapGit live test ${RUN}`,
            packageType: 'development',
            softwareComponent:
              backend === 'onprem'
                ? 'LOCAL'
                : String(params.software_component ?? ''),
            transportLayer:
              backend === 'onprem'
                ? undefined
                : String(params.transport_layer ?? '') || undefined,
            transportRequest,
            masterSystem: context.masterSystem,
            responsible: context.responsible,
            recordChanges: false,
          },
          {
            headers: integrationHeadersOf(pkg, 'create'),
            analyse: modules.strategies.analyseException,
          },
        ),
        `create package ${PACKAGE}`,
      );
    }, STEP_TIMEOUT_MS * 2);

    afterAll(async () => {
      const origin = modules
        ? originLabel(modules.origin)
        : originLabelFromEnv();
      const logger = createRunIntegrityLogger();
      if (!releaseLock) {
        // Not this run's ledger: it touched nothing, and cleans up nothing.
        await opened?.logOff().catch(() => undefined);
        printSummary(skipReason, origin, backendOrUndefined());
        return;
      }
      if (opened && !cleanedUp && ledger.find(RUN)) {
        if (uncorrelated) {
          logger.warn?.(
            `abapGit: a cloud job could not be correlated; left for the next run: ${fixturesOf(ledger.find(RUN))}`,
          );
        } else {
          try {
            await cleanUpEntry(
              ledger,
              RUN,
              cleanupSteps(),
              AbortSignal.timeout(CLOUD_RUN_WAIT_MS),
            );
          } catch (error) {
            logger.warn?.(
              `abapGit: cleanup did not finish; left for the next run: ${fixturesOf(ledger.find(RUN))} — ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
      try {
        await opened?.logOff();
      } catch (error) {
        logger.warn?.(
          `abapGit: log off failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      releaseLock();
      printSummary(skipReason, origin, backendOrUndefined());
    }, STEP_TIMEOUT_MS * 2);

    memberCase(
      'list_repos',
      'listRepos answers the repository list',
      async () => {
        const repos = expectResult(
          await abapGit.listRepos({
            analyse: loaded().strategies.analyseException,
          }),
          'list repositories',
        );
        expect(Array.isArray(repos)).toBe(true);
      },
    );

    memberCase(
      'check_external_repo',
      "checkExternalRepo with the credential lists the run's branch",
      async () => {
        const answer = expectResult(
          await abapGit.checkExternalRepo(
            { url: theRemote.url },
            {
              headers: integrationHeadersOf(abapGit, 'checkExternalRepo'),
              credentials,
              analyse: analyseAbapGitFacts,
            },
          ),
          'check external repository',
        );
        expect(answer.facts.branches.map((b) => b.name)).toContain(ref(BRANCH));
      },
    );

    memberCase(
      'branch_info',
      "getBranchInfo answers the run's branch for the run's package",
      async () => {
        const answer = expectResult(
          await abapGit.getBranchInfo(
            { url: theRemote.url, branch: ref(BRANCH), package: PACKAGE },
            {
              headers: EXTERNAL_INFO,
              credentials,
              analyse: analyseAbapGitFacts,
            },
          ),
          'branch info',
        );
        const branch = answer.facts.branches.find(
          (b) => b.name === ref(BRANCH),
        );
        expect(branch).toBeDefined();
        expect(branch?.folderLogic).toBe('FULL');
      },
    );

    memberCase(
      'link',
      "link links the run's package to the run's branch",
      async () => {
        expectResult(
          await abapGit.link(
            {
              package: PACKAGE,
              url: theRemote.url,
              branchName: ref(BRANCH),
              ...(transportRequest ? { transportRequest } : {}),
              ...(backend === 'cloud' ? { folderLogic: 'FULL' as const } : {}),
            },
            {
              headers: integrationHeadersOf(abapGit, 'link'),
              credentials,
              analyse: analyseAbapGitFacts,
            },
          ),
          'link',
        );
        const repos = expectResult(
          await abapGit.listReposQuiet({ analyse: analyseAbapGitFacts }),
          'list repositories (quiet)',
        ).facts.repos;
        const row = repos.find(
          (r) => r.package.toUpperCase() === PACKAGE && r.url === theRemote.url,
        );
        if (!row) throw new Error(`R1 lists no repository for ${PACKAGE}`);
        repoKey = row.key;
        ledger.amend(RUN, (e) => ({ ...e, repoKey: row.key }));
      },
    );

    memberCase(
      'list_repos_quiet',
      'listReposQuiet lists the key with its package, URL and branch',
      async () => {
        const row = await repoRow(requireKey());
        expect(row).toBeDefined();
        expect(row?.package.toUpperCase()).toBe(PACKAGE);
        expect(row?.url).toBe(theRemote.url);
        expect(row?.branchName).toBe(ref(BRANCH));
      },
    );

    /** Create, write and activate one run-owned interface at `v1`. */
    async function createInterface(name: string): Promise<void> {
      const intf = client.getInterface();
      const analyseException = loaded().strategies.analyseException;
      // Recorded before it is created: the name is the run's.
      ledger.amend(RUN, (e) => ({
        ...e,
        interfaces: [...e.interfaces, name],
      }));
      expectResult(
        await intf.create(
          {
            interfaceName: name,
            packageName: PACKAGE,
            description: `abapGit live test ${RUN}`,
            transportRequest,
          },
          {
            headers: integrationHeadersOf(intf, 'create'),
            analyse: analyseException,
          },
        ),
        `create ${name}`,
      );
      await writeSource(name, 'v1');
    }

    /** Write `name`'s source at `version` under its own lock, and activate it. */
    async function writeSource(name: string, version: string): Promise<void> {
      const intf = client.getInterface();
      const analyseException = loaded().strategies.analyseException;
      const handle = expectResult(
        await intf.lock({ interfaceName: name }, { analyse: analyseException }),
        `lock ${name}`,
      );
      // Released with its own handle, whatever the write did.
      await releasing(
        async () =>
          expectResult(
            await intf.update(
              { interfaceName: name, transportRequest },
              {
                headers: integrationHeadersOf(intf, 'update'),
                source: interfaceSource(name, version),
                lockHandle: handle,
                analyse: analyseException,
              },
            ),
            `write ${name}`,
          ),
        () =>
          intf.unlock({ interfaceName: name }, handle, {
            analyse: analyseException,
          }),
        `unlock ${name}`,
      );
      expectResult(
        await intf.activate(
          { interfaceName: name },
          {
            headers: integrationHeadersOf(intf, 'activate'),
            analyse: judged(loaded().strategies.analyseActivation),
          },
        ),
        `activate ${name}`,
      );
    }

    memberCase(
      'staging',
      'getStaging shows the two run-owned interfaces unstaged',
      async () => {
        await createInterface(INTERFACE);
        await createInterface(INTERFACE_B);

        const facts: IAbapGitStagingFacts = expectResult(
          await abapGit.getStaging(
            { key: requireKey() },
            { credentials, analyse: analyseAbapGitFacts },
          ),
          'staging',
        ).facts;
        const sourceOf = (name: string) => {
          const object = facts.unstaged.find((o) => o.name === name);
          const file = object?.files.find((f) => f.name.endsWith('.intf.abap'));
          if (!file)
            throw new Error(`staging lists no .intf.abap file for ${name}`);
          return { name: file.name, path: file.path };
        };
        sourceFile = sourceOf(INTERFACE);
        sourceFileB = sourceOf(INTERFACE_B);
        // Everything unstaged is the run's package's: all of it is pushed.
        staged = facts.unstaged;
      },
    );

    memberCase(
      'push',
      'push commits the interface; the remote branch holds its file',
      async () => {
        if (staged.length === 0)
          throw new Error('staging gave nothing to push');
        const pending =
          backend === 'cloud' ? await notePending('push') : undefined;
        const person = {
          name: 'adt-clients abapGit live test',
          email: `${theRemote.user}@users.noreply.github.com`,
        };
        const pushed = await abapGit.push(
          {
            key: requireKey(),
            staged,
            comment: {
              text: `abapGit live test ${RUN}: ${INTERFACE}`,
              author: person,
              committer: person,
            },
          },
          { credentials, analyse: analyseAbapGitFacts },
        );
        if (pending) settleRefusedSubmit(pushed);
        const answer = expectResult(pushed, 'push');
        if (pending) {
          expect(answer.status).toBe(202);
          await awaitCloudRun(pending);
        } else {
          expect(answer.status).toBe(200);
        }
        const file = requireFile();
        const remoteFile = expectResult(
          await abapGit.getFile(
            { key: requireKey(), filename: file.name, version: 'remote' },
            { credentials, analyse: analyseAbapGitFacts },
          ),
          'file (remote) after push',
        );
        expect(remoteFile.facts.content).toContain(marker('v1'));
        expect(
          await github.readFile(
            BRANCH,
            `${file.path.replace(/^\/+/, '')}${file.name}`,
          ),
        ).toBeDefined();
      },
    );

    memberCase(
      'check_repo',
      'checkRepo answers; on the system where its handler fault was measured, the fault exactly as measured',
      async () => {
        // `abapgit.check_repo_fault_system` names the system the fault was
        // measured on (the onprem overlay); this system's id is
        // `environment.default_master_system`. Anywhere else checkRepo must
        // succeed.
        const faultSystem = String(
          loadTestConfig()?.abapgit?.check_repo_fault_system ?? '',
        ).trim();
        if (
          backend === 'onprem' &&
          faultSystem !== '' &&
          systemId === faultSystem
        ) {
          // A measured SAP handler fault, not a pass of ours: every call ends
          // in the runtime error SYNTAX_ERROR in ZCL_ABAPGIT_RES_REPO_CHECKS,
          // answered 500 as an HTML page with no T100 key (measured
          // 2026-11-22); its syntax check reports "No value was passed to the
          // mandatory parameter IV_SERVICE" at L53, col. 22 (Code; ERRATA).
          // The member returns SAP's answer as it is. What our facts can tell
          // of it is exactly this: the fixed `refused` words, status 500, no
          // T100 key, no git host status — asserted whole, so a 500 that
          // carries anything more fails.
          const key = requireKey();
          const failure = expectFailure(
            await abapGit.checkRepo(
              { key },
              { credentials, analyse: analyseAbapGitFacts },
            ),
            'check repository (the measured SAP handler fault)',
          );
          expect(failure.message).toBe(ABAPGIT_ERROR_MESSAGES.refused);
          expect(
            Object.entries(failure.facts).filter(([, v]) => v !== undefined),
          ).toEqual([['status', 500]]);
          expect(failure.request).toEqual({
            method: 'POST',
            path: `/sap/bc/adt/abapgit/repos/${key}/checks`,
          });
          gates
            .get(backend)
            ?.faults.add(
              `check_repo: the measured SAP handler fault on ${faultSystem} — 500, no T100, SYNTAX_ERROR in ZCL_ABAPGIT_RES_REPO_CHECKS L53 (IV_SERVICE)`,
            );
          return;
        }
        const answer = expectResult(
          await abapGit.checkRepo(
            { key: requireKey() },
            { credentials, analyse: analyseAbapGitFacts },
          ),
          'check repository',
        );
        createRunIntegrityLogger().info?.(
          `abapGit checkRepo success status on ${backend}: ${answer.status}`,
        );
      },
    );

    memberCase(
      'modified_objects',
      'getModifiedObjects lists both interfaces, changed on both sides; the selection keeps the first alone',
      async () => {
        // Changed locally too: a selection decides only for an object
        // modified locally — `warning_overwrite_find` lists those alone and
        // `warning_overwrite_adjust` drops only their 'N' entries
        // (`CL_ABAPGIT_OBJECTS` L1791–1855; Code); a remote-only change is
        // imported whatever the selection (measured 2026-11-22).
        await writeSource(INTERFACE, 'l1');
        await writeSource(INTERFACE_B, 'l1');
        await changeRemote('v2');
        await changeRemote('v2', INTERFACE_B);
        const answer = expectResult(
          await abapGit.getModifiedObjects(
            { key: requireKey() },
            { credentials, analyse: analyseAbapGitFacts },
          ),
          'modified objects',
        );
        const listed = [
          ...answer.facts.overwriteObjects,
          ...answer.facts.packageWarningObjects,
        ];
        expect(listed.map((o) => o.name)).toContain(INTERFACE);
        expect(listed.map((o) => o.name)).toContain(INTERFACE_B);
        // R6's entries handed back unchanged, the second interface left out:
        // the job sets every entry it is not given to 'N'
        // (`CL_ABAPGIT_BG_ACTION_PULL->execute` L123–152; Code).
        const only = (o: { readonly name: string }) => o.name === INTERFACE;
        selection = {
          overwriteObjects: answer.facts.overwriteObjects.filter(only),
          packageWarningObjects:
            answer.facts.packageWarningObjects.filter(only),
        };
      },
    );

    memberCase(
      'pull_repo',
      'pullRepo pulls the changed remote (onprem: the source changed; cloud: 202, the job submitted with the selection R6 answered)',
      async () => {
        if (currentVersion === 'v1') await changeRemote('v2');
        const key = requireKey();
        const branchName = (await repoRow(key))?.branchName ?? ref(BRANCH);
        if (backend === 'cloud') {
          await notePending('pullRepo');
          const pulled = await abapGit.pullRepo(
            { key, branchName, ...(selection ? { selection } : {}) },
            {
              headers: selection ? PULL_SELECTIVE : REPO_V3,
              credentials,
              analyse: analyseAbapGitFacts,
            },
          );
          settleRefusedSubmit(pulled);
          const answer = expectResult(pulled, 'pull');
          // Accepted, not finished: `cancelled_wait` and `recovery` wait.
          expect(answer.status).toBe(202);
          return;
        }
        const answer = expectResult(
          await abapGit.pullRepo(
            {
              key,
              branchName,
              ...(transportRequest ? { transportRequest } : {}),
            },
            { headers: REPO_V3, credentials, analyse: analyseAbapGitFacts },
          ),
          'pull',
        );
        expect(answer.status).toBe(200);
        expect(await readActiveSource()).toContain(marker('v2'));
      },
    );

    memberCase(
      'cancelled_wait',
      'a cancelled wait keeps the fixtures and the ledger entry with its pre-submit log key',
      async () => {
        const pending = new AbapGitLedger().find(RUN)?.pending;
        if (!pending) throw new Error('no submitted pull is pending');
        const cancelled = new AbortController();
        cancelled.abort();
        await expect(
          waitForRun(() => runRow(requireKey()), pending, cancelled.signal),
        ).rejects.toBeInstanceOf(RunWaitCancelled);
        const kept = new AbapGitLedger().find(RUN);
        expect(kept?.pending).toEqual(pending);
        expect(kept?.repoKey).toBe(requireKey());
        expect(kept?.package).toBe(PACKAGE);
        expect(kept?.interfaces).toContain(INTERFACE);
        expect(kept?.branches).toEqual([BRANCH, SECOND_BRANCH]);
        expect(await repoRow(requireKey())).toBeDefined();
      },
    );

    memberCase(
      'recovery',
      'the ledger read afresh: the wait ends on a new log key and a terminal status; the source changed',
      async () => {
        // A fresh reader of the file, as a restarted run would read it.
        const pending = new AbapGitLedger().find(RUN)?.pending;
        if (!pending) throw new Error('the ledger holds no pending pull');
        const l1 = await awaitCloudRun(pending);
        expect(l1).not.toBe(pending.l0);
        pullLogKey = l1;
        expect(new AbapGitLedger().find(RUN)?.pending).toBeUndefined();
        // Only the selected interface was imported: the second one, changed
        // on both sides, keeps its local source and gets no inactive version.
        expect(await isInactive(INTERFACE_B)).toBe(false);
        expect(await readSource('active', INTERFACE_B)).toContain(
          marker('l1', INTERFACE_B),
        );
        await activatePulled('l1', 'v2');
      },
    );

    memberCase(
      'run_log',
      "getRunLog by the selective pull's new log key lists the run's interface, imported",
      async () => {
        // The pull's log, not the push's: a push's log holds one entry with
        // no object (measured on cloud 2026-11-22: type and name empty,
        // status S, message type I); a pull's names each object it imported
        // (measured: the package and the interface, status S).
        if (!pullLogKey) throw new Error('the selective pull left no log key');
        const answer = expectResult(
          await abapGit.getRunLog(
            { key: requireKey(), appLogKey: pullLogKey },
            { analyse: analyseAbapGitFacts },
          ),
          'run log',
        );
        const mine = answer.facts.objects.find((o) => o.name === INTERFACE);
        expect(mine).toBeDefined();
        expect(['S', 'W']).toContain(mine?.status);
        // The interface left out is listed too, status S, with "not imported;
        // no import requested" (`CL_ABAPGIT_OBJECTS` L308–313; Code): the
        // facts keep no message text, so `recovery` proves it from the
        // sources instead.
      },
    );

    memberCase(
      'pull_repo_in_dialog',
      'pullRepoInDialog pulls in the request (202); the source changed again',
      async () => {
        await changeRemote('v3');
        const key = requireKey();
        const branchName = (await repoRow(key))?.branchName ?? ref(BRANCH);
        const answer = expectResult(
          await abapGit.pullRepoInDialog(
            { key, branchName },
            { headers: REPO_V3, credentials, analyse: analyseAbapGitFacts },
          ),
          'pull in dialog',
        );
        expect(answer.status).toBe(202);
        // Finished, not accepted (R5 runs the pull in the request), and
        // imported inactive as every cloud pull.
        await activatePulled('v2', 'v3');
      },
    );

    memberCase('status', 'getStatus answers its text', async () => {
      const answer = expectResult(
        await abapGit.getStatus(
          { key: requireKey() },
          { analyse: analyseAbapGitFacts },
        ),
        'status',
      );
      expect(typeof answer.facts.text).toBe('string');
      testsLogger.info?.(`abapGit getStatus text: ${answer.facts.text}`);
    });

    memberCase(
      'switch_branch',
      "switchBranch moves to the second branch and back; R1's branch follows",
      async () => {
        const key = requireKey();
        for (const branch of [SECOND_BRANCH, BRANCH]) {
          const answer = expectResult(
            await abapGit.switchBranch(
              { key, branch: ref(branch), create: false },
              { credentials, analyse: analyseAbapGitFacts },
            ),
            `switch to ${branch}`,
          );
          createRunIntegrityLogger().info?.(
            `abapGit switchBranch success status on ${backend}: ${answer.status}`,
          );
          expect((await repoRow(key))?.branchName).toBe(ref(branch));
        }
      },
    );

    memberCase(
      'file',
      "getFile answers the interface's current source, local and remote",
      async () => {
        const file = requireFile();
        for (const version of ['local', 'remote'] as const) {
          const answer = expectResult(
            await abapGit.getFile(
              { key: requireKey(), filename: file.name, version },
              { credentials, analyse: analyseAbapGitFacts },
            ),
            `file (${version})`,
          );
          expect(answer.facts.content).toContain(marker(currentVersion));
        }
      },
    );

    gate('abapgit', GATE_CASE_T100)(
      `${GATE_CASE_T100}: getFile of the remote without a credential — the private remote's refusal carries T100KEY-ID / T100KEY-NO`,
      async () => {
        if (skipReason) {
          testsLogger.warn?.(
            `abapGit ${GATE_CASE_T100} skipped: ${skipReason}`,
          );
          return;
        }
        // Not a file the repository does not hold: R12 answers that 200 with
        // an empty text — it reads the file table without checking that the
        // file was found (onprem `ZCL_ABAPGIT_RES_REPO_FILES->get` L69, cloud
        // L80; Code; measured on premise 2026-11-22). Without a credential
        // SAP reads the private remote anonymously, the git host refuses, and
        // the abapGit exception is answered 500 with its T100 key (onprem
        // L84–87, cloud L97–100; measured 2026-11-22 on both systems: 500,
        // 00/001).
        const file = requireFile();
        const failure = expectFailure(
          await abapGit.getFile(
            { key: requireKey(), filename: file.name, version: 'remote' },
            // No credential: no `Username` / `Password` header at all.
            { analyse: analyseAbapGitFacts },
          ),
          'file of the remote without a credential',
        );
        const { messageClass, messageNumber, status } = failure.facts;
        expect(messageClass).toEqual(expect.any(String));
        expect(messageClass).not.toBe('');
        expect(messageNumber).toEqual(expect.any(String));
        expect(messageNumber).not.toBe('');
        const record = gates.get(backend);
        if (record)
          record.t100 = `status ${status}, T100 ${messageClass}/${messageNumber} on getFile of the remote without a credential`;
      },
      STEP_TIMEOUT_MS,
    );

    memberCase(
      'unlink',
      'unlink, then the interface, package and branches go (cloud: after every job is terminal)',
      async () => {
        if (uncorrelated)
          throw new Error(
            `a cloud job could not be correlated: nothing is cleaned up, the next run works the ledger (${fixturesOf(ledger.find(RUN))})`,
          );
        await cleanUpEntry(
          ledger,
          RUN,
          cleanupSteps(),
          AbortSignal.timeout(CLOUD_RUN_WAIT_MS),
        );
        cleanedUp = true;
        expect(ledger.find(RUN)).toBeUndefined();
        const pkg = client.getPackage();
        const presence = presenceOf(
          await pkg.readMetadata(
            { packageName: PACKAGE },
            { analyse: loaded().strategies.analyseException },
          ),
          `package ${PACKAGE}`,
        );
        if (presence.present === 'unknown') throw new Error(presence.reason);
        expect(presence.present).toBe(false);
        expect(await github.branchExists(BRANCH)).toBe(false);
        expect(await github.branchExists(SECOND_BRANCH)).toBe(false);
      },
    );
  },
);
