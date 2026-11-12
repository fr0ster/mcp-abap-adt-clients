/**
 * The data element's document patch: the document `readMetadata` answered,
 * with the fields the caller names changed — and nothing else.
 *
 * The root is `blue:wbobj`; the type's own fields sit in its
 * `dtel:dataElement`. Values are the caller's: a label's length is never
 * derived from the label, and the `*MaxLength` elements are SAP's.
 */
import type { IDataElementConfig } from '@mcp-abap-adt/interfaces-adt';
import {
  DocumentEdits,
  type DocumentPatch,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface IDataElementChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string | undefined;
  readonly typeKind?: IDataElementConfig['typeKind'] | undefined;
  /** Written as given. */
  readonly typeName?: string | undefined;
  readonly dataType?: string | undefined;
  /** `dtel:dataTypeLength`, SAP's six digits. */
  readonly length?: number | undefined;
  /** `dtel:dataTypeDecimals`, SAP's six digits. */
  readonly decimals?: number | undefined;
  readonly shortLabel?: string | undefined;
  readonly mediumLabel?: string | undefined;
  readonly longLabel?: string | undefined;
  readonly headingLabel?: string | undefined;
  /** SAP's two digits; never derived from the label. */
  readonly shortLength?: number | undefined;
  readonly mediumLength?: number | undefined;
  readonly longLength?: number | undefined;
  readonly headingLength?: number | undefined;
  readonly searchHelp?: string | undefined;
  readonly searchHelpParameter?: string | undefined;
  readonly setGetParameter?: string | undefined;
}

const ROOT = 'blue:wbobj';

function at(name: string): string[] {
  return ['dtel:dataElement', name];
}

/** The data element's document with `changes` written, or why it cannot be. */
export function patchDataElementDocument(
  document: string,
  changes: IDataElementChanges,
): DocumentPatch<keyof IDataElementChanges> {
  const edits = new DocumentEdits<keyof IDataElementChanges>()
    .attribute('description', [], 'adtcore:description', changes.description)
    .text('typeKind', at('dtel:typeKind'), changes.typeKind)
    .text('typeName', at('dtel:typeName'), changes.typeName)
    .text('dataType', at('dtel:dataType'), changes.dataType)
    .digits('length', at('dtel:dataTypeLength'), changes.length, 6)
    .digits('decimals', at('dtel:dataTypeDecimals'), changes.decimals, 6)
    .text('shortLabel', at('dtel:shortFieldLabel'), changes.shortLabel)
    .text('mediumLabel', at('dtel:mediumFieldLabel'), changes.mediumLabel)
    .text('longLabel', at('dtel:longFieldLabel'), changes.longLabel)
    .text('headingLabel', at('dtel:headingFieldLabel'), changes.headingLabel)
    .digits('shortLength', at('dtel:shortFieldLength'), changes.shortLength, 2)
    .digits(
      'mediumLength',
      at('dtel:mediumFieldLength'),
      changes.mediumLength,
      2,
    )
    .digits('longLength', at('dtel:longFieldLength'), changes.longLength, 2)
    .digits(
      'headingLength',
      at('dtel:headingFieldLength'),
      changes.headingLength,
      2,
    )
    .text('searchHelp', at('dtel:searchHelp'), changes.searchHelp)
    .text(
      'searchHelpParameter',
      at('dtel:searchHelpParameter'),
      changes.searchHelpParameter,
    )
    .text(
      'setGetParameter',
      at('dtel:setGetParameter'),
      changes.setGetParameter,
    );
  return patchDocument(document, ROOT, edits.list);
}
