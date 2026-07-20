import {
  type GeneratedServiceType,
  SERVICE_BINDING_VARIANT_MAP,
  type ServiceBindingType,
  type ServiceBindingVariant,
  type ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces';

// Types defined in @mcp-abap-adt/interfaces
export type {
  AdtServiceBindingType,
  DesiredPublicationState,
  GeneratedServiceType,
  IActivateServiceBindingParams,
  IAdtService,
  IAdtServiceBinding,
  IAdtServiceOperationOptions,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateAndGenerateServiceBindingParams,
  ICreateAndGenerateServiceBindingParamsLegacy,
  ICreateServiceBindingParams,
  IDeleteServiceBindingParams,
  IGenerateServiceBindingParams,
  IGetServiceBindingODataParams,
  IPublishODataV2Params,
  IReadServiceBindingParams,
  IServiceBindingConfig,
  IServiceBindingState,
  ITransportCheckServiceBindingParams,
  IUnpublishODataV2Params,
  IUpdateServiceBindingParams,
  IValidateServiceBindingParams,
  ServiceBindingType,
  ServiceBindingVariant,
  ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces';
export { SERVICE_BINDING_VARIANT_MAP } from '@mcp-abap-adt/interfaces';

export function resolveBindingVariant(variant: ServiceBindingVariant): {
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory: '0' | '1';
  serviceType: GeneratedServiceType;
} {
  return SERVICE_BINDING_VARIANT_MAP[variant];
}
