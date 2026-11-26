import { parseSearchConfigurations } from '../results/transport';

/**
 * Equivalence for #304: the reader stops casting parsed XML to a record and
 * reads it through `isElement`. What is no element — a root or a configuration
 * written as text, a link that is text — named nothing before and names
 * nothing now. Each case was green against the casting code and stays green.
 */
const NS =
  'xmlns:configurations="http://www.sap.com/adt/configurations" ' +
  'xmlns:configuration="http://www.sap.com/adt/configuration" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"';

describe('parseSearchConfigurations on what is no element', () => {
  it('reads a root written as text as no configuration', () => {
    expect(
      parseSearchConfigurations(
        `<configurations:configurations ${NS}>text</configurations:configurations>`,
      ),
    ).toEqual([]);
  });

  it('reads a configuration written as text as none', () => {
    expect(
      parseSearchConfigurations(
        `<configurations:configurations ${NS}><configuration:configuration>x</configuration:configuration></configurations:configurations>`,
      ),
    ).toEqual([]);
  });

  it('skips a text configuration beside a real one, and keeps the real one', () => {
    const parsed = parseSearchConfigurations(
      `<configurations:configurations ${NS}>` +
        '<configuration:configuration>x</configuration:configuration>' +
        '<configuration:configuration client="100"><atom:link href="/c/1" etag="E"/></configuration:configuration>' +
        '</configurations:configurations>',
    );
    expect(parsed).toEqual([
      { uri: '/c/1', etag: 'E', attributes: { client: '100' } },
    ]);
  });

  it('reads a link written as text as no address', () => {
    expect(
      parseSearchConfigurations(
        `<configurations:configurations ${NS}><configuration:configuration client="1"><atom:link>t</atom:link></configuration:configuration></configurations:configurations>`,
      ),
    ).toEqual([]);
  });
});
