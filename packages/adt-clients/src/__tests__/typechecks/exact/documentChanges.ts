/**
 * Every optional field of the document patches' inputs takes `undefined`
 * under `exactOptionalPropertyTypes`: a caller passing a value that may be
 * absent (`string | undefined`) compiles, and the patch already reads
 * `undefined` as "not touched".
 *
 * Compiled by `npm run test:check` under `tsconfig.test.exact.json`, which
 * turns the option on; a field declared `?: T` alone fails it. The types are
 * imported as a consumer imports them, from the built declarations (`npm run
 * build` first), so the package's own sources are not compiled under an
 * option they are not written for. Nothing here runs.
 */

import {
  type IDataElementChanges,
  type IDomainChanges,
  type IDomainFixedValue,
  type IFunctionGroupChanges,
  type IMessageClassChanges,
  type IPackageChanges,
  type ITableTypeChanges,
  patchFunctionGroupDocument,
  patchMessageClassDocument,
  patchPackageDocument,
} from '@mcp-abap-adt/adt-clients/core';

export const fixedValue: IDomainFixedValue = {
  low: 'A',
  high: undefined,
  text: 'a',
};

export const domain: IDomainChanges = {
  description: undefined,
  dataType: undefined,
  length: undefined,
  decimals: undefined,
  conversionExit: undefined,
  signExists: undefined,
  lowercase: undefined,
  valueTable: undefined,
  fixedValues: undefined,
};

export const dataElement: IDataElementChanges = {
  description: undefined,
  typeKind: undefined,
  typeName: undefined,
  dataType: undefined,
  length: undefined,
  decimals: undefined,
  shortLabel: undefined,
  mediumLabel: undefined,
  longLabel: undefined,
  headingLabel: undefined,
  shortLength: undefined,
  mediumLength: undefined,
  longLength: undefined,
  headingLength: undefined,
  searchHelp: undefined,
  searchHelpParameter: undefined,
  setGetParameter: undefined,
};

export const tableType: ITableTypeChanges = {
  description: undefined,
  rowTypeKind: undefined,
  rowTypeName: undefined,
  dataType: undefined,
  length: undefined,
  decimals: undefined,
  accessType: undefined,
  keyDefinition: undefined,
  keyKind: undefined,
};

export const functionGroup: IFunctionGroupChanges = { description: undefined };

export const messageClass: IMessageClassChanges = { description: undefined };

export const packageChanges: IPackageChanges = {
  description: undefined,
  responsible: undefined,
  masterSystem: undefined,
  packageType: undefined,
  recordChanges: undefined,
  superPackage: undefined,
  softwareComponent: undefined,
  transportLayer: undefined,
};

/** The inputs as the patches with a description alone take them; never called. */
export const patchesTakeUndefined = (document: string): void => {
  const description: string | undefined = undefined;
  patchFunctionGroupDocument(document, { description });
  patchMessageClassDocument(document, { description });
  patchPackageDocument(document, { description, responsible: description });
};
