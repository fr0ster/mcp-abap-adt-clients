import { legacyRfcSkipReason } from '../../helpers/legacyRfc';

const NOT_LEGACY = 'not a legacy configuration (`is_legacy: true`)';
const RFC_ONLY = 'the legacy client is supported over RFC only';

describe('legacy RFC gate', () => {
  it('names the missing legacy flag when the configuration is not legacy', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => false,
        connectionType: () => 'rfc',
        explicitConfigPath: () => undefined,
      }),
    ).toBe(NOT_LEGACY);
  });

  it('names the missing legacy flag before the wire when neither holds', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => false,
        connectionType: () => 'http',
        explicitConfigPath: () => undefined,
      }),
    ).toBe(NOT_LEGACY);
  });

  it('refuses a legacy configuration over HTTP: RFC only', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => true,
        connectionType: () => 'http',
        explicitConfigPath: () => undefined,
      }),
    ).toBe(RFC_ONLY);
  });

  it('has no reason on a legacy configuration over RFC', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => true,
        connectionType: () => 'rfc',
        explicitConfigPath: () => undefined,
      }),
    ).toBeUndefined();
  });

  it('reads a configuration that cannot be loaded as not legacy, when none was named', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => {
          throw new Error('no config');
        },
        connectionType: () => 'rfc',
        explicitConfigPath: () => undefined,
      }),
    ).toBe(NOT_LEGACY);
  });

  // A configuration named through MCP_TEST_CONFIG_PATH is the 7.40 run's own:
  // when it cannot be read, skipping as "not a legacy configuration" would
  // report a run that never happened as a deliberate skip.
  it('fails, naming the path, when the named configuration cannot be read', () => {
    expect(() =>
      legacyRfcSkipReason({
        isLegacy: () => {
          throw new Error('does not exist');
        },
        connectionType: () => 'rfc',
        explicitConfigPath: () => '/configs/legacy-740.yaml',
      }),
    ).toThrow(/MCP_TEST_CONFIG_PATH.*\/configs\/legacy-740\.yaml/);
  });
});
