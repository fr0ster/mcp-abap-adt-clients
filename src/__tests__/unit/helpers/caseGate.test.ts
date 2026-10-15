import { gate } from '../../helpers/caseGate';

function config(system = 'onprem', enabled = true, availableIn = ['onprem']) {
  return {
    environment: { system },
    enhancement: {
      test_cases: [{ name: 'enhoxhh', enabled, available_in: availableIn }],
    },
  };
}

describe('case registration gate', () => {
  it('registers an enabled, available case normally', () => {
    expect(gate('enhancement', 'enhoxhh', () => config())).toBe(it);
  });

  it('skips a disabled case', () => {
    expect(gate('enhancement', 'enhoxhh', () => config('onprem', false))).toBe(
      it.skip,
    );
  });

  it('skips a case unavailable on the configured system', () => {
    expect(gate('enhancement', 'enhoxhh', () => config('cloud'))).toBe(it.skip);
  });

  it('uses cloud from config for cloud-only cases', () => {
    expect(
      gate('enhancement', 'enhoxhh', () => config('cloud', true, ['cloud'])),
    ).toBe(it);
  });

  it('uses the legacy flag for onprem systems', () => {
    const parsed = config('onprem', true, ['legacy']);
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        environment: { ...parsed.environment, is_legacy: true },
      })),
    ).toBe(it);
    expect(gate('enhancement', 'enhoxhh', () => parsed)).toBe(it.skip);
  });

  it.each([
    undefined,
    {},
    { environment: {} },
    config('invalid'),
  ])('registers normally when config or system is missing or invalid: %p', (parsed) => {
    expect(gate('enhancement', 'enhoxhh', () => parsed)).toBe(it);
  });

  it('registers normally when loading config fails', () => {
    expect(
      gate('enhancement', 'enhoxhh', () => {
        throw new Error('Unreadable config');
      }),
    ).toBe(it);
  });

  it('registers a missing case in an otherwise configured system normally', () => {
    expect(gate('enhancement', 'missing', () => config())).toBe(it);
  });

  it('registers normally when the handler section is absent', () => {
    expect(gate('missing', 'enhoxhh', () => config())).toBe(it);
  });

  it('skips a case with enabled omitted', () => {
    const parsed = config();
    const { enabled: _enabled, ...testCase } = parsed.enhancement.test_cases[0];
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: { test_cases: [testCase] },
      })),
    ).toBe(it.skip);
  });

  it('skips a case with a non-boolean enabled value', () => {
    const parsed = config();
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: {
          test_cases: [
            { ...parsed.enhancement.test_cases[0], enabled: 'true' },
          ],
        },
      })),
    ).toBe(it.skip);
  });

  it('skips an onprem-only case on a legacy system', () => {
    const parsed = config();
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        environment: { ...parsed.environment, is_legacy: true },
      })),
    ).toBe(it.skip);
  });

  it('allows cases with available_in omitted', () => {
    const parsed = config('cloud');
    const { available_in: _availableIn, ...testCase } =
      parsed.enhancement.test_cases[0];
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: { test_cases: [testCase] },
      })),
    ).toBe(it);
  });

  it.each([
    'onprem',
    null,
    {},
    true,
  ])('allows cases with non-array available_in: %p', (availableIn) => {
    const parsed = config('cloud');
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: {
          test_cases: [
            { ...parsed.enhancement.test_cases[0], available_in: availableIn },
          ],
        },
      })),
    ).toBe(it);
  });

  it('allows cases with no availability restriction', () => {
    expect(
      gate('enhancement', 'enhoxhh', () => config('cloud', true, [])),
    ).toBe(it);
  });
});
