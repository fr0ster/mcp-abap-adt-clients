import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { XML_TEXT_OPTIONS } from '../parsed';

/**
 * No reading's parser coerces a value (0.28.0): every `new XMLParser({` in
 * the package's source either spreads `XML_TEXT_OPTIONS` or turns both
 * `parseTagValue` and `parseAttributeValue` off. Plain code over our own
 * source.
 */
const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '__tests__') return [];
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

describe('parser options', () => {
  it('no parser of a reading coerces tag or attribute values', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf-8');
      let from = 0;
      for (;;) {
        const start = text.indexOf('new XMLParser({', from);
        if (start < 0) break;
        const end = text.indexOf('})', start);
        const options = text.slice(start, end);
        // Spread or not, nothing may switch coercion on after it.
        const switchedOn =
          options.includes('parseTagValue: true') ||
          options.includes('parseAttributeValue: true');
        const safe =
          !switchedOn &&
          (options.includes('...XML_TEXT_OPTIONS') ||
            (options.includes('parseTagValue: false') &&
              options.includes('parseAttributeValue: false')));
        if (!safe) offenders.push(file.slice(SRC.length + 1));
        from = end;
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the shared options themselves switch coercion off', () => {
    expect(XML_TEXT_OPTIONS.parseTagValue).toBe(false);
    expect(XML_TEXT_OPTIONS.parseAttributeValue).toBe(false);
    const text = readFileSync(join(SRC, 'parsed.ts'), 'utf-8');
    const start = text.indexOf('export const XML_TEXT_OPTIONS');
    const definition = text.slice(start, text.indexOf('};', start));
    expect(definition).toContain('parseTagValue: false');
    expect(definition).toContain('parseAttributeValue: false');
    expect(definition).not.toContain(': true');
  });
});
