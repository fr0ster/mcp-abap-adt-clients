/**
 * The release variant a client serves, and the gates its factories and
 * members take from the ADT type tables of `@mcp-abap-adt/interfaces-adt`.
 *
 * **How a gate works.** A client and each gated handler declare their
 * variant as a type-only property, `variant?: V`. A gate is a `this`
 * parameter, `this: this & AdtServedBy<'table'>`, demanding that property be
 * one of the variants whose table serves the API (or, for a member, lists the
 * operation for one of the API's codes). So:
 * - a single variant is served exactly as its table says;
 * - the default `AdtModernVariant` — on premise or cloud — is served only
 *   what **both** tables serve: every member of the union must be in the
 *   served set (the intersection);
 * - a generic `V extends AdtModernVariant` is held to that same intersection,
 *   through its constraint;
 * - a 7.40 client is no modern client: its `variant` is `'basis740'`.
 *
 * Nothing is checked at run time — the refusals a legacy class answers stay
 * for callers outside the type system.
 */

import type {
  AdtApiName,
  AdtApiWithIn,
  AdtOperation,
  AdtVariant,
  IAdtTypeTables,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * A system of SAP_BASIS 7.50 or later, on premise or ABAP cloud — what
 * `AdtClient` serves when its variant is not named.
 */
export type AdtModernVariant = Exclude<AdtVariant, 'basis740'>;

/**
 * The variants, among `Tables`' keys, whose table serves API `A`. Each key is
 * read on its own table, so nothing distributes over a union of tables.
 */
export type AdtServingVariantsIn<Tables, A extends AdtApiName> = {
  [V in keyof Tables]: A extends keyof Tables[V] ? V : never;
}[keyof Tables];

/**
 * The variants, among `Tables`' keys, one code of whose API `A` lists
 * operation `Op` (or, for a codeless API, whose entry does).
 */
export type AdtPerformingVariantsIn<
  Tables,
  A extends AdtApiName,
  Op extends AdtOperation,
> = {
  [V in keyof Tables]: [A] extends [AdtApiWithIn<Tables[V], Op>] ? V : never;
}[keyof Tables];

/**
 * What a gated receiver must declare: its `variant`, one of `W`. A client of
 * another variant does not satisfy it, and the call does not compile — the
 * error names the variant it has and the variants that serve.
 */
export interface IAdtServedOn<W> {
  readonly variant?: W;
}

/** The gate of a factory: the variants whose table serves API `A`. */
export type AdtServedBy<A extends AdtApiName> = IAdtServedOn<
  AdtServingVariantsIn<IAdtTypeTables, A>
>;

/**
 * The gate of a member: the variants one code of whose API `A` lists `Op`.
 * An override keeps the same gate, so the call stays refused through it.
 */
export type AdtPerformedBy<
  A extends AdtApiName,
  Op extends AdtOperation,
> = IAdtServedOn<AdtPerformingVariantsIn<IAdtTypeTables, A, Op>>;
