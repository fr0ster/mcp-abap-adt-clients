/**
 * The judge of an abapGit new form in an integration suite.
 *
 * A new form answers through the facts exchange, which has already judged
 * the answer before any `analyse` sees it: a non-2xx is the structured error
 * (status and T100 key), a 2xx that is not the route's document is
 * `unreadableAnswer`, a request with no answer is `noResponse`. abapGit routes
 * answer a refusal with a non-2xx status (`CX_ADT_REST_ABAPGIT` carries its
 * status, else 400 — spec §2.2), never with an exception document inside a
 * 200. So this judge keeps that verdict as it is: the library's strict default,
 * passed explicitly, so every call an integration suite makes names its judge
 * (`integrationCallsAreJudged.test.ts` accepts it by this name and file).
 */

import type {
  AdtNoFailure,
  IAbapGitFactsResponse,
  IAbapGitStructuredError,
} from '@mcp-abap-adt/interfaces-adt';

export function analyseAbapGitFacts<F>(
  verdict: IAbapGitStructuredError | AdtNoFailure,
  _answer?: IAbapGitFactsResponse<F>,
): IAbapGitStructuredError | AdtNoFailure {
  return verdict;
}
