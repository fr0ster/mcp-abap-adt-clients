/**
 * `wrapSqlLines` — a statement's lines longer than 255 wrapped, outside literals
 * and comments (mcp-abap-adt#350, #363).
 *
 * The freestyle data preview keeps 255 characters of each line and drops the
 * rest without a word (measured; `SEO_SECTION_SOURCE_LINE` is CHAR 255): a
 * literal crossing the mark fails, and a condition past it is silently lost.
 * SAP_BASIS 751 refuses a line break anywhere inside the statement (#363), so a
 * line of up to 255 once condensed (SAP CONDENSEs each line before the cut) is
 * sent as it is, and only a longer one is broken: at a run
 * of blanks (replaced by one LF) or right after a comma — never inside a `'…'`
 * or `` `…` `` literal, never inside a comment, never before a `*` or a
 * comment — taking the last such point at or before 255, else the first after.
 * A statement that fits is returned as the same string; a token with no break
 * point within 255 goes as it is, on a line longer than 255.
 *
 * Every case pins the exact output; the property checks below hold for all of
 * them.
 */

import { SQL_LINE_WIDTH, wrapSqlLines } from '../../../core/shared/sqlLines';

/** `null`: the statement fits and is returned as it was given. */
interface WrapCase {
  name: string;
  input: string;
  expected: string[] | null;
}

const X = (count: number): string => 'X'.repeat(count);
const D = (count: number): string => 'd'.repeat(count);
const L = (count: number): string => 'LLLLLLLL, '.repeat(count);

/** 44 characters: a line `${EQUALS}'${X(n)}'` is 46 + n long. */
const EQUALS = 'SELECT devclass FROM tdevc WHERE devclass = ';

const ITEMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => c.repeat(30));

