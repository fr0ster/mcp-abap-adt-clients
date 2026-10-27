/**
 * Every call an integration suite or a test helper makes to an adt-clients
 * member is judged: it passes an `analyse` strategy, and the effective one
 * is `analyseException` or `judged(<specific judge>)`.
 *
 * A member answers what came off the wire, so an `exc:exception` inside an
 * HTTP 200 — an authorization refusal, say — is `ok: true` unless the call
 * asked for a reading. A specific judge of adt-strategies
 * (`analyseActivation`, `analyseDeletion`, `analyseValidation`, …) reads only
 * its own document form and answers an exception document as "no failure",
 * so it is passed composed: `judged(analyseX)` (helpers/judged.ts) reads the
 * exception first. Judges that read exception documents themselves
 * (`analyseDebuggeeEnd`, …) count as judged.
 *
 * Everything is resolved with the compiler's type checker, never by text:
 *
 * - **which member a call is** — through the call's resolved signature, so a
 *   computed member (`h['readMetadata'](…)`), a bound one
 *   (`const read = h.readMetadata.bind(h); read(…)`) and a destructured one
 *   (`const { readMetadata } = h; readMetadata(…)`) are all that member. A
 *   member invoked through `call` / `apply`, and a call on an `any`-typed
 *   receiver, are refused outright; so is a local declaration that narrows a
 *   member and drops its `analyse` option;
 * - **which judge is passed** — through symbols, so an imported alias
 *   (`analyseDeletion as del`), a shorthand `{ analyse }`, options held in a
 *   `const`, and spreads are followed to the judge they carry. Properties are
 *   evaluated in order, so a later spread overrides an earlier `analyse`; a
 *   spread whose `analyse` cannot be resolved statically — an options
 *   parameter typed with an optional `analyse`, which may be `undefined` — is
 *   refused.
 *
 * The guard fails closed: a form it cannot resolve is refused, not accepted.
 * test-helper.js has no types, so its calls are found by member name on a
 * client handler, and its judge must be written as `analyseException` or
 * `judged(analyseX)`, nothing else.
 *
 * A call deliberately judged otherwise goes into ALLOWED, with its reason.
 * An entry that no longer matches a call fails too, so the list cannot rot.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filesUnder,
  jsFindings as jsFindingsUnder,
  typedFindings as typedFindingsUnder,
} from './judgedScan';

const ROOT = join(__dirname, '../../..');
const SCOPES = ['src/__tests__/integration', 'src/__tests__/helpers'];

/** `<file>:<member>:<first 60 characters of the call>` → why it is allowed. */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    'src/__tests__/integration/shared/responseContract.test.ts:activate:client.getClass().activate( { className: NEVER_EXISTS }, { h [analyse: refusalIsAFailure]',
    'The test exists to show a consumer judging the answer with its own strategy (refusalIsAFailure); the call before it uses analyseException.',
  ],
  [
    'src/__tests__/integration/shared/checkRun.test.ts:check:client .getClass() .check({ className, source: BROKEN_SOURCE [analyse: everythingIsAFailure]',
    "The test proves the caller's strategy is consulted: everythingIsAFailure refuses every answer, and the test asserts that refusal.",
  ],
  [
    'src/__tests__/helpers/sessionConfig.ts:getSystemInformation:getSystemInformation(connection)',
    "Its own reading decides: a 404 is the endpoint absent on premise ({ present: false }), a 2xx that is no JSON object a failure. analyseException would turn the 404's exception body into a failure on every on-premise system.",
  ],
  [
    'src/__tests__/integration/core/transport/Transport.test.ts:getSystemInformation:getSystemInformation(connection)',
    "As in sessionConfig: getSystemInformation's own reading of the 404 (absent on premise) and of a non-JSON 2xx (a failure) is the judge.",
  ],
]);

const typedFindings = (
  files: readonly string[],
  virtual?: ReadonlyMap<string, string>,
): string[] =>
  typedFindingsUnder(ROOT, join(ROOT, 'tsconfig.json'), files, virtual);

const jsFindings = (
  sources: ReadonlyMap<string, string> = new Map(
    SCOPES.flatMap((scope) => filesUnder(join(ROOT, scope), /\.js$/)).map(
      (file) => [file, readFileSync(file, 'utf8')],
    ),
  ),
): string[] => jsFindingsUnder(ROOT, sources);

const SCOPED_FILES = SCOPES.flatMap((scope) =>
  filesUnder(join(ROOT, scope), /\.ts$/),
);

describe('integration suites and helpers judge every adt-clients call', () => {
  const findings = [...typedFindings(SCOPED_FILES), ...jsFindings()];
  const unallowed = findings.filter(
    (finding) => !ALLOWED.has(finding.split(' — ')[0] ?? ''),
  );

  it('passes an analyse strategy, the exception document read first', () => {
    expect(unallowed).toEqual([]);
  });

  it('keeps no allow-list entry that matches no call', () => {
    const keys = new Set(findings.map((finding) => finding.split(' — ')[0]));
    expect([...ALLOWED.keys()].filter((key) => !keys.has(key))).toEqual([]);
  });
});

