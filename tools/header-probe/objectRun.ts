/**
 * The clients' members that work on an object, on temporary objects the run
 * makes itself: per object type, make the object (its parent first), then
 * the reads, then a LOCK on the object, the writes and the UNLOCK, then the
 * lock members, then the deletes — each member in the run's header mode. A
 * write is never resent; the object is read back after it. Every object is in
 * the ledger before it is made, and the cleanup proves its removal by a read
 * that answers 404.
 *
 * What cannot be made and removed cleanly is `not coverable`, with its
 * reason; a member that takes no object keeps the probe name.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtClient } from '../../src/clients/AdtClient';
import { sapErrorIn } from '../../src/utils/adtErrors';
import { type ICallOn, type ICapture, traced } from './capture';
import {
  askedFor,
  type BogusHeader,
  bogusHeaders,
  emptyNamed,
  type HeadersMode,
  headerShape,
  type ICorpusRow,
  isLockRefusal,
} from './corpus';
import type { Interrupt, Ledger } from './ledger';
import {
  clientsOn,
  type IClients,
  type IHandlerSpec,
  type IMemberEndpoint,
  LOCK_SKIP,
  pairOf,
} from './members';
import {
  type ITemporaryContext,
  type ITemporarySpec,
  temporarySpec,
} from './objects';
import { isSuccess, lockHandle, ok, Probe, randomRun } from './probe';
import { readState } from './record';

/** Where a member runs: on a temporary object, on the probe name, or not at all. */
export type Coverage =
  | { kind: 'object'; type: string }
  | { kind: 'not coverable'; reason: string }
  | { kind: 'no object' };

const modern = (handler: string) => handler.replace(/^legacy /, '');

/** The temporary object type of each handler whose members work on one object. */
export const OBJECT_OF_HANDLER: Readonly<Record<string, string>> = {
  'getClass()': 'class',
  'getLocalTestClass()': 'class',
  'getLocalTypes()': 'class',
  'getLocalDefinitions()': 'class',
  'getLocalMacros()': 'class',
  'getBehaviorImplementation()': 'class',
  'getInterface()': 'interface',
  'getProgram()': 'program',
  'getInclude()': 'include',
  'getDomain()': 'domain',
  'getDataElement()': 'dataElement',
  'getStructure()': 'structure',
  'getAppendStructure()': 'appendStructure',
  'getTable()': 'table',
  'getTableType()': 'tableType',
  'getDdl()': 'ddl',
  'getFunctionGroup()': 'functionGroup',
  'getFunctionModule()': 'functionModule',
  'getFunctionInclude()': 'functionInclude',
  'getMessageClass()': 'messageClass',
  'getMessageClassMessage()': 'messageClass',
  'getTransformation()': 'transformation',
  'getServiceDefinition()': 'serviceDefinition',
  'getServiceBinding()': 'serviceBinding',
  'getAccessControl()': 'accessControl',
  'getMetadataExtension()': 'metadataExtension',
  'getPackage()': 'package',
  'getScalarFunction()': 'scalarFunction',
  'getScalarFunctionImplementation()': 'scalarFunctionImplementation',
  'getAuthorizationField()': 'authorizationField',
  'getBehaviorDefinition()': 'behaviorDefinition',
};

/** Members of handlers without an object of their own that read one by name. */
export const OBJECT_OF_MEMBER: Readonly<Record<string, string>> = {
  'getUtils().getTableColumns': 'table',
  'getUtils().getTableContents': 'table',
  'getUtils().getInclude': 'include',
};

/**
 * What the probe cannot make and remove cleanly on its own, and why. A member
 * of these keeps the probe name, and its rows say why no object was made.
 */
