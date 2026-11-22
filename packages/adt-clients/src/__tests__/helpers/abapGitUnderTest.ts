/**
 * Which copy of adt-clients, adt-strategies and connection the abapGit live
 * suite runs.
 *
 * `ABAPGIT_CLIENT_UNDER_TEST` names a directory outside the workspace that
 * holds an isolated install of the packed tarballs (plan T5.7: both tarballs,
 * `@mcp-abap-adt/connection` and the interfaces from the registry). With it,
 * every module the suite runs is loaded from that directory, and each
 * resolved file is proved to lie inside it and outside the workspace — so the
 * gates close on the tarballs that will be published, never on a workspace
 * link. Without it, the suite runs the workspace build (what the workspace
 * resolves: `packages/*\/dist` through the sibling links, connection from
 * the registry) and says so in its title.
 *
 * Types come from the workspace sources; the code that runs comes from the
 * copy named here.
 */

import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  connectionSpec,
  credentialFor,
  getConfig,
  getTargetSystem,
} from './sessionConfig';

export const UNDER_TEST_VARIABLE = 'ABAPGIT_CLIENT_UNDER_TEST';

/** The packages the suite loads, each by the specifier a consumer uses. */
export const LOADED_SPECIFIERS = [
  '@mcp-abap-adt/adt-clients',
  '@mcp-abap-adt/adt-strategies',
  '@mcp-abap-adt/connection',
] as const;

/** The workspace root: the repository holding `packages/`. */
export const WORKSPACE_ROOT = realpathSync(
  resolve(__dirname, '../../../../..'),
);

export interface IAbapGitModules {
  readonly clients: typeof import('../../index');
  readonly strategies: typeof import('@mcp-abap-adt/adt-strategies');
  readonly connection: typeof import('@mcp-abap-adt/connection');
  /** Where the modules came from, for the suite's title and summary. */
  readonly origin:
    | { readonly kind: 'under-test'; readonly root: string }
    | { readonly kind: 'workspace' };
  /** Every resolved entry file, by specifier. */
  readonly resolved: Readonly<Record<string, string>>;
}

/** Whether `path` is `root` or lies below it (both real paths). */
export function isInside(root: string, path: string): boolean {
  const between = relative(root, path);
  return (
    between === '' ||
    (!between.startsWith(`..${sep}`) &&
      between !== '..' &&
      !isAbsolute(between))
  );
}

/**
 * Refuse a resolved file that is not inside the install, or that is inside
 * the workspace. Pure: both paths are taken as real paths.
 */
export function refusalFor(
  specifier: string,
  resolvedFile: string,
  installRoot: string,
  workspaceRoot: string = WORKSPACE_ROOT,
): string | undefined {
  if (isInside(workspaceRoot, resolvedFile))
    return `${specifier} resolved to ${resolvedFile}, inside the workspace ${workspaceRoot}: ${UNDER_TEST_VARIABLE} must load only the isolated install`;
  if (!isInside(installRoot, resolvedFile))
    return `${specifier} resolved to ${resolvedFile}, outside ${installRoot}: ${UNDER_TEST_VARIABLE} must load only the isolated install`;
  return undefined;
}

/** The install root, refused when it is missing or inside the workspace. */
export function installRootOf(
  given: string,
  workspaceRoot: string = WORKSPACE_ROOT,
): string {
  if (!isAbsolute(given))
    throw new Error(
      `${UNDER_TEST_VARIABLE} must be an absolute path, got ${given}`,
    );
  if (!existsSync(given) || !statSync(given).isDirectory())
    throw new Error(`${UNDER_TEST_VARIABLE} names no directory: ${given}`);
  const root = realpathSync(given);
  if (isInside(workspaceRoot, root) || isInside(root, workspaceRoot))
    throw new Error(
      `${UNDER_TEST_VARIABLE} (${root}) overlaps the workspace ${workspaceRoot}: the isolated install must be a directory of its own outside it`,
    );
  return root;
}

/**
 * Resolve every loaded package, and what each of them resolves of the others,
 * from `installRoot`; refuse any file outside it or inside the workspace.
 * `resolveFrom(specifier, fromDirectory)` is the resolver (injected by the
 * unit test).
 */
