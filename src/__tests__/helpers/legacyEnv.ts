/**
 * The test environment of the live legacy checks on a 7.40 SP04 system.
 *
 * The idea is mcp-test's: classes in the system prepare the environment and
 * remove it, one call each, instead of dozens of slow ADT calls. 7.40 SP04
 * has no `IF_OO_ADT_CLASSRUN`, so the classes run through ABAP Unit —
 * `POST /sap/bc/adt/abapunit/testruns` (`runSync`), measured there over RFC:
 *
 * - `ZCL_LG7_ENV` holds the logic (`abap/zcl_lg7_env.clas.abap`, whose header
 *   states the scope it never leaves);
 * - `ZCL_LG7_ENV_PREPARE`, `_STATUS`, `_TEARDOWN`, `_REMOVE` each hold one local test
 *   method calling one action, and report it as ABAP Unit alerts:
 *   `@@LOG {json}` per step, then `@@RESULT {json}`.
 *
 * What ADT does well stays with ADT, through the library: installing those
 * classes (create, lock, write, unlock, activate — measured on 7.40), creating
 * the fixtures the live checks read and run, and deleting DDL sources (7.40
 * SP04 has no classic delete function module for them). What ADT cannot do —
 * enqueue locks left by a crashed run, inactive versions, leftovers, the
 * transport request (7.40's ADT refuses to create one) and the transportable
 * package `ZLG7_TEST` — is the ABAP class's.
 *
 * Every object this helper writes or deletes is named with the `ZLG7` prefix
 * and lives in `$TMP` (checked on the object's metadata before any write or
 * delete): an object of another name, or one in another package, is never
 * touched.
 *
 * Run: npm run legacy:setup / legacy:status / legacy:teardown (see
 * src/__tests__/admin/legacy-env/).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { XMLParser } from 'fast-xml-parser';
import type { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import type { AdtExecutorLegacy } from '../../clients/AdtExecutorLegacy';
import { isUnansweredCredentialRefusal } from '../../utils/adtResponse';
import { isModernAdtSystem } from '../../utils/systemInfo';
import { integrationHeadersOf } from './adtHeaders';
import { expectResult } from './contract';
import {
  deleteLocked,
  type LegacyDeletable,
  LOCAL_PACKAGE,
  withLock,
} from './legacyLive';
import { presenceOf } from './objectPresence';

/** Where the ABAP sources live. */
export const ABAP_DIR = path.resolve(
  __dirname,
  '..',
  'integration',
  'legacy',
  'abap',
);

/** The transportable package the env class creates and removes. */
export const ENV_PACKAGE = 'ZLG7_TEST';

/** The text every request of the environment starts with. */
export const REQUEST_MARKER = 'ZLG7 LEGACY-TEST';

export type OwnKind =
  | 'class'
  | 'interface'
  | 'program'
  | 'function group'
  | 'function module'
  | 'function include'
  | 'DDL source';

/** The prefix each kind of object of this environment carries. */
const PREFIXES: Record<OwnKind, readonly string[]> = {
  class: ['ZCL_LG7_'],
  interface: ['ZIF_LG7_'],
  program: ['ZLG7'],
  'function group': ['ZLG7'],
  'function module': ['Z_LG7_'],
  'function include': ['LZLG7'],
  'DDL source': ['ZLG7'],
};

/** Whether `name` is one of this environment's names for its kind. */
export function isOwnName(kind: OwnKind, name: string): boolean {
  const upper = name.trim().toUpperCase();
  return PREFIXES[kind].some(
    (p) => upper.startsWith(p) && upper.length > p.length,
  );
}

/** Throw unless `name` is one of this environment's names. */
export function assertOwnName(kind: OwnKind, name: string): void {
  if (!isOwnName(kind, name))
    throw new Error(
      `legacy env: ${kind} ${name} is not a ZLG7 name (${PREFIXES[kind].join(', ')}…); not touched`,
    );
}

/**
 * Fail unless every configured name of a live case is a ZLG7 name — before
 * anything is created: the environment cleans and removes only that prefix.
 */
