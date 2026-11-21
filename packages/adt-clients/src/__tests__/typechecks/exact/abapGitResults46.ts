/**
 * A 46.x consumer compiles unchanged against 46.2.0: its `results` object, the
 * `{ logger, results }` constructor and the explicit values-map type argument
 * of `AbapGit.test.ts`, on both constructor paths, and its legacy calls. Both
 * test configs compile this file; imported from the built declarations.
 * Nothing here runs.
 */

import { type ResultValuesOf, rawDocument } from '@mcp-abap-adt/adt-clients';
import {
  AdtAbapGitClient,
  abapGitDocuments,
} from '@mcp-abap-adt/adt-clients/abapgit';
import {
  abapGitExternalRepo,
  abapGitRepos,
  type IAbapGitExternalRepoInfo,
  type IAbapGitRepo,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

declare const connection: IAbapConnection;
declare const logger: ILogger;

const results = {
  ...abapGitDocuments,
  repos: abapGitRepos,
  externalRepo: abapGitExternalRepo,
};

let constructed: AdtAbapGitClient<ResultValuesOf<typeof results>>;
constructed = new AdtAbapGitClient(connection, { logger, results });
const created: AdtAbapGitClient<ResultValuesOf<typeof results>> =
  AdtAbapGitClient.create(connection, { logger, results });
const inferred = new AdtAbapGitClient(connection, { logger, results });
const shipped = AdtAbapGitClient.create(connection, { logger });
export const handles = [constructed, created, inferred, shipped, rawDocument];

const headers = { accept: 'a', contentType: 'c' };

export async function legacyCalls(): Promise<void> {
  const listed = await constructed.listRepos();
  const repos: IAbapGitRepo[] = listed.ok ? listed.getResult().value : [];
  const info = await created.checkExternalRepo(
    {
      url: 'https://git.example.invalid/r',
      remoteUser: 'u',
      remotePassword: 'p',
    },
    { headers },
  );
  const external: IAbapGitExternalRepoInfo | undefined = info.ok
    ? info.getResult().value
    : undefined;
  await inferred.link(
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
  void [repos, external, text];

  // The two forms never mix: a legacy argument with `credentials`, or a new
  // one without them, does not compile.
  // @ts-expect-error -- remoteUser and credentials together
  await shipped.link(
    { package: 'ZPKG', url: 'u', remoteUser: 'u' },
    { headers, credentials: null },
  );
  await shipped.pull(
    { package: 'P', pullLink: 'l' },
    // @ts-expect-error -- the legacy form's options carry credentials?: never
    { headers, credentials: null },
  );
}
