/**
 * The package's document patch: the document `readMetadata` answered, with
 * the fields the caller names changed — and nothing else.
 *
 * A package document names other packages: its own `adtcore:packageRef`,
 * `pak:superPackage` and each `pak:subPackages/pak:packageRef`, each with
 * that package's `adtcore:description`. The description, the responsible and
 * the master system are the root's own; the software component and the
 * transport layer are the ones under `pak:transport`.
 */
import {
  DocumentEdits,
  type DocumentPatch,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface IPackageChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string | undefined;
  /** The root's `adtcore:responsible`. */
  readonly responsible?: string | undefined;
  /** The root's `adtcore:masterSystem`. */
  readonly masterSystem?: string | undefined;
  /** `pak:attributes/@pak:packageType`. */
  readonly packageType?: string | undefined;
  /** `pak:attributes/@pak:recordChanges`, `true` / `false`. */
  readonly recordChanges?: boolean | undefined;
  /** The super package's name; the reference keeps nothing of the old one. */
  readonly superPackage?: string | undefined;
  /** `pak:transport/pak:softwareComponent/@pak:name`. */
  readonly softwareComponent?: string | undefined;
  /** `pak:transport/pak:transportLayer/@pak:name`. */
  readonly transportLayer?: string | undefined;
}

const ROOT = 'pak:package';
const ATTRIBUTES = ['pak:attributes'];

/** The package's document with `changes` written, or why it cannot be. */
export function patchPackageDocument(
  document: string,
  changes: IPackageChanges,
): DocumentPatch<keyof IPackageChanges> {
  const edits = new DocumentEdits<keyof IPackageChanges>()
    .attribute('description', [], 'adtcore:description', changes.description)
    .attribute('responsible', [], 'adtcore:responsible', changes.responsible)
    .attribute('masterSystem', [], 'adtcore:masterSystem', changes.masterSystem)
    .attribute(
      'packageType',
      ATTRIBUTES,
      'pak:packageType',
      changes.packageType,
    )
    .attribute(
      'recordChanges',
      ATTRIBUTES,
      'pak:recordChanges',
      changes.recordChanges === undefined
        ? undefined
        : String(changes.recordChanges),
    )
    .reference('superPackage', ['pak:superPackage'], changes.superPackage)
    .attribute(
      'softwareComponent',
      ['pak:transport', 'pak:softwareComponent'],
      'pak:name',
      changes.softwareComponent,
    )
    .attribute(
      'transportLayer',
      ['pak:transport', 'pak:transportLayer'],
      'pak:name',
      changes.transportLayer,
    );
  return patchDocument(document, ROOT, edits.list);
}
