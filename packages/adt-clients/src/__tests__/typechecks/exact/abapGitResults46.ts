/**
 * A 46.x consumer's `results` object, the `{ logger, results }` constructor and
 * the explicit values-map type argument of `AbapGit.test.ts`, on both
 * constructor paths, and the deprecated calls that remain. Since #304 (C4)
 * the old form of `link` and `checkExternalRepo` is gone: each such call is
 * refused, and the `externalRepo` slot no longer exists. Both test configs
 * compile this file; imported from the built declarations. Nothing here runs.
 */

import { type ResultValuesOf, rawDocument } from '@mcp-abap-adt/adt-clients';
import {
  AdtAbapGitClient,
  abapGitDocuments,
  abapGitFactsDefaults,
} from '@mcp-abap-adt/adt-clients/abapgit';
import { abapGitRepos, type IAbapGitRepo } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

declare const connection: IAbapConnection;
declare const logger: ILogger;

const results = {
  ...abapGitDocuments,
  repos: abapGitRepos,
};

let constructed: AdtAbapGitClient<ResultValuesOf<typeof results>>;
// A direct `new` passes every facts reader and its values type (#304, D4).
constructed = new AdtAbapGitClient<ResultValuesOf<typeof results>>(connection, {
  logger,
  results: { ...abapGitFactsDefaults, ...results },
});
const created: AdtAbapGitClient<ResultValuesOf<typeof results>> =
  AdtAbapGitClient.create(connection, { logger, results });
const inferred = new AdtAbapGitClient<ResultValuesOf<typeof results>>(
  connection,
  { logger, results: { ...abapGitFactsDefaults, ...results } },
);
const shipped = AdtAbapGitClient.create(connection, { logger });
export const handles = [constructed, created, inferred, shipped, rawDocument];

const headers = { accept: 'a', contentType: 'c' };

export async function deprecatedCalls(): Promise<void> {
  const listed = await constructed.listRepos();
  const repos: IAbapGitRepo[] = listed.ok ? listed.getResult().value : [];
  // The old form is refused (C4 of #304): remoteUser/remotePassword args with
  // options that carry no credentials.
  const oldExternalArgs = {
    url: 'https://git.example.invalid/r',
    remoteUser: 'u',
    remotePassword: 'p',
  };
  // @ts-expect-error -- the old form's remoteUser and remotePassword are gone
  await created.checkExternalRepo(oldExternalArgs, { headers });
  await inferred.link(
    // @ts-expect-error -- the old form's remoteUser is gone
    { package: 'ZPKG', url: 'https://git.example.invalid/r', remoteUser: 'u' },
    { headers },
  );
  await shipped.pull(
    { package: 'ZPKG', pullLink: '/sap/bc/adt/abapgit/repos/K/pull' },
    { headers },
  );
  await shipped.unlink({ repositoryId: 'K' });
  const log = await shipped.getErrorLog('/sap/bc/adt/abapgit/repos/K/log/L');
  const text: string = log.ok ? log.getResult().value : '';
  void [repos, text];

  // The two forms never mix: a legacy argument with `credentials`, or a new
  // one without them, does not compile.
  await shipped.link(
    // @ts-expect-error -- remoteUser and credentials together
    { package: 'ZPKG', url: 'u', remoteUser: 'u' },
    { headers, credentials: null },
  );
  await shipped.pull(
    { package: 'P', pullLink: 'l' },
    // @ts-expect-error -- the legacy form's options carry credentials?: never
    { headers, credentials: null },
  );
}