const CASES: WrapCase[] = [
  {
    name: "the #363 reporter's statement of 77",
    input:
      "SELECT TABNAME, TABCLASS FROM DD02L WHERE TABNAME = 'MARA' AND AS4LOCAL = 'A'",
    expected: null,
  },
  {
    name: 'the #350 statement of 299',
    input: `SELECT devclass FROM tdevc WHERE devclass IN (${ITEMS.map((i) => `'${i}'`).join(',')},'Z_FLIGHT_ADDITIONAL')`,
    expected: [
      `SELECT devclass FROM tdevc WHERE devclass IN (${ITEMS.slice(0, 6)
        .map((i) => `'${i}'`)
        .join(',')},`,
      `'${ITEMS[6]}','Z_FLIGHT_ADDITIONAL')`,
    ],
  },
  {
    name: 'a statement of 300 with a literal across 255',
    input: `${EQUALS}'${X(190)}' OR devclass = '${'B'.repeat(47)}'`,
    expected: [`${EQUALS}'${X(190)}' OR devclass =`, `'${'B'.repeat(47)}'`],
  },
  {
    name: 'a line of 73',
    input: `${EQUALS}'${X(27)}'`,
    expected: null,
  },
  {
    name: 'a line of 255',
    input: `${EQUALS}'${X(209)}'`,
    expected: null,
  },
  {
    name: 'a line of 256',
    input: `${EQUALS}'${X(210)}'`,
    expected: [EQUALS.trimEnd(), `'${X(210)}'`],
  },
  {
    name: 'a blank run and a comma before 255: the later taken',
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('${X(180)}','${X(30)}') OR devclass = '$TMP'`,
    expected: [
      `SELECT devclass FROM tdevc WHERE devclass IN ('${X(180)}',`,
      `'${X(30)}') OR devclass = '$TMP'`,
    ],
  },
  {
    name: 'a break point at 255 taken',
    input: `SELECT ${D(248)} FROM tdevc`,
    expected: [`SELECT ${D(248)}`, 'FROM tdevc'],
  },
  {
    name: 'a break point at 256 not taken',
    input: `SELECT ${D(249)} FROM tdevc`,
    expected: ['SELECT', `${D(249)} FROM`, 'tdevc'],
  },
  {
    name: 'no break point at or before 255',
    input: `${D(260)} FROM tdevc`,
    expected: [D(260), 'FROM tdevc'],
  },
  {
    name: 'a comma followed by blanks',
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('${X(215)}',   '${X(30)}')`,
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      `('${X(215)}',   '${X(30)}')`,
    ],
  },
  {
    name: "a '…' literal of 300",
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', '${L(30)}', 'X')`,
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      `'${L(30)}',`,
      "'X')",
    ],
  },
  {
    name: 'a backtick literal of 300',
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', \`${L(30)}\`, 'X')`,
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      `\`${L(30)}\`,`,
      "'X')",
    ],
  },
  {
    name: 'a doubled quote inside a literal across 255',
    input: `${EQUALS}'O'' ${'word, '.repeat(40)}'`,
    expected: [EQUALS.trimEnd(), `'O'' ${'word, '.repeat(40)}'`],
  },
  {
    name: 'a doubled backtick inside a literal across 255',
    input: `${EQUALS}\`O\`\` ${'word, '.repeat(40)}\``,
    expected: [EQUALS.trimEnd(), `\`O\`\` ${'word, '.repeat(40)}\``],
  },
  {
    name: 'a " inside a literal across 255',
    input: `${EQUALS}'A"B, ${'word, '.repeat(45)}' OR devclass = '$TMP'`,
    expected: [
      EQUALS.trimEnd(),
      `'A"B, ${'word, '.repeat(45)}'`,
      "OR devclass = '$TMP'",
    ],
  },
  {
    name: "a caller's LF inside a literal, then a line starting with *",
    input: `${EQUALS}'X\n* Y' OR devclass = '${X(200)}' OR devclass = '${'B'.repeat(30)}'`,
    expected: [
      `${EQUALS}'X`,
      `* Y' OR devclass = '${X(200)}' OR devclass =`,
      `'${'B'.repeat(30)}'`,
    ],
  },
  {
    name: "a caller's CRLF inside a short literal",
    input: `${EQUALS}'X\r\nY'`,
    expected: null,
  },
  {
    name: "a caller's CR inside a short literal",
    input: `${EQUALS}'X\rY'`,
    expected: null,
  },
  {
    name: 'SELECT * with the blank before * at column 253',
    input: `SELECT devclass FROM tdevc WHERE devclass IN (SELECT ${D(199)} *xxxxxxxxxx FROM tdevc)`,
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN (SELECT',
      `${D(199)} *xxxxxxxxxx FROM tdevc)`,
    ],
  },
  {
    name: 'COUNT( *) with the blank before * at column 253',
    input: `SELECT devclass FROM tdevc WHERE devclass IN (SELECT ${D(193)}COUNT( *)xxxxxxxxxx FROM tdevc)`,
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN (SELECT',
      `${D(193)}COUNT( *)xxxxxxxxxx FROM tdevc)`,
    ],
  },
  {
    name: 'a token longer than 255, blanks, then a comment',
    input: `'${'L'.repeat(260)}'   " note`,
    expected: null,
  },
  {
    name: 'a long line ending with a comment',
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('${X(215)}','${X(30)}') " note`,
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      `('${X(215)}','${X(30)}') " note`,
    ],
  },
  {
    name: 'code of 60 and a comment of 300',
    input: `${EQUALS}'XXXXXXXXXXXXX' " ${'c'.repeat(300)}`,
    expected: null,
  },
  {
    name: 'a * comment line of 300',
    input: `* ${'c'.repeat(300)}\nSELECT devclass FROM tdevc`,
    expected: null,
  },
  {
    name: 'short lines separated by CR alone',
    input: `SELECT devclass\rFROM tdevc\rWHERE devclass = '${X(200)}'\rOR devclass = '${X(200)}'`,
    expected: null,
  },
  {
    name: 'a long line, then CRLF and a short one',
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('${X(215)}','${X(30)}')\r\nORDER BY devclass`,
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      `('${X(215)}','${X(30)}')\r`,
      'ORDER BY devclass',
    ],
  },
  {
    name: 'tabs at a break point, leading blanks kept',
    input: `    SELECT devclass\tFROM tdevc WHERE devclass IN ('${X(215)}',\t\t'${X(30)}')`,
    expected: [
      '    SELECT devclass\tFROM tdevc WHERE devclass IN',
      `('${X(215)}',\t\t'${X(30)}')`,
    ],
  },
  {
    name: 'Ä in a line of 255',
    input: `${EQUALS}'${'Ä'.repeat(209)}'`,
    expected: null,
  },
  {
    name: 'Ä in a line of 256',
    input: `${EQUALS}'${'Ä'.repeat(210)}'`,
    expected: [EQUALS.trimEnd(), `'${'Ä'.repeat(210)}'`],
  },
  {
    // 256 UTF-16 code units, 255 code points: counted by `length`, so wrapped.
    name: 'a character outside the BMP in a line of 256 code units',
    input: `${EQUALS}'\u{1F600}${X(208)}'`,
    expected: [EQUALS.trimEnd(), `'\u{1F600}${X(208)}'`],
  },
  {
    name: 'an empty statement',
    input: '',
    expected: null,
  },
  {
    name: "concat( '<250>','B')",
    input: `SELECT devclass, concat('${'L'.repeat(250)}','B') AS x FROM tdevc WHERE devclass = '$TMP'`,
    expected: [
      'SELECT devclass,',
      `concat('${'L'.repeat(250)}',`,
      "'B') AS x FROM tdevc WHERE devclass = '$TMP'",
    ],
  },
  {
    name: "'<250>' * 2",
    input: `SELECT devclass FROM tdevc WHERE devclass = '$TMP' AND '${'L'.repeat(250)}' * 2 = 2`,
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass = '$TMP' AND",
      `'${'L'.repeat(250)}' *`,
      '2 = 2',
    ],
  },
  {
    name: 'a short statement',
    input: 'SELECT * FROM T000',
    expected: null,
  },
  {
    // SAP CONDENSEs a line before the cut: 261 as written, 18 condensed.
    name: 'a line of 261 whose blanks condense to 18',
    input: `SELECT${' '.repeat(244)}* FROM T000`,
    expected: null,
  },
  {
    name: 'a line of 262 whose blanks condense to 255',
    input: `  SELECT devclass   FROM tdevc WHERE devclass = '${X(209)}'   `,
    expected: null,
  },
  {
    name: 'a line of 263 whose blanks condense to 256',
    input: `  SELECT devclass   FROM tdevc WHERE devclass = '${X(210)}'   `,
    expected: [
      '  SELECT devclass   FROM tdevc WHERE devclass =',
      `'${X(210)}'   `,
    ],
  },
  {
    name: 'blanks inside a literal counted as written',
    input: `${EQUALS}'${' '.repeat(100)}${X(110)}'`,
    expected: [EQUALS.trimEnd(), `'${' '.repeat(100)}${X(110)}'`],
  },
  {
    // A token with no break point within 255 goes as it is, longer than 255.
    name: 'a literal of 255 and its comma: a line of 257',
    input: `SELECT devclass FROM tdevc WHERE devclass IN ('${X(253)}', 'B')`,
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      `('${X(253)}',`,
      "'B')",
    ],
  },
];

/** The literals of a statement, delimiters included, in order — plain code. */
function literalsOf(statement: string): string[] {
  const found: string[] = [];
  let i = 0;
  let inComment = false;
  while (i < statement.length) {
    const ch = statement.charAt(i);
    if (inComment) {
      if (ch === '\n' || ch === '\r') inComment = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < statement.length) {
        if (statement.charAt(j) === ch) {
          if (statement.charAt(j + 1) === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      found.push(statement.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return found;
}

/** The statement without blanks and line breaks outside literals — plain code. */
function compact(statement: string): string {
  let kept = '';
  let quote = '';
  for (let i = 0; i < statement.length; i += 1) {
    const ch = statement.charAt(i);
    if (quote) {
      kept += ch;
      if (ch === quote) {
        if (statement.charAt(i + 1) === quote) {
          kept += quote;
          i += 1;
        } else {
          quote = '';
        }
      }
      continue;
    }
    if (ch === "'" || ch === '`') quote = ch;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    kept += ch;
  }
  return kept;
}

function firstNonBlank(line: string): string {
  for (const ch of line) {
    if (ch !== ' ' && ch !== '\t') return ch;
  }
  return '';
}

describe('wrapSqlLines', () => {
  it('wraps at 255', () => {
    expect(SQL_LINE_WIDTH).toBe(255);
  });

  it('sends a token with no break point within 255 as it is, longer than 255', () => {
    const lines = wrapSqlLines(
      `SELECT devclass FROM tdevc WHERE devclass IN ('${X(253)}', 'B')`,
    ).split('\n');
    expect(lines[1]).toBe(`('${X(253)}',`);
    expect(lines[1]?.length).toBe(257);
  });

  it('sends a statement of 300 on lines of at most 255, its literals whole', () => {
    const input = `${EQUALS}'${X(190)}' OR devclass = '${'B'.repeat(47)}'`;
    expect(input).toHaveLength(300);
    const lines = wrapSqlLines(input).split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(255);
    expect(literalsOf(lines.join('\n'))).toEqual(literalsOf(input));
  });

  it.each(CASES)('$name', ({ input, expected }) => {
    const output = wrapSqlLines(input);
    if (expected === null) {
      expect(output).toBe(input);
    } else {
      expect(output.split('\n')).toEqual(expected);
    }
  });

  it.each(CASES)('$name: only whitespace moves', ({ input }) => {
    expect(compact(wrapSqlLines(input))).toBe(compact(input));
  });

  it.each(CASES)('$name: every literal stays byte-identical', ({ input }) => {
    expect(literalsOf(wrapSqlLines(input))).toEqual(literalsOf(input));
  });

  it.each(CASES)('$name: no new comment line', ({ input }) => {
    const before = input
      .split('\n')
      .filter((line) => firstNonBlank(line) === '*').length;
    const after = wrapSqlLines(input)
      .split('\n')
      .filter((line) => firstNonBlank(line) === '*').length;
    expect(after).toBe(before);
  });

  it('keeps the 300-character literals alone on their lines', () => {
    const unit = 'LLLLLLLL, ';
    for (const count of [30]) {
      for (const delimiter of ["'", '`']) {
        const literal = `${delimiter}${unit.repeat(count)}${delimiter}`;
        const output = wrapSqlLines(
          `SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', ${literal}, 'X')`,
        );
        expect(output.split('\n')).toContain(`${literal},`);
      }
    }
  });
});
