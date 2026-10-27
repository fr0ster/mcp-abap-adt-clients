import type { AdtClient } from '../../../clients/AdtClient';

// Type-level only: @ts-expect-error asserts the call is a COMPILE error.
// If the narrowing regressed, @ts-expect-error itself errors (unused).
() => {
  const c = null as unknown as AdtClient;
  // domain has no version history — these must not type-check:
  // @ts-expect-error getVersions is not on the narrowed getDomain() type
  c.getDomain().getVersions({});
  // @ts-expect-error getVersionSource is not on the narrowed getDomain() type
  c.getDomain().getVersionSource('');
  // a full handler still exposes versions (no error expected):
  c.getClass().getVersions({});
};

it('return-type narrowing compiles as asserted', () => expect(true).toBe(true));
