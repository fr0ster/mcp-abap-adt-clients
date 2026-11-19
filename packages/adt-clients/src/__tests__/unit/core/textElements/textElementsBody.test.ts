import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readSelectionTexts,
  readTextHeadings,
  readTextSymbols,
} from '@mcp-abap-adt/adt-strategies';
import {
  selectionTextsBody,
  textElementsBody,
  textHeadingsBody,
  textSymbolsBody,
} from '../../../../core/textElements/body';

/**
 * The text elements write body, over what SAP answered: a part read and
 * written back unchanged is the same bytes, so a read-modify-write changes
 * exactly what the caller changed. SAP deletes what a write leaves out; a
 * body that differed from the read in one byte would be a different list.
 */

const ANSWERS = join(__dirname, '../../../../../corpus/adt/answers');
const body = (step: string): string =>
  readFileSync(join(ANSWERS, `${step}.body.txt`), 'utf-8');

describe('a part read and written back is the answer it was read from', () => {
  it.each([
    'read-text-symbols-s4-2025--01-symbols',
    'read-text-symbols-umlauts-s4-2025--01-symbols',
    'read-text-symbols-empty-s4-2025--01-symbols',
    'write-text-symbols-abap-cloud--01-update',
  ])('symbols: %s', (step) => {
    const answer = body(step);
    const read = readTextSymbols(answer);
    expect(textSymbolsBody(read.symbols)).toBe(answer);
    expect(textElementsBody(read)).toBe(answer);
  });

  it.each([
    'read-text-selections-s4-2025--01-selections',
    'write-text-selections-s4-2025--01-update',
  ])('selections: %s', (step) => {
    const answer = body(step);
    const read = readSelectionTexts(answer);
    expect(selectionTextsBody(read.selections)).toBe(answer);
    expect(textElementsBody(read)).toBe(answer);
  });

  it('headings: read-text-headings-s4-2025--01-headings', () => {
    const answer = body('read-text-headings-s4-2025--01-headings');
    const read = readTextHeadings(answer);
    expect(textHeadingsBody(read.headings)).toBe(answer);
    expect(textElementsBody(read)).toBe(answer);
  });
});

describe('the body the measured write sent', () => {
  it('two symbols, an empty line between them, CR LF, no trailing break', () => {
    expect(
      textSymbolsBody([
        { key: '001', text: 'Symbol one EN', maxLength: 20 },
        { key: '002', text: 'Symbol two EN', maxLength: 20 },
      ]),
    ).toBe(
      '@MaxLength:20\r\n001=Symbol one EN\r\n\r\n@MaxLength:20\r\n002=Symbol two EN',
    );
  });

  it('a selection text as given: SAP pads the name, the library does not', () => {
    expect(
      selectionTextsBody([{ name: 'P_TEST', text: 'Test parameter EN' }]),
    ).toBe('P_TEST=Test parameter EN');
  });

  it('an empty list is the empty body: the write deletes every entry', () => {
    expect(textSymbolsBody([])).toBe('');
    expect(selectionTextsBody([])).toBe('');
  });

  it('every heading line, empty ones included', () => {
    expect(
      textHeadingsBody({
        listHeader: 'List',
        columnHeader1: 'A',
        columnHeader2: '',
        columnHeader3: ' C',
        columnHeader4: 'D=d',
      }),
    ).toBe(
      'listHeader=List\r\n\r\ncolumnHeader_1=A\r\ncolumnHeader_2=\r\ncolumnHeader_3= C\r\ncolumnHeader_4=D=d',
    );
  });

  it('a text holding "=" goes as it is: SAP splits at the first one', () => {
    const sent = textSymbolsBody([{ key: '001', text: 'a=b', maxLength: 3 }]);
    expect(readTextSymbols(sent).symbols).toEqual([
      { key: '001', text: 'a=b', maxLength: 3 },
    ]);
  });
});

describe('a value the format cannot carry is refused before any request', () => {
  it.each([
    [
      'a line break in a text',
      () => textSymbolsBody([{ key: '001', text: 'a\r\nb', maxLength: 3 }]),
      "symbol 1 ('001')'s text holds a line break",
    ],
    [
      'an LF alone in a text',
      () => textSymbolsBody([{ key: '001', text: 'a\nb', maxLength: 3 }]),
      'holds a line break',
    ],
    [
      '"=" in a key',
      () => textSymbolsBody([{ key: '0=1', text: 'a', maxLength: 3 }]),
      "symbol 1 ('0=1')'s key is empty or holds '='",
    ],
    [
      'an empty key',
      () => textSymbolsBody([{ key: '', text: 'a', maxLength: 3 }]),
      "key is empty or holds '='",
    ],
    [
      'a negative length',
      () => textSymbolsBody([{ key: '001', text: 'a', maxLength: -1 }]),
      'has maxLength -1, not a count',
    ],
    [
      'a fractional length',
      () => textSymbolsBody([{ key: '001', text: 'a', maxLength: 1.5 }]),
      'has maxLength 1.5, not a count',
    ],
    [
      '"=" in a selection name',
      () => selectionTextsBody([{ name: 'P=X', text: 'a' }]),
      "selection text 1 ('P=X')'s name is empty or holds '='",
    ],
    [
      'a line break in a heading',
      () =>
        textHeadingsBody({
          listHeader: '',
          columnHeader1: '',
          columnHeader2: 'x\ny',
          columnHeader3: '',
          columnHeader4: '',
        }),
      'column header 2 holds a line break',
    ],
  ])('%s', (_name, build, words) => {
    expect(build).toThrow(words);
  });
});
