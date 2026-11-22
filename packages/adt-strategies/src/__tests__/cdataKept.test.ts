import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { feedEntries } from '../results/feeds';
import { readNamedItems } from '../results/utils';

/**
 * A CDATA section is text as written (0.28.0): references are decoded in
 * element text and attribute values, never in CDATA. Written documents — no
 * recorded answer of these readings holds a CDATA section.
 */
const wire = (data: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data,
});

describe('CDATA is kept as written', () => {
  it('a feed entry’s content in CDATA keeps &amp;', () => {
    const [entry] = feedEntries(
      wire(
        '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>e</id><title>t</title><content><![CDATA[a &amp; b]]></content></entry></feed>',
      ),
    );
    expect(entry?.content).toBe('a &amp; b');
  });

  it('decodes the text beside a CDATA section, not the section', () => {
    const [item] = readNamedItems(
      '<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditem"><nameditem:namedItem><nameditem:name>N</nameditem:name><nameditem:description>x &amp; <![CDATA[&amp;&#x26;]]></nameditem:description></nameditem:namedItem></nameditem:namedItemList>',
    );
    expect(item?.description).toBe('x &&amp;&#x26;');
  });
});
