/**
 * The header probe's temporary-object cycle, as the error corpus's phase 2
 * runs it (writeCycle.ts): per object type, create; read, lock, write,
 * unlock; check and activate; deletion check and delete — each member sent
 * with its known pair, a bad Content-Type and a bad Accept, on temporary
 * objects it creates in the configured package and deletes again. It has no
 * command of its own any more: `npm run header:discovery` is the error corpus.
 *
 * More in tools/header-probe/README.md.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../src/clients/AdtClient';
import {
  cleanupOf,
  type ICallOn,
  type ICapture,
  runCalls,
  throughGate,
  traced,
} from './capture';
import { type Interrupt, type Ledger, withLock } from './ledger';
import {
  type IObjectSpec,
  type IProbeable,
  type ISpecContext,
  LOCAL_INCLUDES,
  OBJECT_SPECS,
} from './objects';
import { knownPair } from './pairs';
import {
  endpointOf,
  type IObjectState,
  type IOperationRow,
  type IProbeAnswer,
  PROBE_KINDS,
  type ProbeKind,
  plannedKinds,
  probePair,
  readAnswer,
  readState,
  wants,
} from './record';

const progress = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

export interface IArgs {
  only?: string[];
  operation?: string;
  /** Only these rows, `<object type>.<member>`; the cycle's prerequisites still run. */
  members?: string[];
  sequential: boolean;
  /**
   * The bogus Content-Type before the bogus Accept (the error corpus's
   * phase 2); the known pair keeps its place.
   */
  contentTypeFirst?: boolean;
}

type ICall = ICallOn<AdtClient>;

export class Probe {
  readonly rows: IOperationRow[] = [];
  readonly names: string[] = [];
  private readonly direct: AdtClient;
  /** For what releases or removes: the gate's cleanup sibling, past a stop. */
  private readonly cleanupDirect: AdtClient;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly clientOptions: ConstructorParameters<typeof AdtClient>[2],
    private readonly args: IArgs,
    private readonly ledger: Ledger,
    private readonly context: Omit<ISpecContext, 'parent'>,
    private readonly run: string,
    private readonly interrupt: Interrupt,
  ) {
    this.direct = this.client(traced(connection));
    this.cleanupDirect = this.client(traced(cleanupOf(connection)));
  }

  private client(connection: IAbapConnection): AdtClient {
    if (!throughGate(connection))
      throw new Error('Probe: the connection does not send through the gate');
    return new AdtClient(connection, undefined, this.clientOptions);
  }

  /** Runs the calls in one envelope, or one by one with `--sequential`. */
  calls(
    calls: ICall[],
    batched = !this.args.sequential,
    gated = true,
  ): Promise<ICapture[]> {
    // After Ctrl-C nothing new goes out, except what releases or removes.
    return runCalls({
      calls,
      batched,
      connection: this.connection,
      direct: gated ? this.direct : this.cleanupDirect,
      onBatch: (batch) => this.client(traced(batch)),
      interrupt: gated ? this.interrupt : undefined,
    });
  }

  wanted(type: string, member: string): boolean {
    return wants(this.args, type, member);
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
   * Without a wanted member the step still runs once with the known pair when
   * the cycle needs it (`isPrerequisite`), and nothing is reported.
   */
  async operation(input: {
    objectType: string;
    handler: string;
    member: string;
    kinds?: readonly ProbeKind[];
    call: (kind: ProbeKind, headers: IAdtHeaders) => ICall;
    state?: (kind: ProbeKind) => ICall;
    readState?: (capture: ICapture, kind: ProbeKind) => IObjectState;
    sequential?: string;
  }): Promise<IProbeAnswer | undefined> {
    const known = knownPair(input.handler, input.member);
    if (!known) return undefined;
    const wanted = this.wanted(input.objectType, input.member);
    const ordered = input.kinds ?? PROBE_KINDS;
    const kinds = plannedKinds(
      this.args,
      input.objectType,
      input.member,
      this.args.contentTypeFirst ? contentTypeFirst(ordered) : ordered,
    );
    if (!kinds.length) return undefined;
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
  async direct1(call: ICall, gated = true): Promise<ICapture> {
    const [capture] = await this.calls([call], false, gated);
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
            false,
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
          false,
        );
        const after = readState((await read()).wire);
        if (after.exists === false)
          return {
            removed: true,
            detail: `deleted (${deleted.wire?.status ?? 'no status'})`,
          };
        // Unreadable: the object may remain, which is not proof of either.
        if (after.exists === 'unknown')
          return {
            removed: 'unknown',
            detail: `unknown ${after.status ?? 'no answer'}: the delete answered ${deleted.wire?.status ?? deleted.failure ?? 'nothing'}; it may remain`,
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
      await withLock(
        handle,
        // Released after an interrupt too: unlocking is cleanup.
        (held) =>
          this.direct1(
            (client, analyse) =>
              spec.handle(client).unlock?.(config, held, { analyse }) ??
              Promise.resolve(),
            false,
          ),
        (held) =>
          this.direct1(
            (client, analyse) =>
              spec.handle(client).update?.(config, {
                headers: pair('update'),
                source,
                lockHandle: held,
                analyse,
              }) ?? Promise.resolve(),
          ),
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
      if (!lock) {
        if (this.wanted(spec.type, writeMember))
          this.skip(
            spec.type,
            writeMember,
            `skipped: the lock answered ${locked.wire?.status ?? locked.failure}`,
          );
      } else {
        const source = body;
        await withLock(
          lock,
          // Released after an interrupt too: unlocking is cleanup.
          (held) =>
            this.direct1(
              (client, analyse) =>
                handle(client).unlock?.(config, held, { analyse }) ??
                Promise.resolve(),
              false,
            ),
          async (held) => {
            if (source === undefined) {
              if (this.wanted(spec.type, writeMember))
                this.skip(
                  spec.type,
                  writeMember,
                  'skipped: the object could not be read to write it back',
                );
            } else
              await this.operation({
                objectType: spec.type,
                handler: spec.handler,
                member: writeMember,
                call: (_kind, headers) => (client, analyse) =>
                  handle(client)[writeMember]?.(config, {
                    headers,
                    source,
                    lockHandle: held,
                    analyse,
                  }) ?? Promise.resolve(),
                state: () => stateOf(names.known),
              });
            if (spec.type === 'class') await this.locals(names.known, held);
          },
        );
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

/** The same probes, the bad Content-Type moved before the bad Accept. */
function contentTypeFirst(kinds: readonly ProbeKind[]): ProbeKind[] {
  const out = [...kinds];
  const accept = out.indexOf('badAccept');
  const contentType = out.indexOf('badContentType');
  if (accept !== -1 && contentType !== -1 && contentType > accept) {
    out[accept] = 'badContentType';
    out[contentType] = 'badAccept';
  }
  return out;
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

export function randomRun(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let run = '';
  for (let i = 0; i < 4; i++)
    run += alphabet[Math.floor(Math.random() * alphabet.length)];
  return run;
}
