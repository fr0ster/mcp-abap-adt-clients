import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import {
  type IUtilResults,
  utilDocuments,
} from '../../../core/shared/utilResultSet';
import { rawDocument } from '../../../utils/resultStrategy';

/**
 * The invariant 19.0.0 is built on: a member answers the contract, and what the
 * result *is* comes from an injected reading.
 *
 * Until 44.0.0 of `@mcp-abap-adt/interfaces`, fifteen members were typed
 * `IAdtResponse<string>` — the contract had chosen, so no reading could be
 * offered for them. This asserts that none of that is left: every member that
 * makes a request names a slot, and the only members that name none are the
 * three that make no request at all.
 */
describe('AdtUtils readings', () => {
  const source = readFileSync(
    join(__dirname, '../../../core/shared/AdtUtils.ts'),
    'utf-8',
  );

  it('pins no member result to a document', () => {
    expect(source).not.toContain('Promise<IAdtResponse<string>>');
  });

  it('reads every answer through the injected set, never a fixed strategy', () => {
    const bodies = source.split('\n').filter((line) => /^\s{6}\w/.test(line));
    const fixed = bodies.filter((line) =>
      /^\s+(rawDocument|nothing|util[A-Z]\w*)[,)]/.test(line),
    );
    expect(fixed).toEqual([]);
  });

  it('names a slot for each of the twenty members that make a request', () => {
    const named = new Set(
      [...source.matchAll(/this\.results\.(\w+)/g)].map((m) => m[1]),
    );
    // The legacy subclass overrides four of them; it reaches the same slots.
    const legacy = readFileSync(
      join(__dirname, '../../../core/shared/AdtUtilsLegacy.ts'),
      'utf-8',
    );
    for (const m of legacy.matchAll(/this\.results\.(\w+)/g)) named.add(m[1]);

    expect([...named].sort()).toEqual(Object.keys(utilDocuments).sort());
    expect(named.size).toBe(20);
  });

  it('ships a default for every slot', () => {
    const shipped = utilDocuments as unknown as Record<string, unknown>;
    for (const slot of Object.keys(shipped)) {
      expect(typeof shipped[slot]).toBe('function');
    }
    // Every default is the document. The parses that were defaults — search
    // hits, the type catalogue, the tree level, the inactive list, the run id —
    // are strategies in adt-strategies a caller passes.
    for (const slot of Object.keys(shipped)) {
      expect(shipped[slot]).toBe(rawDocument);
    }
    // `satisfies`, so the shipped set is assignable to the contract it fills.
    const asContract: IUtilResults = utilDocuments;
    expect(asContract.activation).toBe(utilDocuments.activation);
  });

  it("hands every answer to the caller's error strategy", () => {
    // One `answering` per request-making member, and each passes the caller's
    // `analyse` through — a member that dropped it would judge the answer by
    // the library's verdict alone, with no way for the caller to say otherwise.
    for (const file of ['AdtUtils.ts', 'AdtUtilsLegacy.ts']) {
      const text = readFileSync(
        join(__dirname, '../../../core/shared', file),
        'utf-8',
      );
      const calls = text.split('return answering(').slice(1);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const body = call.slice(0, call.indexOf('\n    );'));
        expect(body).toContain('options?.analyse');
      }
    }
  });

  it('leaves the three members that make no request without one', () => {
    const surface = AdtUtils.prototype as unknown as Record<string, unknown>;
    for (const name of [
      'modifyWhereUsedScope',
      'supportsSourceCode',
      'getObjectSourceUri',
    ]) {
      expect(typeof surface[name]).toBe('function');
    }
  });
});