export const NOT_COVERABLE: readonly {
  handler: string;
  member?: string;
  reason: string;
}[] = [
  {
    handler: 'getRequest()',
    reason:
      'transport requests: the server assigns the number, and a released or used request is part of the system’s transport history',
  },
  {
    handler: 'getAtc()',
    reason:
      'ATC results and worklists: the server assigns their ids and keeps them',
  },
  {
    handler: 'getAtcLog()',
    reason: 'ATC results: the server assigns their ids and keeps them',
  },
  {
    handler: 'getProfiler()',
    reason: 'traces: written by the system’s profiler, under ids it assigns',
  },
  {
    handler: 'getClassExecutor()',
    member: 'scheduleTrace',
    reason: 'trace requests: the server assigns the id',
  },
  {
    handler: 'getProgramExecutor()',
    member: 'scheduleTrace',
    reason: 'trace requests: the server assigns the id',
  },
  {
    handler: 'AdtAbapGitClient',
    reason: 'abapGit repositories: need an external Git repository to link',
  },
  {
    handler: 'getApplicationLog()',
    reason: 'application logs: written by the system, not by an ADT create',
  },
  {
    handler: 'getDumps()',
    reason: 'runtime dumps: written by the system when a program dumps',
  },
  {
    handler: 'AbapDebugger',
    reason: 'the debugger: needs a live session attached to a debuggee',
  },
  {
    handler: 'AmdpDebugger',
    reason: 'the AMDP debugger: needs a live session attached to a debuggee',
  },
  {
    handler: 'getFeatureToggle()',
    reason:
      'feature toggles: creating one was refused on the measured system (403)',
  },
  {
    handler: 'getEnhancement()',
    reason:
      'enhancement implementations: need an enhancement spot (a BAdI definition) of the system to implement, which the probe cannot choose for every system',
  },
  {
    handler: 'getServiceBinding()',
    member: 'publishByServiceType',
    reason:
      'publishing: registers an OData service in the system’s gateway, outside the object',
  },
  {
    handler: 'getServiceBinding()',
    member: 'unpublishByServiceType',
    reason:
      'publishing: registers an OData service in the system’s gateway, outside the object',
  },
  {
    handler: 'getServiceBinding()',
    member: 'updateRequest',
    reason:
      'publishing: registers an OData service in the system’s gateway, outside the object',
  },
];

/** Where one member runs: an object's handler's members on a temporary object, but {@link ON_THE_PROBE_NAME}. */
export function coverageOf(
  member: Pick<IMemberEndpoint, 'handler' | 'member' | 'requests'>,
): Coverage {
  const handler = modern(member.handler);
  const refused = NOT_COVERABLE.find(
    (entry) =>
      entry.handler === handler &&
      (entry.member === undefined || entry.member === member.member),
  );
  if (refused) return { kind: 'not coverable', reason: refused.reason };
  const byMember = OBJECT_OF_MEMBER[`${handler}.${member.member}`];
  if (byMember) return { kind: 'object', type: byMember };
  const byHandler = OBJECT_OF_HANDLER[handler];
  if (byHandler && !ON_THE_PROBE_NAME.includes(member.member))
    return { kind: 'object', type: byHandler };
  return { kind: 'no object' };
}

/**
 * The members of an object's handler that keep the probe name: `create`
 * makes its own object from it (and removes it), `validate` asks whether a
 * new name is free — a temporary object's name is not.
 */
export const ON_THE_PROBE_NAME: readonly string[] = ['create', 'validate'];

/**
 * What a member does to its object, which decides its place in the order:
 * `read`; `locked`, a write that carries the lock handle; `lock`, a LOCK or
 * UNLOCK member; `write`, a write without one (activation, a check), run once
 * every lock on the object is released; `delete`.
 */
export type Step = 'read' | 'locked' | 'write' | 'lock' | 'delete';

/** The step of a member: reads, the writes under the lock, lock members, the other writes, deletes last. */
export function stepOf(
  member: Pick<IMemberEndpoint, 'member' | 'requests'>,
): Step {
  const requests = member.requests;
  if (
    member.member === 'delete' ||
    requests.some((request) => request.method === 'DELETE')
  )
    return 'delete';
  if (
    member.member === 'lock' ||
    member.member === 'unlock' ||
    requests.some(
      (request) =>
        request.action === 'LOCK' ||
        request.action === 'UNLOCK' ||
        request.action === 'LOCK_MSG',
    )
  )
    return 'lock';
  if (requests.every((request) => request.method === 'GET')) return 'read';
  if (requests.some((request) => request.lockHandle)) return 'locked';
  return 'write';
}

/** A metadata write: `updateMetadata`, whose body is the object's metadata document. */
export const isMetadataWrite = (member: Pick<IMemberEndpoint, 'member'>) =>
  member.member === 'updateMetadata';

/** Whether the real call carries a body: a metadata write does (the metadata read back), whatever the dry recording said. */
export const hasBody = (
  member: Pick<IMemberEndpoint, 'member' | 'hasBody'>,
): boolean => member.hasBody === true || isMetadataWrite(member);

