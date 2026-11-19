/**
 * Text elements module type definitions.
 *
 * The shapes are those of `IAdtTextElements.ts` in
 * `@mcp-abap-adt/interfaces-adt` 30.0.0, declared here until this package
 * depends on that release; then they come from the contract and these
 * declarations go.
 */

import type {
  AdtReadVersion,
  IAdtAnalyseOptions,
  IAdtError,
} from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';
import type { TextElementsPartInput } from './body';

/** The objects that have text elements. */
export type TextElementsObjectKind = 'program' | 'class' | 'functionGroup';

/** The parts of the text elements, each its own sub-resource. */
export type TextElementsPart = 'symbols' | 'selections' | 'headings';

/** The parts each object has: a class has text symbols only. */
interface ITextElementsPartsByKind {
  readonly program: TextElementsPart;
  readonly class: 'symbols';
  readonly functionGroup: TextElementsPart;
}

/** The text elements of one object: what `lock` and `unlock` take. */
export interface ITextElementsConfig {
  readonly objectKind: TextElementsObjectKind;
  objectName: string;
  transportRequest?: string | undefined;
}

/** One part of one object's text elements: what a read takes. */
export type ITextElementsPartConfig = {
  [K in TextElementsObjectKind]: {
    readonly objectKind: K;
    objectName: string;
    readonly part: ITextElementsPartsByKind[K];
  };
}[TextElementsObjectKind];

/** What a write takes: the object, and the whole of one part. */
export type ITextElementsUpdateConfig = {
  [K in TextElementsObjectKind]: {
    readonly objectKind: K;
    objectName: string;
    transportRequest?: string | undefined;
  } & Extract<
    TextElementsPartInput,
    { readonly part: ITextElementsPartsByKind[K] }
  >;
}[TextElementsObjectKind];

/** The version a read asks for; absent, SAP's working area. */
export type TextElementsReadVersion = AdtReadVersion;

/** The options of a read: the error strategy and a timeout, no write fields. */
export type TextElementsReadOptions<E extends IAdtError = IAdtError> =
  IAdtAnalyseOptions<E> & {
    timeout?: number | undefined;
    source?: never;
    lockHandle?: never;
    ifMatch?: never;
  };

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
};
