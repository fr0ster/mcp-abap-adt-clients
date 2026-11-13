/**
 * `wrapSqlLines` — a statement's long lines wrapped at 72, outside literals and
 * comments (mcp-abap-adt#350).
 *
 * The freestyle data preview keeps 255 characters of each line and drops the
 * rest without a word (measured): a literal crossing the mark fails, and a
 * condition past it is silently lost. The wrap breaks a line longer than 72 at a
 * run of blanks (replaced by one LF) or right after a comma — never inside a
 * `'…'` or `` `…` `` literal, never inside a comment, never before a `*` or a
 * comment — taking the last such point at or before 72, else the first after.
 * A statement that fits is returned as the same string.
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

const CASES: WrapCase[] = [
  {
    name: 'the issue statement',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB','CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC','DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD','EEEEEEEEEEEEEEEEEEEEEEEEEEEEEE','FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF','GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG','Z_FLIGHT_ADDITIONAL')",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      "('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',",
      "'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC','DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',",
      "'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEE','FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',",
      "'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG','Z_FLIGHT_ADDITIONAL')",
    ],
  },
  {
    name: 'the condition past 255',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','Z') AND devclass = 'NOPE'",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      "'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',",
      "'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',",
      "'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','Z')",
      "AND devclass = 'NOPE'",
    ],
  },
  {
    name: 'a line of 72',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'",
    expected: null,
  },
  {
    name: 'a line of 73',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'XXXXXXXXXXXXXXXXXXXXXXXXXXX'",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass =',
      "'XXXXXXXXXXXXXXXXXXXXXXXXXXX'",
    ],
  },
  {
    name: 'a blank run and a comma before 72: the later taken',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('AAAAAAAAAAAA','BBBBBBBBBB') OR devclass = '$TMP'",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('AAAAAAAAAAAA',",
      "'BBBBBBBBBB') OR devclass = '$TMP'",
    ],
  },
  {
    name: 'a break point at 72 taken',
    input:
      'SELECT ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd FROM tdevc',
    expected: [
      'SELECT ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'FROM tdevc',
    ],
  },
  {
    name: 'a break point at 73 not taken',
    input:
      'SELECT dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd FROM tdevc',
    expected: [
      'SELECT',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd FROM',
      'tdevc',
    ],
  },
  {
    name: 'no break point at or before 72',
    input:
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd FROM tdevc',
    expected: [
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'FROM tdevc',
    ],
  },
  {
    name: 'a comma followed by blanks',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',   'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      "('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',   'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')",
    ],
  },
  {
    name: "a '…' literal of 100",
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', 'LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, ', 'X')",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      "'LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, ',",
      "'X')",
    ],
  },
  {
    name: 'a backtick literal of 100',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', `LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, `, 'X')",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      '`LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, `,',
      "'X')",
    ],
  },
  {
    name: "a '…' literal of 300",
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', 'LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, ', 'X')",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      "'LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, ',",
      "'X')",
    ],
  },
  {
    name: 'a backtick literal of 300',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', `LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, `, 'X')",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
      '`LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, LLLLLLLL, `,',
      "'X')",
    ],
  },
  {
    name: 'a doubled quote inside a literal',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'O'' word, word, word, word, word, word, word, word, word, word, word, word, '",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass =',
      "'O'' word, word, word, word, word, word, word, word, word, word, word, word, '",
    ],
  },
  {
    name: 'a doubled backtick inside a literal',
    input:
      'SELECT devclass FROM tdevc WHERE devclass = `O`` word, word, word, word, word, word, word, word, word, word, word, word, `',
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass =',
      '`O`` word, word, word, word, word, word, word, word, word, word, word, word, `',
    ],
  },
  {
    name: 'a " inside a literal',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'A\"B, word, word, word, word, word, word, word, word, word, word, word, word, ' OR devclass = '$TMP'",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass =',
      "'A\"B, word, word, word, word, word, word, word, word, word, word, word, word, '",
      "OR devclass = '$TMP'",
    ],
  },
  {
    name: "a caller's LF inside a literal, then a line starting with *",
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'X\n* Y' OR devclass = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' OR devclass = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass = 'X",
      "* Y' OR devclass = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' OR devclass =",
      "'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'",
    ],
  },
  {
    name: "a caller's CRLF inside a short literal",
    input: "SELECT devclass FROM tdevc WHERE devclass = 'X\r\nY'",
    expected: null,
  },
  {
    name: "a caller's CR inside a short literal",
    input: "SELECT devclass FROM tdevc WHERE devclass = 'X\rY'",
    expected: null,
  },
  {
    name: 'SELECT * with the blank before * at column 70',
    input:
      'SELECT devclass FROM tdevc WHERE devclass IN (SELECT qqqqqqqqqqqqqqqq *xxxxxxxxxx FROM tdevc)',
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN (SELECT',
      'qqqqqqqqqqqqqqqq *xxxxxxxxxx FROM tdevc)',
    ],
  },
  {
    name: 'COUNT( *) with the blank before * at column 70',
    input:
      'SELECT devclass FROM tdevc WHERE devclass IN (SELECT qqqqqqqqqqCOUNT( *)xxxxxxxxxx FROM tdevc)',
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN (SELECT',
      'qqqqqqqqqqCOUNT( *)xxxxxxxxxx FROM tdevc)',
    ],
  },
  {
    name: 'a token longer than 72, blanks, then a comment',
    input:
      "'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL'   \" note",
    expected: null,
  },
  {
    name: 'a long line ending with a comment',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB') \" note",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      "('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB') \" note",
    ],
  },
  {
    name: 'code of 60 and a comment of 300',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'XXXXXXXXXXXXX' \" cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    expected: null,
  },
  {
    name: 'a * comment line of 300',
    input:
      '* cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\nSELECT devclass FROM tdevc',
    expected: null,
  },
  {
    name: 'short lines separated by CR alone',
    input:
      "SELECT devclass\rFROM tdevc\rWHERE devclass = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'\rOR devclass = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'",
    expected: null,
  },
  {
    name: 'a long line, then CRLF and a short one',
    input:
      "SELECT devclass FROM tdevc WHERE devclass IN ('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')\r\nORDER BY devclass",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass IN',
      "('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')\r",
      'ORDER BY devclass',
    ],
  },
  {
    name: 'tabs at a break point, leading blanks kept',
    input:
      "    SELECT devclass\tFROM tdevc WHERE devclass IN ('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',\t\t'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')",
    expected: [
      '    SELECT devclass\tFROM tdevc WHERE devclass IN',
      "('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',\t\t'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')",
    ],
  },
  {
    name: 'Ä in a line of 72',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ'",
    expected: null,
  },
  {
    name: 'Ä in a line of 73',
    input:
      "SELECT devclass FROM tdevc WHERE devclass = 'ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ'",
    expected: [
      'SELECT devclass FROM tdevc WHERE devclass =',
      "'ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ'",
    ],
  },
  {
    name: "concat( '<100>','B')",
    input:
      "SELECT devclass, concat('LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL','B') AS x FROM tdevc WHERE devclass = '$TMP'",
    expected: [
      'SELECT devclass,',
      "concat('LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',",
      "'B') AS x FROM tdevc WHERE devclass = '$TMP'",
    ],
  },
  {
    name: "'<100>' * 2",
    input:
      "SELECT devclass FROM tdevc WHERE devclass = '$TMP' AND 'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL' * 2 = 2",
    expected: [
      "SELECT devclass FROM tdevc WHERE devclass = '$TMP' AND",
      "'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL' *",
      '2 = 2',
    ],
  },
  {
    name: 'a short statement',
    input: 'SELECT * FROM T000',
    expected: null,
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
  it('wraps at 72', () => {
    expect(SQL_LINE_WIDTH).toBe(72);
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

  it('keeps the 100- and 300-character literals alone on their lines', () => {
    const unit = 'LLLLLLLL, ';
    for (const count of [10, 30]) {
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
