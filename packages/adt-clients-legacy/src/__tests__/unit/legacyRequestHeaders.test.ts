/**
 * The root package's header claim (`requestHeaders.test.ts` there), held
 * against the legacy classes: every header member a legacy client's handler
 * has sends the caller's pair and nothing else, or answers a refusal before
 * any request. The table is closed here too: every class method in this
 * package's `src` named like a header member is reached by a row.
 */

import { join } from 'node:path';
import { utilDocuments } from '@mcp-abap-adt/adt-clients';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { createLibraryLogger } from '../../../../adt-clients/src/__tests__/helpers/testLogger';
import {
  expectCarriesItsPair,
  objectRows,
  ownerOfRow,
  type Row,
  requestRows,
  scanImplementations,
  utilRows,
} from '../../../../adt-clients/src/__tests__/unit/requestHeadersGuard';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { AdtUtilsLegacy } from '../../core/shared/AdtUtilsLegacy';

/**
 * Members whose implementation sends no request at all: the legacy refusals of
 * an endpoint a legacy system does not have. They answer before any request,
 * so there is no wire to carry the pair.
 */
const SENDS_NO_REQUEST: ReadonlySet<string> = new Set([
  'AdtPackageLegacy.create',
  'AdtPackageLegacy.updateMetadata',
  'AdtPackageLegacy.delete',
  'AdtRequestLegacy.create',
  'AdtRequestLegacy.updateMetadata',
  'AdtRequestLegacy.delete',
  'AdtRequestLegacy.checkDeletion',
  'AdtRequestLegacy.addObject',
  'AdtRequestLegacy.removeObject',
  'AdtRequestLegacy.moveObjects',
  'AdtRequestLegacy.createTask',
  'AdtRequestLegacy.changeTaskType',
  'AdtUtilsLegacy.getSqlQuery',
  'AdtUtilsLegacy.getTableContents',
  // No deletion API on 7.40 (spec §4.3, §5).
  'AdtPackageLegacy.checkDeletion',
  'AdtPackageLegacy.check',
  'AdtUtilsLegacy.checkDeletionGroup',
  'AdtUtilsLegacy.deleteObjectsGroup',
  'AdtClassLegacy.checkDeletion',
  'AdtProgramLegacy.checkDeletion',
  'AdtInterfaceLegacy.checkDeletion',
  'AdtFunctionGroupLegacy.checkDeletion',
  'AdtFunctionModuleLegacy.checkDeletion',
  'AdtDdlLegacy.checkDeletion',
  'AdtIncludeLegacy.checkDeletion',
  'AdtFunctionIncludeLegacy.checkDeletion',
  'AdtFunctionIncludeLegacy.delete',
  'AdtMessageClassLegacy.checkDeletion',
  // Measured on 7.40 SP04 (B4-cycles-20261026-2019): refused, no request
  // (readTransport and the DDL version reads take no headers: not in this table).
  'AdtMessageClassLegacy.updateMetadata',
  // Not measured on 7.40: refused, no request.
  'AdtClassLegacy.updateMetadata',
  'AdtProgramLegacy.updateMetadata',
  'AdtInterfaceLegacy.updateMetadata',
  'AdtFunctionModuleLegacy.updateMetadata',
  'AdtDdlLegacy.updateMetadata',
  'AdtIncludeLegacy.updateMetadata',
  // Measured 404 on 7.40 (spec §10.2).
  'AdtUtilsLegacy.getWhereUsed',
  'AdtUtilsLegacy.getWhereUsedScope',
  'AdtUtilsLegacy.getVirtualFoldersContents',
  // No /activation/runs on 7.40 (fr0ster/mcp-abap-adt#351).
  'AdtUtilsLegacy.activateObjectsGroup',
  // The absent types' operations (C5): every one refuses, nothing is sent.
  'AdtDomainAbsentLegacy.create',
  'AdtDomainAbsentLegacy.updateMetadata',
  'AdtDomainAbsentLegacy.checkDeletion',
  'AdtDomainAbsentLegacy.delete',
  'AdtDomainAbsentLegacy.activate',
  'AdtDomainAbsentLegacy.check',
  'AdtDataElementAbsentLegacy.create',
  'AdtDataElementAbsentLegacy.updateMetadata',
  'AdtDataElementAbsentLegacy.checkDeletion',
  'AdtDataElementAbsentLegacy.delete',
  'AdtDataElementAbsentLegacy.activate',
  'AdtDataElementAbsentLegacy.check',
  'AdtStructureAbsentLegacy.create',
  'AdtStructureAbsentLegacy.update',
  'AdtStructureAbsentLegacy.updateMetadata',
  'AdtStructureAbsentLegacy.checkDeletion',
  'AdtStructureAbsentLegacy.delete',
  'AdtStructureAbsentLegacy.activate',
  'AdtStructureAbsentLegacy.check',
  'AdtTableAbsentLegacy.create',
  'AdtTableAbsentLegacy.update',
  'AdtTableAbsentLegacy.updateMetadata',
  'AdtTableAbsentLegacy.checkDeletion',
  'AdtTableAbsentLegacy.delete',
  'AdtTableAbsentLegacy.activate',
  'AdtTableAbsentLegacy.check',
  'AdtTableSettingsAbsentLegacy.updateMetadata',
  'AdtTextElementsAbsentLegacy.update',
  'AdtDdicTableTypeAbsentLegacy.create',
  'AdtDdicTableTypeAbsentLegacy.updateMetadata',
  'AdtDdicTableTypeAbsentLegacy.checkDeletion',
  'AdtDdicTableTypeAbsentLegacy.delete',
  'AdtDdicTableTypeAbsentLegacy.activate',
  'AdtDdicTableTypeAbsentLegacy.check',
  'AdtAccessControlAbsentLegacy.create',
  'AdtAccessControlAbsentLegacy.update',
  'AdtAccessControlAbsentLegacy.updateMetadata',
  'AdtAccessControlAbsentLegacy.checkDeletion',
  'AdtAccessControlAbsentLegacy.delete',
  'AdtAccessControlAbsentLegacy.activate',
  'AdtAccessControlAbsentLegacy.check',
  'AdtServiceDefinitionAbsentLegacy.create',
  'AdtServiceDefinitionAbsentLegacy.update',
  'AdtServiceDefinitionAbsentLegacy.updateMetadata',
  'AdtServiceDefinitionAbsentLegacy.checkDeletion',
  'AdtServiceDefinitionAbsentLegacy.delete',
  'AdtServiceDefinitionAbsentLegacy.activate',
  'AdtServiceDefinitionAbsentLegacy.check',
  'AdtServiceBindingAbsentLegacy.create',
  'AdtServiceBindingAbsentLegacy.update',
  'AdtServiceBindingAbsentLegacy.updateMetadata',
  'AdtServiceBindingAbsentLegacy.checkDeletion',
  'AdtServiceBindingAbsentLegacy.delete',
  'AdtServiceBindingAbsentLegacy.activate',
  'AdtServiceBindingAbsentLegacy.check',
  'AdtBehaviorDefinitionAbsentLegacy.create',
  'AdtBehaviorDefinitionAbsentLegacy.update',
  'AdtBehaviorDefinitionAbsentLegacy.updateMetadata',
  'AdtBehaviorDefinitionAbsentLegacy.checkDeletion',
  'AdtBehaviorDefinitionAbsentLegacy.delete',
  'AdtBehaviorDefinitionAbsentLegacy.activate',
  'AdtBehaviorDefinitionAbsentLegacy.check',
  'AdtBehaviorImplementationAbsentLegacy.create',
  'AdtBehaviorImplementationAbsentLegacy.update',
  'AdtBehaviorImplementationAbsentLegacy.checkDeletion',
  'AdtBehaviorImplementationAbsentLegacy.delete',
  'AdtBehaviorImplementationAbsentLegacy.activate',
  'AdtBehaviorImplementationAbsentLegacy.check',
  'AdtMetadataExtensionAbsentLegacy.create',
  'AdtMetadataExtensionAbsentLegacy.update',
  'AdtMetadataExtensionAbsentLegacy.updateMetadata',
  'AdtMetadataExtensionAbsentLegacy.checkDeletion',
  'AdtMetadataExtensionAbsentLegacy.delete',
  'AdtMetadataExtensionAbsentLegacy.activate',
  'AdtMetadataExtensionAbsentLegacy.check',
  'AdtEnhancementAbsentLegacy.create',
  'AdtEnhancementAbsentLegacy.updateMetadata',
  'AdtEnhancementAbsentLegacy.update',
  'AdtEnhancementAbsentLegacy.checkDeletion',
  'AdtEnhancementAbsentLegacy.delete',
  'AdtEnhancementAbsentLegacy.activate',
  'AdtEnhancementAbsentLegacy.check',
  'AdtAuthorizationFieldAbsentLegacy.create',
  'AdtAuthorizationFieldAbsentLegacy.updateMetadata',
  'AdtAuthorizationFieldAbsentLegacy.checkDeletion',
  'AdtAuthorizationFieldAbsentLegacy.delete',
  'AdtAuthorizationFieldAbsentLegacy.activate',
  'AdtAuthorizationFieldAbsentLegacy.check',
  'AdtFeatureToggleAbsentLegacy.create',
  'AdtFeatureToggleAbsentLegacy.updateMetadata',
  'AdtFeatureToggleAbsentLegacy.update',
  'AdtFeatureToggleAbsentLegacy.checkDeletion',
  'AdtFeatureToggleAbsentLegacy.delete',
  'AdtFeatureToggleAbsentLegacy.activate',
  'AdtFeatureToggleAbsentLegacy.check',
  'AdtFeatureToggleAbsentLegacy.checkState',
  'AdtTransformationAbsentLegacy.create',
  'AdtTransformationAbsentLegacy.update',
  'AdtTransformationAbsentLegacy.updateMetadata',
  'AdtTransformationAbsentLegacy.checkDeletion',
  'AdtTransformationAbsentLegacy.delete',
  'AdtTransformationAbsentLegacy.activate',
  'AdtTransformationAbsentLegacy.check',
  'AdtScalarFunctionAbsentLegacy.create',
  'AdtScalarFunctionAbsentLegacy.update',
  'AdtScalarFunctionAbsentLegacy.updateMetadata',
  'AdtScalarFunctionAbsentLegacy.checkDeletion',
  'AdtScalarFunctionAbsentLegacy.delete',
  'AdtScalarFunctionAbsentLegacy.activate',
  'AdtScalarFunctionAbsentLegacy.check',
  'AdtScalarFunctionImplementationAbsentLegacy.create',
  'AdtScalarFunctionImplementationAbsentLegacy.update',
  'AdtScalarFunctionImplementationAbsentLegacy.updateMetadata',
  'AdtScalarFunctionImplementationAbsentLegacy.checkDeletion',
  'AdtScalarFunctionImplementationAbsentLegacy.delete',
  'AdtScalarFunctionImplementationAbsentLegacy.activate',
  'AdtScalarFunctionImplementationAbsentLegacy.check',
  'AdtAppendStructureAbsentLegacy.create',
  'AdtAppendStructureAbsentLegacy.update',
  'AdtAppendStructureAbsentLegacy.checkDeletion',
  'AdtAppendStructureAbsentLegacy.delete',
  'AdtAppendStructureAbsentLegacy.activate',
  'AdtAppendStructureAbsentLegacy.check',
]);

