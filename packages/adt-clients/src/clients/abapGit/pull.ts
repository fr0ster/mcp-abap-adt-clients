import type {
  IAbapGitPullArgs,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { buildPullBody } from './xmlBuilder';

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
export async function pullRepo(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IAbapGitPullArgs,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'POST',
    url: args.pullLink,
    timeout: 0,
    headers: requestHeaders(headers),
    data: buildPullBody(args, args.branchName),
  });
}
