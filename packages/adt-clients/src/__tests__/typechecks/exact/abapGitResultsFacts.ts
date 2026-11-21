/**
 * A new-form slot types its member's result by its key's optionality, the
 * same with `exactOptionalPropertyTypes` on (`tsconfig.test.exact.json`) and
 * off (`tsconfig.test.json`; both compile this file): a required reader gives
 * its own result, an optional one its result or the default facts (it may be
 * absent at run time), an omitted slot the default facts — through `create`
 * and through `new` with its values map. Imported as a consumer imports it,
 * from the built declarations (`npm run build` first). Nothing here runs.
 */

import {
  type AbapGitDefaultFacts,
  type AbapGitValuesOf,
  AdtAbapGitClient,
  abapGitDocuments,
} from '@mcp-abap-adt/adt-clients/abapgit';
import type { IAbapGitReposFacts } from '@mcp-abap-adt/adt-strategies';
import type { IAbapGitFactsResponse } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false;

type ValueOf<P> =
  P extends Promise<infer A>
    ? A extends { ok: true; getResult(): { value: infer V } }
      ? V
      : never
    : never;

declare const connection: IAbapConnection;

const count = (answer: IAbapGitFactsResponse<IAbapGitReposFacts>): number =>
  answer.facts.repos.length;

const required = { ...abapGitDocuments, reposFacts: count };
const optional: typeof abapGitDocuments & {
  readonly reposFacts?: typeof count;
} = abapGitDocuments;
const omitted = abapGitDocuments;

type Default = AbapGitDefaultFacts<'reposFacts'>;

// Through `create`.
const createdRequired = AdtAbapGitClient.create(connection, {
  results: required,
});
const createdOptional = AdtAbapGitClient.create(connection, {
  results: optional,
});
const createdOmitted = AdtAbapGitClient.create(connection, {
  results: omitted,
});
export const createRequired: Equal<
  ValueOf<ReturnType<typeof createdRequired.listReposQuiet>>,
  number
> = true;
export const createOptional: Equal<
  ValueOf<ReturnType<typeof createdOptional.listReposQuiet>>,
  number | Default
> = true;
export const createOmitted: Equal<
  ValueOf<ReturnType<typeof createdOmitted.listReposQuiet>>,
  Default
> = true;
const createdShipped = AdtAbapGitClient.create(connection);
export const createShipped: Equal<
  ValueOf<ReturnType<typeof createdShipped.listReposQuiet>>,
  Default
> = true;

// Through `new`, with the values map.
const newRequired = new AdtAbapGitClient<AbapGitValuesOf<typeof required>>(
  connection,
  { results: required },
);
const newOptional = new AdtAbapGitClient<AbapGitValuesOf<typeof optional>>(
  connection,
  { results: optional },
);
const newOmitted = new AdtAbapGitClient<AbapGitValuesOf<typeof omitted>>(
  connection,
  { results: omitted },
);
export const constructRequired: Equal<
  ValueOf<ReturnType<typeof newRequired.listReposQuiet>>,
  number
> = true;
export const constructOptional: Equal<
  ValueOf<ReturnType<typeof newOptional.listReposQuiet>>,
  number | Default
> = true;
export const constructOmitted: Equal<
  ValueOf<ReturnType<typeof newOmitted.listReposQuiet>>,
  Default
> = true;
