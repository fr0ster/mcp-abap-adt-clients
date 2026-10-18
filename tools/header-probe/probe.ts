/**
 * Header probe: how SAP answers each member's request headers.
 *
 * Prepare:
 *   - `.env` in the repository root with the SAP connection (SAP_URL,
 *     SAP_USERNAME, SAP_PASSWORD, SAP_CLIENT), as the integration tests use.
 *   - `src/__tests__/helpers/test-config.yaml` (`npm run test:init`): the
 *     probe reads `environment.system`, `default_package` and
 *     `default_transport` from it. The package must exist; every object is
 *     created in it, on that transport, and deleted again.
 *
 * Run:
 *   npm run probe:headers
 *   npm run probe:headers -- --only class,domain      # these object types only
 *   npm run probe:headers -- --operation update       # this member only
 *   npm run probe:headers -- --sequential             # one request at a time, no batch
 *   npm run probe:headers -- --compare <batched.json> <sequential.json>
 *
 * `--only` takes object types (class, interface, program, include, domain,
 * dataElement, structure, table, tableType, ddl, functionGroup,
 * functionModule, messageClass, transformation, serviceDefinition,
 * accessControl, metadataExtension, utils). `--operation` keeps the whole
 * cycle but probes only that member; the other steps run with the known pair
 * and are not reported. `--compare` reads two reports and writes which probes
 * differ between them.
 *
 * Report: `.header-probe/report-<timestamp>.json` (everything recorded) and
 * `.header-probe/report-<timestamp>.md` (a table per object type, then the
 * summary). The directory is gitignored: the report holds system answers.
 *
 * Every operation gets three requests, each through the member itself:
 *   - known pair: the operation's pair from MIGRATION-36 (pairs.ts), as given;
 *   - bad Accept: Accept `application/x-header-probe`, the known
 *     Content-Type — a 406 is expected;
 *   - bad Content-Type: the known Accept, Content-Type
 *     `application/x-header-probe` — a 415 is expected.
 *
 * More in tools/header-probe/README.md.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtHeaders, IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  closeOwnTestConnection,
  createTestConnection,
  getTargetSystem,
  resolveSystemContext,
} from '../../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../../src/__tests__/helpers/testLogger';
import { AdtBatchConnection } from '../../src/batch/AdtBatchConnection';
import { AdtClient } from '../../src/clients/AdtClient';
import { Ledger, withCleanup } from './ledger';
import {
  type IObjectSpec,
  type IProbeable,
  type ISpecContext,
  LOCAL_INCLUDES,
  OBJECT_SPECS,
  SKIPPED,
} from './objects';
import { knownPair } from './pairs';
import {
  endpointOf,
  type IObjectState,
  type IOperationRow,
  type IProbeAnswer,
  type IProbeReport,
  type IRemoval,
  PROBE_KINDS,
  type ProbeKind,
  probePair,
  readAnswer,
  readState,
  renderComparison,
  renderMarkdown,
} from './record';

// The helpers load `.env` when imported; nothing else here reads it.
const {
  getEnvironmentConfig,
} = require('../../src/__tests__/helpers/test-helper');

const OUT_DIR = path.resolve(__dirname, '../../.header-probe');

const progress = (line: string): void => {
  process.stdout.write(`${line}\n`);
};
const loud = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

interface IArgs {
  only?: string[];
  operation?: string;
  sequential: boolean;
  compare?: [string, string];
}

function parseArgs(argv: readonly string[]): IArgs {
  const args: IArgs = { sequential: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only')
      args.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (arg === '--operation') args.operation = argv[++i];
    else if (arg === '--sequential') args.sequential = true;
    else if (arg === '--compare') args.compare = [argv[++i], argv[++i]];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/** What one call captured: its answer and the requests it issued. */
interface ICapture {
  wire?: IAdtWireResponse;
  /** What the member returned. */
  result?: unknown;
  failure?: string;
  requests: { method: string; url: string; params: unknown }[];
}

const current = new AsyncLocalStorage<ICapture>();

