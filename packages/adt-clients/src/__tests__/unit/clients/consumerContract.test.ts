/**
 * A consumer's client contract, composed from `@mcp-abap-adt/interfaces-adt`
 * alone (`helpers/consumerClientContract.ts`), accepts this package's client
 * and an object written by hand, and refuses an object that lacks a member the
 * contract names.
 *
 * The assignments are the test: `npm run test:check` fails when one breaks.
 * The runtime cases pin that the contract imports nothing but the contract
 * package, so the substitution is not satisfied by a type borrowed from here.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AdtClient } from '../../../clients/AdtClient';
import type {
  IConsumerClass,
  IConsumerClient,
  IConsumerMessage,
  IConsumerProgram,
  IConsumerUtils,
} from '../../helpers/consumerClientContract';

// ── An object written by hand satisfies it ────────────────────────────────

/** A member this test never calls; its type is all that is checked. */
const unused = (): Promise<never> => Promise.reject(new Error('not called'));

const handClass = (): IConsumerClass<never> => ({
  read: unused,
  lock: unused,
  unlock: unused,
  update: unused,
  activate: unused,
});
const handProgram = (): IConsumerProgram<never> => ({
  read: unused,
  check: unused,
});
const handMessage = (): IConsumerMessage<never> => ({ read: unused });
const handUtils = (): IConsumerUtils<never> => ({
  readObjectSource: unused,
  readObjectMetadata: unused,
  getInclude: unused,
  supportsSourceCode: () => false,
  getObjectSourceUri: () => '',
});

const handWritten: IConsumerClient = {
  getClass: handClass,
  getProgram: handProgram,
  getMessageClassMessage: handMessage,
  getUtils: handUtils,
};

// Type-level only: never called. An assignment that stops compiling, or a
// `@ts-expect-error` that stops being needed, fails `npm run test:check`.
() => {
  // This package's client satisfies it.
  const client = null as unknown as AdtClient;
  const fromLibrary: IConsumerClient = client;

  // An object lacking a member the contract names does not.
  const lacksUnlock = () => ({
    read: unused,
    lock: unused,
    update: unused,
    activate: unused,
  });
  const withoutUnlock = { ...handWritten, getClass: lacksUnlock };
  // @ts-expect-error `unlock` is named by IAdtLockable and missing here
  const missingMember: IConsumerClient = withoutUnlock;

  const withoutUtils = {
    getClass: handClass,
    getProgram: handProgram,
    getMessageClassMessage: handMessage,
  };
  // @ts-expect-error `getUtils` is a factory the contract names
  const missingFactory: IConsumerClient = withoutUtils;

  return [fromLibrary, missingMember, missingFactory];
};

describe('the consumer client contract', () => {
  it('imports from @mcp-abap-adt/interfaces-adt alone', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../helpers/consumerClientContract.ts'),
      'utf8',
    );
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(specifiers).toEqual(['@mcp-abap-adt/interfaces-adt']);
  });

  it('is satisfied by an object written by hand', () => {
    expect(Object.keys(handWritten).sort()).toEqual([
      'getClass',
      'getMessageClassMessage',
      'getProgram',
      'getUtils',
    ]);
  });
});
