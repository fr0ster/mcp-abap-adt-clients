/**
 * A target system for a script: a session file, the kind of system it is, and
 * a connection built from that file alone.
 *
 * Shared by `adt-nc` and `address-matrix`. The files are parsed, not loaded
 * into `process.env`, so two systems in one process do not leak into each
 * other; the system kind is stated, never inferred.
 */

import * as fs from 'node:fs';
import type { AgentOptions } from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  BasicAuthProvider,
  TokenAuthProvider,
} from '@mcp-abap-adt/auth-providers';
import {
  AdtCloudConnector,
  AdtOnPremConnector,
  CloudHttpTransport,
  LegacyOnPremHttpTransport,
  OnPremHttpTransport,
  type SapConfig,
} from '@mcp-abap-adt/connection';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';

export type SystemKind = 'onprem' | 'cloud' | 'legacy';

export interface ITarget {
  label: string;
  file: string;
  kind: SystemKind;
  env: Record<string, string>;
}

const SESSIONS = path.join(os.homedir(), '.config/mcp-abap-adt/sessions');
const KINDS: readonly SystemKind[] = ['onprem', 'cloud', 'legacy'];

export function fail(message: string): never {
  process.stderr.write(`adt-nc: ${message}\n`);
  process.exit(2);
}

export function clean(value: string | undefined): string | undefined {
  const v = value?.split('#')[0].trim();
  return v ? v : undefined;
}

export function resolveTarget(spec: string): ITarget {
  const colon = spec.lastIndexOf(':');
  const suffix = colon > 0 ? spec.slice(colon + 1) : '';
  const stated = KINDS.includes(suffix as SystemKind)
    ? (suffix as SystemKind)
    : undefined;
  const name = stated ? spec.slice(0, colon) : spec;

  const file =
    name.includes('/') || name.endsWith('.env')
      ? path.resolve(name)
      : path.join(SESSIONS, `${name}.env`);
  if (!fs.existsSync(file)) fail(`no env file for '${spec}': ${file}`);

  const env = dotenv.parse(fs.readFileSync(file));
  const fromFile = clean(env.SAP_SYSTEM_TYPE)?.toLowerCase();
  const kind =
    stated ??
    (KINDS.includes(fromFile as SystemKind)
      ? (fromFile as SystemKind)
      : undefined);
  if (!kind) {
    fail(
      `'${spec}' does not say which kind of system it is — append :onprem, ` +
        ':cloud or :legacy, or set SAP_SYSTEM_TYPE in the file',
    );
  }
  return { label: path.basename(name, '.env'), file, kind, env };
}

export function configOf(target: ITarget): SapConfig {
  const { env } = target;
  const url = clean(env.SAP_URL);
  if (!url || !/^https?:\/\//.test(url)) {
    fail(`${target.file}: missing or invalid SAP_URL`);
  }
  const authType = clean(env.SAP_AUTH_TYPE)?.toLowerCase();
  const jwt =
    authType === 'jwt' ||
    authType === 'xsuaa' ||
    (!authType && Boolean(clean(env.SAP_JWT_TOKEN)));

  const config: SapConfig = { url, authType: jwt ? 'jwt' : 'basic' };
  const client = clean(env.SAP_CLIENT);
  if (client) config.client = client;

  if (jwt) {
    const token = clean(env.SAP_JWT_TOKEN);
    if (!token) fail(`${target.file}: SAP_JWT_TOKEN is missing`);
    config.jwtToken = token;
  } else {
    const username = clean(env.SAP_USERNAME) ?? clean(env.SAP_LOGIN);
    const password = env.SAP_PASSWORD;
    if (!username || !password) {
      fail(`${target.file}: SAP_USERNAME (or SAP_LOGIN) and SAP_PASSWORD`);
    }
    config.username = username;
    config.password = password;
  }
  return config;
}

export function loggerFor(verbose: boolean): ILogger {
  const write = (level: string) => (message: string, meta?: unknown) => {
    if (!verbose) return;
    process.stderr.write(
      `[${level}] ${message}${meta === undefined ? '' : ` ${JSON.stringify(meta)}`}\n`,
    );
  };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  } as ILogger;
}

export function connectionFor(target: ITarget, logger: ILogger) {
  const config = configOf(target);
  const wire = { client: config.client, baseUrl: config.url };
  const material = (): AgentOptions => ({});
  if (target.kind === 'cloud') {
    return new AdtCloudConnector(
      config,
      TokenAuthProvider.fixed(config.jwtToken as string),
      new CloudHttpTransport(material, logger, wire),
      logger,
    );
  }
  const credential =
    config.authType === 'jwt'
      ? TokenAuthProvider.fixed(config.jwtToken as string)
      : new BasicAuthProvider(
          config.username as string,
          config.password as string,
        );
  const transport =
    target.kind === 'legacy'
      ? new LegacyOnPremHttpTransport(material, logger, wire)
      : new OnPremHttpTransport(material, logger, wire);
  return new AdtOnPremConnector(config, credential, transport, logger);
}

/** The answer that arrived, whether the transport called it success or not. */
export function answerOf(
  error: unknown,
): IAdtWireResponse | { error: string; stack?: string } {
  const response = (error as { response?: IAdtWireResponse })?.response;
  if (response) return response;
  const e = error as Error;
  return { error: e?.message ?? String(error), stack: e?.stack };
}
