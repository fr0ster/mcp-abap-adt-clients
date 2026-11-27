import { randomUUID } from 'node:crypto';
import { differences, inputSets } from '../../helpers/differential';

/**
 * `/-/g` (#304) at `wire.ts` and `discovery.ts`: a request id is the UUID
 * without its dashes. `replaceAll('-', '')` answers the same on every input.
 */
describe("replaceAll('-', '') answers what replace(/-/g, '') answered", () => {
  const sets = inputSets({
    edges: ['', '-', '--', 'a-b-c', randomUUID(), randomUUID(), '‐'],
    alphabet: ['-', 'a', '‑', '\n'],
    maxLength: 7,
    tokens: ['-', '--', 'a', '0', '‐'],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => s.replace(/-/g, ''),
          (s) => s.replaceAll('-', ''),
        ),
      ).toEqual([]);
    });
});