/** The names a member is given on a temporary object, beside its own. */
export function overridesFor(
  type: string,
  name: string,
  context: ITemporaryContext,
): Record<string, unknown> {
  const common: Record<string, unknown> = {
    packageName: context.packageName,
    ...(context.transportRequest
      ? { transportRequest: context.transportRequest }
      : {}),
  };
  switch (type) {
    case 'functionModule':
      return { ...common, functionGroupName: context.parent };
    case 'functionInclude':
      return {
        ...common,
        functionGroupName: context.parent,
        includeName: name,
      };
    case 'messageClass':
      return { ...common, className: name, msgno: '001' };
    case 'class':
      return { ...common, className: name, includeType: 'testclasses' };
    case 'package':
      return { packageName: name, superPackage: context.packageName };
    case 'scalarFunctionImplementation':
      return {
        ...common,
        implementationName: name,
        scalarFunctionName: context.parent,
      };
    case 'appendStructure':
      return { ...common, baseObject: context.parent };
    case 'behaviorDefinition':
      return { ...common, rootEntity: name, implementationType: 'Managed' };
    case 'serviceBinding':
      return {
        ...common,
        serviceDefinitionName: context.parent,
        serviceName: context.parent,
      };
    default:
      return common;
  }
}

/** One temporary object the run made, or why it could not. */
export interface ITemporaryObject {
  type: string;
  name?: string;
  parent?: string;
  reason?: string;
  /** What the run met on it: a LOCK refused before the deletes. */
  note?: string;
}

/** One row as the run plans it: the corpus's runner sends it. */
export interface IObjectRowPlan<T> {
  row: ICorpusRow;
  call: ICallOn<T>;
  write: boolean;
  /** Once the answer is in: the capture (a LOCK's handle). */
  after?: (capture: ICapture) => void;
}

/** Sends planned rows: in envelopes (`batched`), or one by one; on `connection` when given. */
export type SendRows<T> = (
  rows: readonly IObjectRowPlan<T>[],
  batched: boolean,
  connection?: IAbapConnection,
) => Promise<void>;

export interface IObjectRunInput<T> {
  connection: IAbapConnection;
  mode: HeadersMode;
  /** The members to run, each of coverage `object`. */
  members: readonly IMemberEndpoint[];
  specs: ReadonlyMap<string, IHandlerSpec>;
  clientOptions: ConstructorParameters<typeof AdtClient>[2];
  interrupt: Interrupt;
  ledger: Ledger;
  context: ITemporaryContext;
  progress: (line: string) => void;
  /** Where each row goes: the corpus's rows. */
  rows: ICorpusRow[];
  /** The connection a call is given, plain or in an envelope. */
  target: (on: T) => { base: IAbapConnection; parts: boolean };
  send: SendRows<T>;
  /** The member's headers in the mode. */
  headersFor: (member: IMemberEndpoint) => IAdtHeaders;
  /**
   * Runs `use` on a session of its own, ended after: the logoff frees every
   * lock it held — a LOCK member runs there.
   */
  ownSession?: (
    use: (connection: IAbapConnection) => Promise<void>,
  ) => Promise<void>;
}