/**
 * The guard's own fixtures, in memory beside the helpers so their imports
 * resolve as a helper's would. Each refused form is refused for its own
 * reason; the judged forms pass.
 */
describe('the guard resolves receivers and judges by symbol', () => {
  const at = (name: string) => join(ROOT, 'src/__tests__/helpers', name);
  const HEAD = `import { analyseDeletion, analyseException, analyseDeletion as del } from '@mcp-abap-adt/adt-strategies';
import type { IAdtAnalyseOptions, IAdtResponse, IAdtRunnable, ITestRunInformation } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../clients/AdtClient';
import { judged } from './judged';
type Domain = ReturnType<AdtClient['getDomain']>;
`;
  const fixture = (name: string, body: string): [string, string] => [
    at(name),
    `${HEAD}${body}`,
  ];
  const fixtures = new Map<string, string>([
    fixture(
      '__guardHandler.ts',
      `type Handler = {
  readMetadata(config: any): Promise<any>;
  delete(config: any, options?: any): Promise<any>;
};
export async function f(handler: Handler) {
  await handler.readMetadata({});
  await handler.delete({}, {});
}
`,
    ),
    fixture(
      '__guardRunner.ts',
      `interface IRunner {
  getStatus(runId: string, withLongPolling?: boolean): Promise<IAdtResponse<unknown>>;
  getResult(runId: string): Promise<IAdtResponse<unknown>>;
}
export async function f(runner: IRunner) {
  await runner.getStatus('R', true);
  await runner.getResult('R');
}
`,
    ),
    fixture(
      '__guardClient.ts',
      `interface IGroupClient {
  getFunctionGroup(): {
    readMetadata(config: { functionGroupName: string }): Promise<IAdtResponse<unknown>>;
  };
}
export async function f(client: IGroupClient) {
  await client.getFunctionGroup().readMetadata({ functionGroupName: 'Z' });
}
`,
    ),
    fixture(
      '__guardAny.ts',
      `export async function f(handler: any) {
  await handler.readMetadata({}, { analyse: analyseException });
}
`,
    ),
    fixture(
      '__guardComputed.ts',
      `export async function f(h: Domain, key: 'readMetadata' | 'delete') {
  await h['readMetadata']({});
  await h[key]({});
}
`,
    ),
    fixture(
      '__guardBound.ts',
      `export async function f(h: Domain) {
  const read = h.readMetadata.bind(h);
  await read({});
}
`,
    ),
    fixture(
      '__guardDestructured.ts',
      `export async function f(h: Domain) {
  const { readMetadata } = h;
  await readMetadata({});
}
`,
    ),
    fixture(
      '__guardCallApply.ts',
      `export async function f(h: Domain) {
  await h.readMetadata.call(h, {}, { analyse: analyseException });
}
`,
    ),
    fixture(
      '__guardAlias.ts',
      `export async function f(h: Domain) {
  await h.delete({}, { analyse: del });
}
`,
    ),
    fixture(
      '__guardShorthand.ts',
      `export async function f(h: Domain) {
  const analyse = analyseDeletion;
  await h.delete({}, { analyse });
}
`,
    ),
    fixture(
      '__guardVariable.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseDeletion };
  await h.delete({}, opts);
}
`,
    ),
    fixture(
      '__guardSpreadUndefined.ts',
      `export async function f(h: Domain, opts: IAdtAnalyseOptions) {
  await h.readMetadata({}, { analyse: analyseException, ...opts });
}
`,
    ),
    fixture(
      '__guardSpreadSpecific.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseDeletion };
  await h.delete({}, { analyse: judged(analyseDeletion), ...opts });
}
`,
    ),
    fixture(
      '__guardUndefined.ts',
      `export async function f(h: Domain, flag: boolean) {
  await h.readMetadata({}, { analyse: flag ? analyseException : undefined });
}
`,
    ),
    fixture(
      '__guardMutated.ts',
      `export async function f(h: Domain) {
  const opts: { analyse?: unknown } = { analyse: analyseException };
  opts.analyse = undefined;
  await h.readMetadata({}, opts as never);
}
`,
    ),
    fixture(
      '__guardAliasMutated.ts',
      `export async function f(h: Domain) {
  const opts: { analyse?: unknown } = { analyse: analyseException };
  const alias = opts;
  alias.analyse = undefined;
  await h.readMetadata({}, opts as never);
}
`,
    ),
    fixture(
      '__guardDeleted.ts',
      `export async function f(h: Domain) {
  const opts: { analyse?: unknown } = { analyse: analyseException };
  delete opts.analyse;
  await h.readMetadata({}, opts as never);
}
`,
    ),
    fixture(
      '__guardAssigned.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseException };
  Object.assign(opts, { analyse: undefined });
  await h.readMetadata({}, opts);
}
`,
    ),
    fixture(
      '__guardEscaped.ts',
      `function tamper(o: { analyse?: unknown }) { o.analyse = undefined; }
export async function f(h: Domain) {
  const opts = { analyse: analyseException };
  tamper(opts);
  await h.readMetadata({}, opts);
}
`,
    ),
    fixture(
      '__guardExported.ts',
      `export const sharedOptions = { analyse: analyseException };
export async function f(h: Domain) {
  await h.readMetadata({}, sharedOptions);
}
`,
    ),
    fixture(
      '__guardCleanConst.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseException, headers: undefined };
  const copied = { ...opts };
  void opts.headers;
  await h.readMetadata({}, opts);
  await h.readMetadata({}, copied);
}
`,
    ),
    fixture(
      '__guardJudged.ts',
      `type IRunner = IAdtRunnable<string, unknown, object> & ITestRunInformation<unknown, unknown>;
export async function judgedCalls(h: Domain, runner: IRunner) {
  const opts = { analyse: judged(del) };
  const analyse = analyseException;
  const { readMetadata } = h;
  await h.delete({}, opts);
  await h.readMetadata({}, { analyse });
  await readMetadata({}, { analyse: analyseException });
  await h['readMetadata']({}, { headers: undefined, analyse: analyseException });
  await h.delete({}, { analyse: analyseDeletion, ...opts });
  await runner.getStatus('R', true, { analyse: analyseException });
}
`,
    ),
  ]);
  const findings = typedFindings([], fixtures);
  const of = (name: string) =>
    findings.filter((finding) => finding.includes(`/${name}:`));

  it.each([
    ['__guardHandler.ts', 2, /drops its analyse/],
    ['__guardRunner.ts', 2, /drops its analyse/],
    ['__guardClient.ts', 1, /drops its analyse/],
    ['__guardAny.ts', 1, /any-typed receiver/],
    ['__guardComputed.ts', 2, /no analyse|computed key/],
    ['__guardBound.ts', 1, /no analyse/],
    ['__guardDestructured.ts', 1, /no analyse/],
    ['__guardCallApply.ts', 1, /call\(\)/],
    ['__guardAlias.ts', 1, /analyseDeletion alone/],
    ['__guardShorthand.ts', 1, /analyseDeletion alone/],
    ['__guardVariable.ts', 1, /analyseDeletion alone/],
    ['__guardSpreadUndefined.ts', 1, /may be undefined/],
    ['__guardSpreadSpecific.ts', 1, /analyseDeletion alone/],
    ['__guardUndefined.ts', 1, /may be undefined/],
    ['__guardMutated.ts', 1, /has a property assigned/],
    ['__guardAliasMutated.ts', 1, /cannot prove/],
    ['__guardDeleted.ts', 1, /has a property deleted/],
    ['__guardAssigned.ts', 1, /escapes to a call/],
    ['__guardEscaped.ts', 1, /escapes to a call/],
    ['__guardExported.ts', 1, /is exported/],
  ])('refuses %s', (name, count, why) => {
    expect(of(name)).toHaveLength(count);
    for (const finding of of(name)) expect(finding).toMatch(why);
  });

  it('passes the judged forms: aliases, shorthand, variables, destructured and computed members, spreads that keep the judge', () => {
    expect(of('__guardJudged.ts')).toEqual([]);
  });

  it('passes a const options object nothing changes: read, copied, passed to the member', () => {
    expect(of('__guardCleanConst.ts')).toEqual([]);
  });
});

