import type {
  IAbapGitCredentials,
  IAbapGitPullArgs,
  IAbapGitPullRepoArgs,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { NEW_FORM } from './newForm';
import { repoPath } from './paths';
import {
  buildPullBody,
  buildPullRepoBody,
  buildSelectivePullBody,
} from './xmlBuilder';

/**
 * Start a pull — one POST to the link the caller passes.
 *
 * **It does not wait, and it does not look the link up.** This listed the
 * repositories to find the pull link, posted, polled the repository until its
 * status left `R`, and read the error log if the status said to. Four requests
 * in one member, and three decisions the caller could not reach: how long to
 * wait, how often to ask, and what a failed status means.
 *
 * The caller lists the repositories once, keeps the link, posts here, then
 * polls `getRepo` on their own terms. The abort that used to be passed in
 * stopped this client's own `sleep` and never the server's job; leaving their
 * own loop says so in their own code.
 */
export async function postPullLink(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IAbapGitPullArgs,
  // `args.pullLink` rebuilt by `pullLinkPath` (since 46.2.0): only the path a
  // key would build is sent.
  url: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'POST',
    url,
    timeout: 0,
    headers: requestHeaders(headers),
    data: buildPullBody(args, args.branchName),
  });
}

/**
 * R4 (`pullRepo`) and R5 (`pullRepoInDialog`, `…/pull/v2`), by key: the
 * `repo.v3` document, or with a selection the `pull.req.v1` one (cloud). The
 * media types are the caller's: a selection goes with `pull.req.v1`.
 */
export function postPullByKey(
  headers: IAdtHeaders,
  args: IAbapGitPullRepoArgs,
  credentials: IAbapGitCredentials | null,
  dialog: boolean,
): IAbapRequestOptions {
  const { selection } = args;
  return {
    method: 'POST',
    url: dialog ? repoPath(args.key, 'pull', 'v2') : repoPath(args.key, 'pull'),
    headers: requestHeaders(headers),
    data:
      selection === undefined
        ? buildPullRepoBody(args, credentials)
        : buildSelectivePullBody({ ...args, selection }, credentials),
    ...NEW_FORM,
  };
}
