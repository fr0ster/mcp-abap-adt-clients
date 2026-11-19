import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  readSelectionTexts,
  readTextHeadings,
  readTextSymbols,
  selectionTexts,
  textHeadings,
  textSymbols,
} from '../index';
import { answerFor } from './corpus';

/**
 * The text elements readings, over what SAP answered (`corpus/adt/answers`):
 * every line read as written, and a line out of the grammar refused by name —
 * a part is written back whole, so a line skipped would be a line deleted.
 */

const answer = (data: unknown): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

describe('text symbols', () => {
  it('reads every symbol of a standard program, with its length, as SAP wrote it', () => {
    const { part, symbols } = textSymbols(
      answerFor('read-text-symbols-s4-2025'),
    );
    expect(part).toBe('symbols');
    expect(symbols).toHaveLength(77);
    expect(symbols[0]).toEqual({
      key: '110',
      text: 'Referenzbenutzer',
      maxLength: 20,
    });
    expect(symbols.at(-1)).toEqual({
      key: 'T12',
      text: 'Dokumentation',
      maxLength: 23,
    });
  });

  it('keeps a leading space of a text', () => {
    const { symbols } = textSymbols(answerFor('read-text-symbols-s4-2025'));
    expect(symbols.find((s) => s.key === 'E01')).toEqual({
      key: 'E01',
      text: ' Defektes Sammelprofil',
      maxLength: 30,
    });
  });

  it('reads non-ASCII text and a text holding commas as it came', () => {
    const { symbols } = textSymbols(
      answerFor('read-text-symbols-umlauts-s4-2025'),
    );
    expect(symbols[0]).toEqual({
      key: '001',
      text: 'Fehler, als Objekt ist nur TEXT,STYL,FORM,PRIN möglich',
      maxLength: 54,
    });
  });

  it('reads an empty answer as no symbols', () => {
    expect(textSymbols(answerFor('read-text-symbols-empty-s4-2025'))).toEqual({
      part: 'symbols',
      symbols: [],
    });
  });

  it('reads the answer of a write: the part as saved', () => {
    expect(textSymbols(answerFor('write-text-symbols-abap-cloud'))).toEqual({
      part: 'symbols',
      symbols: [
        { key: '001', text: 'Symbol one EN', maxLength: 20 },
        { key: '002', text: 'Symbol two EN', maxLength: 20 },
      ],
    });
  });

  it('a text holding "=" keeps everything after the first one', () => {
    expect(readTextSymbols('@MaxLength:5\r\n001=a=b').symbols).toEqual([
      { key: '001', text: 'a=b', maxLength: 5 },
    ]);
  });

  it.each([
    [
      'a symbol without its length line',
      '001=x',
      "line 1 is not '@MaxLength:N'",
    ],
    [
      'a length that is not a count',
      '@MaxLength:2x\r\n001=x',
      "'2x' is not a length",
    ],
    ['an empty length', '@MaxLength:\r\n001=x', "'' is not a length"],
    ['a negative length', '@MaxLength:-1\r\n001=x', "'-1' is not a length"],
    ['a length with no symbol after it', '@MaxLength:3', 'line 2 is missing'],
    ['a symbol line without "="', '@MaxLength:3\r\n001', "line 2 has no '='"],
    [
      'two symbols with no empty line between them',
      '@MaxLength:3\r\n001=a\r\n@MaxLength:3\r\n002=b',
      'line 3 is not the empty line between two symbols',
    ],
    [
      'a trailing line break',
      '@MaxLength:3\r\n001=a\r\n',
      "line 4 is not '@MaxLength:N'",
    ],
    ['a bare LF between lines', '@MaxLength:3\n001=a', 'is not a length'],
  ])('refuses %s, naming the line', (_name, body, words) => {
    expect(() => readTextSymbols(body)).toThrow(words);
  });
});

describe('selection texts', () => {
  it('reads a standard program’s selection text', () => {
    expect(selectionTexts(answerFor('read-text-selections-s4-2025'))).toEqual({
      part: 'selections',
      selections: [{ name: 'ALSOUSUB', text: 'Display also unsubstituted?' }],
    });
  });

  it('keeps the name as SAP pads it: P_TEST written, "P_TEST  " answered', () => {
    expect(
      selectionTexts(answerFor('write-text-selections-s4-2025')).selections,
    ).toEqual([{ name: 'P_TEST  ', text: 'Test parameter EN' }]);
  });

  it('reads one entry per line, and an empty answer as none', () => {
    expect(readSelectionTexts('A=1\r\nB=2').selections).toEqual([
      { name: 'A', text: '1' },
      { name: 'B', text: '2' },
    ]);
    expect(readSelectionTexts('').selections).toEqual([]);
  });

  it('refuses a line without "=", naming it', () => {
    expect(() => readSelectionTexts('A=1\r\n\r\nB=2')).toThrow(
      "text elements selections: line 2 has no '='",
    );
  });
});

describe('list and column headings', () => {
  it('reads the six lines of a standard program’s headings', () => {
    expect(textHeadings(answerFor('read-text-headings-s4-2025'))).toEqual({
      part: 'headings',
      headings: {
        listHeader: '',
        columnHeader1: '',
        columnHeader2: '',
        columnHeader3: '',
        columnHeader4: '',
      },
    });
  });

  it('reads each heading by its own line', () => {
    expect(
      textHeadings(
        answer(
          'listHeader=List\r\n\r\ncolumnHeader_1=A\r\ncolumnHeader_2=B=b\r\ncolumnHeader_3= C\r\ncolumnHeader_4=D',
        ),
      ).headings,
    ).toEqual({
      listHeader: 'List',
      columnHeader1: 'A',
      columnHeader2: 'B=b',
      columnHeader3: ' C',
      columnHeader4: 'D',
    });
  });

  it.each([
    ['an empty answer', '', '0 line(s), not 6'],
    [
      'no empty line after the list header',
      'listHeader=\r\ncolumnHeader_1=\r\ncolumnHeader_2=\r\ncolumnHeader_3=\r\ncolumnHeader_4=\r\nx=',
      'line 2 is not the empty line',
    ],
    [
      'the headings out of order',
      'listHeader=\r\n\r\ncolumnHeader_2=\r\ncolumnHeader_1=\r\ncolumnHeader_3=\r\ncolumnHeader_4=',
      "line 3 is 'columnHeader_2', not 'columnHeader_1'",
    ],
    [
      'a heading line without "="',
      'listHeader\r\n\r\ncolumnHeader_1=\r\ncolumnHeader_2=\r\ncolumnHeader_3=\r\ncolumnHeader_4=',
      "line 1 has no '='",
    ],
  ])('refuses %s', (_name, body, words) => {
    expect(() => readTextHeadings(body)).toThrow(words);
  });
});

describe('an answer with no text', () => {
  it('reads as an empty part, never as the text "undefined"', () => {
    const empty = answer(undefined);
    expect(textSymbols(empty).symbols).toEqual([]);
    expect(selectionTexts(empty).selections).toEqual([]);
  });
});