describe('the guard reads test-helper.js as written', () => {
  const js = (name: string, body: string): [string, string] => [
    join(ROOT, 'src/__tests__/helpers', name),
    body,
  ];
  const findings = jsFindings(
    new Map([
      js(
        '__guardSpread.js',
        `async function f(client, options) {
  await client.getDomain().readMetadata({}, { analyse: analyseException, ...options });
}`,
      ),
      js(
        '__guardRenamed.js',
        `const { analyseDeletion: analyseException } = require('@mcp-abap-adt/adt-strategies');
async function f(client) {
  await client.getDomain().delete({}, { analyse: analyseException });
}`,
      ),
      js(
        '__guardWrongJudge.js',
        `async function f(handler) {
  await handler.delete({}, { analyse: analyseDeletion });
  await handler.lock({});
}`,
      ),
      js(
        '__guardJudged.js',
        `async function f(client, handler) {
  await client.getDomain().readMetadata({}, { analyse: analyseException });
  await handler.delete({}, { analyse: judged(analyseDeletion) });
}`,
      ),
    ]),
  );
  const of = (name: string) =>
    findings.filter((finding) => finding.includes(`/${name}:`));

  it('refuses a spread in the options', () => {
    expect(of('__guardSpread.js')).toEqual([
      expect.stringMatching(/a spread in options/),
    ]);
  });

  it('refuses a judge renamed on import', () => {
    expect(of('__guardRenamed.js')).toEqual([
      expect.stringMatching(/renamed on import/),
    ]);
  });

  it('refuses an uncomposed judge and a missing one', () => {
    expect(of('__guardWrongJudge.js')).toEqual([
      expect.stringMatching(/analyseDeletion is neither/),
      expect.stringMatching(/no options|cannot read/),
    ]);
  });

  it('passes analyseException and judged(analyseX)', () => {
    expect(of('__guardJudged.js')).toEqual([]);
  });
});
