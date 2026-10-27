import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The corpus is committed, so what is in it is published.
 *
 * The first version shipped here claimed the system was identified nowhere
 * while fourteen files carried the real system id in `adtcore:masterSystem`
 * and thirty-seven carried the answering application server in
 * `sap-adt-saplb`. A README is not a check; this is.
 *
 * Placeholders are deliberate rather than deletions — a strategy still has to
 * see that a user id and a system id sit in those attributes.
 */
const CORPUS = join(__dirname, '../../../corpus/adt');

const files = (() => {
  try {
    return readdirSync(CORPUS);
  } catch {
    return [];
  }
})();

const text = (name: string): string =>
  readFileSync(join(CORPUS, name), 'utf-8');

describe('the recorded corpus', () => {
  it('is there to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each([
    ['a system id other than the placeholder', /masterSystem="(?!SYS")[^"]+"/],
    ['an application server name', /appserver-[a-z0-9]/i],
    ['a bearer token', /Bearer\s+[A-Za-z0-9._-]{16,}/],
    ['an Authorization header value', /"authorization"\s*:\s*"(?!REDACTED)/i],
    ['a cookie value', /"set-cookie"\s*:\s*"(?!REDACTED)/i],
    ['a CSRF token', /"x-csrf-token"\s*:\s*"(?!REDACTED)/i],
    ['a host name', /[a-z0-9-]+\.(?:hana\.ondemand|ondemand)\.com/i],
    ['an IP address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ])('carries no %s', (_what, pattern) => {
    const offenders = files.filter((name) => pattern.test(text(name)));
    expect(offenders).toEqual([]);
  });

  it('keeps the placeholders it promises, so a reading still sees the shape', () => {
    const documents = files.filter((name) => name.endsWith('.body.xml'));
    const withSystem = documents.filter((name) =>
      text(name).includes('masterSystem='),
    );
    expect(withSystem.length).toBeGreaterThan(0);
    for (const name of withSystem) {
      expect(text(name)).toContain('masterSystem="SYS"');
    }
  });
});