export function requireOwnNames(
  caseName: string,
  names: ReadonlyArray<readonly [OwnKind, string]>,
): void {
  const wrong = names.filter(([kind, name]) => !isOwnName(kind, name));
  if (wrong.length > 0)
    throw new Error(
      `legacy_740/${caseName}: ${wrong.map(([kind, name]) => `${kind} ${name}`).join(', ')} not a ZLG7 name (${wrong.map(([kind]) => PREFIXES[kind].join('|')).join(', ')}…); nothing created`,
    );
}

const SPACE = [' ', '\n', '\t', '\r'];

/** The value of `attribute` in a start tag, or `undefined`. Plain string code. */
function attributeOf(tag: string, attribute: string): string | undefined {
  const key = `${attribute}="`;
  let at = tag.indexOf(key);
  while (at !== -1) {
    if (SPACE.includes(tag.charAt(at - 1))) {
      const start = at + key.length;
      const close = tag.indexOf('"', start);
      return close === -1 ? undefined : tag.slice(start, close);
    }
    at = tag.indexOf(key, at + 1);
  }
  return undefined;
}

/** The package an object's metadata document names, or `undefined`. */
export function packageOf(metadata: string): string | undefined {
  const at = metadata.indexOf('<adtcore:packageRef');
  if (at === -1) return undefined;
  const end = metadata.indexOf('>', at);
  if (end === -1) return undefined;
  return attributeOf(metadata.slice(at, end), 'adtcore:name');
}

/**
 * The person responsible an object's metadata names on its root element
 * (`adtcore:responsible`), or `undefined` when it names none.
 */
export function responsibleOf(metadata: string): string | undefined {
  let at = metadata.indexOf('<');
  while (at !== -1 && (metadata[at + 1] === '?' || metadata[at + 1] === '!'))
    at = metadata.indexOf('<', at + 1);
  if (at === -1) return undefined;
  const end = metadata.indexOf('>', at);
  if (end === -1) return undefined;
  return attributeOf(metadata.slice(at, end), 'adtcore:responsible');
}

/** The logged-on user, upper-cased as the user master stores it. */
function sessionUser(): string | undefined {
  return (
    process.env.SAP_USERNAME?.split('#')[0]?.trim().toUpperCase() || undefined
  );
}

/**
 * `$TMP` is shared by every user, so a `$TMP` object is touched only when its
 * metadata names the session user as the person responsible. Why not, when it
 * may not be touched; `undefined` when it may. Metadata that names no one
 * leaves the package and name checks as the guard.
 */
function notTheSessionUsers(metadata: string): string | undefined {
  const responsible = responsibleOf(metadata);
  if (responsible === undefined) return undefined;
  const user = sessionUser();
  if (user === undefined)
    return 'names a person responsible, and the session user is not known';
  if (responsible.toUpperCase() !== user)
    return 'is in $TMP, but another user is responsible for it';
  return undefined;
}

/** Two sources the same, line ends and trailing blanks aside. */
export function sameSource(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
      .trim();
  return norm(a) === norm(b);
}

// ---------------------------------------------------------------------------
// Settings from the configuration
// ---------------------------------------------------------------------------

/** What the env class needs from the configuration to create `ZLG7_TEST`. */
export interface LegacyEnvSettings {
  readonly softwareComponent: string;
  readonly transportLayer: string;
}

const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_/';

/**
 * A value that goes into an ABAP literal: upper-case letters, digits, `_` and
 * `/` only, 1..`max` characters — nothing that could end the literal.
 */
export function abapNameValue(
  key: string,
  value: unknown,
  max: number,
): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`legacy env: legacy_env.${key} is required`);
  const upper = value.trim().toUpperCase();
  if (upper.length > max || [...upper].some((c) => !NAME_CHARS.includes(c)))
    throw new Error(
      `legacy env: legacy_env.${key} must be 1-${max} characters of A-Z, 0-9, _ and / (a placeholder is still in place?)`,
    );
  return upper;
}

/** The settings from a configuration's `legacy_env` section. */
export function settingsOf(config: unknown): LegacyEnvSettings {
  const section = (config as { legacy_env?: Record<string, unknown> } | null)
    ?.legacy_env;
  if (!section || typeof section !== 'object')
    throw new Error(
      'legacy env: the configuration has no legacy_env section (see test-config.yaml.template)',
    );
  return {
    softwareComponent: abapNameValue(
      'software_component',
      section.software_component,
      30,
    ),
    transportLayer: abapNameValue(
      'transport_layer',
      section.transport_layer,
      4,
    ),
  };
}

