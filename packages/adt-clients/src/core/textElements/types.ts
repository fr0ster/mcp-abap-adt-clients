/**
 * Text elements module type definitions: the contract's
 * (`@mcp-abap-adt/interfaces-adt` 30.0.0, `IAdtTextElements.ts`), and the
 * shipped result set.
 */

import type { ITextElementsResults } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

export type {
  IAdtTextElementsReadOptions,
  IAdtTextElementsUpdateOptions,
  ISelectionText,
  ITextElementsConfig,
  ITextElementsPartConfig,
  ITextElementsResults,
  ITextElementsUpdateConfig,
  ITextHeadings,
  ITextSymbol,
  TextElementsDocument,
  TextElementsObjectKind,
  TextElementsPart,
  TextElementsReadVersion,
} from '@mcp-abap-adt/interfaces-adt';

/** The part's text a read answers, as it arrived. */
export type TextElementsSource = string;

/** What a write answers: the part as saved, as it arrived. */
export type TextElementsUpdated = string;

/**
 * The shipped default: every member answers its document as it arrived.
 * `textSymbols`, `selectionTexts` and `textHeadings` in
 * `@mcp-abap-adt/adt-strategies` read the parts.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const textElementsDocuments = {
  source: rawDocument,
  updated: rawDocument,
} satisfies ITextElementsResults;
