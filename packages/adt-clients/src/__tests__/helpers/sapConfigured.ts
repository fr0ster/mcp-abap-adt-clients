/**
 * Whether this machine names a SAP system at all, and the environment keys an
 * RFC address is stated in.
 *
 * Its own module, so the case gate can ask without loading the connection
 * helpers.
 */

/** The application-server address: host and system number. */
export const RFC_APPLICATION_SERVER_KEYS = ['SAP_ASHOST', 'SAP_SYSNR'] as const;

/** The message-server address: host, service (msserv and/or sysid), group. */
export const RFC_MESSAGE_SERVER_KEYS = [
  'SAP_MSHOST',
  'SAP_MSSERV',
  'SAP_SYSID',
  'SAP_GROUP',
] as const;

/** Every key of an RFC address, `SAP_SAPROUTER` included, which HTTP does not take. */
export const RFC_ADDRESS_KEYS = [
  ...RFC_APPLICATION_SERVER_KEYS,
  ...RFC_MESSAGE_SERVER_KEYS,
  'SAP_SAPROUTER',
] as const;

export type RfcAddressKey = (typeof RFC_ADDRESS_KEYS)[number];

/**
 * An environment value as stated: an inline `#` comment dropped, the rest
 * trimmed; nothing left is not stated.
 */
export function statedEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.split('#')[0].trim();
  return value === '' ? undefined : value;
}

/**
 * Whether this machine has SAP configured at all.
 *
 * The one legitimate reason a test file may skip its whole suite: a checkout
 * with no `.env`, where nothing could possibly run. A system is named by a
 * stated `SAP_URL` or by any key of an RFC address — an RFC destination has
 * no URL. Everything else — an invalid URL, a missing `environment.system`, an
 * unparseable `test-config.yaml`, an incomplete address, an expired token, a
 * host that refuses the session — is a fault, and a fault that skips is a
 * fault nobody sees.
 */
export function sapIsConfigured(): boolean {
  if (statedEnv('SAP_URL') !== undefined) return true;
  return RFC_ADDRESS_KEYS.some((key) => statedEnv(key) !== undefined);
}

/**
 * The system the environment names, for a message: the `SAP_URL`, else each
 * stated RFC address key with its value. Address keys only — no credential,
 * no client, nothing else of the environment.
 */
export function statedTarget(): string {
  const url = statedEnv('SAP_URL');
  if (url !== undefined) return url;
  const address = RFC_ADDRESS_KEYS.flatMap((key) => {
    const value = statedEnv(key);
    return value === undefined ? [] : [`${key}=${value}`];
  });
  return address.length > 0 ? `RFC ${address.join(' ')}` : 'no system';
}