const legacy = (connection: IAbapConnection) =>
  new AdtClientLegacy(connection, createLibraryLogger());

const ROWS: Row[] = [
  // @ts-expect-error -- the modern harness drives a 7.40 client as a caller outside the type system would: its gates refuse what 7.40 does not serve, and the run proves the runtime refusals
  ...objectRows(legacy, 'legacy '),
  // @ts-expect-error -- the modern harness drives a 7.40 client as a caller outside the type system would: its gates refuse what 7.40 does not serve, and the run proves the runtime refusals
  ...requestRows(legacy, 'legacy '),
  ...utilRows(
    (connection) =>
      // @ts-expect-error -- the modern harness drives the 7.40 utilities, whose codes are 7.40's, as a caller outside the type system would
      new AdtUtilsLegacy(connection, {
        logger: createLibraryLogger(),
        results: utilDocuments,
      }),
    'legacy ',
  ),
];

let scanned: ReturnType<typeof scanImplementations> | undefined;

/** The scan of this package's `src`, made once. */
function SCAN(): ReturnType<typeof scanImplementations> {
  scanned ??= scanImplementations(join(__dirname, '..', '..'));
  return scanned;
}

describe('a request carries exactly the headers its caller gave', () => {
  for (const row of ROWS) {
    it(`${row.name}.${row.member}`, async () => {
      await expectCarriesItsPair(row, SENDS_NO_REQUEST);
    });
  }
});

describe('the table covers every legacy implementation', () => {
  it('every class implementing a header member is reached by a row', () => {
    const reached = new Set(ROWS.map(ownerOfRow));
    const { found } = SCAN();
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((impl) => !reached.has(impl))).toEqual([]);
  });

  it('every computed member name in a scanned class resolves', () => {
    expect(SCAN().unresolvedNames).toEqual([]);
  });

  it('every exclusion still names a declared method', () => {
    const declared = new Set(SCAN().found);
    for (const name of SENDS_NO_REQUEST) expect(declared).toContain(name);
  });
});
