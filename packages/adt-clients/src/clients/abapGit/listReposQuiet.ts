import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_ABAPGIT_REPOS_V2 } from '../../constants/contentTypes';
import { NEW_FORM } from './newForm';
import { ABAPGIT_REPOS } from './paths';

/** R1, read quietly: no credential, nothing logged — the server's pre-read. */
export function listReposQuietRequest(): IAbapRequestOptions {
  return {
    method: 'GET',
    url: ABAPGIT_REPOS,
    headers: { Accept: ACCEPT_ABAPGIT_REPOS_V2 },
    ...NEW_FORM,
  };
}
