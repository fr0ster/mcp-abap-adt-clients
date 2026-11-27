import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { parseBatchResponse } from '../../../batch/wire';
import {
  delimiterLines,
  headerBodySplit,
  innerStatusLine,
  lines,
  multipartBoundary,
} from '../../../utils/scan';
import { differences, inputSets } from '../../helpers/differential';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');

/** The regexes of the multipart reader (#304), as they were. */
const BOUNDARY = /boundary=(?:"([^"]+)"|([^;\s]+))/i;
const STATUS = /(?:^|\r?\n)HTTP\/1\.\d\s+(\d{3})\s*([^\r\n]*)\r?\n/;
const SPLIT = /^(?:\r?\n)|\r?\n\r?\n/;
const LINE = /\r?\n/;
const escapeRegex = (b: string) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const delimiterOracle = (body: string, boundary: string) =>
  [
    ...body.matchAll(
      new RegExp(
        `(?:^|\\r?\\n)--${escapeRegex(boundary)}(--)?[ \t]*(?:\\r?\\n|$)`,
        'g',
      ),
    ),
  ].map((m) => ({
    index: m.index,
    length: m[0].length,
    closing: m[1] !== undefined,
  }));

describe('multipartBoundary answers what the boundary regex answered', () => {
  const sets = inputSets({
    edges: [
      '',
      'multipart/mixed; boundary="answer"; charset=utf-8',
      'multipart/mixed; boundary=batch_1',
      'multipart/mixed; BOUNDARY=x',
      'boundary=""x',
      'boundary="',
      'boundary="a;b"',
      'boundary=a b',
      'boundary= x',
      'boundary=;boundary=y',
      'boundarY=k',
      'bounDary="q',
    ],
    alphabet: ['boundary=', 'BOUNDARY=', '"', ';', ' ', 'x', ' ', '\n'],
    maxLength: 5,
    tokens: [
      'boundary=',
      'Boundary=',
      '"',
      ';',
      ' ',
      '\t',
      'a',
      'b',
      ' ',
      '﻿',
      'İ',
    ],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => {
            const m = BOUNDARY.exec(s);
            return m ? (m[1] ?? m[2]) : undefined;
          },
          multipartBoundary,
        ),
      ).toEqual([]);
    });
});

describe('delimiterLines answers what matchAll answered', () => {
  const boundary = 'b';
  const sets = inputSets({
    edges: [
      '',
      '--b\r\nx\r\n--b--\r\n',
      '--b--',
      'x--b\n',
      '\n--b \t\n--b--',
      '\r\r\n--b\r\n',
      '--b--x\n',
      '--bb\n',
      '\n--b--  ',
      '--b\r',
    ],
    alphabet: ['--b', '-', '\r', '\n', ' ', 'x'],
    maxLength: 6,
    tokens: ['--b', '--', '-', 'b', '\r\n', '\r', '\n', ' ', '\t', 'x'],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => delimiterOracle(s, boundary),
          (s) => delimiterLines(s, boundary),
        ),
      ).toEqual([]);
    });
  it('with a boundary holding regex characters', () => {
    const b = 'a.b*(c)';
    const inputs = ['--a.b*(c)\n', '--aXb*(c)\n', `\n--${b}--\n`, `--${b}`];
    expect(
      differences(
        inputs,
        (s) => delimiterOracle(s, b),
        (s) => delimiterLines(s, b),
      ),
    ).toEqual([]);
  });
});

describe('innerStatusLine answers what the status regex answered', () => {
  const sets = inputSets({
    edges: [
      '',
      'HTTP/1.1 200 OK\r\n',
      'HTTP/1.1 200  Result\r\n~server_protocol: HTTP/1.1\r\n',
      'HTTP/1.1 204\r\n\r\n',
      'HTTP/1.1 200\r\nContent-Type: x\r\n',
      'x\nHTTP/1.0 404 Not Found\n',
      'xHTTP/1.1 200 OK\n',
      'HTTP/1.1 20 OK\n',
      'HTTP/1.1 2000\n',
      'HTTP/1.1 200 OK\n',
      'HTTP/1.1 200 OK',
      'HTTP/1.x 200 OK\n',
    ],
    alphabet: ['HTTP/1.1 ', '200', ' ', '\r', '\n', 'x'],
    maxLength: 5,
    tokens: [
      'HTTP/1.',
      '1',
      '2',
      '0',
      ' ',
      '\t',
      '\r\n',
      '\r',
      '\n',
      'O',
      'K',
      ' ',
      '\n\n',
    ],
    maxTokens: 30,
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => {
            const m = STATUS.exec(s);
            return m
              ? { end: m.index + m[0].length, status: m[1], reason: m[2] }
              : undefined;
          },
          innerStatusLine,
        ),
      ).toEqual([]);
    });
});