/** The connection a client is built on, recording each request into the call that issued it. */
function traced(connection: IAbapConnection): IAbapConnection {
  return new Proxy(connection, {
    get(target, property, receiver) {
      if (property === 'makeAdtRequest')
        return (request: IAbapRequestOptions) => {
          current.getStore()?.requests.push({
            method: request.method,
            url: request.url,
            params: request.params,
          });
          return target.makeAdtRequest(request);
        };
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

type ICall = (client: AdtClient, analyse: IAnalyse) => Promise<unknown>;

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

class Probe {
  readonly rows: IOperationRow[] = [];
  readonly names: string[] = [];
  private readonly direct: AdtClient;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly clientOptions: ConstructorParameters<typeof AdtClient>[2],
    private readonly args: IArgs,
    private readonly ledger: Ledger,
    private readonly context: Omit<ISpecContext, 'parent'>,
    private readonly run: string,
  ) {
    this.direct = this.client(traced(connection));
  }

  private client(connection: IAbapConnection): AdtClient {
    return new AdtClient(connection, undefined, this.clientOptions);
  }

  /** Runs the calls in one envelope, or one by one with `--sequential`. */
  async calls(
    calls: ICall[],
    batched = !this.args.sequential,
  ): Promise<ICapture[]> {
    const captures = calls.map((): ICapture => ({ requests: [] }));
    const invoke = (client: AdtClient, call: ICall, capture: ICapture) =>
      current.run(capture, () =>
        call(client, (verdict, wire) => {
          capture.wire = wire;
          if (
            !wire &&
            verdict &&
            typeof verdict === 'object' &&
            'message' in verdict
          )
            capture.failure = String(verdict.message);
          return verdict;
        }).then(
          (result: unknown) => {
            capture.result = result;
          },
          (error: unknown) => {
            capture.failure = message(error);
          },
        ),
      );
    if (!batched) {
      for (const [i, call] of calls.entries())
        await invoke(this.direct, call, captures[i]);
      return captures;
    }
    const batch = new AdtBatchConnection(this.connection, {
      endpoint: 'communication',
    });
    const client = this.client(traced(batch));
    const pending = calls.map((call, i) => invoke(client, call, captures[i]));
    // A member may record its request a few turns after it was called.
    for (let turn = 0; turn < 3; turn++)
      await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      await batch.execute();
    } catch (error) {
      for (const capture of captures)
        if (!capture.wire)
          capture.failure ??= `the envelope failed: ${message(error)}`;
    }
    await Promise.all(pending);
    return captures;
  }

  wanted(type: string, member: string): boolean {
    const group = type.startsWith('local')
      ? 'class'
      : type === 'messageClassMessage'
        ? 'messageClass'
        : type;
    if (this.args.only && !this.args.only.includes(group)) return false;
    return !this.args.operation || this.args.operation === member;
  }

  name(spec: { code: string; functionModule?: boolean }, role: string): string {
    const name = `${spec.functionModule ? 'Z_HP' : 'ZHP'}${this.run}${spec.code}${role}`;
    this.names.push(name);
    return name;
  }

  skip(objectType: string, member: string, reason: string): void {
    this.rows.push({ objectType, member, skipped: reason, probes: [] });
  }

  private answerOf(
    capture: ICapture,
    probe: ProbeKind,
    sent: IAdtHeaders,
    mode: string,
  ): IProbeAnswer {
    return readAnswer({
      probe,
      sent,
      mode,
      requests: capture.requests.map((request) =>
        endpointOf(request.method, request.url, request.params, this.names),
      ),
      wire: capture.wire,
      failure: capture.failure,
    });
  }

  /**
   * The three probes of one operation, each optionally followed by a read of
   * the object's state; the row is recorded when the member is wanted.
   *
   * Without a wanted member the step still runs once with the known pair, when
   * the cycle needs it (`required`), and nothing is reported.
   */
  async operation(input: {
    objectType: string;
    handler: string;
    member: string;
    kinds?: readonly ProbeKind[];
    call: (kind: ProbeKind, headers: IAdtHeaders) => ICall;
    state?: (kind: ProbeKind) => ICall;
    readState?: (capture: ICapture, kind: ProbeKind) => IObjectState;
    required?: boolean;
    sequential?: string;
  }): Promise<IProbeAnswer | undefined> {
    const known = knownPair(input.handler, input.member);
    if (!known) return undefined;
    const wanted = this.wanted(input.objectType, input.member);
    if (!wanted && !input.required) return undefined;
    const kinds = wanted ? (input.kinds ?? PROBE_KINDS) : (['known'] as const);
    const calls: ICall[] = [];
    for (const kind of kinds) {
      calls.push(input.call(kind, probePair(kind, known)));
      if (input.state) calls.push(input.state(kind));
    }
    const mode = this.args.sequential
      ? 'sequential: --sequential'
      : input.sequential
        ? `sequential: ${input.sequential}`
        : 'batched';
    progress(`  ${input.objectType}.${input.member} (${mode})`);
    const captures = await this.calls(calls, mode === 'batched');
    const step = input.state ? 2 : 1;
    const probes = kinds.map((kind, i) => {
      const answer = this.answerOf(
        captures[i * step],
        kind,
        probePair(kind, known),
        mode,
      );
      if (input.state)
        answer.stateAfter = (input.readState ?? ((c) => readState(c.wire)))(
          captures[i * step + 1],
          kind,
        );
      return answer;
    });
    if (wanted)
      this.rows.push({
        objectType: input.objectType,
        member: input.member,
        known,
        probes,
      });
    return probes.find((probe) => probe.probe === 'known');
  }

  /** One call on the plain connection, for a step that is not a probe. */
  async direct1(call: ICall): Promise<ICapture> {
    const [capture] = await this.calls([call], false);
    return capture;
  }

  /** A ledger entry that deletes `name` with the known delete pair, if it is there. */
  remember(spec: IObjectSpec, name: string, context: ISpecContext): void {
    const config = spec.config(name, context);
    this.ledger.add({
      label: `${spec.type} ${name}`,
      remove: async () => {
        const read = () =>
          this.direct1(
            (client, analyse) =>
              spec.handle(client).readMetadata?.(config, { analyse }) ??
              Promise.resolve(),
          );
        const before = readState((await read()).wire);
        if (before.exists === false)
          return {
            removed: true,
            detail: 'not there: never created, or deleted by the probe',
          };
        const headers = knownPair(spec.handler, 'delete');
        if (!headers) return { removed: false, detail: 'no delete pair' };
        const deleted = await this.direct1(
          (client, analyse) =>
            spec.handle(client).delete?.(config, { headers, analyse }) ??
            Promise.resolve(),
        );
        const after = readState((await read()).wire);
        if (after.exists === false)
          return {
            removed: true,
            detail: `deleted (${deleted.wire?.status ?? 'no status'})`,
          };
        const answer = this.answerOf(
          deleted,
          'known',
          headers,
          'sequential: cleanup',
        );
        return {
          removed: false,
          detail: `delete answered ${answer.status ?? answer.failure}${answer.sapMessage ? `: ${answer.sapMessage}` : ''}; the object still reads ${after.status ?? 'unknown'}`,
        };
      },
    });
  }

  /** Creates, writes and activates a dependency with known pairs; reports nothing. */
  async dependency(
    spec: IObjectSpec,
    name: string,
    source?: string,
  ): Promise<boolean> {
    const context: ISpecContext = { ...this.context };
    const config = spec.config(name, context);
    this.remember(spec, name, context);
    const pair = (member: string) =>
      knownPair(spec.handler, member) as IAdtHeaders;
    const created = await this.direct1(
      (client, analyse) =>
        spec
          .handle(client)
          .create?.(config, { headers: pair('create'), analyse }) ??
        Promise.resolve(),
    );
    if (!ok(created)) return false;
    if (source) {
      const locked = await this.direct1(
        (client, analyse) =>
          spec.handle(client).lock?.(config, { analyse }) ?? Promise.resolve(),
      );
      const handle = lockHandle(locked);
      if (!handle) return false;
      await this.direct1(
        (client, analyse) =>
          spec.handle(client).update?.(config, {
            headers: pair('update'),
            source,
            lockHandle: handle,
            analyse,
          }) ?? Promise.resolve(),
      );
      await this.direct1(
        (client, analyse) =>
          spec.handle(client).unlock?.(config, handle, { analyse }) ??
          Promise.resolve(),
      );
    }
    const activated = await this.direct1(
      (client, analyse) =>
        spec
          .handle(client)
          .activate?.(config, { headers: pair('activate'), analyse }) ??
        Promise.resolve(),
    );
    return ok(activated);
  }

  /** The whole cycle of one object type. */
  async objectType(spec: IObjectSpec): Promise<void> {
    progress(`${spec.type}`);
    const context: ISpecContext = { ...this.context };
    if (spec.needs) {
      const parentSpec = OBJECT_SPECS.find(
        (s) => s.type === (spec.needs === 'ddl' ? 'ddl' : 'functionGroup'),
      ) as IObjectSpec;
      const parent = this.name(
        { code: `${spec.code[0]}${parentSpec.code[0]}` },
        'P',
      );
      const made = await this.dependency(
        parentSpec,
        parent,
        spec.needs === 'ddl' ? parentSpec.source?.(parent, context) : undefined,
      );
      if (!made) {
        for (const member of [
          'create',
          'update',
          'check',
          'activate',
          'checkDeletion',
          'delete',
        ])
          if (knownPair(spec.handler, member) && this.wanted(spec.type, member))
            this.skip(
              spec.type,
              member,
              `skipped: its ${spec.needs} could not be created and activated`,
            );
        return;
      }
      context.parent = parent;
    }

    const names: Record<ProbeKind, string> = {
      known: this.name(spec, 'K'),
      badAccept: this.name(spec, 'A'),
      badContentType: this.name(spec, 'C'),
    };
    const configOf = (kind: ProbeKind) => spec.config(names[kind], context);
    const handle = (client: AdtClient) => spec.handle(client);
    const stateOf =
      (name: string): ICall =>
      (client, analyse) =>
        handle(client).readMetadata?.(spec.config(name, context), {
          analyse,
        }) ?? Promise.resolve();
    for (const kind of PROBE_KINDS) this.remember(spec, names[kind], context);

    // 1. Create: each probe on a name of its own, read right after.
    const created = await this.operation({
      objectType: spec.type,
      handler: spec.handler,
      member: 'create',
      required: true,
      call: (kind, headers) => (client, analyse) =>
        handle(client).create?.(configOf(kind), { headers, analyse }) ??
        Promise.resolve(),
      state: (kind) => stateOf(names[kind]),
    });
    if (!created || !isSuccess(created.status)) {
      const why = `skipped: the known create answered ${created?.status ?? created?.failure ?? 'nothing'}`;
      for (const member of [
        'update',
        'updateMetadata',
        'check',
        'activate',
        'checkDeletion',
        'delete',
      ])
        if (knownPair(spec.handler, member) && this.wanted(spec.type, member))
          this.skip(spec.type, member, why);
      return;
    }
    const config = configOf('known');

    // 2. Read, lock, write with the three probes, unlock.
    const writeMember = spec.write === 'source' ? 'update' : 'updateMetadata';
    const writesLocals =
      spec.type === 'class' &&
      LOCAL_INCLUDES.some(
        (local) =>
          this.wanted(local.type, 'update') ||
          this.wanted(local.type, 'delete'),
      );
    if (this.wanted(spec.type, writeMember) || writesLocals) {
      let body = spec.source?.(names.known, context);
      if (body === undefined) {
        const read = await this.direct1((client, analyse) =>
          spec.write === 'source'
            ? (handle(client).read?.(config, 'inactive', { analyse }) ??
              Promise.resolve())
            : (handle(client).readMetadata?.(config, { analyse }) ??
              Promise.resolve()),
        );
        body = typeof read.wire?.data === 'string' ? read.wire.data : undefined;
      }
      const locked = await this.direct1(
        (client, analyse) =>
          handle(client).lock?.(config, { analyse }) ?? Promise.resolve(),
      );
      const lock = lockHandle(locked);
      if (!lock || body === undefined) {
        const why = !lock
          ? `skipped: the lock answered ${locked.wire?.status ?? locked.failure}`
          : 'skipped: the object could not be read to write it back';
        if (this.wanted(spec.type, writeMember))
          this.skip(spec.type, writeMember, why);
      } else {
        try {
          await this.operation({
            objectType: spec.type,
            handler: spec.handler,
            member: writeMember,
            call: (_kind, headers) => (client, analyse) =>
              handle(client)[writeMember]?.(config, {
                headers,
                source: body,
                lockHandle: lock,
                analyse,
              }) ?? Promise.resolve(),
            state: () => stateOf(names.known),
          });
          if (spec.type === 'class') await this.locals(names.known, lock);
        } finally {
          await this.direct1(
            (client, analyse) =>
              handle(client).unlock?.(config, lock, { analyse }) ??
              Promise.resolve(),
          );
        }
      }
    }
    if (spec.type === 'messageClass') await this.messages(names.known);

    // 3. Check and activate.
    await this.operation({
      objectType: spec.type,
      handler: spec.handler,
      member: 'check',
      call: (_kind, headers) => (client, analyse) =>
        handle(client).check?.(config, undefined, { headers, analyse }) ??
        Promise.resolve(),
    });
    if (spec.type === 'class')
      for (const local of LOCAL_INCLUDES)
        await this.operation({
          objectType: local.type,
          handler: local.handler,
          member: 'check',
          call: (_kind, headers) => (client, analyse) =>
            local
              .handle(client)
              .check?.(
                { className: names.known, source: local.source(names.known) },
                undefined,
                {
                  headers,
                  analyse,
                },
              ) ?? Promise.resolve(),
        });
    await this.operation({
      objectType: spec.type,
      handler:
        spec.type === 'class' ? 'getClass() / getLocal*()' : spec.handler,
      member: 'activate',
      call: (_kind, headers) => (client, analyse) =>
        handle(client).activate?.(config, { headers, analyse }) ??
        Promise.resolve(),
      state: () => stateOf(names.known),
    });

    // 4. Deletion check, then delete: the bad probes first, the known pair last.
    await this.operation({
      objectType: spec.type,
      handler: spec.handler,
      member: 'checkDeletion',
      call: (_kind, headers) => (client, analyse) =>
        handle(client).checkDeletion?.(config, { headers, analyse }) ??
        Promise.resolve(),
    });
    await this.operation({
      objectType: spec.type,
      handler: spec.handler,
      member: 'delete',
      kinds: ['badAccept', 'badContentType', 'known'],
      call: (_kind, headers) => (client, analyse) =>
        handle(client).delete?.(config, { headers, analyse }) ??
        Promise.resolve(),
      state: () => stateOf(names.known),
    });
  }

  /** The class includes, written under the class's lock. */
  async locals(className: string, lock: string): Promise<void> {
    const classSpec = OBJECT_SPECS.find(
      (s) => s.type === 'class',
    ) as IObjectSpec;
    const stateOf: ICall = (client, analyse) =>
      classSpec
        .handle(client)
        .readMetadata?.(classSpec.config(className, { ...this.context }), {
          analyse,
        }) ?? Promise.resolve();
    for (const local of LOCAL_INCLUDES) {
      const config = {
        className,
        transportRequest: this.context.transportRequest,
      };
      for (const member of ['update', 'delete'])
        await this.operation({
          objectType: local.type,
          handler: local.handler,
          member,
          kinds:
            member === 'delete'
              ? ['badAccept', 'badContentType', 'known']
              : PROBE_KINDS,
          call: (_kind, headers) => (client, analyse) =>
            local.handle(client)[member]?.(config, {
              headers,
              source: local.source(className),
              lockHandle: lock,
              analyse,
            }) ?? Promise.resolve(),
          state: () => stateOf,
        });
    }
  }

  /** A message class's messages: each write is the member's own chain. */
  async messages(className: string): Promise<void> {
    const handler = 'getMessageClassMessage()';
    const handle = (client: AdtClient): IProbeable =>
      client.getMessageClassMessage() as unknown as IProbeable;
    const msgno: Record<ProbeKind, string> = {
      known: '001',
      badAccept: '002',
      badContentType: '003',
    };
    const config = (number: string) => ({
      className,
      msgno: number,
      msgtext: `Header probe ${number}`,
      transportRequest: this.context.transportRequest,
    });
    const state =
      (number: string): ICall =>
      (client, analyse) =>
        handle(client).read?.(config(number), undefined, { analyse }) ??
        Promise.resolve();
    const present =
      (number: string) =>
      (capture: ICapture): IObjectState => {
        const base = readState(capture.wire);
        if (base.exists !== true) return base;
        const body = String(capture.wire?.data ?? '');
        return { ...base, exists: body.includes(`msgno="${number}"`) };
      };
    const chain =
      'a chain: read, two locks, the write, two unlocks, each next request depending on the answer before';
    await this.operation({
      objectType: 'messageClassMessage',
      handler,
      member: 'create',
      sequential: chain,
      call: (kind, headers) => (client, analyse) =>
        handle(client).create?.(config(msgno[kind]), { headers, analyse }) ??
        Promise.resolve(),
      state: (kind) => state(msgno[kind]),
      readState: (capture, kind) => present(msgno[kind])(capture),
    });
    await this.operation({
      objectType: 'messageClassMessage',
      handler,
      member: 'update',
      sequential: chain,
      call: (_kind, headers) => (client, analyse) =>
        handle(client).update?.(
          { ...config('001'), msgtext: 'Header probe updated' },
          {
            headers,
            analyse,
          },
        ) ?? Promise.resolve(),
      state: () => state('001'),
      readState: present('001'),
    });
    await this.operation({
      objectType: 'messageClassMessage',
      handler,
      member: 'delete',
      sequential: chain,
      kinds: ['badAccept', 'badContentType', 'known'],
      call: (_kind, headers) => (client, analyse) =>
        handle(client).delete?.(config('001'), { headers, analyse }) ??
        Promise.resolve(),
      state: () => state('001'),
      readState: present('001'),
    });
  }

  /** The utilities: reads on the package and T000, the group lifecycle on a program of its own. */
  async utils(): Promise<void> {
    progress('utils');
    const handler = 'getUtils()';
    const utils = (client: AdtClient): IProbeable =>
      client.getUtils() as unknown as IProbeable;
    const program = OBJECT_SPECS.find(
      (s) => s.type === 'program',
    ) as IObjectSpec;
    const name = this.name({ code: 'UT' }, 'P');
    const context: ISpecContext = { ...this.context };
    const made = await this.dependency(program, name);
    const reads: { member: string; args: unknown[] }[] = [
      {
        member: 'getWhereUsed',
        args: [{ object_name: name, object_type: 'program' }],
      },
      {
        member: 'getWhereUsedScope',
        args: [{ object_name: name, object_type: 'program' }],
      },
      {
        member: 'getVirtualFoldersContents',
        args: [
          {
            objectSearchPattern: '*',
            preselection: [
              { facet: 'package', values: [this.context.packageName] },
            ],
            facetOrder: ['package', 'group', 'type'],
          },
        ],
      },
      {
        member: 'fetchNodeStructure',
        args: ['DEVC/K', this.context.packageName],
      },
      {
        member: 'getSqlQuery',
        args: [{ sql_query: 'SELECT mandt FROM t000', row_number: 1 }],
      },
      {
        member: 'getTableContents',
        args: [{ table_name: 'T000', max_rows: 1 }],
      },
    ];
    for (const read of reads)
      await this.operation({
        objectType: 'utils',
        handler,
        member: read.member,
        call: (_kind, headers) => (client, analyse) =>
          utils(client)[read.member]?.(...read.args, { headers, analyse }) ??
          Promise.resolve(),
      });
    if (!made) {
      for (const member of [
        'activateObjectsGroup',
        'checkDeletionGroup',
        'deleteObjectsGroup',
      ])
        if (this.wanted('utils', member))
          this.skip(
            'utils',
            member,
            'skipped: its program could not be created and activated',
          );
      return;
    }
    const objects = [{ type: 'PROG/P', name }];
    const stateOf: ICall = (client, analyse) =>
      program
        .handle(client)
        .readMetadata?.(program.config(name, context), { analyse }) ??
      Promise.resolve();
    await this.operation({
      objectType: 'utils',
      handler,
      member: 'activateObjectsGroup',
      call: (_kind, headers) => (client, analyse) =>
        utils(client).activateObjectsGroup?.(objects, undefined, {
          headers,
          analyse,
        }) ?? Promise.resolve(),
      state: () => stateOf,
    });
    await this.operation({
      objectType: 'utils',
      handler,
      member: 'checkDeletionGroup',
      call: (_kind, headers) => (client, analyse) =>
        utils(client).checkDeletionGroup?.(objects, { headers, analyse }) ??
        Promise.resolve(),
    });
    await this.operation({
      objectType: 'utils',
      handler,
      member: 'deleteObjectsGroup',
      kinds: ['badAccept', 'badContentType', 'known'],
      call: (_kind, headers) => (client, analyse) =>
        utils(client).deleteObjectsGroup?.(
          objects,
          this.context.transportRequest,
          {
            headers,
            analyse,
          },
        ) ?? Promise.resolve(),
      state: () => stateOf,
    });
  }
}

const isSuccess = (status: number | undefined): boolean =>
  status !== undefined && status >= 200 && status < 300;

const ok = (capture: ICapture): boolean => isSuccess(capture.wire?.status);

/** The lock handle the member read from its LOCK's answer. */
function lockHandle(capture: ICapture): string | undefined {
  const result = capture.result as
    | { ok: boolean; getResult?: () => { value: unknown } }
    | undefined;
  if (!result?.ok || !result.getResult) return undefined;
  const value = result.getResult().value;
  return typeof value === 'string' && value ? value : undefined;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeReport(report: IProbeReport): string[] {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, `report-${stamp()}`);
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(`${base}.md`, renderMarkdown(report));
  return [`${base}.json`, `${base}.md`];
}

function randomRun(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let run = '';
  for (let i = 0; i < 4; i++)
    run += alphabet[Math.floor(Math.random() * alphabet.length)];
  return run;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.compare) {
    const [a, b] = args.compare.map(
      (file) => JSON.parse(fs.readFileSync(file, 'utf8')) as IProbeReport,
    );
    const [batched, sequential] = a.mode === 'batched' ? [a, b] : [b, a];
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = path.join(OUT_DIR, `compare-${stamp()}.md`);
    fs.writeFileSync(out, renderComparison(batched, sequential));
    progress(out);
    return;
  }

  const environment = getEnvironmentConfig();
  const packageName = String(environment.default_package ?? '');
  const transportRequest = String(environment.default_transport ?? '');
  if (!packageName)
    throw new Error('test-config.yaml: environment.default_package is not set');
  const system = getTargetSystem();

  const report: IProbeReport = {
    startedAt: new Date().toISOString(),
    mode: args.sequential ? 'sequential' : 'batched',
    filters: { only: args.only, operation: args.operation },
    rows: [],
    removals: [],
  };
  const ledger = new Ledger((removal: IRemoval) => {
    report.removals.push(removal);
    progress(
      `  cleanup: ${removal.removed ? 'removed' : 'NOT REMOVED'} ${removal.label}`,
    );
  });

  const connection = await createTestConnection(createConnectionLogger(), {
    ownSession: true,
  });
  const clientOptions = await resolveSystemContext(
    connection,
    system === 'cloud',
  );
  const probe = new Probe(
    connection,
    clientOptions,
    args,
    ledger,
    { packageName, transportRequest },
    randomRun(),
  );
  report.rows = probe.rows;

  const finish = async (): Promise<void> => {
    report.finishedAt = new Date().toISOString();
    for (const file of writeReport(report)) progress(file);
    const left = report.removals.filter((removal) => !removal.removed);
    if (left.length) {
      loud(
        `\n!!! ${left.length} temporary object(s) could not be removed — delete them by hand:`,
      );
      for (const removal of left)
        loud(`!!!   ${removal.label}: ${removal.detail}`);
    }
  };

  let interrupted = false;
  process.on('SIGINT', () => {
    if (interrupted) return;
    interrupted = true;
    progress('interrupted: removing the temporary objects');
    report.error = 'interrupted (SIGINT)';
    void ledger
      .cleanup()
      .then(finish)
      .finally(() => closeOwnTestConnection(connection))
      .finally(() => process.exit(130));
  });

  try {
    await withCleanup(ledger, async () => {
      for (const spec of OBJECT_SPECS) {
        if (args.only && !args.only.includes(spec.type)) continue;
        await probe.objectType(spec);
      }
      if (!args.only || args.only.includes('utils')) await probe.utils();
      for (const skipped of SKIPPED)
        if (probe.wanted(skipped.type, skipped.member))
          probe.skip(skipped.type, skipped.member, skipped.reason);
    });
  } catch (error) {
    report.error = message(error);
    loud(`The probe stopped: ${report.error}`);
  }
  if (interrupted) return;
  await finish();
  await closeOwnTestConnection(connection);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    loud(`header probe: ${message(error)}`);
    process.exit(1);
  },
);