/** The run of the object members of one header mode; it answers what it made. */
export async function runOnTemporaryObjects<T>(
  input: IObjectRunInput<T>,
): Promise<{ objects: ITemporaryObject[]; failures: string[] }> {
  const probe = new Probe(
    input.connection,
    input.clientOptions,
    { sequential: true },
    input.ledger,
    {
      packageName: input.context.packageName,
      transportRequest: input.context.transportRequest,
    },
    randomRun(),
    input.interrupt,
  );
  const objects: ITemporaryObject[] = [];
  /** Per object, its deletes: run once every object's lock members ran. */
  const finish: (() => Promise<void>)[] = [];
  const byType = new Map<string, IMemberEndpoint[]>();
  for (const member of input.members) {
    const coverage = coverageOf(member);
    if (coverage.kind !== 'object') continue;
    byType.set(coverage.type, [...(byType.get(coverage.type) ?? []), member]);
  }
  for (const [type, members] of byType) {
    input.interrupt.check();
    const made = await make(probe, type, input.context, 'K');
    objects.push(made.object);
    // Each member's rows, made once: one per bogus header in bogus mode.
    const rowsByMember = new Map<IMemberEndpoint, ICorpusRow[]>();
    const rowsOf = (member: IMemberEndpoint): ICorpusRow[] => {
      const known = rowsByMember.get(member);
      if (known) return known;
      const kinds: (BogusHeader | undefined)[] =
        input.mode === 'bogus' ? bogusHeaders(hasBody(member)) : [undefined];
      const rows = kinds.map((bogus) => {
        const row: ICorpusRow = {
          source: 'clients',
          group: member.handler,
          label: member.member,
          requests: member.requests,
          onWire: [],
          named: emptyNamed(),
          ...(member.requests.length
            ? { endpoint: member.requests[member.requests.length - 1] }
            : {}),
          ...(member.pair ? { pair: { ...member.pair } } : {}),
          ...(bogus ? { bogus } : {}),
          asked: askedFor(input.mode, member.pair, hasBody(member), bogus),
          ...(made.object.name
            ? { temporary: `${type} ${made.object.name}` }
            : {}),
        };
        input.rows.push(row);
        return row;
      });
      rowsByMember.set(member, rows);
      return rows;
    };
    if (!made.object.name || !made.spec) {
      for (const member of members)
        for (const row of rowsOf(member))
          row.skipped = `skipped: the temporary ${type} could not be made: ${made.object.reason}`;
      continue;
    }
    const spec = made.spec;
    const name = made.object.name;
    const context: ITemporaryContext = {
      ...input.context,
      ...(made.object.parent ? { parent: made.object.parent } : {}),
    };
    const config = spec.config(name, context);
    const handle = (client: AdtClient) => spec.handle(client);
    const overrides = overridesFor(type, name, context);
    await prepare(probe, type, name, context);
    /** The lock handle the next call is given, if any. */
    const lock: { handle?: string } = {};
    /** LOCK members sent on sessions of their own, whose locks are not yet proven freed. */
    const lockedElsewhere: string[] = [];
    /** The object's metadata as read before a metadata write: its body, written back unchanged. */
    const metadata: { body?: string } = {};
    const readMetadataBody = async () => {
      const read = await stateRead();
      metadata.body =
        read.wire && isSuccess(read.wire.status)
          ? String(read.wire.data ?? '')
          : undefined;
    };
    // A 403 "currently editing" on our own object is a lock of ours, not a
    // verdict on the headers.
    const send: SendRows<T> = async (plans, batched, connection) => {
      await input.send(plans, batched, connection);
      for (const plan of plans)
        if (
          isLockRefusal(plan.row) ||
          // A 423 while a session of ours holds the object's lock.
          (plan.row.status === 423 &&
            (lock.handle !== undefined || lockedElsewhere.length > 0))
        )
          plan.row.blocked = 'blocked by our own lock';
    };
    const planOf = (member: IMemberEndpoint): IObjectRowPlan<T>[] => {
      const handlerSpec = input.specs.get(member.handler);
      const call = member.call;
      const plans: IObjectRowPlan<T>[] = [];
      for (const row of rowsOf(member)) {
        // A LOCK is the probe name's problem, not a temporary object's.
        if (member.skipped && member.skipped !== LOCK_SKIP)
          row.skipped ??= member.skipped;
        if (row.skipped) continue;
        if (!handlerSpec || !call) {
          row.skipped = 'skipped: the handler is not reachable';
          continue;
        }
        const headers = input.headersFor(member);
        plans.push({
          row,
          write: stepOf(member) !== 'read',
          call: (on, analyse) => {
            const target = input.target(on);
            const clients: IClients = clientsOn(
              traced(target.base, {
                shape: headerShape(input.mode, target.parts, row.bogus),
                parts: target.parts,
              }),
              input.clientOptions,
            );
            return call(handlerSpec.of(clients) as never, {
              headers,
              analyse,
              name,
              overrides,
              ...(lock.handle ? { lockHandle: lock.handle } : {}),
              ...(isMetadataWrite(member) && metadata.body !== undefined
                ? { source: metadata.body }
                : {}),
            });
          },
        });
      }
      return plans;
    };
    const stateRead = async (): Promise<ICapture> =>
      probe.direct1(
        (client, analyse) =>
          handle(client).readMetadata?.(config, { analyse }) ??
          Promise.resolve(),
        false,
      );
    const readBack = async (row: ICorpusRow) => {
      const state = readState((await stateRead()).wire);
      row.afterWrite = {
        exists: state.exists,
        ...(state.status !== undefined ? { status: state.status } : {}),
        note: `the temporary ${type} read back after the write`,
      };
    };
    /** The last LOCK's answer when it gave no handle, for the report. */
    let lockRefusal = '';
    const takeLock = async (): Promise<string | undefined> => {
      const capture = await probe.direct1(
        (client, analyse) =>
          handle(client).lock?.(config, { analyse }) ?? Promise.resolve(),
      );
      const held = lockHandle(capture);
      if (!held) {
        const body = String(capture.wire?.data ?? '');
        const error = sapErrorIn(body);
        lockRefusal = `${capture.wire?.status ?? capture.failure ?? 'nothing'}${error?.adtType ? ` ${error.adtType}` : ''}${error?.message ? `: ${error.message}` : ''}`;
      }
      return held;
    };
    const release = (held: string) =>
      probe.release(
        `${type} ${name}`,
        (h) => (client, analyse) =>
          handle(client).unlock?.(config, h, { analyse }) ?? Promise.resolve(),
        held,
      );
    const of = (step: Step) =>
      members.filter((member) => stepOf(member) === step);

    // 1. The reads, in envelopes.
    const reads = of('read').flatMap((member) => planOf(member));
    if (reads.length) {
      input.progress(`  ${type} ${name}: ${reads.length} reads`);
      await send(reads, true);
    }

    // 2. A LOCK on our object, the writes that carry its handle one by one,
    // the UNLOCK.
    const writes = of('locked');
    if (writes.length) {
      const held = await takeLock();
      if (!held) {
        for (const member of writes)
          for (const row of rowsOf(member))
            row.skipped = `skipped: the LOCK on the temporary ${type} answered no handle`;
      } else {
        lock.handle = held;
        try {
          for (const member of writes)
            for (const plan of planOf(member)) {
              input.interrupt.check();
              // A metadata write sends the object's metadata back unchanged.
              if (isMetadataWrite(member)) await readMetadataBody();
              await send([plan], false);
              await readBack(plan.row);
            }
        } finally {
          delete lock.handle;
          await release(held);
        }
      }
    }

    // 3. The lock members. A classic LOCK checks the Accept after it took the
    // lock (SAP's code): a refused one may hold it with no handle to release
    // it, and while it holds a LOCK with the known pair is refused
    // (measured). So a LOCK member runs on a session of its own, ended
    // after — the logoff frees its locks —; a LOCK and an UNLOCK on ours
    // then prove the object free. An unlock is given a real handle, released
    // again if the unlock refused it.
    // The unlocks first: each takes a LOCK on our session, which a lock
    // still held by an ended session would refuse.
    const isUnlock = (member: IMemberEndpoint) =>
      member.member === 'unlock' ||
      member.requests.some((request) => request.action === 'UNLOCK');
    const lockMembers = [
      ...of('lock').filter(isUnlock),
      ...of('lock').filter((member) => !isUnlock(member)),
    ];
    for (const member of lockMembers) {
      const unlocks = isUnlock(member);
      for (const plan of planOf(member)) {
        input.interrupt.check();
        if (unlocks) {
          const held = await takeLock();
          if (held) lock.handle = held;
          try {
            await send([plan], false);
          } finally {
            delete lock.handle;
            // Released on every path, unless the unlock row released it.
            if (held && !isSuccess(plan.row.status)) await release(held);
          }
          continue;
        }
        let granted: string | undefined;
        const withHandle = {
          ...plan,
          after: (capture: ICapture) => {
            granted = lockHandle(capture);
          },
        };
        if (input.ownSession) {
          await input.ownSession((connection) =>
            send([withHandle], false, connection),
          );
          lockedElsewhere.push(`${member.handler}.${member.member}`);
          plan.row.objectNote =
            'sent on a session of its own, ended after (its logoff frees the lock)';
          continue;
        }
        try {
          await send([withHandle], false);
        } finally {
          if (granted) await release(granted);
        }
        const free = await takeLock();
        if (free) await release(free);
        else
          probe.lockFailures.push(
            `${type} ${name}: after ${member.handler}.${member.member} answered ${plan.row.status ?? plan.row.failure ?? 'nothing'}, the object stays locked (no session of its own to end): a LOCK answered ${lockRefusal}`,
          );
        plan.row.objectNote = 'the object then locked and unlocked';
      }
    }
    // 4. The deletes, last — after every type's lock members: the logoff
    // frees a session's locks a moment after it answered (measured: a LOCK
    // right after it was refused, one a second later granted), and the other
    // types' work passes that moment without a timer.
    finish.push(async () => {
      if (lockedElsewhere.length) {
        const free = await takeLock();
        if (free) await release(free);
        else
          made.object.note = `after ${lockedElsewhere.join(', ')} on sessions of their own (ended), a LOCK answered ${lockRefusal}`;
      }
      // The writes without a lock handle (activation, a check): an
      // activation of an object a session of ours still holds is refused
      // "currently editing" (measured), so they run here, every lock freed.
      for (const plan of of('write').flatMap((member) => planOf(member))) {
        input.interrupt.check();
        await send([plan], false);
        await readBack(plan.row);
      }
      for (const member of of('delete')) {
        const ownLock = member.requests.some(
          (request) => request.action === 'LOCK',
        );
        for (const plan of planOf(member)) {
          input.interrupt.check();
          const before = readState((await stateRead()).wire);
          if (
            before.exists === false &&
            !(await remake(probe, spec, name, context))
          ) {
            plan.row.skipped = `skipped: the temporary ${type} was deleted by an earlier row and could not be made again`;
            continue;
          }
          const held = ownLock ? undefined : await takeLock();
          if (held) lock.handle = held;
          try {
            await send([plan], false);
            await readBack(plan.row);
          } finally {
            delete lock.handle;
            // Released on every path, unless the delete took the object
            // (and its lock) with it.
            if (held && plan.row.afterWrite?.exists !== false)
              await release(held);
          }
        }
      }
    });
  }
  for (const step of finish) {
    input.interrupt.check();
    await step();
  }
  return {
    objects,
    failures: [
      ...probe.lockFailures,
      ...probe.possiblyOurs.map(
        (taken) => `possibly ours, not deleted: ${taken}`,
      ),
    ],
  };
}

