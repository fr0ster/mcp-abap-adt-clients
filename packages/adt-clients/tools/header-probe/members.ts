/**
 * The clients source of the error corpus: every member of the adt-clients
 * handlers, the request it builds, and how to call it again.
 *
 * The endpoints are taken from the requests the members actually build: each
 * member is called against a connection that sends nothing and answers every
 * request with an empty 200, and the requests it issued are recorded. Every
 * argument names the fixed probe object ({@link PROBE_NAME}), which no system
 * has. A member that cannot be recorded that way is listed with the reason.
 */

import type { IAdtHeaders, IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtAbapGitClient } from '../../src/clients/AdtAbapGitClient';
import { AdtClient } from '../../src/clients/AdtClient';
import { AdtExecutor } from '../../src/clients/AdtExecutor';
import { AdtRuntimeClient } from '../../src/clients/AdtRuntimeClient';
import { AbapDebugger } from '../../src/runtime/debugger/AbapDebugger';
import { AmdpDebugger } from '../../src/runtime/debugger/AmdpDebugger';
import {
  current,
  type ICapture,
  message,
  silent,
  throughGate,
  traced,
} from './capture';
import { FIXED_TEXT, PROBE_HANDLE, PROBE_NAME, PROBE_PACKAGE } from './corpus';
import type { IProbeClient } from './objects';
import { knownPair } from './pairs';
import { endpointOf, type ISentRequest, presence } from './record';

/** The clients a handler comes from, on one connection. */
export interface IClients {
  adt: AdtClient;
  runtime: AdtRuntimeClient;
  executor: AdtExecutor;
  abapGit: AdtAbapGitClient;
  /** The clients of the registered client sets ({@link registerClientSet}), by key. */
  more: Readonly<Record<string, object>>;
}

/**
 * Clients of another package of this repository, probed beside these: each
 * set's clients hand out handlers labelled `<prefix>get…()`, their pairs come
 * from the set's own table, and a member the base client's same-named member
 * does not send is not sent either. Registered by that package's entry point
 * before the run; nothing here knows the classes.
 */
export interface IClientSet {
  /** Prefix of every handler label, `'<word> '`. */
  readonly prefix: string;
  /** The set's clients on one connection, by key. */
  build(
    connection: IAbapConnection,
    options?: ConstructorParameters<typeof AdtClient>[2],
  ): Readonly<Record<string, object>>;
  /** The corpus pair of `handler.member` (its label prefixed), or `undefined`. */
  pairOf(handler: string, member: string): Partial<IAdtHeaders> | undefined;
  /**
   * Set when the system the run probes is one the base client cannot make,
   * read back and remove its temporary objects on: they are made, read and
   * removed through this set's client instead.
   */
  readonly forTemporaryObjects?: {
    /** The client that makes, reads and removes the temporary objects. */
    client(
      connection: IAbapConnection,
      options?: ConstructorParameters<typeof AdtClient>[2],
    ): IProbeClient;
    /** Its delete is made under the caller's lock: lock, delete with the handle, unlock. */
    readonly deleteUnderLock: boolean;
    /** An unknown path answers 2xx with an empty body there: such a read finds nothing. */
    readonly emptyBodyIsAbsent: boolean;
  };
}

const CLIENT_SETS: IClientSet[] = [];

/** The registered set that takes over the temporary objects, if any. */
export const temporaryObjectsSet = (): IClientSet | undefined =>
  CLIENT_SETS.find((set) => set.forTemporaryObjects !== undefined);

/** The client a registered set makes the temporary objects with, if one does. */
export const temporaryClient = (
  connection: IAbapConnection,
  options?: ConstructorParameters<typeof AdtClient>[2],
): IProbeClient | undefined =>
  temporaryObjectsSet()?.forTemporaryObjects?.client(connection, options);

/** Whether a delete of a temporary object is made under its lock. */
export const deletesUnderLock = (): boolean =>
  temporaryObjectsSet()?.forTemporaryObjects?.deleteUnderLock === true;

/** Probe another package's clients as well, from now on. */
export function registerClientSet(set: IClientSet): void {
  if (!/^\S+ $/.test(set.prefix))
    throw new Error(
      `a client set's prefix is a word and a space: "${set.prefix}"`,
    );
  if (CLIENT_SETS.some((known) => known.prefix === set.prefix)) return;
  CLIENT_SETS.push(set);
  if (set.forTemporaryObjects?.emptyBodyIsAbsent)
    presence.emptyBodyIsAbsent = true;
}

/** The registered client set a handler label belongs to, if any. */
const setOf = (handler: string): IClientSet | undefined =>
  CLIENT_SETS.find((set) => handler.startsWith(set.prefix));

