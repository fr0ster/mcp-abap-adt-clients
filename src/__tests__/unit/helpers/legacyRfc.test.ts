import { legacyRfcSkipReason } from '../../helpers/legacyRfc';

const NOT_LEGACY = 'not a legacy configuration (`is_legacy: true`)';
const RFC_ONLY = 'the legacy client is supported over RFC only';

describe('legacy RFC gate', () => {
  it('names the missing legacy flag when the configuration is not legacy', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => false,
        connectionType: () => 'rfc',
      }),
    ).toBe(NOT_LEGACY);
  });

  it('names the missing legacy flag before the wire when neither holds', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => false,
        connectionType: () => 'http',
      }),
    ).toBe(NOT_LEGACY);
  });

  it('refuses a legacy configuration over HTTP: RFC only', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => true,
        connectionType: () => 'http',
      }),
    ).toBe(RFC_ONLY);
  });

  it('has no reason on a legacy configuration over RFC', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => true,
        connectionType: () => 'rfc',
      }),
    ).toBeUndefined();
  });

  // Read as "not legacy", a configuration that cannot be loaded would report
  // a run that never happened as a deliberate skip.
  it('fails with the fault when the configuration cannot be read', () => {
    expect(() =>
      legacyRfcSkipReason({
        isLegacy: () => {
          throw new Error('test-config.overlay.sys.yaml is not usable');
        },
        connectionType: () => 'rfc',
      }),
    ).toThrow('test-config.overlay.sys.yaml is not usable');
  });
});
