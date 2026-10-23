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

  it('reads a configuration that cannot be loaded as not legacy', () => {
    expect(
      legacyRfcSkipReason({
        isLegacy: () => {
          throw new Error('no config');
        },
        connectionType: () => 'rfc',
      }),
    ).toBe(NOT_LEGACY);
  });
});
