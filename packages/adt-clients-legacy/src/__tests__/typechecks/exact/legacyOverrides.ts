/**
 * Every class the legacy clients hand out accepts, in each member, every
 * argument the root class it extends accepts, under
 * `exactOptionalPropertyTypes`.
 *
 * A legacy class claims its contracts through the root class: the root
 * class's `implements` clause is checked against interfaces-adt in the root
 * package's `tsconfig.test.exact.json`. An override with a narrower option
 * (`withLongPolling?: boolean` where the root says `boolean | undefined`)
 * still passes the `extends` check, which compares methods bivariantly, and
 * the class a consumer holds then does not meet the contract. Here each
 * member is compared as a function type, so its parameters are compared
 * contravariantly: what the root member accepts, the override accepts. An
 * override that takes fewer parameters (a member refused without a request)
 * or narrows `this` still passes, as it does for a consumer.
 *
 * Compiled by `npm run test:check` under `tsconfig.test.exact.json`, against
 * the built declarations of both packages (`npm run build` first). Nothing
 * here runs.
 */

import type { AdtClient, AdtExecutor } from '@mcp-abap-adt/adt-clients';
import type {
  AdtClientLegacy,
  AdtExecutorLegacy,
} from '@mcp-abap-adt/adt-clients-legacy';

/** A member as a function type: its parameters then compare contravariantly. */
type AsFunction<F> = F extends (...args: infer A) => infer R
  ? (...args: A) => R
  : F;

type Product<C, K extends keyof C> = C[K] extends (...args: never) => infer P
  ? P
  : never;

/** The members of `L` that do not accept what `B`'s member accepts. */
type Narrowed<L, B> = {
  [M in keyof L]-?: M extends keyof B
    ? AsFunction<L[M]> extends AsFunction<B[M]>
      ? never
      : M
    : M;
}[keyof L];

/** Per factory, the members of its legacy product narrower than the root's. */
type Overrides<L, B> = {
  [K in Extract<keyof L, `get${string}`>]: K extends keyof B
    ? Narrowed<Product<L, K>, Product<B, K>>
    : K;
};

type NoneNarrowed<T extends Record<string, never>> = T;

export type ClientProducts = NoneNarrowed<
  Overrides<AdtClientLegacy, AdtClient<'basis740'>>
>;

export type ExecutorProducts = NoneNarrowed<
  Overrides<AdtExecutorLegacy, AdtExecutor<'basis740'>>
>;