describe('headerBodySplit and lines answer what their regexes answered', () => {
  const sets = inputSets({
    edges: [
      '',
      '\r\n',
      '\n',
      'a\r\n\r\nb',
      'a\n\nb',
      'a\r\n\nb',
      'a\r\r\n\r\n',
      'a\r',
    ],
    alphabet: ['\r', '\n', 'a', ':'],
    maxLength: 7,
    tokens: ['\r\n', '\r', '\n', 'a', ':', ' '],
  });
  for (const [name, inputs] of Object.entries(sets)) {
    it(`the split on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => {
            const m = SPLIT.exec(s);
            return m ? { index: m.index, length: m[0].length } : undefined;
          },
          headerBodySplit,
        ),
      ).toEqual([]);
    });
    it(`the lines on the ${name} inputs`, () => {
      expect(differences(inputs(), (s) => s.split(LINE), lines)).toEqual([]);
    });
  }
});

/** The reader before #304, copied whole, as the oracle of the reader after. */
function oldParse(response: IAdtWireResponse) {
  const contentType = Object.entries(response.headers).find(
    ([key]) => key.toLowerCase() === 'content-type',
  )?.[1];
  const boundary = BOUNDARY.exec(String(contentType));
  if (!boundary)
    throw new Error('Invalid ADT batch response: missing multipart boundary');
  const delimiter = new RegExp(
    `(?:^|\\r?\\n)--${escapeRegex(boundary[1] ?? boundary[2] ?? '')}(--)?[ \t]*(?:\\r?\\n|$)`,
    'g',
  );
  const body = String(response.data);
  const chunks: string[] = [];
  let start: number | undefined;
  for (const match of body.matchAll(delimiter)) {
    if (start !== undefined) chunks.push(body.slice(start, match.index));
    if (match[1]) break;
    start = match.index + match[0].length;
  }
  return chunks.map((part) => {
    const match = STATUS.exec(part);
    if (!match || match.index === undefined)
      throw new Error('Invalid ADT batch response: missing inner HTTP status');
    const rest = part.slice(match.index + match[0].length);
    const found = SPLIT.exec(rest);
    const split =
      found && found.index !== undefined
        ? { index: found.index, length: found[0].length }
        : { index: rest.length, length: 0 };
    const headers: Record<string, string> = {};
    for (const line of rest.slice(0, split.index).split(LINE)) {
      const colon = line.indexOf(':');
      if (colon > 0)
        headers[line.slice(0, colon).toLowerCase()] = line
          .slice(colon + 1)
          .trim();
    }
    return {
      status: Number(match[1]),
      statusText: (match[2] ?? '').trim(),
      headers,
      data: rest.slice(split.index + split.length),
    };
  });
}

const outcome = (
  read: (r: IAdtWireResponse) => unknown,
  r: IAdtWireResponse,
) => {
  try {
    return read(r);
  } catch (error) {
    return error instanceof Error ? `throws: ${error.message}` : 'throws';
  }
};

describe('parseBatchResponse reads every batch as the old reader did', () => {
  const recorded = readdirSync(ANSWERS)
    .filter((f) => f.startsWith('batch-') && f.endsWith('.json'))
    .map((file): IAdtWireResponse => {
      const meta = JSON.parse(readFileSync(join(ANSWERS, file), 'utf-8')) as {
        response: {
          status: number;
          headers?: Record<string, string>;
          bodyFile?: string;
        };
      };
      return {
        status: meta.response.status,
        statusText: '',
        headers: meta.response.headers ?? {},
        data: meta.response.bodyFile
          ? readFileSync(join(ANSWERS, meta.response.bodyFile), 'utf-8')
          : '',
      };
    });
  const answer = (
    data: string,
    type = 'multipart/mixed; boundary=b',
  ): IAdtWireResponse => ({
    status: 200,
    statusText: '',
    headers: { 'Content-Type': type },
    data,
  });
  const edges = [
    answer(
      '--b\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nA: 1\r\n\r\nbody\r\n--b--\r\n',
    ),
    answer('--b\nX\n\nHTTP/1.1 204 \n\n--b--'),
    answer(
      '--b\r\n\r\nHTTP/1.1 200 OK\r\n--b\r\n\r\nHTTP/1.1 404 NF\r\nH: v\r\n\r\n--b--',
    ),
    answer('--b\r\nno status\r\n--b--'),
    answer('', 'text/plain'),
    answer(
      '--b\r\nHTTP/1.1 200\r\nH: v\r\n\r\nx\r\n--bx\r\n--b--',
      'multipart/mixed; boundary="b"',
    ),
  ];
  it('on the recorded batches and the edges', () => {
    expect(recorded.length).toBeGreaterThan(0);
    for (const r of [...recorded, ...edges])
      expect(outcome(parseBatchResponse, r)).toEqual(outcome(oldParse, r));
  });
});
