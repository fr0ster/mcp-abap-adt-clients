// The rules of tools/sourceRules.js, each form refused or allowed on its own.
//   node tools/test-sourceRules.js
//
// Each case is a small program written to a temporary package (a
// `tsconfig.json` and `src/`), read by `findForbidden`, and compared with the
// rule and kind it must yield, or with nothing for an allowed form. Spec
// section 6 lists the cases.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  findForbidden,
  baselineOf,
  compareWithBaseline,
} = require('./sourceRules');

const TSCONFIG = {
  compilerOptions: {
    target: 'es2022',
    module: 'commonjs',
    lib: ['es2022'],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  },
  include: ['src/**/*'],
};

/** Write `files` to a fresh package and return its findings. */
function run(files, options) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-rules-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(TSCONFIG));
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, 'src', name)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(dir, 'src', name), text);
    }
    const resolved = options?.(dir);
    return findForbidden(path.join(dir, 'tsconfig.json'), resolved).map(
      (f) => `${f.rule}/${f.kind}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const cases = [
  // C
  [
    'C: as',
    { 'a.ts': 'export const x = (1 as unknown) as string;' },
    ['cast/re-types', 'cast/redundant'],
  ],
  [
    'C: <T>',
    { 'a.ts': 'export const x = <string>(<unknown>1);' },
    ['cast/assertion', 'cast/assertion'],
  ],
  ['C: as const allowed', { 'a.ts': 'export const x = [1, 2] as const;' }, []],
  [
    'C: import alias allowed',
    {
      'a.ts': "import { join as j } from 'node:path';\nexport { j as joined };",
    },
    [],
  ],
  [
    'C: satisfies allowed',
    { 'a.ts': 'export const x = { a: 1 } satisfies { a: number };' },
    [],
  ],
  [
    'C: two on one line count twice',
    {
      'a.ts':
        'declare const u: unknown;\nexport const x = [u as string, u as number];',
    },
    ['cast/re-types', 'cast/re-types'],
  ],
  // Y
  ['Y: any keyword', { 'a.ts': 'export let x: any = 1;' }, ['any/keyword']],
  [
    'Y: JSON.parse read as a property',
    { 'a.ts': "export const x = JSON.parse('{}').a;" },
    ['any/flow'],
  ],
  [
    'Y: JSON.parse returned',
    { 'a.ts': "export function f() { return JSON.parse('{}'); }" },
    ['any/flow'],
  ],
  [
    'Y: JSON.parse to a typed parameter',
    {
      'a.ts':
        "function g(s: string) { return s; }\nexport const x = g(JSON.parse('1'));",
    },
    ['any/flow'],
  ],
  [
    'Y: JSON.parse to a typed variable',
    { 'a.ts': "export const x: number = JSON.parse('1');" },
    ['any/flow'],
  ],
  [
    'Y: JSON.parse bound to unknown allowed',
    { 'a.ts': "export const x: unknown = JSON.parse('1');" },
    [],
  ],
  [
    'Y: JSON.parse to an unknown parameter allowed',
    {
      'a.ts':
        "function g(v: unknown) { return v === 1; }\nexport const x = g(JSON.parse('1'));",
    },
    [],
  ],
  // N
  [
    'N: a typed value narrowed by hand',
    {
      'a.ts':
        "function f(v: unknown) { return typeof v === 'string'; }\nexport const x = f('a');",
    },
    ['hand-narrowed/widened'],
  ],
  [
    'N: one typed and one unknown caller',
    {
      'a.ts':
        "function f(v: unknown) { return typeof v === 'string'; }\ndeclare const u: unknown;\nexport const x = [f(u), f(1)];",
    },
    ['hand-narrowed/widened'],
  ],
  [
    'N: an exported function with a typed internal caller',
    {
      'a.ts':
        'export function f(v: unknown) { return Array.isArray(v); }\nexport const x = f([1]);',
    },
    ['hand-narrowed/widened'],
  ],
  [
    'N: a local unknown widened from a typed value',
    {
      'a.ts':
        "export function f(n: number) { const v: unknown = n; return typeof v === 'number'; }",
    },
    ['hand-narrowed/widened'],
  ],
  [
    'N: a catch variable narrowed, allowed',
    {
      'a.ts':
        'export function f() { try { return 1; } catch (e: unknown) { return e instanceof Error; } }',
    },
    [],
  ],
  [
    'N: an unknown from outside narrowed, allowed',
    {
      'a.ts':
        "declare const wire: { data: unknown };\nfunction f(v: unknown) { return typeof v === 'string'; }\nexport const x = f(wire.data);",
    },
    [],
  ],
  [
    'N: a typed value handed to a boundary reader, allowed',
    {
      'parsed.ts':
        "export function isText(v: unknown): boolean { return typeof v === 'string'; }",
      'a.ts':
        "import { isText } from './parsed';\nexport const x = isText('a');",
    },
    [],
    (dir) => ({
      boundaryModules: [`${dir.split(path.sep).join('/')}/src/parsed.ts`],
      readerModules: [],
    }),
  ],
  // R
  [
    'R: a literal',
    { 'a.ts': "export const x = /a/.test('a');" },
    ['regex/literal'],
  ],
  [
    'R: new RegExp',
    { 'a.ts': "export const x = new RegExp('a');" },
    ['regex/RegExp'],
  ],
  [
    'R: RegExp()',
    { 'a.ts': "export const x = RegExp('a');" },
    ['regex/RegExp'],
  ],
  [
    'R: RegExp aliased',
    { 'a.ts': "const R = RegExp;\nexport const x = new R('a');" },
    ['regex/RegExp'],
  ],
  [
    'R: a RegExp value from a declaration',
    {
      'a.ts':
        "declare function pattern(): RegExp;\nexport const x = pattern().test('a');",
    },
    ['regex/value'],
  ],
  [
    "R: s.match('x')",
    { 'a.ts': "export const x = 'abc'.match('b');" },
    ['regex/String.match'],
  ],
  [
    "R: s.matchAll('x')",
    { 'a.ts': "export const x = [...'abc'.matchAll('b')];" },
    ['regex/String.matchAll'],
  ],
  [
    "R: s.search('x')",
    { 'a.ts': "export const x = 'abc'.search('b');" },
    ['regex/String.search'],
  ],
  [
    'R: on a union receiver',
    { 'a.ts': "declare const s: 'a' | 'b';\nexport const x = s.match('a');" },
    ['regex/String.match'],
  ],
  [
    "R: s['match']",
    { 'a.ts': "export const x = 'abc'['match']('b');" },
    ['regex/String.match'],
  ],
  [
    'R: const m = s.match',
    { 'a.ts': "const m = 'abc'.match;\nexport const x = m;" },
    ['regex/String.match'],
  ],
  [
    'R: Symbol.replace',
    { 'a.ts': 'export const x = Symbol.replace;' },
    ['regex/Symbol.replace'],
  ],
  [
    'R: replace, replaceAll and split with strings, allowed',
    {
      'a.ts':
        "export const x = ['a-b'.replace('a', 'b'), 'a-b'.replaceAll('-', ''), 'a,b'.split(',')];",
    },
    [],
  ],
  // P
  [
    'P: a predicate over a typed value',
    {
      'a.ts': "export function isA(v: string): v is 'a' { return v === 'a'; }",
    },
    ['predicate/is'],
  ],
  [
    'P: a predicate in a reader over unknown, allowed',
    {
      'reader.ts':
        "export function isText(v: unknown): v is string { return typeof v === 'string'; }",
    },
    [],
    (dir) => ({
      boundaryModules: [],
      readerModules: [`${dir.split(path.sep).join('/')}/src/reader.ts`],
    }),
  ],
  [
    'P: a predicate over unknown outside a reader',
    {
      'a.ts':
        "export function isText(v: unknown): v is string { return typeof v === 'string'; }",
    },
    ['predicate/is'],
  ],
];

let failed = 0;
for (const [name, files, expected, options] of cases) {
  const got = run(files, options).sort();
  const want = [...expected].sort();
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failed += 1;
    console.error(
      `FAIL ${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
    );
  } else {
    console.log(`ok   ${name}`);
  }
}

// The baseline is a multiset: a finding beyond its count, or a count no
// longer reached, is a difference.
{
  const f = (text) => ({
    file: 'a.ts',
    line: 1,
    column: 1,
    rule: 'cast',
    kind: 're-types',
    text,
  });
  const baseline = baselineOf([f('x as T'), f('x as T')]);
  const same = compareWithBaseline([f('x as T'), f('x as T')], baseline);
  const more = compareWithBaseline(
    [f('x as T'), f('x as T'), f('x as T')],
    baseline,
  );
  const fewer = compareWithBaseline([f('x as T')], baseline);
  const checks = [
    [
      'baseline: the same multiset',
      same.added.length === 0 && same.stale.length === 0,
    ],
    ['baseline: a third identical cast is new', more.added.length === 1],
    ['baseline: a fixed cast is stale', fewer.stale.length === 1],
  ];
  for (const [name, ok] of checks) {
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${name}`);
    } else {
      console.log(`ok   ${name}`);
    }
  }
}

if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log('source rules: every form refused or allowed as specified');
