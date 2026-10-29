/**
 * What a client's getter, and a handler's constructor, answers is typed by
 * what it was given, and by nothing else (compile-time checks;
 * `npm run test:check` runs them). The executor's are in
 * `unit/executors/executorResultDefaults.test.ts`; the legacy client's in the
 * legacy package's `legacyClientResultDefaults.test.ts`.
 *
 * Until this, every getter of `AdtClient` and `AdtRuntimeClient` and every
 * handler constructor had `results: R = <x>Documents as unknown as R`: a caller
 * naming its own `R` and passing nothing got the shipped documents back, typed
 * as `R`. Now each getter has two overloads — no argument answers the shipped
 * documents' type, a custom `R` needs its results — and each constructor takes
 * an options object whose `results` is required (`AdtHandlerOptions`). The
 * four classes no client hands out have a static `create` with the getters'
 * two overloads (`unit/clients/handlerFactories.test.ts`).
 */

import { AdtClient } from '../../../clients/AdtClient';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';
import type { AdtModernVariant } from '../../../clients/variant';
import { AdtClass } from '../../../core/class/AdtClass';
import { classDocuments } from '../../../core/class/types';
import { AdtDomain } from '../../../core/domain/AdtDomain';
import { domainDocuments } from '../../../core/domain/types';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import type { utilDocuments } from '../../../core/shared/utilResultSet';
import { type AdtAtc, atcDocuments } from '../../../runtime/atc/AdtAtc';
import {
  RuntimeDumps,
  runtimeDumpsDocuments,
} from '../../../runtime/dumps/RuntimeDumps';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** A result set of its own: the shipped one, and a marker the default lacks. */
type Marked<D> = D & { readonly marker: true };
const marked = <D extends object>(documents: D): Marked<D> => ({
  ...documents,
  marker: true,
});

function clientGetterTypes(client: AdtClient): void {
  // No argument: the shipped documents' type, inferred.
  const classes = client.getClass();
  const isDefault: Equal<
    typeof classes,
    AdtClass<typeof classDocuments, AdtModernVariant>
  > = true;
  void isDefault;

  // Given results: their type.
  const own = client.getClass(marked(classDocuments));
  const isOwn: Equal<
    typeof own,
    AdtClass<Marked<typeof classDocuments>, AdtModernVariant>
  > = true;
  void isOwn;

  // A custom R names its results: no getter answers R without them.
  // @ts-expect-error -- R without results
  client.getClass<Marked<typeof classDocuments>>();
  // @ts-expect-error -- R without results (a getter with no variant gate)
  client.getUtils<Marked<typeof utilDocuments>>();
}

function runtimeGetterTypes(runtime: AdtRuntimeClient): void {
  // No argument: the shipped documents' type, inferred.
  const atc = runtime.getAtc();
  const isDefault: Equal<typeof atc, AdtAtc<typeof atcDocuments>> = true;
  void isDefault;

  // Given results: their type.
  const own = runtime.getAtc(marked(atcDocuments));
  const isOwn: Equal<typeof own, AdtAtc<Marked<typeof atcDocuments>>> = true;
  void isOwn;

  // @ts-expect-error -- R without results
  runtime.getAtc<Marked<typeof atcDocuments>>();
}

function constructorTypes(): void {
  const connection = new RecordingConnection();

  // Given results: their type.
  const own = new AdtClass(connection, { results: marked(classDocuments) });
  const isOwn: Equal<
    typeof own,
    AdtClass<Marked<typeof classDocuments>, AdtModernVariant>
  > = true;
  void isOwn;

  // A constructor takes its options: `results` required, the context parts
  // the handler reads optional and by name, a required logger positional.
  new AdtClass(connection, {
    results: classDocuments,
    logger: noopLogger,
    systemContext: {},
  });
  // @ts-expect-error -- results are required
  new AdtClass<Marked<typeof classDocuments>>(connection, {
    logger: noopLogger,
  });
  // @ts-expect-error -- results are required (a required logger, positional)
  new AdtUtils(connection, noopLogger, {});
  // @ts-expect-error -- results are required
  new RuntimeDumps(connection, noopLogger, {});
  // A part the handler does not read is not taken.
  new AdtDomain(connection, {
    results: domainDocuments,
    // @ts-expect-error -- AdtDomain takes no contentTypes
    contentTypes: {},
  });
}

describe('client getters and handler constructors', () => {
  it('are typed by what they are given (checked by npm run test:check)', () => {
    expect(typeof clientGetterTypes).toBe('function');
    expect(typeof runtimeGetterTypes).toBe('function');
    expect(typeof constructorTypes).toBe('function');
  });

  it('answer the shipped documents when given none', async () => {
    const connection = new RecordingConnection();
    const dumps = new AdtRuntimeClient(connection).getDumps();

    const answer = await dumps.list();

    expect(answer.ok).toBe(true);
    expect(connection.sent).toHaveLength(1);
  });

  it('answer with the documents they are given', async () => {
    const connection = new RecordingConnection();
    const dumps = new RuntimeDumps(connection, noopLogger, {
      results: runtimeDumpsDocuments,
    });

    const answer = await dumps.list();

    expect(answer.ok).toBe(true);
    expect(connection.sent).toHaveLength(1);
  });

  it('the client getter needs a connected client only', () => {
    const client = new AdtClient(new RecordingConnection());
    expect(client.getClass()).toBeInstanceOf(AdtClass);
  });
});
