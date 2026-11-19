/**
 * The body a text elements write sends: one part, whole, in SAP's line
 * format (`CL_SEDX_ADT_SRC_UTIL=>map_source_to_textpool_data` reads it,
 * `map_text_elements_to_source` writes the same shape back), CR LF between
 * lines.
 *
 * **What a reading read, written back, is the same bytes.** Every value goes
 * out as given — nothing trimmed, padded or upper-cased — so a part read by
 * `@mcp-abap-adt/adt-strategies` and written back unchanged sends exactly the
 * answer it was read from (`textElementsBody.test.ts` holds this over the
 * recorded answers).
 *
 * **A value the format cannot carry is refused before any request.** A line
 * break inside a value would start a new line SAP reads as another entry; a
 * `=` in a key or a name would move the split SAP makes at the first one. The
 * write replaces the whole part, so a body SAP reads differently from what
 * the caller meant would delete or rename entries: these throw, naming the
 * entry.
 *
 * The input shapes are the contract's (`TextElementsDocument`,
 * `@mcp-abap-adt/interfaces-adt` 30.0.0).
 */

import type {
  ISelectionText,
  ITextHeadings,
  ITextSymbol,
  TextElementsDocument,
} from '@mcp-abap-adt/interfaces-adt';

/** One text symbol, one selection text, the headings: the contract's. */
export type ITextSymbolInput = ITextSymbol;
export type ISelectionTextInput = ISelectionText;
export type ITextHeadingsInput = ITextHeadings;

/** One part with its whole list. */
export type TextElementsPartInput = TextElementsDocument;

const CRLF = '\r\n';

/** A value that would break its line: a CR or an LF in it. */
function breaksLine(value: string): boolean {
  return value.includes('\r') || value.includes('\n');
}

/** Refuse a value its line cannot carry. */
function lineValue(value: string, what: string): string {
  if (breaksLine(value)) {
    throw new Error(`text elements: ${what} holds a line break`);
  }
  return value;
}

/** Refuse a key or a name SAP would split elsewhere, or read as empty. */
function lineKey(value: string, what: string): string {
  if (value === '' || value.includes('=')) {
    throw new Error(`text elements: ${what} is empty or holds '='`);
  }
  return lineValue(value, what);
}

/**
 * The symbols part: `@MaxLength:N` and `KEY=text` per symbol, an empty line
 * between two symbols; no symbols is the empty body.
 */
export function textSymbolsBody(symbols: readonly ITextSymbolInput[]): string {
  const lines: string[] = [];
  symbols.forEach((symbol, index) => {
    const what = `symbol ${index + 1} ('${symbol.key}')`;
    if (!Number.isSafeInteger(symbol.maxLength) || symbol.maxLength < 0) {
      throw new Error(
        `text elements: ${what} has maxLength ${symbol.maxLength}, not a count`,
      );
    }
    if (index > 0) lines.push('');
    lines.push(`@MaxLength:${symbol.maxLength}`);
    lines.push(
      `${lineKey(symbol.key, `${what}'s key`)}=${lineValue(symbol.text, `${what}'s text`)}`,
    );
  });
  return lines.join(CRLF);
}

/**
 * The selections part: `NAME=text` per entry, an empty line between two
 * entries, `@DDICReference` on its own line before a dictionary text — the
 * form SAP answers (measured on premise); none is the empty body. Names go
 * as given: SAP pads them on a read and takes them padded or not.
 */
export function selectionTextsBody(
  selections: readonly ISelectionTextInput[],
): string {
  return selections
    .map((selection, index) => {
      const what = `selection text ${index + 1} ('${selection.name}')`;
      const line = `${lineKey(selection.name, `${what}'s name`)}=${lineValue(selection.text, `${what}'s text`)}`;
      return selection.ddicReference ? `@DDICReference${CRLF}${line}` : line;
    })
    .join(`${CRLF}${CRLF}`);
}

/**
 * The headings part: `listHeader=…`, an empty line, `columnHeader_1=…` to
 * `columnHeader_4=…` — the six lines SAP answers, every heading written.
 */
export function textHeadingsBody(headings: ITextHeadingsInput): string {
  return [
    `listHeader=${lineValue(headings.listHeader, 'the list header')}`,
    '',
    `columnHeader_1=${lineValue(headings.columnHeader1, 'column header 1')}`,
    `columnHeader_2=${lineValue(headings.columnHeader2, 'column header 2')}`,
    `columnHeader_3=${lineValue(headings.columnHeader3, 'column header 3')}`,
    `columnHeader_4=${lineValue(headings.columnHeader4, 'column header 4')}`,
  ].join(CRLF);
}

/** The body of one part's write. */
export function textElementsBody(document: TextElementsPartInput): string {
  switch (document.part) {
    case 'symbols':
      return textSymbolsBody(document.symbols);
    case 'selections':
      return selectionTextsBody(document.selections);
    case 'headings':
      return textHeadingsBody(document.headings);
  }
}