/** The settings of the configuration this run loads. */
export function configuredSettings(): LegacyEnvSettings {
  const { loadTestConfig } = require('./test-helper');
  return settingsOf(loadTestConfig());
}

// ---------------------------------------------------------------------------
// The sources
// ---------------------------------------------------------------------------

function abapFile(name: string): string {
  return fs.readFileSync(path.join(ABAP_DIR, name), 'utf8');
}

/** A class to keep current: its main source and its test classes, if any. */
export interface ClassSource {
  readonly name: string;
  readonly description: string;
  readonly main: string;
  readonly testClasses?: string;
}

export type EnvAction = 'prepare' | 'status' | 'teardown' | 'remove';

/** The runner class of each action. */
export const RUNNERS: Record<EnvAction, string> = {
  prepare: 'ZCL_LG7_ENV_PREPARE',
  status: 'ZCL_LG7_ENV_STATUS',
  teardown: 'ZCL_LG7_ENV_TEARDOWN',
  remove: 'ZCL_LG7_ENV_REMOVE',
};

/** The prepare runner's test include, the settings filled in. */
export function renderPrepare(
  template: string,
  settings: LegacyEnvSettings,
): string {
  const component = abapNameValue(
    'software_component',
    settings.softwareComponent,
    30,
  );
  const layer = abapNameValue('transport_layer', settings.transportLayer, 4);
  const filled = template
    .split('{{SOFTWARE_COMPONENT}}')
    .join(component)
    .split('{{TRANSPORT_LAYER}}')
    .join(layer);
  if (filled.includes('{{'))
    throw new Error(
      'legacy env: an unknown placeholder is left in the prepare runner',
    );
  return filled;
}

/** The env class, then the runners of `actions` (they depend on it). */
export function envClasses(
  actions: readonly EnvAction[],
  settings?: LegacyEnvSettings,
): ClassSource[] {
  const list: ClassSource[] = [
    {
      name: 'ZCL_LG7_ENV',
      description: 'adt-clients legacy checks: test environment',
      main: abapFile('zcl_lg7_env.clas.abap'),
    },
  ];
  for (const action of actions) {
    const base = RUNNERS[action].toLowerCase();
    let testClasses = abapFile(`${base}.clas.testclasses.abap`);
    if (action === 'prepare') {
      if (!settings)
        throw new Error('legacy env: prepare needs the legacy_env settings');
      testClasses = renderPrepare(testClasses, settings);
    }
    list.push({
      name: RUNNERS[action],
      description: `adt-clients legacy checks: env ${action}`,
      main: abapFile(`${base}.clas.abap`),
      testClasses,
    });
  }
  return list;
}

/** The fixtures the live checks read and run: their names and sources. */
export const FIXTURES = {
  className: 'ZCL_LG7_FX_UNIT',
  programName: 'ZLG7_FX_UNIT',
  functionGroupName: 'ZLG7_FX',
  functionModuleName: 'Z_LG7_FX_UNIT',
  testIncludeName: 'LZLG7_FXT99',
} as const;

// ---------------------------------------------------------------------------
// The ABAP Unit answer
// ---------------------------------------------------------------------------

export interface EnvLogLine {
  readonly n: number;
  readonly step: string;
  readonly object: string;
  readonly status: string;
  readonly message: string;
}

export interface EnvResult {
  readonly ok: boolean;
  readonly action: string;
  readonly request: string;
  readonly package: string;
  readonly packageExists: boolean;
  readonly errors: number;
  readonly lines: number;
}

export interface EnvRun {
  readonly result: EnvResult;
  readonly log: EnvLogLine[];
}

/** Every element text and attribute value of a document, in document order. */
function textsOf(document: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
    htmlEntities: true,
  });
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) for (const item of node) walk(item);
    else if (node !== null && typeof node === 'object')
      for (const value of Object.values(node)) walk(value);
  };
  walk(parser.parse(document));
  return texts;
}