/** The suffixes a name gets when the one before is there already. */
const NAME_TRIES: readonly string[] = ['', 'X', 'Y'];

/** Makes the object of `type` (its parent first), with the known pairs; ours once its create answered 2xx. */
async function make(
  probe: Probe,
  type: string,
  context: ITemporaryContext,
  role: string,
): Promise<{ object: ITemporaryObject; spec?: ITemporarySpec }> {
  const spec = temporarySpec(type);
  if (!spec) return { object: { type, reason: 'no spec to make one' } };
  let parent: string | undefined;
  if (spec.parentType) {
    // The parent's name carries the chain below it (the child's code and
    // role): two children, or one child two levels up, two parents.
    const made = await make(
      probe,
      spec.parentType,
      context,
      `${spec.code}${role}`,
    );
    if (!made.object.name)
      return {
        object: {
          type,
          reason: `its ${spec.parentType}: ${made.object.reason}`,
        },
      };
    parent = made.object.name;
  }
  const own: ITemporaryContext = {
    ...context,
    ...(parent ? { parent } : {}),
  };
  // A name that is there is not ours: another one, never that object.
  let name: string | undefined;
  for (const suffix of NAME_TRIES) {
    const probeName = probe.name(spec, `${role}${suffix}`);
    const candidate =
      spec.parentsName && parent
        ? parent
        : spec.nameFrom
          ? spec.nameFrom(probeName, parent)
          : probeName;
    if (candidate !== probeName) probe.names.push(candidate);
    if (await probe.isFree(spec, candidate, own)) {
      name = candidate;
      break;
    }
    // A name fixed by its parent cannot change.
    if (spec.parentsName && parent) break;
  }
  if (!name)
    return {
      object: {
        type,
        reason: 'every name tried is there already, so not ours',
        ...(parent ? { parent } : {}),
      },
    };
  const why = await build(probe, spec, name, own);
  return why
    ? {
        object: {
          type,
          name: undefined,
          reason: why,
          ...(parent ? { parent } : {}),
        },
      }
    : { object: { type, name, ...(parent ? { parent } : {}) }, spec };
}