export function resolveInsideInstall(
  installRoot: string,
  resolveFrom: (specifier: string, fromDirectory: string) => string,
  workspaceRoot: string = WORKSPACE_ROOT,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const refusals: string[] = [];
  const check = (specifier: string, file: string) => {
    const real = realpathSync(file);
    const refusal = refusalFor(specifier, real, installRoot, workspaceRoot);
    if (refusal) refusals.push(refusal);
    return real;
  };
  for (const specifier of [
    ...LOADED_SPECIFIERS,
    '@mcp-abap-adt/adt-clients/abapgit',
  ]) {
    resolved[specifier] = check(specifier, resolveFrom(specifier, installRoot));
  }
  // What each loaded package itself resolves: adt-clients' adt-strategies and
  // interfaces, connection's interfaces — all from the install.
  const fromClients = dirname(resolved['@mcp-abap-adt/adt-clients'] as string);
  const fromConnection = dirname(
    resolved['@mcp-abap-adt/connection'] as string,
  );
  for (const [from, specifier] of [
    [fromClients, '@mcp-abap-adt/adt-strategies'],
    [fromClients, '@mcp-abap-adt/interfaces-adt'],
    [fromClients, '@mcp-abap-adt/interfaces-adt-connection'],
    [fromConnection, '@mcp-abap-adt/interfaces-adt-connection'],
  ] as const) {
    check(
      `${specifier} (as ${from} resolves it)`,
      resolveFrom(specifier, from),
    );
  }
  if (refusals.length > 0) throw new Error(refusals.join('\n'));
  return resolved;
}

function nodeResolveFrom(specifier: string, fromDirectory: string): string {
  return require.resolve(specifier, { paths: [fromDirectory] });
}

/**
 * Load the three packages: from `ABAPGIT_CLIENT_UNDER_TEST` when it is set
 * (every file proved inside it), else from the workspace.
 */
export function loadAbapGitModules(
  env: NodeJS.ProcessEnv = process.env,
): IAbapGitModules {
  const given = env[UNDER_TEST_VARIABLE]?.trim();
  if (given) {
    const root = installRootOf(given);
    const resolved = resolveInsideInstall(root, nodeResolveFrom);
    return {
      clients: require(resolved['@mcp-abap-adt/adt-clients'] as string),
      strategies: require(resolved['@mcp-abap-adt/adt-strategies'] as string),
      connection: require(resolved['@mcp-abap-adt/connection'] as string),
      origin: { kind: 'under-test', root },
      resolved,
    };
  }
  const resolved: Record<string, string> = {};
  for (const specifier of LOADED_SPECIFIERS) {
    resolved[specifier] = realpathSync(nodeResolveFrom(specifier, __dirname));
  }
  return {
    clients: require(resolved['@mcp-abap-adt/adt-clients'] as string),
    strategies: require(resolved['@mcp-abap-adt/adt-strategies'] as string),
    connection: require(resolved['@mcp-abap-adt/connection'] as string),
    origin: { kind: 'workspace' },
    resolved,
  };
}

/** What the suite's title says about the copy it runs. */
export function originLabel(origin: IAbapGitModules['origin']): string {
  return origin.kind === 'under-test'
    ? `the isolated install at ${origin.root}`
    : `the workspace build (no ${UNDER_TEST_VARIABLE}: not the tested tarballs)`;
}

/** The origin as the title names it, read without loading anything. */
export function originLabelFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const given = env[UNDER_TEST_VARIABLE]?.trim();
  return given
    ? `the isolated install at ${given}`
    : originLabel({ kind: 'workspace' });
}

/** A connection of the loaded copy, with an open session of its own. */
export interface IConnectionUnderTest {
  readonly connection: IAbapConnection;
  /** Log off: ends the session this connection opened. */
  readonly logOff: () => Promise<void>;
}

/**
 * Open a session through the loaded copy of connection — never the
 * workspace's. The system, the wire and the credential come from the test
 * configuration, as `createTestConnection` takes them; the session is the
 * suite's own (it adopts no run session), so the suite logs it off itself.
 */
export async function openConnectionUnderTest(
  modules: IAbapGitModules,
  logger: ILogger,
): Promise<IConnectionUnderTest> {
  const config = getConfig();
  const system = getTargetSystem();
  const created = modules.connection.createConnection(
    connectionSpec(config, system, credentialFor(config), logger, {}),
  );
  await created.connect();
  return {
    connection: created,
    logOff: async () => {
      const ending = created as unknown as {
        disconnect?: () => Promise<unknown>;
        close?: () => Promise<unknown>;
        flushGoodbye?: () => Promise<unknown>;
      };
      // `close()` over RFC, `disconnect()` (the platform logoff) over HTTP —
      // as `closeOwnTestConnection` ends a session of its own.
      if (typeof ending.close === 'function') await ending.close();
      else if (typeof ending.disconnect === 'function')
        await ending.disconnect();
      // `disconnect()` resolves when the logoff is written; wait for SAP's
      // answer, so the session is gone when the suite says it is.
      if (typeof ending.flushGoodbye === 'function')
        await ending.flushGoodbye();
    },
  };
}

/** For a message: where an entry file sits relative to the install. */
export function shownPath(root: string, file: string): string {
  return isInside(root, file) ? join('<install>', relative(root, file)) : file;
}
