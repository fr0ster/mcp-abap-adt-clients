import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { utilDocuments } from '@mcp-abap-adt/adt-clients';

/**
 * The legacy utils hold to the root package's invariant
 * (`everyMemberTakesAReading.test.ts` there): an override answers through the
 * injected set and the caller's error strategy, never a reading of its own.
 */
describe('AdtUtils readings', () => {
  const source = readFileSync(
    join(__dirname, '../../../core/shared/AdtUtilsLegacy.ts'),
    'utf-8',
  );

  it('the legacy subclass reaches only slots of the set', () => {
    const named = [...source.matchAll(/this\.results\.(\w+)/g)].map(
      (m) => m[1],
    );
    expect(named.length).toBeGreaterThan(0);
    expect(
      named.filter((slot) => !Object.keys(utilDocuments).includes(slot ?? '')),
    ).toEqual([]);
  });

  it("hands every answer to the caller's error strategy", () => {
    const calls = source.split('return answering(').slice(1);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const body = call.slice(0, call.indexOf('\n    );'));
      expect(body).toContain('options?.analyse');
    }
  });
});
