// The redundant-parentheses rule of tools/compare-emit.js, each case on its own.
//   node tools/test-compare-emit.js
//
// A pair is the same program when only redundant parentheses differ, and a
// different one when a parenthesis changes precedence, short-circuiting, an
// optional chain's end or a comma.
const { normalizedText } = require('./compare-emit');

const same = (a, b) => normalizedText('a.js', a) === normalizedText('b.js', b);
const cases = [
  ['a cast left (x) behind a member read', '(x).y;', 'x.y;', true],
  ['an argument in parentheses', 'f((a));', 'f(a);', true],
  ['a call in parentheses', 'const v = (g()).h;', 'const v = g().h;', true],
  [
    'an initializer in parentheses',
    'const v = (a + b);',
    'const v = a + b;',
    true,
  ],
  ['an optional chain ends at its parenthesis', '(a?.b).c;', 'a?.b.c;', false],
  ['precedence', 'v = (a || b) && c;', 'v = a || b && c;', false],
  ['a comma in an argument', 'f((a, b));', 'f(a, b);', false],
  ['an object literal at a statement start', '({}).x;', '{}.x;', null],
  ['arithmetic precedence', 'v = (a + b) * c;', 'v = a + b * c;', false],
  ['a nullish group', 'v = (a ?? b) || c;', 'v = a ?? b || c;', null],
];
let failed = 0;
for (const [name, a, b, want] of cases) {
  let got;
  try {
    got = same(a, b);
  } catch {
    got = null;
  }
  // `null`: the second form does not parse as the same program; it must not
  // compare equal.
  const ok = want === null ? got !== true : got === want;
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}: expected ${want}, got ${got}`);
  } else {
    console.log(`ok   ${name}`);
  }
}
if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log('compare-emit: only redundant parentheses are ignored');
