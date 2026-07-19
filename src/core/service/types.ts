import {
  type IActivateServiceBindingParams,
  type IAdtObject,
  type IAdtObjectState,
  type IAdtOperationOptions,
  type IAdtResponse,
  type ICheckServiceBindingParams,
  type IClassifyServiceBindingParams,
  type ICreateAndGenerateServiceBindingParams,
  type ICreateServiceBindingParams,
  type IDeleteServiceBindingParams,
  type IGenerateServiceBindingParams,
  type IGetServiceBindingODataParams,
  type IPublishODataV2Params,
  type IReadServiceBindingParams,
  type ITransportCheckServiceBindingParams,
  type IUnpublishODataV2Params,
  type IUpdateServiceBindingParams,
  type IValidateServiceBindingParams,
  SERVICE_BINDING_VARIANT_MAP,
  type ServiceBindingVariant,
} from '@mcp-abap-adt/interfaces';

// Low-level function parameters — defined in @mcp-abap-adt/interfaces
export type {
  IActivateServiceBindingParams,
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
  ITransportCheckServiceBindingParams,
  IUnpublishODataV2Params,
  IUpdateServiceBindingParams,
  IValidateServiceBindingParams,
  ServiceBindingVariant,
} from '@mcp-abap-adt/interfaces';
export { SERVICE_BINDING_VARIANT_MAP } from '@mcp-abap-adt/interfaces';

export type ServiceBindingType = 'ODATA' | 'INA' | 'SQL';
export type ServiceBindingVersion = 'V2' | 'V4' | '0001' | '0000' | string;
export type GeneratedServiceType = 'odatav2' | 'odatav4';
export type DesiredPublicationState = 'published' | 'unpublished' | 'unchanged';

export function resolveBindingVariant(variant: ServiceBindingVariant): {
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory: '0' | '1';
  serviceType: GeneratedServiceType;
} {
  return SERVICE_BINDING_VARIANT_MAP[variant];
}

export interface IServiceBindingConfig {
  bindingName: string;
  packageName?: string;
  description?: string;
  serviceDefinitionName?: string;
  serviceName?: string;
  serviceVersion?: string;
  bindingVariant?: ServiceBindingVariant;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  desiredPublicationState?: DesiredPublicationState;
  serviceType?: GeneratedServiceType;
  transportRequest?: string;
  runTransportCheck?: boolean;
}

export interface IServiceBindingState extends IAdtObjectState {
  serviceTypesResult?: IAdtResponse;
  inactiveCheckResult?: IAdtResponse;
  generatedInfoResult?: IAdtResponse;
  activeCheckResult?: IAdtResponse;
}

export interface IAdtServiceBinding
  extends IAdtObject<IServiceBindingConfig, IServiceBindingState> {
  getServiceBindingTypes(): Promise<IAdtResponse>;
  validateServiceBinding(
    params: IValidateServiceBindingParams,
  ): Promise<IAdtResponse>;
  transportCheckServiceBinding(
    params: ITransportCheckServiceBindingParams,
  ): Promise<IAdtResponse>;
  createServiceBinding(
    params: ICreateServiceBindingParams,
  ): Promise<IAdtResponse>;
  readServiceBinding(params: IReadServiceBindingParams): Promise<IAdtResponse>;
  updateServiceBinding(
    params: IUpdateServiceBindingParams,
  ): Promise<IAdtResponse>;
  checkServiceBinding(
    params: ICheckServiceBindingParams,
  ): Promise<IAdtResponse>;
  activateServiceBinding(
    params: IActivateServiceBindingParams,
  ): Promise<IAdtResponse>;
  deleteServiceBinding(
    params: IDeleteServiceBindingParams,
  ): Promise<IAdtResponse>;
  generateServiceBinding(
    params: IGenerateServiceBindingParams,
  ): Promise<IAdtResponse>;
  createAndGenerateServiceBinding(
    params: ICreateAndGenerateServiceBindingParams,
  ): Promise<{
    createResult: IAdtResponse;
    inactiveCheckResult: IAdtResponse;
    activationResult?: IAdtResponse;
    readResult: IAdtResponse;
    generatedInfoResult: IAdtResponse;
    activeCheckResult?: IAdtResponse;
  }>;
  getODataV2ServiceBinding(
    params: IGetServiceBindingODataParams,
  ): Promise<IAdtResponse>;
  getODataV4ServiceBinding(
    params: IGetServiceBindingODataParams,
  ): Promise<IAdtResponse>;
  publishODataV2(params: IPublishODataV2Params): Promise<IAdtResponse>;
  unpublishODataV2(params: IUnpublishODataV2Params): Promise<IAdtResponse>;
  classifyServiceBinding(
    params: IClassifyServiceBindingParams,
  ): Promise<IAdtResponse>;
}

export type AdtServiceBindingType = IAdtObject<
  IServiceBindingConfig,
  IServiceBindingState
>;

// Backward compatibility aliases
export type IAdtService = IAdtServiceBinding;
export type IAdtServiceOperationOptions = IAdtOperationOptions;