/** Makes the object again after a delete row took it; `false` when it cannot. */
async function remake(
  probe: Probe,
  spec: ITemporarySpec,
  name: string,
  context: ITemporaryContext,
): Promise<boolean> {
  return (await build(probe, spec, name, context)) === undefined;
}

/** Create, write its source, activate: the known pairs. The reason, if one step refused. */
async function build(
  probe: Probe,
  spec: ITemporarySpec,
  name: string,
  context: ITemporaryContext,
): Promise<string | undefined> {
  const config = spec.config(name, context);
  const pair = (member: string) =>
    pairOf(spec.handler, member) as IAdtHeaders | undefined;
  const handle = (client: AdtClient) => spec.handle(client);
  const created = await probe.direct1(
    (client, analyse) =>
      handle(client).create?.(config, { headers: pair('create'), analyse }) ??
      Promise.resolve(),
  );
  // Ours, and into the ledger (newest first: the object before its parent),
  // only when the create answered 2xx.
  if (
    !(await probe.claim(spec, name, context, {
      ...(created.wire ? { status: created.wire.status } : {}),
    }))
  )
    return `the create answered ${created.wire?.status ?? created.failure ?? 'nothing'}`;
  const source = spec.source?.(name, context);
  if (source !== undefined) {
    const locked = await probe.direct1(
      (client, analyse) =>
        handle(client).lock?.(config, { analyse }) ?? Promise.resolve(),
    );
    const held = lockHandle(locked);
    if (!held)
      return `the lock for its source answered ${locked.wire?.status ?? locked.failure ?? 'nothing'}`;
    let written: ICapture | undefined;
    try {
      written = await probe.direct1(
        (client, analyse) =>
          handle(client).update?.(config, {
            headers: pair('update'),
            source,
            lockHandle: held,
            analyse,
          }) ?? Promise.resolve(),
      );
    } finally {
      await probe.release(
        `${spec.type} ${name}`,
        (h) => (client, analyse) =>
          handle(client).unlock?.(config, h, { analyse }) ?? Promise.resolve(),
        held,
      );
    }
    if (!ok(written))
      return `its source write answered ${written.wire?.status ?? written.failure ?? 'nothing'}`;
  }
  if (spec.noActivation) return undefined;
  const activated = await probe.direct1(
    (client, analyse) =>
      handle(client).activate?.(config, {
        headers: pair('activate'),
        analyse,
      }) ?? Promise.resolve(),
  );
  // A type with no activation sends nothing: nothing to wait for.
  if (!activated.requests.length && !activated.failure) return undefined;
  return ok(activated)
    ? undefined
    : `the activation answered ${activated.wire?.status ?? activated.failure ?? 'nothing'}`;
}