/**
 * The base client's label of a handler: a registered set's handler is the
 * base handler of the same name (`'<prefix>getClass()'` → `'getClass()'`).
 */
export function baseHandler(handler: string): string {
  const set = setOf(handler);
  return set ? handler.slice(set.prefix.length) : handler;
}

/** Whether a handler label is a registered client set's. */
export const isSetHandler = (handler: string): boolean =>
  setOf(handler) !== undefined;

export function clientsOn(
  connection: IAbapConnection,
  options?: ConstructorParameters<typeof AdtClient>[2],
): IClients {
  if (!throughGate(connection))
    throw new Error('clientsOn: the connection does not send through the gate');
  return {
    adt: new AdtClient(connection, undefined, options),
    runtime: new AdtRuntimeClient(connection),
    executor: new AdtExecutor(connection),
    abapGit: new AdtAbapGitClient(connection),
    more: Object.fromEntries(
      CLIENT_SETS.flatMap((set) =>
        Object.entries(set.build(connection, options)).map(([key, client]) => [
          `${set.prefix}${key}`,
          client,
        ]),
      ),
    ),
  };
}

type Member = (...args: unknown[]) => unknown;
type Handler = Record<string, Member | undefined>;

/** A handler as the corpus reaches it. */
export interface IHandlerSpec {
  /** The handler column of MIGRATION-36: `getClass()`, `AdtAbapGitClient`. */
  label: string;
  of(clients: IClients): Handler;
}

/** The members the corpus does not send, and why. */
export const NOT_SENT: Readonly<Record<string, string>> = {
  'getRequest().create':
    'the server assigns the request number, so a request a probe made could not be found by name and removed',
  'getRequest().createTask':
    'the server assigns the task number, so a task a probe made could not be found by name and removed',
  'getClassExecutor().scheduleTrace':
    'the server assigns the trace request id, so a schedule a probe made could not be found and removed',
  'getProgramExecutor().scheduleTrace':
    'the server assigns the trace request id, so a schedule a probe made could not be found and removed',
  'getAtc().createWorklist':
    'the server assigns the worklist id, so a worklist a probe made could not be found and removed',
  'AdtAbapGitClient.link': 'needs an external Git repository to link',
  'AdtAbapGitClient.pull': 'needs an external Git repository to link',
};

/** The debuggers' members: each needs a live debugging session, so none is sent. */
export const DEBUGGERS: readonly { label: string; prototype: object }[] = [
  { label: 'AbapDebugger', prototype: AbapDebugger.prototype },
  { label: 'AmdpDebugger', prototype: AmdpDebugger.prototype },
];

