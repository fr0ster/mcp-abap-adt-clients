/**
 * The legacy half of the consumer-contract check: the contract a consumer
 * composes from `@mcp-abap-adt/interfaces-adt` alone — the one the root
 * package's `consumerContract.test.ts` proves against `AdtClient` and an object
 * written by hand — accepts `AdtClientLegacy` too. Its getters answer classes
 * (0.2.0), and the compiler checks here that those classes satisfy it.
 *
 * The assignment is the test: `npm run test:check` fails when it breaks.
 */

import type { IConsumerClient } from '../../../../../adt-clients/src/__tests__/helpers/consumerClientContract';
import type { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

// Type-level only: never called.
() => {
  const client = null as unknown as AdtClientLegacy;
  const accepted: IConsumerClient = client;
  return accepted;
};

it('the consumer contract accepts AdtClientLegacy (checked by test:check)', () =>
  expect(true).toBe(true));
