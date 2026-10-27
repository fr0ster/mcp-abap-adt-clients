/**
 * The function group a FunctionModule or FunctionInclude flow builds in.
 *
 * Two routes, and the configuration picks one before the test runs — the
 * case's `params.function_group_route`:
 *
 * - `shared`: the group is the shared dependency of that name, in the shared
 *   package (`ensureSharedPackage` + `ensureSharedDependency`);
 * - `default_package`: the group lives in the case's (or the environment's
 *   default) package, for a system with no shared package (a BTP trial
 *   without a transport layer).
 *
 * Each route's failure is the setup's failure. The second route is never a
 * recovery from the first: the shared setup failing used to fall back to the
 * default package, and a group found or created there made the test pass over
 * the shared setup that had just failed. A refused create is never forgiven by
 * a later read that finds the group, and a read that could not find out is
 * never "absent".
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtClient } from '../../clients/AdtClient';
import { integrationHeadersOf } from './adtHeaders';
import { expectResult } from './contract';
import { presenceOf } from './objectPresence';

const ROUTES = ['shared', 'default_package'] as const;
export type FunctionGroupRoute = (typeof ROUTES)[number];

/**
 * What the two routes need of the client: its function group handler, as the
 * client declares it — so the `analyse` option of every call is the
 * compiler's to keep, not a hand-written narrowing's.
 */
export type IFunctionGroupClient = Pick<AdtClient, 'getFunctionGroup'>;

/** The shared-dependency setup, as test-helper.js offers it. */
export interface ISharedSetup {
  ensureSharedPackage(client: unknown, logger?: ILogger): Promise<unknown>;
  ensureSharedDependency(
    client: unknown,
    type: string,
    name: string,
    logger?: ILogger,
  ): Promise<unknown>;
  resolvePackageName(packageName?: string): string;
  resolveTransportRequest(transportRequest?: string): string | undefined;
}

/**
 * The route a case states. Anything but the two names is a defect of the
 * configuration, thrown naming the key.
 */
export function functionGroupRouteOf(
  params: Record<string, unknown> | undefined,
  caseLabel: string,
): FunctionGroupRoute {
  const route = params?.function_group_route;
  if (
    typeof route === 'string' &&
    (ROUTES as readonly string[]).includes(route)
  ) {
    return route as FunctionGroupRoute;
  }
  throw new Error(
    `${caseLabel}: params.function_group_route must be ${ROUTES.map((r) => `"${r}"`).join(' or ')}, ` +
      `got ${JSON.stringify(route)} — fix test-config.yaml.template or the overlay.`,
  );
}

/**
 * Make the case's function group ready by the route the case states; any
 * failure throws with what was said.
 */
export async function ensureFunctionGroupFor(
  client: IFunctionGroupClient,
  params: Record<string, unknown>,
  caseLabel: string,
  description: string,
  logger: ILogger | undefined,
  setup: ISharedSetup = require('./test-helper'),
): Promise<void> {
  const functionGroupName = params.function_group_name;
  if (typeof functionGroupName !== 'string' || functionGroupName === '') {
    throw new Error(`${caseLabel}: params.function_group_name is not set`);
  }
  const route = functionGroupRouteOf(params, caseLabel);

  if (route === 'shared') {
    await setup.ensureSharedPackage(client, logger);
    await setup.ensureSharedDependency(
      client,
      'function_groups',
      functionGroupName,
      logger,
    );
    return;
  }

  const groups = client.getFunctionGroup();
  const existing = presenceOf(
    await groups.readMetadata(
      { functionGroupName },
      { analyse: analyseException },
    ),
    `function group ${functionGroupName}`,
  );
  if (existing.present === 'unknown') {
    throw new Error(existing.reason);
  }
  if (existing.present === true) {
    logger?.info?.(`Function group ${functionGroupName} already exists`);
    return;
  }
  const packageName = setup.resolvePackageName(
    params.package_name as string | undefined,
  );
  const transportRequest = setup.resolveTransportRequest(
    params.transport_request as string | undefined,
  );
  expectResult(
    await groups.create(
      { functionGroupName, packageName, description, transportRequest },
      {
        headers: integrationHeadersOf(groups, 'create'),
        analyse: analyseException,
      },
    ),
    `create function group ${functionGroupName}`,
  );
  logger?.info?.(
    `Created function group ${functionGroupName} in ${packageName}`,
  );
}
