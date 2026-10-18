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
import { AdtClientLegacy } from '../../src/clients/AdtClientLegacy';
import { AdtExecutor } from '../../src/clients/AdtExecutor';
import { AdtExecutorLegacy } from '../../src/clients/AdtExecutorLegacy';
import { AdtRuntimeClient } from '../../src/clients/AdtRuntimeClient';
import { AbapDebugger } from '../../src/runtime/debugger/AbapDebugger';
import { AmdpDebugger } from '../../src/runtime/debugger/AmdpDebugger';
import { current, type ICapture, message, traced } from './capture';
import { FIXED_TEXT, PROBE_HANDLE, PROBE_NAME, PROBE_PACKAGE } from './corpus';
import { knownPair, legacyPair } from './pairs';
import { endpointOf, type ISentRequest } from './record';

/** The clients a handler comes from, on one connection: the modern and the legacy ones. */
export interface IClients {
  adt: AdtClient;
  legacy: AdtClientLegacy;
  runtime: AdtRuntimeClient;
  executor: AdtExecutor;
  legacyExecutor: AdtExecutorLegacy;
  abapGit: AdtAbapGitClient;
}

export function clientsOn(
  connection: IAbapConnection,
  options?: ConstructorParameters<typeof AdtClient>[2],
): IClients {
  return {
    adt: new AdtClient(connection, undefined, options),
    legacy: new AdtClientLegacy(connection, undefined, options),
    runtime: new AdtRuntimeClient(connection),
    executor: new AdtExecutor(connection),
    legacyExecutor: new AdtExecutorLegacy(connection),
    abapGit: new AdtAbapGitClient(connection),
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
 * The legacy client's are labelled `legacy get…()`, as MIGRATION-36 does.
 */
export function handlerSpecs(clients: IClients): IHandlerSpec[] {
  const specs: IHandlerSpec[] = [];
  const factories = (key: keyof IClients, prefix = '') => {
    const client = clients[key] as unknown as Record<string, unknown>;
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
        of: (on) =>
          (on[key] as unknown as Record<string, () => Handler>)[name].call(
            on[key],
          ),
      });
    }
  };
  factories('adt');
  factories('legacy', 'legacy ');
  factories('runtime');
  factories('executor');
  factories('legacyExecutor', 'legacy ');
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
export const UNIVERSAL: unknown = new Proxy(
  {},
  {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => PROBE_NAME;
      if (typeof key !== 'string') return undefined;
      if (key === 'then' || key === 'toJSON') return undefined;
      if (key === 'packageName' || key === 'superPackage') return PROBE_PACKAGE;
      if (key === 'name' || key.endsWith('Name') || key.endsWith('_name'))
        return PROBE_NAME;
      if (key === 'id' || key.endsWith('Id') || key.endsWith('_id'))
        return PROBE_NAME;
      if (['description', 'msgtext', 'text', 'label'].includes(key))
        return PROBE_TEXT;
      if (['source', 'sourceCode', 'content', 'xml', 'code'].includes(key))
        return FIXED_TEXT;
      if (key === 'msgno') return '001';
      // A name the address needs, where a type is part of it.
      if (key === 'transportNumber') return PROBE_NAME;
      if (key === 'enhancementType') return 'enhoxhb';
      if (key === 'object_type' || key === 'objectType') return 'program';
      if (key === 'toString' || key === 'valueOf') return () => PROBE_NAME;
      const fromString = (PROBE_NAME as unknown as Record<string, unknown>)[
        key
      ];
      if (typeof fromString === 'function') return fromString.bind(PROBE_NAME);
      return undefined;
    },
  },
);

/** The options a member is given: the headers, the strategy's reading. */
export interface IMemberOptions {
  headers?: IAdtHeaders;
  analyse: IAnalyse;
}

/** What one argument of a member gets, or why the member cannot be called without a real object. */
export function argumentFor(
  name: string,
  options: IMemberOptions,
): { value: unknown } | { skip: string } {
  const lower = name.toLowerCase();
  if (lower.includes('option')) return { value: options };
  if (lower === 'lockhandle' || lower === 'handle' || lower.endsWith('handle'))
    return { value: PROBE_HANDLE };
  if (lower === 'version' || lower === 'status' || lower === 'transportrequest')
    return { value: undefined };
  if (lower.endsWith('uri') || lower.endsWith('url') || lower.endsWith('link'))
    return {
      skip: `needs a URI the system handed out in an earlier answer (${name})`,
    };
  if (lower === 'objects' || lower.endsWith('objects'))
    return { value: [{ type: 'PROG/P', name: PROBE_NAME }] };
  return { value: UNIVERSAL };
}

/** How many requests one recording may issue before it is stopped (a polling member). */
export const RECORDING_LIMIT = 10;

/** A connection that sends nothing: every request answers an empty 200. */
export function recordingConnection(): IAbapConnection {
  return {
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
  } as IAbapConnection;
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
  /** Whether any request the member builds carries a body. */
  hasBody?: boolean;
}

/** The corpus pair of a member, from pairs.ts; the legacy client's from its own rows. */
export function pairOf(
  handler: string,
  member: string,
): Partial<IAdtHeaders> | undefined {
  if (handler.startsWith('legacy ')) return legacyPair(handler, member);
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
      entry.hasBody = capture.requests.some((request) => request.hasBody);
      // The legacy client's member is the modern one's: the same reason.
      const notSent = NOT_SENT[key.replace(/^legacy /, '')];
      if (notSent) entry.skipped = `skipped: ${notSent}`;
      else if (!entry.requests.length)
        entry.skipped = capture.failure
          ? `skipped: builds no request from the probe name alone: ${capture.failure}`
          : 'skipped: answers without a request on the probe name alone (it reads its input from a server answer it was not given)';
      else if (entry.requests.some((request) => request.action === 'LOCK'))
        entry.skipped =
          'skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks';
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
      else
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