const memberNames = (instance: object): string[] => {
  const names = new Set<string>();
  for (
    let level = Object.getPrototypeOf(instance);
    level && level !== Object.prototype;
    level = Object.getPrototypeOf(level)
  )
    for (const key of Object.getOwnPropertyNames(level)) {
      if (key === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(level, key);
      if (descriptor && typeof descriptor.value === 'function') names.add(key);
    }
  return [...names];
};

export const prototypeMembers = (prototype: object): string[] =>
  memberNames(Object.create(prototype));

/**
 * Every handler the clients hand out — read from the clients themselves:
 * every `get…()` that answers an object — plus the abapGit client itself.
 */
export function handlerSpecs(clients: IClients): IHandlerSpec[] {
  const specs: IHandlerSpec[] = [];
  const factories = (
    client: Record<string, unknown>,
    of: (on: IClients) => Record<string, unknown>,
    prefix = '',
  ) => {
    for (const name of memberNames(client)) {
      if (!/^get[A-Z]/.test(name)) continue;
      let made: unknown;
      try {
        made = (client[name] as () => unknown).call(client);
      } catch {
        continue;
      }
      if (!made || typeof made !== 'object') continue;
      specs.push({
        label: `${prefix}${name}()`,
        of: (on) => {
          const owner = of(on);
          return (owner[name] as () => Handler).call(owner);
        },
      });
    }
  };
  const base = (key: 'adt' | 'runtime' | 'executor') => (on: IClients) =>
    on[key] as unknown as Record<string, unknown>;
  factories(base('adt')(clients), base('adt'));
  factories(base('runtime')(clients), base('runtime'));
  factories(base('executor')(clients), base('executor'));
  for (const set of CLIENT_SETS)
    for (const key of Object.keys(clients.more))
      if (key.startsWith(set.prefix))
        factories(
          clients.more[key] as Record<string, unknown>,
          (on) => on.more[key] as Record<string, unknown>,
          set.prefix,
        );
  specs.push({
    label: 'AdtAbapGitClient',
    of: (on) => on.abapGit as unknown as Handler,
  });
  return specs;
}

/** The parameter names of a method, from its source. A destructured one is `{}`. */
export function parameterNames(source: string): string[] {
  const open = source.indexOf('(');
  if (open === -1) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (char === '(' || char === '{' || char === '[') depth++;
    else if (char === ')' || char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  const inner = source.slice(open + 1, close === -1 ? undefined : close);
  const params: string[] = [];
  let piece = '';
  depth = 0;
  for (const char of inner) {
    if (char === '(' || char === '{' || char === '[') depth++;
    if (char === ')' || char === '}' || char === ']') depth--;
    if (char === ',' && depth === 0) {
      params.push(piece);
      piece = '';
    } else piece += char;
  }
  if (piece.trim()) params.push(piece);
  return params
    .map((param) => param.trim())
    .filter(Boolean)
    .map((param) => {
      if (param.startsWith('{') || param.startsWith('[')) return '{}';
      const name = param
        .replace(/^\.\.\./, '')
        .split('=')[0]
        .trim();
      return name;
    });
}

const PROBE_TEXT = 'Error corpus probe';

/**
 * The one value every config, name and id argument gets: a config object that
 * answers every `…Name`, `name` and `…Id` with the probe name, and a string
 * where a string is read. Never thenable.
 */
function universalFor(
  objectName: string,
  overrides: Readonly<Record<string, unknown>> = {},
): unknown {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === Symbol.toPrimitive) return () => objectName;
        if (typeof key !== 'string') return undefined;
        if (key === 'then' || key === 'toJSON') return undefined;
        // A temporary object's own names (its parent, its include, …).
        if (Object.hasOwn(overrides, key)) return overrides[key];
        if (key === 'packageName' || key === 'superPackage')
          return PROBE_PACKAGE;
        if (key === 'name' || key.endsWith('Name') || key.endsWith('_name'))
          return objectName;
        if (key === 'id' || key.endsWith('Id') || key.endsWith('_id'))
          return objectName;
        if (['description', 'msgtext', 'text', 'label'].includes(key))
          return PROBE_TEXT;
        if (['source', 'sourceCode', 'content', 'xml', 'code'].includes(key))
          return FIXED_TEXT;
        if (key === 'msgno') return '001';
        // A name the address needs, where a type is part of it.
        if (key === 'transportNumber') return objectName;
        if (key === 'enhancementType') return 'enhoxhb';
        // The client's own type name where it takes one (where-used); the
        // search's `objectType` stays unset: a value that is not an ADT type
        // makes it answer 406/037 for any Accept (measured).
        if (key === 'object_type') return 'program';
        if (key === 'query') return objectName;
        if (key === 'maxResults' || key === 'max_results') return 1;
        if (key === 'rootEntity') return objectName;
        if (key === 'implementationType') return 'managed';
        if (key === 'toString' || key === 'valueOf') return () => objectName;
        const fromString = (objectName as unknown as Record<string, unknown>)[
          key
        ];
        if (typeof fromString === 'function')
          return fromString.bind(objectName);
        return undefined;
      },
    },
  );
}

const universals = new Map<string, unknown>();

/** The universal value naming `name`: what a member gets in place of every config and name. */
export function universal(
  name: string,
  overrides?: Readonly<Record<string, unknown>>,
): unknown {
  if (overrides && Object.keys(overrides).length)
    return universalFor(name, overrides);
  let value = universals.get(name);
  if (value === undefined) {
    value = universalFor(name);
    universals.set(name, value);
  }
  return value;
}

export const UNIVERSAL: unknown = universal(PROBE_NAME);

/** The options a member is given: the headers, the strategy's reading. */
export interface IMemberOptions {
  headers?: IAdtHeaders;
  analyse: IAnalyse;
  /** The object every name argument names: the probe name unless given (a temporary object). */
  name?: string;
  /** A real lock handle, from a LOCK on the probe's own object. */
  lockHandle?: string;
  /** Config keys answered with these values first: a temporary object's parent, its include, … */
  overrides?: Readonly<Record<string, unknown>>;
  /** The body a write sends: a temporary object's metadata, read and written back unchanged. */
  source?: string;
}

