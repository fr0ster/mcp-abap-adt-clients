/**
 * The release variant a client serves, and the gates its factories and
 * members take from the ADT type tables of `@mcp-abap-adt/interfaces-adt`.
 *
 * A gate is a `this` parameter: a factory or member is callable only on a
 * receiver whose variant's table serves its API (and, for a member, lists its
 * operation for one of the API's codes); on any other variant its `this`
 * demands {@link IAdtNotServed}, which no receiver has, and the call does not
 * compile. Nothing is checked at run time —
 * the refusals a legacy class answers stay for callers outside the type
 * system.
 */

import type {
  AdtApi,
  AdtApiName,
  AdtApiWith,
  AdtOperation,
  AdtVariant,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * A system of SAP_BASIS 7.50 or later, on premise or ABAP cloud — what
 * `AdtClient` serves when its variant is not named. Its gates are the
 * intersection of the two tables, which serve the same APIs and operations.
 */
export type AdtModernVariant = Exclude<AdtVariant, 'basis740'>;

/**
 * What a receiver would have to carry to call a factory or member its
 * variant does not serve. No client or handler carries it, so the call does
 * not compile — the error names what is missing, e.g.
 * `Property '"not served on this variant"' is missing … "table"`. Inside
 * the member the receiver is still its class, so a refusal kept for callers
 * outside the type system can read `this`.
 */
export interface IAdtNotServed<What extends string> {
  readonly 'not served on this variant': What;
}

/**
 * Nothing when variant `V` serves API `A`; otherwise what no receiver has. A
 * factory takes `this: this & AdtServedBy<V, 'table'>`.
 */
export type AdtServedBy<V extends AdtVariant, A extends AdtApiName> = [
  A,
] extends [AdtApi<V>]
  ? unknown
  : IAdtNotServed<A>;

/**
 * Nothing when one code of API `A` lists operation `Op` on variant `V` — or,
 * for a codeless API, its entry does; otherwise what no receiver has. A
 * member takes `this: this & AdtPerformedBy<V, 'class', 'deletionCheck'>`.
 * An override keeps the same gate, so the call stays refused through it.
 */
export type AdtPerformedBy<
  V extends AdtVariant,
  A extends AdtApiName,
  Op extends AdtOperation,
> = [A] extends [AdtApiWith<V, Op>] ? unknown : IAdtNotServed<`${A}.${Op}`>;
