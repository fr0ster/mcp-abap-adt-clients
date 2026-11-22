/**
 * What every request of a new form carries (spec §3.4): no timeout, and the
 * three flags — `noLog` (the connection writes nothing of it), `noResend` (no
 * replay: SAP may already have run a write it read), `stateless` (SAP keeps
 * git credentials in static class data for the ABAP session, so a stateful
 * session would keep them). The legacy forms and `unlink` never carry them.
 */

import type { IAbapGitCredentials } from '@mcp-abap-adt/interfaces-adt';

export const NEW_FORM = {
  timeout: 0,
  noLog: true,
  noResend: true,
  stateless: true,
} as const;

/**
 * The credential of a key-addressed route (R6, R9–R12, R15): the header
 * `Username` as given, the header `Password` base64-encoded — SAP decodes it
 * with `cl_http_utility=>decode_base64` (spec §2.2, Code). No credential, no
 * header.
 */
export function credentialHeaders(
  credentials: IAbapGitCredentials | null | undefined,
): { Username?: string; Password?: string } {
  if (credentials === null || credentials === undefined) return {};
  return {
    Username: credentials.user,
    Password: Buffer.from(credentials.password, 'utf8').toString('base64'),
  };
}
