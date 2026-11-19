import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';

/**
 * Readings of a program's, a class's or a function group's text elements:
 * the three parts `GET /sap/bc/adt/textelements/{kind}/{name}/source/{part}`
 * answers, each a line format of SAP's own (`CL_SEDX_ADT_SRC_UTIL`,
 * `CL_SEDX_ADT_C_HANDLER_*`), CR LF between lines.
 *
 * **Read as SAP wrote it.** Nothing is trimmed and nothing is decoded beyond
 * the text the answer is: a symbol's text keeps a leading space
 * (`E01= Defektes Sammelprofil`), a selection text's name keeps the padding
 * SAP gives it (`P_TEST  `). So writing back what was read sends the same
 * bytes: the body the library builds from a reading equals the answer it was
 * read from.
 *
 * **Every line, or a throw naming the one not read.** A part is written back
 * whole, and SAP deletes what the write leaves out, so a reading that skipped
 * a line it did not understand would delete that entry on the next write. A
 * line out of the grammar throws, naming the part and the line.
 *
 * The shapes are those of `TextElementsDocument` in
 * `@mcp-abap-adt/interfaces-adt` 30.0.0.
 */

/** One text symbol: `@MaxLength:N`, then `KEY=text`. */
export interface ITextSymbolRead {
  key: string;
  text: string;
  maxLength: number;
}

/** One selection text: `NAME=text`, the name as SAP pads it. */
export interface ISelectionTextRead {
  name: string;
  text: string;
}

/** The list and column headings. */
export interface ITextHeadingsRead {
  listHeader: string;
  columnHeader1: string;
  columnHeader2: string;
  columnHeader3: string;
  columnHeader4: string;
}

/** The symbols part, read. */
export interface ITextSymbolsDocument {
  part: 'symbols';
  symbols: ITextSymbolRead[];
}

/** The selections part, read. */
export interface ISelectionTextsDocument {
  part: 'selections';
  selections: ISelectionTextRead[];
}

/** The headings part, read. */
export interface ITextHeadingsDocument {
  part: 'headings';
  headings: ITextHeadingsRead;
}

const CRLF = '\r\n';
const MAX_LENGTH = '@MaxLength:';

/** The lines of a part: `[]` for an empty answer, which is an empty part. */
function linesOf(body: string): string[] {
  return body === '' ? [] : body.split(CRLF);
}

/** The text before the first `=`, and the text after it. */
function keyAndText(
  line: string,
  part: string,
  index: number,
): { key: string; text: string } {
  const at = line.indexOf('=');
  if (at < 0) {
    throw new Error(
      `text elements ${part}: line ${index + 1} has no '=': '${line}'`,
    );
  }
  return { key: line.slice(0, at), text: line.slice(at + 1) };
}

/** A non-negative count written in decimal digits, nothing else. */
function count(value: string, part: string, index: number): number {
  let digits = value !== '';
  for (const character of value) {
    if (character < '0' || character > '9') digits = false;
  }
  if (!digits) {
    throw new Error(
      `text elements ${part}: line ${index + 1}: '${value}' is not a length`,
    );
  }
  return Number(value);
}

/**
 * The symbols part's text, read: blocks of `@MaxLength:N` and `KEY=text`,
 * an empty line between two blocks, as `map_text_elements_to_source` writes
 * them.
 */
export function readTextSymbols(body: string): ITextSymbolsDocument {
  const lines = linesOf(body);
  const symbols: ITextSymbolRead[] = [];
  let index = 0;
  while (index < lines.length) {
    if (symbols.length > 0) {
      if (lines[index] !== '') {
        throw new Error(
          `text elements symbols: line ${index + 1} is not the empty line between two symbols`,
        );
      }
      index += 1;
    }
    const lengthLine = lines[index];
    if (lengthLine === undefined || !lengthLine.startsWith(MAX_LENGTH)) {
      throw new Error(
        `text elements symbols: line ${index + 1} is not '${MAX_LENGTH}N'`,
      );
    }
    const maxLength = count(
      lengthLine.slice(MAX_LENGTH.length),
      'symbols',
      index,
    );
    const entryLine = lines[index + 1];
    if (entryLine === undefined) {
      throw new Error(
        `text elements symbols: line ${index + 2} is missing: '${MAX_LENGTH}${maxLength}' has no symbol after it`,
      );
    }
    const { key, text } = keyAndText(entryLine, 'symbols', index + 1);
    symbols.push({ key, text, maxLength });
    index += 2;
  }
  return { part: 'symbols', symbols };
}

/** The selections part's text, read: one `NAME=text` per line. */
export function readSelectionTexts(body: string): ISelectionTextsDocument {
  const selections = linesOf(body).map((line, index) => {
    const { key, text } = keyAndText(line, 'selections', index);
    return { name: key, text };
  });
  return { part: 'selections', selections };
}

/** A heading line `name=…`, at its place: its text. */
function heading(lines: string[], index: number, name: string): string {
  const { key, text } = keyAndText(lines[index] ?? '', 'headings', index);
  if (key !== name) {
    throw new Error(
      `text elements headings: line ${index + 1} is '${key}', not '${name}'`,
    );
  }
  return text;
}

/**
 * The headings part's text, read: `listHeader=…`, an empty line, and
 * `columnHeader_1=…` to `columnHeader_4=…` — six lines, in that order.
 */
export function readTextHeadings(body: string): ITextHeadingsDocument {
  const lines = linesOf(body);
  if (lines.length !== 6) {
    throw new Error(`text elements headings: ${lines.length} line(s), not 6`);
  }
  if (lines[1] !== '') {
    throw new Error(
      'text elements headings: line 2 is not the empty line after the list header',
    );
  }
  return {
    part: 'headings',
    headings: {
      listHeader: heading(lines, 0, 'listHeader'),
      columnHeader1: heading(lines, 2, 'columnHeader_1'),
      columnHeader2: heading(lines, 3, 'columnHeader_2'),
      columnHeader3: heading(lines, 4, 'columnHeader_3'),
      columnHeader4: heading(lines, 5, 'columnHeader_4'),
    },
  };
}

/** The answer's body, `''` when it carried none. */
function bodyOf(data: unknown): string {
  return typeof data === 'string' ? data : '';
}

/** A read of the symbols part, or the answer of its write, read. */
export const textSymbols: IResultStrategy<ITextSymbolsDocument> = (answer) =>
  readTextSymbols(bodyOf(answer.data));

/** A read of the selections part, or the answer of its write, read. */
export const selectionTexts: IResultStrategy<ISelectionTextsDocument> = (
  answer,
) => readSelectionTexts(bodyOf(answer.data));

/** A read of the headings part, or the answer of its write, read. */
export const textHeadings: IResultStrategy<ITextHeadingsDocument> = (answer) =>
  readTextHeadings(bodyOf(answer.data));
