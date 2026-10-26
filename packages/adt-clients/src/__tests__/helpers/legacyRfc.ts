/**
 * Where a live legacy check runs: on a legacy configuration over RFC.
 *
 * The legacy client is supported, and was measured, over RFC only (SAP_BASIS
 * 7.40 SP04). A live test of it states that: it runs when the configuration
 * says `is_legacy: true` and `connection_type: "rfc"`, and registers a skipped
 * test naming the reason everywhere else — a legacy configuration over HTTP
 * included. A skip that says why is not a pass that ran nothing.
 */

export const NOT_LEGACY_REASON =
  'not a legacy configuration (`is_legacy: true`)';
export const RFC_ONLY_REASON = 'the legacy client is supported over RFC only';

/** What the gate reads; injected by the unit test, `legacyRegistrations` and `sessionConfig` otherwise. */
export interface LegacyRfcProbes {
  isLegacy: () => boolean;
  connectionType: () => 'http' | 'rfc';
}

const configured: LegacyRfcProbes = {
  isLegacy: () => require('./legacyRegistrations').isLegacyEnvironment(),
  connectionType: () => require('./sessionConfig').getConnectionType(),
};

/**
 * Why a live legacy check does not run here; `undefined` when it does.
 *
 * A configuration that cannot be read throws, naming its fault — never read
 * as "not a legacy configuration", which would report a run that never
 * happened as a deliberate skip.
 */
export function legacyRfcSkipReason(
  probes: LegacyRfcProbes = configured,
): string | undefined {
  if (!probes.isLegacy()) return NOT_LEGACY_REASON;
  if (probes.connectionType() !== 'rfc') return RFC_ONLY_REASON;
  return undefined;
}

/** `describe` for a live legacy check: runs on legacy over RFC, else skips with the reason. */
export function describeLegacyRfc(title: string, body: () => void): void {
  const reason = legacyRfcSkipReason();
  describe(title, () => {
    if (reason === undefined) {
      body();
      return;
    }
    it.skip(`skipped: ${reason}`, () => {});
  });
}