/**
 * The marked lines a testruns answer carries: each element text or attribute
 * value (an alert's title, a detail's text) that holds the marker, from the
 * marker on, the entities decoded by the XML parser — so a `"` written raw in
 * element text or as `&quot;` reads the same. Each line once.
 */
export function markedLines(document: string, marker: string): string[] {
  const found: string[] = [];
  for (const text of textsOf(document)) {
    const at = text.indexOf(marker);
    if (at === -1) continue;
    const line = text.slice(at + marker.length).trim();
    if (!found.includes(line)) found.push(line);
  }
  return found;
}

/**
 * Read the env class's report out of a testruns answer. Throws when there is
 * no `@@RESULT` line — the runner did not run (a syntax error, a risk level
 * the client does not allow) — naming the start of the answer.
 */
export function parseEnvRun(document: string): EnvRun {
  const results = markedLines(document, '@@RESULT ');
  if (results.length === 0)
    throw new Error(
      `legacy env: the ABAP Unit answer carries no @@RESULT line — the runner did not run. The answer begins: ${document.slice(0, 1500)}`,
    );
  if (results.length > 1)
    throw new Error(
      `legacy env: ${results.length} @@RESULT lines in one answer`,
    );
  const result = JSON.parse(results[0] as string) as EnvResult;
  // A line may come twice (title and detail): one per step number.
  const byStep = new Map<number, EnvLogLine>();
  for (const line of markedLines(document, '@@LOG ')) {
    const entry = JSON.parse(line) as EnvLogLine;
    if (!byStep.has(entry.n)) byStep.set(entry.n, entry);
  }
  const log = [...byStep.values()].sort((a, b) => a.n - b.n);
  if (log.length !== result.lines)
    throw new Error(
      `legacy env: the answer carries ${log.length} of ${result.lines} @@LOG lines`,
    );
  return { result, log };
}

