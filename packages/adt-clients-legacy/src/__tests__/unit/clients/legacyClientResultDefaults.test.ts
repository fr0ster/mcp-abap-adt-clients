/**
 * What the legacy client's getters, and a legacy handler's constructor,
 * answer is typed by what they were given (compile-time checks;
 * `npm run test:check` runs them) — adt-clients 38's two overloads, through
 * its overrides. (The absent types' overrides take them too; their variant
 * gate refuses every call on this client, see legacyVariantGates.test.ts.)
 *
 * Type-level: the checks sit in a function nothing calls.
 */
import { classDocuments, type utilDocuments } from '@mcp-abap-adt/adt-clients';
import { RecordingConnection } from '../../../../../adt-clients/src/__tests__/helpers/recordingConnection';
import type { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { AdtClassLegacy } from '../../../core/class/AdtClassLegacy';

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

function legacyGetterTypes(legacy: AdtClientLegacy): void {
  // No argument: the shipped documents' type, inferred.
  const classes = legacy.getClass();
  const isDefault: Equal<
    typeof classes,
    AdtClassLegacy<typeof classDocuments>
  > = true;
  void isDefault;

  // Given results: their type.
  const own = legacy.getClass(marked(classDocuments));
  const isOwn: Equal<
    typeof own,
    AdtClassLegacy<Marked<typeof classDocuments>>
  > = true;
  void isOwn;

  // A custom R names its results: no override answers R without them.
  // @ts-expect-error -- R without results
  legacy.getClass<Marked<typeof classDocuments>>();
  // @ts-expect-error -- R without results
  legacy.getUtils<Marked<typeof utilDocuments>>();
}

function legacyConstructorTypes(): void {
  const connection = new RecordingConnection();
  // The base constructor's required results, inherited.
  // @ts-expect-error -- results are required
  new AdtClassLegacy<Marked<typeof classDocuments>>(connection, {});
  new AdtClassLegacy(connection, { results: classDocuments });
}

describe('legacy client getters and handler constructors', () => {
  it('are typed by what they are given (checked by npm run test:check)', () => {
    expect(typeof legacyGetterTypes).toBe('function');
    expect(typeof legacyConstructorTypes).toBe('function');
  });
});
