/**
 * D4 of #304 (the owner's decision): a field a create's request builder always
 * reads is required in the member's type, so leaving it out is a compile
 * error instead of a `TypeError` inside the builder. Each call below leaves one
 * out; the full calls compile.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../clients/AdtClient';

declare const client: AdtClient;
declare const headers: IAdtHeaders;
const options = { headers };

export async function requiredOnCreate(): Promise<void> {
  const bdef = {
    name: 'ZBDEF',
    packageName: 'P',
    implementationType: 'Managed' as const,
  };
  // @ts-expect-error -- description is read by the builder
  await client.getBehaviorDefinition().create(bdef, options);
  await client
    .getBehaviorDefinition()
    .create({ ...bdef, description: 'd' }, options);

  const fugr = { functionGroupName: 'ZFG', packageName: 'P' };
  // @ts-expect-error -- description is read by the builder
  await client.getFunctionGroup().create(fugr, options);
  await client
    .getFunctionGroup()
    .create({ ...fugr, description: 'd' }, options);

  const func = {
    functionGroupName: 'ZFG',
    functionModuleName: 'ZFM',
    packageName: 'P',
  };
  // @ts-expect-error -- description is read by the builder
  await client.getFunctionModule().create(func, options);
  await client
    .getFunctionModule()
    .create({ ...func, description: 'd' }, options);

  const intf = { interfaceName: 'ZIF', packageName: 'P' };
  // @ts-expect-error -- description is read by the builder
  await client.getInterface().create(intf, options);
  await client.getInterface().create({ ...intf, description: 'd' }, options);

  const ddlx = { name: 'ZDDLX', packageName: 'P' };
  // @ts-expect-error -- description is read by the builder
  await client.getMetadataExtension().create(ddlx, options);
  await client
    .getMetadataExtension()
    .create({ ...ddlx, description: 'd' }, options);

  const stru = { structureName: 'ZST', packageName: 'P' };
  // @ts-expect-error -- description is read by the builder
  await client.getStructure().create(stru, options);
  await client.getStructure().create({ ...stru, description: 'd' }, options);

  const srvb = {
    bindingName: 'ZSB',
    packageName: 'P',
    description: 'd',
    serviceName: 'ZS',
    serviceDefinitionName: 'ZSD',
    serviceVersion: '0001',
    bindingVariant: 'ODATA_V4_UI' as const,
  };
  await client.getServiceBinding().create(srvb, options);
  const { description: _d, ...noDescription } = srvb;
  // @ts-expect-error -- description is read by the builder
  await client.getServiceBinding().create(noDescription, options);
  const { serviceName: _n, ...noServiceName } = srvb;
  // @ts-expect-error -- serviceName is read by the builder
  await client.getServiceBinding().create(noServiceName, options);
  const { serviceDefinitionName: _s, ...noDefinition } = srvb;
  // @ts-expect-error -- serviceDefinitionName is read by the builder
  await client.getServiceBinding().create(noDefinition, options);
  const { serviceVersion: _v, ...noVersion } = srvb;
  // @ts-expect-error -- serviceVersion is read by the builder
  await client.getServiceBinding().create(noVersion, options);
  const { bindingVariant: _b, ...noVariant } = srvb;
  // @ts-expect-error -- bindingVariant is read by the builder
  await client.getServiceBinding().create(noVariant, options);

  const enho = { enhancementName: 'ZE', packageName: 'P', description: 'd' };
  // @ts-expect-error -- the enhancement type is read by the builder
  await client.getEnhancement().create(enho, options);
  await client
    .getEnhancement()
    .create({ ...enho, enhancementType: 'enhoxhh' }, options);
}
