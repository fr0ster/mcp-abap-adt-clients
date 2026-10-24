/**
 * Where a live legacy check runs: on a legacy configuration over RFC.
 *
 * The legacy client is supported, and was measured, over RFC only (SAP_BASIS
 * 7.40 SP04). A live test of it states that: it runs when `test-config.yaml`
 * says `is_legacy: true` and `connection_type: "rfc"`, and registers a skipped
 * test naming the reason everywhere else — a legacy configuration over HTTP
 * included. A skip that says why is not a pass that ran nothing.
 */

export const NOT_LEGACY_REASON =
  'not a legacy configuration (`is_legacy: true`)';
export const RFC_ONLY_REASON = 'the legacy client is supported over RFC only';

/** What the gate reads; injected by the unit test, `sessionConfig` otherwise. */
export interface LegacyRfcProbes {
  isLegacy: () => boolean;
  connectionType: () => 'http' | 'rfc';
  /** The configuration named through `MCP_TEST_CONFIG_PATH`, if any. */
  explicitConfigPath: () => string | undefined;
}

const configured: LegacyRfcProbes = {
  isLegacy: () => require('./sessionConfig').isLegacyEnvironment(),
  connectionType: () => require('./sessionConfig').getConnectionType(),
  explicitConfigPath: () =>
    process.env.MCP_TEST_CONFIG_PATH?.trim() || undefined,
};

/** Why a live legacy check does not run here; `undefined` when it does. */
export function legacyRfcSkipReason(
  probes: LegacyRfcProbes = configured,
): string | undefined {
  let legacy: boolean;
  try {
    legacy = probes.isLegacy();
  } catch (error) {
    // A configuration named through MCP_TEST_CONFIG_PATH is the 7.40 run's
    // own: one that cannot be read fails the run, naming the path, rather than
    // reading as "not a legacy configuration" and skipping as if on purpose.
    const named = probes.explicitConfigPath();
    if (named) {
      throw new Error(
        `MCP_TEST_CONFIG_PATH names ${named}, which cannot be read as a test configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    // Without one, a configuration that cannot be read is not a legacy one.
    legacy = false;
  }
  if (!legacy) return NOT_LEGACY_REASON;
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
