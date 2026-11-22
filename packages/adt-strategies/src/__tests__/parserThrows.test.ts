import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import * as api from '../index';
import {
  readTransportItem,
  transportCreated,
  transportTree,
} from '../results/transport';

const STRATEGIES = { transportTree, transportCreated };

/**
 * A parser's own error never escapes a reading (0.28.0). The review's two
 * documents: an entity name the parser refuses inside a DTD, and nesting
 * past the parser's limit — both well-formed enough for `XMLValidator`, both
 * thrown by `parse()` with a message quoting the document.
 */
const BAD_ENTITY =
  '<!DOCTYPE r [<!ENTITY 1x "PARSER_TEXT_MARKER">]><tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="SIDK900011"/>';
const DEEP = `<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="SIDK900011">${'<a>'.repeat(20000)}${'</a>'.repeat(20000)}</tm:root>`;
const DOCUMENTS: ReadonlyArray<[string, string]> = [
  ['an invalid entity name', BAD_ENTITY],
  ['nesting past the limit', DEEP],
];
const wire = (data: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data,
});

/** What a reading threw, as text, or `''` when it answered. */
function thrownBy(read: () => unknown): string {
  try {
    read();
    return '';
  } catch (error) {
    return error instanceof Error
      ? `${error.message}|${String(error.cause)}`
      : String(error);
  }
}

describe.each(DOCUMENTS)('%s', (_what, document) => {
  it.each([
    ['transportTree', 'parseTransportTree: the answer is no transport list'],
    [
      'transportCreated',
      'parseCreatedTransport: the answer names no created transport request or task',
    ],
  ] as const)('%s refuses in its fixed words', (name, words) => {
    expect(thrownBy(() => STRATEGIES[name](wire(document)))).toBe(
      `${words}|undefined`,
    );
  });

  it('transportItem refuses in its fixed words', () => {
    expect(thrownBy(() => readTransportItem(document, 'SIDK900011'))).toBe(
      'readTransportItem: the answer is not the transport request or task asked for|undefined',
    );
  });

  it('no reading lets the parser speak', () => {
    for (const [name, value] of Object.entries(api)) {
      if (typeof value !== 'function' || value.length !== 1) continue;
      const said = thrownBy(() =>
        Reflect.apply(value, undefined, [wire(document)]),
      );
      expect([
        name,
        said.includes('entity') ||
          said.includes('nested') ||
          said.includes('PARSER_TEXT_MARKER'),
      ]).toEqual([name, false]);
    }
  });
});
