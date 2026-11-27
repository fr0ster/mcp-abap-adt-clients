/**
 * D1 of #304: every member that addresses one object requires the object's
 * own name — omitting it is refused, the full call compiles. One member per
 * family (its lock); the parented ones (function module and include) name
 * their group too.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */
import type { AdtClient } from '../../clients/AdtClient';

declare const client: AdtClient;

export async function identities(): Promise<void> {
  // @ts-expect-error -- className is required
  await client.getClass().lock({});
  await client.getClass().lock({ className: 'ZOBJ' });
  // @ts-expect-error -- interfaceName is required
  await client.getInterface().lock({});
  await client.getInterface().lock({ interfaceName: 'ZOBJ' });
  // @ts-expect-error -- programName is required
  await client.getProgram().lock({});
  await client.getProgram().lock({ programName: 'ZOBJ' });
  // @ts-expect-error -- functionGroupName is required
  await client.getFunctionGroup().lock({});
  await client.getFunctionGroup().lock({ functionGroupName: 'ZOBJ' });
  // @ts-expect-error -- includeName is required
  await client.getInclude().lock({});
  await client.getInclude().lock({ includeName: 'ZOBJ' });
  // @ts-expect-error -- ddlName is required
  await client.getDdl().lock({});
  await client.getDdl().lock({ ddlName: 'ZOBJ' });
  // @ts-expect-error -- domainName is required
  await client.getDomain().lock({});
  await client.getDomain().lock({ domainName: 'ZOBJ' });
  // @ts-expect-error -- dataElementName is required
  await client.getDataElement().lock({});
  await client.getDataElement().lock({ dataElementName: 'ZOBJ' });
  // @ts-expect-error -- structureName is required
  await client.getStructure().lock({});
  await client.getStructure().lock({ structureName: 'ZOBJ' });
  // @ts-expect-error -- tableName is required
  await client.getTable().lock({});
  await client.getTable().lock({ tableName: 'ZOBJ' });
  // @ts-expect-error -- tableTypeName is required
  await client.getTableType().lock({});
  await client.getTableType().lock({ tableTypeName: 'ZOBJ' });
  // @ts-expect-error -- packageName is required
  await client.getPackage().lock({});
  await client.getPackage().lock({ packageName: 'ZOBJ' });
  // @ts-expect-error -- name is required
  await client.getMessageClass().lock({});
  await client.getMessageClass().lock({ name: 'ZOBJ' });
  // @ts-expect-error -- name is required
  await client.getBehaviorDefinition().lock({});
  await client.getBehaviorDefinition().lock({ name: 'ZOBJ' });
  // @ts-expect-error -- name is required
  await client.getMetadataExtension().lock({});
  await client.getMetadataExtension().lock({ name: 'ZOBJ' });
  // @ts-expect-error -- serviceDefinitionName is required
  await client.getServiceDefinition().lock({});
  await client.getServiceDefinition().lock({ serviceDefinitionName: 'ZOBJ' });
  // @ts-expect-error -- bindingName is required
  await client.getServiceBinding().lock({});
  await client.getServiceBinding().lock({ bindingName: 'ZOBJ' });
  // @ts-expect-error -- accessControlName is required
  await client.getAccessControl().lock({});
  await client.getAccessControl().lock({ accessControlName: 'ZOBJ' });
  // @ts-expect-error -- featureToggleName is required
  await client.getFeatureToggle().lock({});
  await client.getFeatureToggle().lock({ featureToggleName: 'ZOBJ' });
  // @ts-expect-error -- transformationName is required
  await client.getTransformation().lock({});
  await client.getTransformation().lock({ transformationName: 'ZOBJ' });
  // @ts-expect-error -- scalarFunctionName is required
  await client.getScalarFunction().lock({});
  await client.getScalarFunction().lock({ scalarFunctionName: 'ZOBJ' });
  // @ts-expect-error -- authorizationFieldName is required
  await client.getAuthorizationField().lock({});
  await client.getAuthorizationField().lock({ authorizationFieldName: 'ZOBJ' });
  // @ts-expect-error -- appendStructureName is required
  await client.getAppendStructure().lock({});
  await client.getAppendStructure().lock({ appendStructureName: 'ZOBJ' });
  // @ts-expect-error -- transportNumber is required
  await client.getRequest().readMetadata({});
  await client.getRequest().readMetadata({ transportNumber: 'ZOBJ' });
  // @ts-expect-error -- the module's own name is required beside its group
  await client.getFunctionModule().lock({ functionGroupName: 'ZFG' });
  await client
    .getFunctionModule()
    .lock({ functionGroupName: 'ZFG', functionModuleName: 'ZFM' });
}
