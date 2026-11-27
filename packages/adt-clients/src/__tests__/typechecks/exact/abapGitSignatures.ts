/**
 * A caller that extracts a member's signature (`Parameters<…>`,
 * `ReturnType<…>`) gets the new form: since #304 (C4) `link` and
 * `checkExternalRepo` have no deprecated overload left, so their one
 * signature takes the new-form args and the options with `credentials`. Both
 * test configs compile this file; imported from the built declarations.
 * Nothing here runs.
 */

import type { AdtAbapGitClient } from '@mcp-abap-adt/adt-clients/abapgit';
import type {
  IAbapGitExternalRepoArgs,
  IAbapGitLinkNewArgs,
} from '@mcp-abap-adt/interfaces-adt';

/** `true` when each type is assignable to the other. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Client = AdtAbapGitClient;

export const linkArgs: Mutual<
  Parameters<Client['link']>[0],
  IAbapGitLinkNewArgs
> = true;
export const externalArgs: Mutual<
  Parameters<Client['checkExternalRepo']>[0],
  IAbapGitExternalRepoArgs
> = true;
/** The options name the credential: there is no form without it. */
export const linkTakesCredentials: 'credentials' extends keyof Parameters<
  Client['link']
>[1]
  ? true
  : false = true;
export const externalTakesCredentials: 'credentials' extends keyof Parameters<
  Client['checkExternalRepo']
>[1]
  ? true
  : false = true;
