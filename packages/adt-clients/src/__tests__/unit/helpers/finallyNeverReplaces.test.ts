/**
 * No `finally` block in an integration suite or a test helper asserts or
 * throws.
 *
 * A `finally` that fails — an unlock read with `expectResult`, a cleanup that
 * `expect`s the object gone — throws over the error already in flight: when
 * the body failed too, SAP's answer to the body's request never reaches the
 * log, and only the cleanup's does. A release goes through `releasing`, a
 * cleanup through `withCleanup` / `CleanupSteps`: the body's failure stays the
 * step's error and every refusal after it is added to it.
 *
 * Read with the compiler's parser, never by text.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';
import { filesUnder } from '../judgedScan';

const ROOT = join(__dirname, '../../../..');
const SCOPES = ['src/__tests__/integration', 'src/__tests__/helpers'];

/** Calls that fail the test by throwing. */
const FAILING_CALLS = new Set(['expect', 'expectResult', 'expectFailure']);

/** What in `block` throws over an error in flight, as `<line>: <text>`. */
function throwersIn(source: ts.SourceFile, block: ts.Block): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const callee = ts.isCallExpression(node) ? node.expression : undefined;
    if (
      ts.isThrowStatement(node) ||
      (callee !== undefined &&
        ts.isIdentifier(callee) &&
        FAILING_CALLS.has(callee.text))
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${line + 1}: ${node.getText(source).split('\n')[0]}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(block);
  return found;
}

function findingsIn(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node) && node.finallyBlock) {
      for (const thrower of throwersIn(source, node.finallyBlock)) {
        findings.push(`${relative(ROOT, file)}:${thrower}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

describe('a finally block never throws over the error in flight', () => {
  it('finds a throwing finally in a fixture (the scan is load-bearing)', () => {
    const fixture = ts.createSourceFile(
      'fixture.ts',
      'async function f() { try { await w(); } finally { expectResult(await u(), "unlock"); } }',
      ts.ScriptTarget.Latest,
      true,
    );
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isTryStatement(node) && node.finallyBlock) {
        found.push(...throwersIn(fixture, node.finallyBlock));
      }
      ts.forEachChild(node, visit);
    };
    visit(fixture);
    expect(found).toEqual(['1: expectResult(await u(), "unlock")']);
  });

  it('holds in every integration suite and test helper', () => {
    const files = SCOPES.flatMap((scope) =>
      filesUnder(join(ROOT, scope), /\.(ts|js)$/),
    );
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap(findingsIn)).toEqual([]);
  });
});
