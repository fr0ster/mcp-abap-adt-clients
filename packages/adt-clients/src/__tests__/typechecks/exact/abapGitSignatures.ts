/**
 * A caller that extracts a member's signature (`Parameters<…>`,
 * `ReturnType<…>`) gets 46.1.0's: TypeScript takes the last overload, so the
 * deprecated signature of `link` and `checkExternalRepo` stays last. The 46.1.0
 * types are written out from its declarations. Both test configs compile this
 * file; imported from the built declarations. Nothing here runs.
 */

import type { AdtAbapGitClient } from '@mcp-abap-adt/adt-clients/abapgit';
import type {
  IAbapGitExternalRepoCredentials,
  IAbapGitLinkArgs,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';

/** `true` when each type is assignable to the other. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Options46 = { headers: IAdtHeaders } & IAdtAnalyseOptions<IAdtError>;
type Client = AdtAbapGitClient;

export const linkParameters: Mutual<
  Parameters<Client['link']>,
  [IAbapGitLinkArgs, Options46]
> = true;
export const linkReturn: Mutual<
  ReturnType<Client['link']>,
  Promise<IAdtResponse<void, IAdtError>>
> = true;
export const externalParameters: Mutual<
  Parameters<Client['checkExternalRepo']>,
  [IAbapGitExternalRepoCredentials, Options46]
> = true;
export const externalReturn: Mutual<
  ReturnType<Client['checkExternalRepo']>,
  Promise<IAdtResponse<string, IAdtError>>
> = true;

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false;

// The one stated change: the deprecated forms' options name `credentials`
// (`credentials?: never`), so an extracted options type has one key more than
// 46.1.0's (`headers`, `analyse`) — the edge case of an undeclared
// `credentials` the CHANGELOG states. Pinned, so the change stays deliberate.
export const linkOptionKeys: Equal<
  keyof Parameters<Client['link']>[1],
  'headers' | 'analyse' | 'credentials'
> = true;
export const externalOptionKeys: Equal<
  keyof Parameters<Client['checkExternalRepo']>[1],
  'headers' | 'analyse' | 'credentials'
> = true;
export const options46Keys: Equal<keyof Options46, 'headers' | 'analyse'> =
  true;
