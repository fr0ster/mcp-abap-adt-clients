import type {
  IAbapGitCredentials,
  IAbapGitFileArgs,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_ABAPGIT_FILE } from '../../constants/contentTypes';
import { credentialHeaders, NEW_FORM } from './newForm';
import { repoPath } from './paths';

/** R12: one file, in the system's version or the remote's. */
export function getFileRequest(
  args: IAbapGitFileArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'GET',
    url: repoPath(args.key, 'files'),
    params: { filename: args.filename, version: args.version },
    headers: { Accept: ACCEPT_ABAPGIT_FILE, ...credentialHeaders(credentials) },
    ...NEW_FORM,
  };
}
