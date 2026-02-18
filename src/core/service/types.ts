import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

export type ServiceBindingType = 'ODATA' | 'INA' | 'SQL';
export type ServiceBindingVersion = 'V2' | 'V4' | '0001' | '0000' | string;
export type GeneratedServiceType = 'odatav2' | 'odatav4';
export type DesiredPublicationState = 'published' | 'unpublished' | 'unchanged';

export interface IValidateServiceBindingParams {
  objname: string;
  serviceDefinition: string;
  serviceBindingVersion?: string;
  description?: string;
  package?: string;
}

export interface IGetServiceBindingODataParams {
  objectname: string;
  servicename?: string;
  serviceversion?: string;
  srvdname?: string;
}

export interface IPublishODataV2Params {
  servicename: string;
  serviceversion?: string;
}

export interface IUnpublishODataV2Params {
  servicename: string;
  serviceversion?: string;
}

export interface IClassifyServiceBindingParams {
  objectname: string;
  bindtype?: string;
  bindtypeversion?: string;
  repositoryid?: string;
  servicename?: string;
  serviceversion?: string;
}

export interface ITransportCheckServiceBindingParams {
  objectName: string;
  packageName: string;
  description?: string;
  operation?: 'I' | 'U' | 'D';
}

export interface ICreateServiceBindingParams {
  bindingName: string;
  packageName: string;
  description: string;
  serviceDefinitionName: string;
  serviceName: string;
  serviceVersion: string;
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory?: '0' | '1' | string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IReadServiceBindingParams {
  bindingName: string;
}

export interface ICheckServiceBindingParams {
  bindingName: string;
  version?: 'active' | 'inactive';
}

export interface IActivateServiceBindingParams {
  bindingName: string;
  preauditRequested?: boolean;
}

export interface IUpdateServiceBindingParams {
  bindingName: string;
  desiredPublicationState: DesiredPublicationState;
  serviceType?: GeneratedServiceType;
  serviceName?: string;
  serviceVersion?: string;
}

export interface IGenerateServiceBindingParams {
  serviceType: GeneratedServiceType;
  bindingName: string;
  serviceName: string;
  serviceVersion: string;
  serviceDefinitionName: string;
}

export interface ICreateAndGenerateServiceBindingParams
  extends ICreateServiceBindingParams {
  serviceType: GeneratedServiceType;
  runTransportCheck?: boolean;
  activateAfterCreate?: boolean;
}

export interface IAdtService {
  getServiceBindingTypes(): Promise<IAdtResponse>;
  validateServiceBinding(
    params: IValidateServiceBindingParams,
  ): Promise<IAdtResponse>;
  transportCheckServiceBinding(
    params: ITransportCheckServiceBindingParams,
  ): Promise<IAdtResponse>;
  createServiceBinding(params: ICreateServiceBindingParams): Promise<IAdtResponse>;
  readServiceBinding(params: IReadServiceBindingParams): Promise<IAdtResponse>;
  updateServiceBinding(params: IUpdateServiceBindingParams): Promise<IAdtResponse>;
  checkServiceBinding(params: ICheckServiceBindingParams): Promise<IAdtResponse>;
  activateServiceBinding(
    params: IActivateServiceBindingParams,
  ): Promise<IAdtResponse>;
  generateServiceBinding(params: IGenerateServiceBindingParams): Promise<IAdtResponse>;
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
