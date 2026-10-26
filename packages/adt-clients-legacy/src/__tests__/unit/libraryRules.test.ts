/**
 * The root package's rules on what a member sends and reads, held on this
 * package's production code (`src/__tests__/` left out), as the root's
 * `noBuiltinDeadline.test.ts` and `onlyCorpusStrategiesShip.test.ts` hold
 * them on its own:
 *
 * - no request carries a deadline of the library's: nothing reads a
 *   process-wide default, every request literal states its `timeout`, and
 *   none is a number — a client deadline closes the socket, and SAP then ends
 *   the synchronous request still running on it;
 * - the error strategy is the caller's: no member falls back from `analyse`
 *   to a reading of its own.
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

const PROTOCOL_HOLDS = new Set<string>();

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
    // The legacy delete, the CTS reads and the synchronous unit run.
    expect(deadlines.length).toBeGreaterThan(2);
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
});

describe("the error strategy is the caller's", () => {
  it('no file falls back from analyse to a reading of its own', () => {
    const offenders = sourceFiles(SRC).filter((f) =>
      /analyse\s*\?\?/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