/** What one argument of a member gets, or why the member cannot be called without a real object. */
export function argumentFor(
  name: string,
  options: IMemberOptions,
): { value: unknown } | { skip: string } {
  const lower = name.toLowerCase();
  // A member reads its lock handle from the options too.
  if (lower.includes('option')) {
    const { name: _name, overrides: _overrides, ...rest } = options;
    return {
      value: { ...rest, lockHandle: options.lockHandle ?? PROBE_HANDLE },
    };
  }
  // A positional ADT object type: a valid one.
  if (lower === 'objecttype' || lower === 'object_type')
    return { value: 'PROG/P' };
  if (lower === 'lockhandle' || lower === 'handle' || lower.endsWith('handle'))
    return { value: options.lockHandle ?? PROBE_HANDLE };
  if (lower === 'version' || lower === 'status' || lower === 'transportrequest')
    return { value: undefined };
  if (lower.endsWith('uri') || lower.endsWith('url') || lower.endsWith('link'))
    return {
      skip: `needs a URI the system handed out in an earlier answer (${name})`,
    };
  if (lower === 'objects' || lower.endsWith('objects'))
    return { value: [{ type: 'PROG/P', name: PROBE_NAME }] };
  if (options.overrides && Object.hasOwn(options.overrides, name))
    return { value: options.overrides[name] };
  return {
    value: options.name
      ? universal(options.name, options.overrides)
      : UNIVERSAL,
  };
}

/**
 * The request parameters a stand-in argument produced: a value `undefined`,
 * `null`, `NaN` or `[object Object]`, or an object type that is not an ADT
 * type (`XXXX` or `XXXX/YYYY`).
 */
export function standInParameters(
  requests: readonly { url: string; params?: unknown }[],
): string[] {
  const found: string[] = [];
  for (const request of requests) {
    const at = String(request.url ?? '').indexOf('?');
    const pairs: [string, string][] =
      at === -1
        ? []
        : [...new URLSearchParams(String(request.url).slice(at + 1)).entries()];
    if (request.params && typeof request.params === 'object')
      for (const [key, value] of Object.entries(
        request.params as Record<string, unknown>,
      ))
        pairs.push([key, String(value)]);
    for (const [key, value] of pairs) {
      const typeKey =
        key.toLowerCase() === 'objecttype' || key.toLowerCase() === 'type';
      if (
        ['undefined', 'null', 'NaN', '[object Object]'].includes(value) ||
        (typeKey && !/^[A-Za-z0-9]{1,4}(\/[A-Za-z0-9]{1,4})?$/.test(value))
      )
        found.push(`${key}=${value}`);
    }
  }
  return [...new Set(found)];
}

/** Why a member that sends a LOCK is not sent on the probe name; on a temporary object it is. */
export const LOCK_SKIP =
  'skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks';

/** How many requests one recording may issue before it is stopped (a polling member). */
export const RECORDING_LIMIT = 10;

/** A connection that sends nothing: every request answers an empty 200. */
export function recordingConnection(): IAbapConnection {
  return silent({
    connect: async () => {},
    getBaseUrl: async () => 'http://recording.invalid',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async <T, D>(
      _request: IAbapRequestOptions,
    ): Promise<IAdtWireResponse<T, D>> => {
      const recorded = current.getStore()?.requests.length ?? 0;
      if (recorded > RECORDING_LIMIT)
        throw new Error(
          `recording stopped after ${RECORDING_LIMIT} requests: the member polls`,
        );
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/xml' },
        data: '' as T,
      } as IAdtWireResponse<T, D>;
    },
  } as IAbapConnection);
}

/** One member of the clients source. */
export interface IMemberEndpoint {
  handler: string;
  member: string;
  /** The requests the member built when recorded. */
  requests: ISentRequest[];
  /** Calls the member again with these options. */
  call?: (handler: Handler, options: IMemberOptions) => Promise<unknown>;
  /** `skipped: <reason>`. */
  skipped?: string;
  /** The member's corpus pair (pairs.ts); a header the table names none for is absent. */
  pair?: Partial<IAdtHeaders>;
  /** Request parameters a stand-in argument produced (`key=value`): the request is not what a real call sends. */
  standIn?: string[];
  /** Whether any request the member builds carries a body. */
  hasBody?: boolean;
}

/** The corpus pair of a member, from pairs.ts; a client set's from its own table. */
export function pairOf(
  handler: string,
  member: string,
): Partial<IAdtHeaders> | undefined {
  const set = setOf(handler);
  if (set) return set.pairOf(handler, member);
  return (
    knownPair(handler, member) ??
    (handler === 'getClass()' || handler.startsWith('getLocal')
      ? knownPair('getClass() / getLocal*()', member)
      : undefined)
  );
}

const RECORDING_PAIR: IAdtHeaders = {
  accept: 'application/x-recording',
  contentType: 'application/x-recording',
};

const NAMES = [PROBE_NAME, PROBE_PACKAGE, PROBE_HANDLE];