/** What an object's members read must exist on it: a message, the test class include. */
async function prepare(
  probe: Probe,
  type: string,
  name: string,
  context: ITemporaryContext,
): Promise<void> {
  if (type === 'messageClass')
    await probe.direct1((client, analyse) =>
      (
        client.getMessageClassMessage() as unknown as {
          create: (config: unknown, options: unknown) => Promise<unknown>;
        }
      ).create(
        {
          className: name,
          msgno: '001',
          msgtext: 'Header probe 001',
          ...(context.transportRequest
            ? { transportRequest: context.transportRequest }
            : {}),
        },
        {
          headers: pairOf('getMessageClassMessage()', 'create'),
          analyse,
        },
      ),
    );
  if (type === 'class') {
    const spec = temporarySpec('class');
    if (!spec) return;
    const config = spec.config(name, context);
    const held = lockHandle(
      await probe.direct1(
        (client, analyse) =>
          spec.handle(client).lock?.(config, { analyse }) ?? Promise.resolve(),
      ),
    );
    if (!held) return;
    try {
      await probe.direct1((client, analyse) =>
        (
          client.getLocalTestClass() as unknown as {
            update: (config: unknown, options: unknown) => Promise<unknown>;
          }
        ).update(
          {
            className: name,
            ...(context.transportRequest
              ? { transportRequest: context.transportRequest }
              : {}),
          },
          {
            headers: pairOf('getLocalTestClass()', 'update'),
            source:
              'CLASS ltc_probe DEFINITION FINAL FOR TESTING DURATION SHORT RISK LEVEL HARMLESS.\n  PRIVATE SECTION.\n    METHODS probe FOR TESTING.\nENDCLASS.\n\nCLASS ltc_probe IMPLEMENTATION.\n  METHOD probe.\n  ENDMETHOD.\nENDCLASS.\n',
            lockHandle: held,
            analyse,
          },
        ),
      );
    } finally {
      await probe.release(
        `class ${name}`,
        (h) => (client, analyse) =>
          spec.handle(client).unlock?.(config, h, { analyse }) ??
          Promise.resolve(),
        held,
      );
    }
  }
}