/** One line per step, for a log or a report file. */
export function describeRun(run: EnvRun): string {
  const r = run.result;
  const lines = run.log.map(
    (l) =>
      `${l.status.padEnd(12)} ${l.step.padEnd(9)} ${l.object}${l.message ? ` — ${l.message}` : ''}`,
  );
  lines.push(
    `${r.action}: ${r.ok ? 'OK' : `${r.errors} ERROR(S)`} request=${r.request || '-'} package=${r.package} (${r.packageExists ? 'exists' : 'absent'})`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Talking to the system
// ---------------------------------------------------------------------------

export interface LegacyEnvTarget {
  readonly client: AdtClientLegacy;
  readonly executor: AdtExecutorLegacy;
  readonly logger?: ILogger;
}

type Answer = Promise<IAdtResponse<unknown, IAdtError>>;

/** The handler surface this helper uses; the legacy handlers have it. */
interface Writable {
  readMetadata(config: object): Answer;
  read(config: object, version?: 'active' | 'inactive'): Answer;
  create(config: object, options: { headers: IAdtHeaders }): Answer;
  lock(config: object): Promise<IAdtResponse<string, IAdtError>>;
  unlock(
    config: object,
    lockHandle: string,
  ): Promise<IAdtResponse<void, IAdtError>>;
  update(
    config: object,
    options: { headers: IAdtHeaders; lockHandle?: string; source?: string },
  ): Answer;
  activate(config: object, options: { headers: IAdtHeaders }): Answer;
  delete(
    config: object,
    options: { headers: IAdtHeaders; lockHandle?: string },
  ): Answer;
}

const as = (handler: unknown) => handler as Writable;

/** The same handler, as legacyLive's lock helpers take it. */
const lockable = (handler: Writable) =>
  handler as unknown as LegacyDeletable<object>;

/**
 * SAP refused the credential: every further request would be refused too,
 * so a loop over objects stops here instead of collecting one failure each.
 */
export class CredentialRefused extends Error {}

/** A refusal of the credential: a `401`, `RFC_LOGON_FAILURE`, or the connection's own refusal. */
export function isCredentialRefusal(error: unknown): boolean {
  if (error instanceof CredentialRefused) return true;
  if (isUnansweredCredentialRefusal(error)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('RFC_LOGON_FAILURE');
}

/** Throw `CredentialRefused` when `answer` is SAP refusing the credential. */
export function stopOnCredentialRefusal(
  answer: IAdtResponse<unknown, IAdtError>,
  what: string,
): void {
  if (answer.ok) return;
  const failure = answer.getError();
  if (
    failure.response?.status === 401 ||
    (failure.message ?? '').includes('RFC_LOGON_FAILURE')
  )
    throw new CredentialRefused(
      `legacy env: ${what}: the credential was refused [${failure.origin}]: ${failure.message} — stopping`,
    );
}

/** Is it there? `unknown` is never read as either answer. */
async function isPresent(handler: Writable, config: object, label: string) {
  const answer = await handler.readMetadata(config);
  stopOnCredentialRefusal(answer, `read ${label}`);
  const there = presenceOf(answer, label);
  if (there.present === 'unknown') throw new Error(there.reason);
  return there.present;
}

/**
 * Throw unless the object's metadata names `$TMP` and, where it names a person
 * responsible, the session user.
 */
async function assertLocal(handler: Writable, config: object, label: string) {
  const answer = await handler.readMetadata(config);
  // By the answer's status, not its words: a 401 here stops the caller's loop.
  stopOnCredentialRefusal(answer, `read ${label}`);
  const metadata = String(expectResult(answer, `read ${label}`));
  const pkg = packageOf(metadata);
  if (pkg?.toUpperCase() !== LOCAL_PACKAGE)
    throw new Error(
      `legacy env: ${label} is in package ${pkg ?? '(none named)'}, not ${LOCAL_PACKAGE}; not touched`,
    );
  const foreign = notTheSessionUsers(metadata);
  if (foreign) throw new Error(`legacy env: ${label} ${foreign}; not touched`);
}

/**
 * The current (inactive, else active) source; `''` for an include never
 * written, which ADT answers with an empty body or a `404`.
 */
async function source(handler: Writable, config: object, label: string) {
  const answer = await handler.read(config, 'inactive');
  stopOnCredentialRefusal(answer, `read ${label}`);
  if (!answer.ok && answer.getError().response?.status === 404) return '';
  return String(expectResult(answer, `read ${label}`) ?? '');
}

/**
 * Keep a class current in `$TMP`: create it when missing, write the parts
 * whose source differs under one class lock, activate when anything was
 * written. Answers whether it wrote.
 */
export async function ensureClass(
  target: LegacyEnvTarget,
  cls: ClassSource,
): Promise<boolean> {
  assertOwnName('class', cls.name);
  const handler = as(target.client.getClass());
  const tests = as(target.client.getLocalTestClass());
  const config = { className: cls.name };
  const label = `class ${cls.name}`;
  if (!(await isPresent(handler, config, label))) {
    expectResult(
      await handler.create(
        { ...config, packageName: LOCAL_PACKAGE, description: cls.description },
        { headers: integrationHeadersOf(handler, 'create') },
      ),
      `create ${label}`,
    );
    target.logger?.info(`legacy env: created ${label}`);
  }
  await assertLocal(handler, config, label);

  const mainDiffers = !sameSource(
    await source(handler, config, label),
    cls.main,
  );
  const testsDiffer =
    cls.testClasses !== undefined &&
    !sameSource(
      await source(tests, config, `${label} test classes`),
      cls.testClasses,
    );
  if (!mainDiffers && !testsDiffer) return false;

  await withLock(lockable(handler), config, label, async (lockHandle) => {
    if (mainDiffers)
      expectResult(
        await handler.update(config, {
          headers: integrationHeadersOf(handler, 'update'),
          lockHandle,
          source: cls.main,
        }),
        `write ${label}`,
      );
    if (testsDiffer)
      expectResult(
        await tests.update(config, {
          headers: integrationHeadersOf(tests, 'update'),
          lockHandle,
          source: cls.testClasses,
        }),
        `write ${label} test classes`,
      );
  });
  expectResult(
    await handler.activate(config, {
      headers: integrationHeadersOf(handler, 'activate'),
    }),
    `activate ${label}`,
  );
  target.logger?.info(`legacy env: wrote and activated ${label}`);
  return true;
}

/** Keep one source object (program, module, include) current; `true` when written. */
async function ensureSource(
  target: LegacyEnvTarget,
  handler: Writable,
  config: object,
  label: string,
  text: string,
): Promise<boolean> {
  if (sameSource(await source(handler, config, label), text)) return false;
  await withLock(lockable(handler), config, label, async (lockHandle) =>
    expectResult(
      await handler.update(config, {
        headers: integrationHeadersOf(handler, 'update'),
        lockHandle,
        source: text,
      }),
      `write ${label}`,
    ),
  );
  expectResult(
    await handler.activate(config, {
      headers: integrationHeadersOf(handler, 'activate'),
    }),
    `activate ${label}`,
  );
  target.logger?.info(`legacy env: wrote and activated ${label}`);
  return true;
}

/** Create `config` in `$TMP` when missing; then require it to be in `$TMP`. */
async function ensureLocalObject(
  target: LegacyEnvTarget,
  handler: Writable,
  config: object,
  label: string,
  description: string,
): Promise<void> {
  if (!(await isPresent(handler, config, label))) {
    expectResult(
      await handler.create(
        { ...config, packageName: LOCAL_PACKAGE, description },
        { headers: integrationHeadersOf(handler, 'create') },
      ),
      `create ${label}`,
    );
    target.logger?.info(`legacy env: created ${label}`);
  }
  await assertLocal(handler, config, label);
}

/**
 * The fixtures, created when missing and kept at their sources: the class and
 * the report with local tests, the function group with its module and test
 * include. All in `$TMP`; an existing one in another package fails, untouched.
 */
export async function ensureFixtures(target: LegacyEnvTarget): Promise<void> {
  const c = target.client;
  await ensureClass(target, {
    name: FIXTURES.className,
    description: 'adt-clients legacy checks: fixture with tests',
    main: abapFile('zcl_lg7_fx_unit.clas.abap'),
    testClasses: abapFile('zcl_lg7_fx_unit.clas.testclasses.abap'),
  });

  assertOwnName('program', FIXTURES.programName);
  const program = as(c.getProgram());
  const prog = { programName: FIXTURES.programName };
  await ensureLocalObject(
    target,
    program,
    prog,
    `program ${prog.programName}`,
    'adt-clients legacy checks: fixture with tests',
  );
  await ensureSource(
    target,
    program,
    prog,
    `program ${prog.programName}`,
    abapFile('zlg7_fx_unit.prog.abap'),
  );

  assertOwnName('function group', FIXTURES.functionGroupName);
  const groupHandler = as(c.getFunctionGroup());
  const group = { functionGroupName: FIXTURES.functionGroupName };
  const groupLabel = `function group ${group.functionGroupName}`;
  await ensureLocalObject(
    target,
    groupHandler,
    group,
    groupLabel,
    'adt-clients legacy checks: fixture with tests',
  );

  assertOwnName('function module', FIXTURES.functionModuleName);
  const moduleHandler = as(c.getFunctionModule());
  const module = { ...group, functionModuleName: FIXTURES.functionModuleName };
  const moduleLabel = `function module ${module.functionModuleName}`;
  if (!(await isPresent(moduleHandler, module, moduleLabel))) {
    expectResult(
      await moduleHandler.create(
        { ...module, description: 'adt-clients legacy checks: fixture' },
        { headers: integrationHeadersOf(moduleHandler, 'create') },
      ),
      `create ${moduleLabel}`,
    );
  }
  await ensureSource(
    target,
    moduleHandler,
    module,
    moduleLabel,
    abapFile('zlg7_fx.fugr.z_lg7_fx_unit.abap'),
  );

  assertOwnName('function include', FIXTURES.testIncludeName);
  const includeHandler = as(c.getFunctionInclude());
  const include = { ...group, includeName: FIXTURES.testIncludeName };
  const includeLabel = `function include ${include.includeName}`;
  // The include's own metadata read is not measured on 7.40: its presence is
  // read from its source, empty or `404` for an include never created.
  if ((await source(includeHandler, include, includeLabel)).trim() === '') {
    expectResult(
      await includeHandler.create(
        { ...include, description: 'adt-clients legacy checks: tests' },
        { headers: integrationHeadersOf(includeHandler, 'create') },
      ),
      `create ${includeLabel}`,
    );
  }
  await ensureSource(
    target,
    includeHandler,
    include,
    includeLabel,
    abapFile('zlg7_fx.fugr.lzlg7_fxt99.abap'),
  );
  expectResult(
    await groupHandler.activate(group, {
      headers: integrationHeadersOf(groupHandler, 'activate'),
    }),
    `activate ${groupLabel}`,
  );
}

/** Install the env class and the runners of `actions`, writing only what differs. */
export async function installEnv(
  target: LegacyEnvTarget,
  actions: readonly EnvAction[],
  settings?: LegacyEnvSettings,
): Promise<void> {
  for (const cls of envClasses(actions, settings))
    await ensureClass(target, cls);
}

/** Run one action's runner through ABAP Unit and read its report. */
export async function runEnvAction(
  target: LegacyEnvTarget,
  action: EnvAction,
): Promise<EnvRun> {
  const runner = RUNNERS[action];
  const answer = await target.executor.getClassTestRunner().runSync(runner, {
    title: `ZLG7 env ${action}`,
    scope: { ownTests: true, foreignTests: false },
    riskLevel: { harmless: true, dangerous: true, critical: true },
    duration: { short: true, medium: true, long: true },
    analyse: analyseException,
  });
  const run = parseEnvRun(String(expectResult(answer, `run ${runner}`)));
  target.logger?.info(`legacy env ${action}:\n${describeRun(run)}`);
  return run;
}

/**
 * Delete the DDL sources the env class left for ADT: lock, `DELETE
 * ?lockHandle=`, unlock — measured on 7.40 SP04. Guarded like everything here:
 * a ZLG7 name whose metadata names `$TMP`, or `ZLG7_TEST` with the env's
 * request as `corrNr`.
 */
export async function deleteLeftDdls(
  target: LegacyEnvTarget,
  run: EnvRun,
): Promise<string[]> {
  const problems: string[] = [];
  for (const line of run.log.filter((l) => l.status === 'LEFT-FOR-ADT')) {
    const [type, name] = line.object.split(' ');
    if (type !== 'DDLS' || !name || !isOwnName('DDL source', name)) {
      problems.push(`${line.object}: not a ZLG7 DDL source; not touched`);
      continue;
    }
    const handler = as(target.client.getDdl());
    const label = `DDL source ${name}`;
    const local = line.message.toUpperCase() === LOCAL_PACKAGE;
    const inEnvPackage = line.message.toUpperCase() === ENV_PACKAGE;
    try {
      const read = await handler.readMetadata({ ddlName: name });
      stopOnCredentialRefusal(read, `read ${label}`);
      const metadata = String(expectResult(read, `read ${label}`));
      const pkg = packageOf(metadata)?.toUpperCase();
      if (
        !(local && pkg === LOCAL_PACKAGE) &&
        !(inEnvPackage && pkg === ENV_PACKAGE)
      )
        throw new Error(`in package ${pkg ?? '(none named)'}; not touched`);
      const foreign =
        pkg === LOCAL_PACKAGE ? notTheSessionUsers(metadata) : undefined;
      if (foreign) throw new Error(`${foreign}; not touched`);
      const config = {
        ddlName: name,
        ...(inEnvPackage && { transportRequest: run.result.request }),
      };
      const deleted = await deleteLocked(lockable(handler), config, label);
      stopOnCredentialRefusal(deleted, `delete ${label}`);
      expectResult(deleted, `delete ${label}`);
      target.logger?.info(`legacy env: deleted ${label}`);
    } catch (error) {
      if (isCredentialRefusal(error)) throw error;
      problems.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return problems;
}

/** Fail naming every ERROR line (and every DDL source left behind). */
function requireClean(run: EnvRun, problems: readonly string[]): void {
  const errors = run.log
    .filter((l) => l.status === 'ERROR')
    .map((l) => `${l.step} ${l.object}: ${l.message}`);
  const all = [...errors, ...problems];
  if (all.length > 0)
    throw new Error(
      `legacy env ${run.result.action} reported ${all.length} problem(s):\n  ${all.join('\n  ')}`,
    );
}

/**
 * The admin runs install classes and delete objects on the system they are
 * pointed at, so they run only on a legacy one: a system that answers
 * `/sap/bc/adt/core/discovery` (`isModernAdtSystem()` true) is refused before
 * anything is installed — a 7.40 configuration pointed at the wrong host must
 * not set up, or tear down, anything there.
 */
export async function assertLegacySystem(
  connection: IAbapConnection,
  isModern: (
    connection: IAbapConnection,
  ) => Promise<boolean> = isModernAdtSystem,
): Promise<void> {
  if (await isModern(connection)) {
    throw new Error(
      'The legacy test environment refuses this system: it answers ' +
        '/sap/bc/adt/core/discovery, so it is not a legacy (7.40) system. ' +
        'Nothing was installed or deleted.',
    );
  }
}

/**
 * Before the live checks: install the env classes, run prepare (own locks,
 * leftovers, inactive versions, the request, the package), delete the DDL
 * sources it left for ADT, and create or refresh the fixtures.
 */
export async function setup(
  target: LegacyEnvTarget,
  settings: LegacyEnvSettings,
): Promise<EnvRun> {
  await installEnv(
    target,
    ['prepare', 'status', 'teardown', 'remove'],
    settings,
  );
  const run = await runEnvAction(target, 'prepare');
  requireClean(run, await deleteLeftDdls(target, run));
  await ensureFixtures(target);
  return run;
}

/**
 * The environment as it is: the open marked request, the package, every
 * object in scope. Reads only; installs nothing — run setup first.
 */
export async function status(target: LegacyEnvTarget): Promise<EnvRun> {
  const runner = as(target.client.getClass());
  if (!(await isPresent(runner, { className: RUNNERS.status }, RUNNERS.status)))
    throw new Error(
      `legacy env: ${RUNNERS.status} is not installed — run npm run legacy:setup first`,
    );
  return runEnvAction(target, 'status');
}

/** Two runs as one report: both logs, the second's state, ok only if both are. */
export function combineRuns(first: EnvRun, second: EnvRun): EnvRun {
  const offset = first.log.length;
  const log = [
    ...first.log,
    ...second.log.map((l) => ({ ...l, n: l.n + offset })),
  ];
  return {
    result: {
      ...second.result,
      action: `${first.result.action}+${second.result.action}`,
      ok: first.result.ok && second.result.ok,
      errors: first.result.errors + second.result.errors,
      lines: log.length,
    },
    log,
  };
}

/**
 * When no longer needed, in this order:
 * 1. teardown (ABAP): own locks; every object in scope, fixtures included,
 *    DDL sources left for ADT; inactive versions — the request kept;
 * 2. the DDL sources over ADT, with the request as `corrNr` in `ZLG7_TEST`;
 * 3. remove (ABAP): package `ZLG7_TEST`, then every marked request — none
 *    is released;
 * 4. the env classes themselves over ADT, runners first.
 * A credential refusal stops it at once.
 */
export async function teardown(target: LegacyEnvTarget): Promise<EnvRun> {
  await installEnv(target, ['teardown', 'remove']);
  const objects = await runEnvAction(target, 'teardown');
  const problems = await deleteLeftDdls(target, objects);
  const rest = await runEnvAction(target, 'remove');
  const handler = as(target.client.getClass());
  const classes = [
    RUNNERS.prepare,
    RUNNERS.status,
    RUNNERS.teardown,
    RUNNERS.remove,
    'ZCL_LG7_ENV',
  ];
  for (const name of classes) {
    assertOwnName('class', name);
    const config = { className: name };
    const label = `class ${name}`;
    try {
      if (!(await isPresent(handler, config, label))) continue;
      await assertLocal(handler, config, label);
      const deleted = await deleteLocked(lockable(handler), config, label);
      stopOnCredentialRefusal(deleted, `delete ${label}`);
      expectResult(deleted, `delete ${label}`);
      target.logger?.info(`legacy env: deleted ${label}`);
    } catch (error) {
      if (isCredentialRefusal(error)) throw error;
      problems.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const run = combineRuns(objects, rest);
  requireClean(run, problems);
  return run;
}
