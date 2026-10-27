/**
 * No request carries a deadline of the library's.
 *
 * A client deadline closes the socket, and SAP then ends the synchronous request
 * still running on it — a write in it is lost. So a wait ends on SAP's answer,
 * or on the caller's own choice (`IAdtOperationOptions.timeout`, applied by
 * `withCallTimeout`), never on a number this library picked.
 *
 * Two things are checked over the source (tests excluded), with the TypeScript
 * parser rather than text patterns:
 *
 * - nothing reads a process-wide default any more: no `getTimeout(` and no
 *   `SAP_TIMEOUT_` anywhere;
 * - every `timeout` on a request handed to `makeAdtRequest` holds no non-zero
 *   number — `0` (the contract requires a number; the wires read 0 as "do not
 *   abort") or the caller's value. The one exception is a protocol long-poll,
 *   whose request asks SAP to hold it for a time: the deadline is that hold
 *   plus a margin, derived from the hold itself, not a guess of ours.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';

const SRC = join(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '__tests__') return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Identifiers naming a hold the request asks SAP for — the debugger listener's
 * `holdSeconds` (sent as its `timeout` query parameter) and the AMDP event
 * wait's `AMDP_EVENTS_HOLD_MS`. A deadline built from one of them follows the
 * hold the caller or the protocol chose.
 */
const PROTOCOL_HOLDS = new Set(['holdSeconds', 'AMDP_EVENTS_HOLD_MS']);

function nonZeroNumbers(node: ts.Node): string[] {
  const found: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isNumericLiteral(n) && Number(n.text) !== 0) found.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function namesHold(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && PROTOCOL_HOLDS.has(n.text)) found = true;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

interface IRequestDeadline {
  where: string;
  text: string;
  /** Non-zero numbers in the deadline, or in the local variable it names. */
  numbers: string[];
  hold: boolean;
}

function requestDeadlines(file: string): {
  deadlines: IRequestDeadline[];
  missing: string[];
} {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const locals = new Map<string, ts.Expression>();
  const deadlines: IRequestDeadline[] = [];
  const missing: string[] = [];
  const where = (n: ts.Node) =>
    `${relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

  const collectLocals = (n: ts.Node): void => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer
    ) {
      locals.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, collectLocals);
  };
  collectLocals(sf);

  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'makeAdtRequest'
    ) {
      const [request] = n.arguments;
      if (request && ts.isObjectLiteralExpression(request)) {
        let value: ts.Expression | undefined;
        for (const p of request.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'timeout') {
            value = p.initializer;
          } else if (
            ts.isShorthandPropertyAssignment(p) &&
            p.name.text === 'timeout'
          ) {
            value = p.name;
          }
        }
        if (!value) {
          missing.push(where(request));
        } else {
          const local =
            ts.isIdentifier(value) && locals.has(value.text)
              ? locals.get(value.text)
              : undefined;
          deadlines.push({
            where: where(value),
            text: value.getText(sf),
            numbers: [
              ...nonZeroNumbers(value),
              ...(local ? nonZeroNumbers(local) : []),
            ],
            hold: namesHold(value),
          });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { deadlines, missing };
}

describe('no deadline of the library', () => {
  const files = sourceFiles(SRC);

  it('reads no process-wide default: no getTimeout( and no SAP_TIMEOUT_', () => {
    const offenders = files.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return text.includes('getTimeout(') || text.includes('SAP_TIMEOUT_');
    });
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  const all = files.map(requestDeadlines);
  const deadlines = all.flatMap((r) => r.deadlines);

  it('finds the requests it is checking', () => {
    // The scan is only evidence if it sees the requests: hundreds of them.
    expect(deadlines.length).toBeGreaterThan(400);
  });

  it('every request literal states its timeout', () => {
    expect(all.flatMap((r) => r.missing)).toEqual([]);
  });

  it('no request carries a literal deadline', () => {
    const offenders = deadlines
      .filter((d) => d.numbers.length > 0 && !d.hold)
      .map((d) => `${d.where} timeout: ${d.text}`);
    expect(offenders).toEqual([]);
  });

  it('the only deadlines with a number are the protocol holds', () => {
    const holds = deadlines
      .filter((d) => d.numbers.length > 0)
      .map((d) => d.text)
      .sort();
    expect(holds).toEqual([
      '(holdSeconds + 60) * 1000',
      'AMDP_EVENTS_HOLD_MS + 60_000',
    ]);
  });
});