/** The requests a capture recorded, as endpoints. */
export const endpointsOf = (capture: ICapture): ISentRequest[] =>
  capture.requests.map((request) =>
    endpointOf(
      String(request.method ?? ''),
      String(request.url ?? ''),
      request.params,
      NAMES,
    ),
  );

/**
 * Records every member of every handler: the requests each one builds.
 *
 * A method that answers no promise is a helper, not a member: it is returned
 * in `helpers`, not as a row.
 */
export async function recordMembers(): Promise<{
  members: IMemberEndpoint[];
  helpers: string[];
}> {
  const connection = traced(recordingConnection());
  const clients = clientsOn(connection);
  const members: IMemberEndpoint[] = [];
  const helpers: string[] = [];
  for (const spec of handlerSpecs(clients)) {
    const handler = spec.of(clients);
    for (const member of memberNames(handler)) {
      const key = `${spec.label}.${member}`;
      const fn = handler[member];
      if (typeof fn !== 'function') continue;
      const pair = pairOf(spec.label, member);
      const entry: IMemberEndpoint = {
        handler: spec.label,
        member,
        requests: [],
        ...(pair ? { pair } : {}),
      };
      const names = parameterNames(fn.toString());
      const build = (options: IMemberOptions) => {
        const args: unknown[] = [];
        for (const name of names) {
          const argument = argumentFor(name, options);
          if ('skip' in argument) return argument;
          args.push(argument.value);
        }
        return { args };
      };
      const capture: ICapture = { requests: [] };
      // What the member's strategy is handed when it refuses without a request.
      const analyse: IAnalyse = (verdict, wire) => {
        if (
          !wire &&
          verdict &&
          typeof verdict === 'object' &&
          'message' in verdict
        )
          capture.failure = String(verdict.message);
        return verdict;
      };
      const planned = build({ headers: RECORDING_PAIR, analyse });
      if ('skip' in planned) {
        entry.skipped = `skipped: ${planned.skip}`;
        members.push(entry);
        continue;
      }
      let answer: unknown;
      try {
        answer = current.run(capture, () => fn.apply(handler, planned.args));
      } catch (error) {
        capture.failure = message(error);
      }
      const thenable =
        answer !== null &&
        typeof answer === 'object' &&
        typeof (answer as { then?: unknown }).then === 'function';
      if (!thenable && !capture.requests.length) {
        if (!capture.failure) {
          helpers.push(key);
          continue;
        }
      }
      if (thenable)
        await (answer as Promise<unknown>).then(
          () => {},
          (error: unknown) => {
            capture.failure = message(error);
          },
        );
      entry.requests = endpointsOf(capture);
      const standIn = standInParameters(capture.requests);
      if (standIn.length) entry.standIn = standIn;
      entry.hasBody = capture.requests.some((request) => request.hasBody);
      // A client set's member is the base client's: the same reason.
      const notSent = NOT_SENT[`${baseHandler(spec.label)}.${member}`];
      if (notSent) entry.skipped = `skipped: ${notSent}`;
      else if (!entry.requests.length)
        entry.skipped = capture.failure
          ? `skipped: builds no request from the probe name alone: ${capture.failure}`
          : 'skipped: answers without a request on the probe name alone (it reads its input from a server answer it was not given)';
      else if (entry.requests.some((request) => request.action === 'LOCK'))
        entry.skipped = LOCK_SKIP;
      else if (
        entry.requests.some(
          (request) =>
            !request.path.startsWith('/') ||
            request.path.includes('undefined') ||
            request.path.includes('[object'),
        )
      )
        entry.skipped = `skipped: builds no address from the probe name alone (${entry.requests.map((request) => request.path).join(', ')})`;
      else if (capture.requests.length > RECORDING_LIMIT)
        entry.skipped = `skipped: polls (more than ${RECORDING_LIMIT} requests recorded)`;
      // The call, for what is sent: a member that sends a LOCK keeps it, and
      // runs on a temporary object, never on the probe name.
      if (!entry.skipped || entry.skipped === LOCK_SKIP)
        entry.call = (target, options) => {
          const live = build(options);
          if ('skip' in live) return Promise.reject(new Error(live.skip));
          const method = target[member];
          if (typeof method !== 'function')
            return Promise.reject(new Error(`${key} is not on the handler`));
          return Promise.resolve(method.apply(target, live.args));
        };
      members.push(entry);
    }
  }
  for (const debuggerSpec of DEBUGGERS)
    for (const member of prototypeMembers(debuggerSpec.prototype))
      members.push({
        handler: debuggerSpec.label,
        member,
        requests: [],
        skipped:
          'skipped: needs a live debugging session attached to a debuggee',
      });
  return { members, helpers };
}
