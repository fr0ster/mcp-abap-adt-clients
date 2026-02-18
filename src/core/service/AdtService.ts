import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { getTimeout } from '../../utils/timeouts';
import type {
  IActivateServiceBindingParams,
  IAdtService,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateAndGenerateServiceBindingParams,
  ICreateServiceBindingParams,
  IGenerateServiceBindingParams,
  IGetServiceBindingODataParams,
  IPublishODataV2Params,
  IReadServiceBindingParams,
  ITransportCheckServiceBindingParams,
  IUnpublishODataV2Params,
  IUpdateServiceBindingParams,
  IValidateServiceBindingParams,
} from './types';

export class AdtService implements IAdtService {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  private static encodeName(name: string): string {
    return encodeURIComponent(name.toLowerCase());
  }

  private buildServiceBindingCreateXml(
    params: ICreateServiceBindingParams,
  ): string {
    const bindingCategory = params.bindingCategory ?? '1';
    const masterLanguage = params.masterLanguage ?? 'EN';
    const masterSystem = params.masterSystem ?? '';
    const responsible = params.responsible ?? '';
    const escapedDescription = params.description.replace(/"/g, '&quot;');
    const escapedBindingName = params.bindingName.toUpperCase();
    const escapedPackageName = params.packageName.toUpperCase();
    const escapedServiceName = params.serviceName.toUpperCase();
    const escapedServiceVersion = params.serviceVersion;
    const escapedServiceDefinition = params.serviceDefinitionName.toUpperCase();

    return `<?xml version="1.0" encoding="UTF-8"?><srvb:serviceBinding xmlns:srvb="http://www.sap.com/adt/ddic/ServiceBindings" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${escapedDescription}" adtcore:language="${masterLanguage}" adtcore:name="${escapedBindingName}" adtcore:type="SRVB/SVB" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="${masterSystem}" adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${escapedPackageName}"/>
  <srvb:services srvb:name="${escapedServiceName}">
    <srvb:content srvb:version="${escapedServiceVersion}">
      <srvb:serviceDefinition adtcore:name="${escapedServiceDefinition}"/>
    </srvb:content>
  </srvb:services>
  <srvb:binding srvb:category="${bindingCategory}" srvb:type="${params.bindingType}" srvb:version="${params.bindingVersion}">
    <srvb:implementation adtcore:name=""/>
  </srvb:binding>
</srvb:serviceBinding>`;
  }

  private buildTransportCheckXml(
    params: ITransportCheckServiceBindingParams,
  ): string {
    const description = (params.description ?? '').replace(/"/g, '&quot;');
    return `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><PGMID>R3TR</PGMID><OBJECT>SRVB</OBJECT><OBJECTNAME>${params.objectName.toUpperCase()}</OBJECTNAME><OPERATION>${params.operation ?? 'I'}</OPERATION><DEVCLASS>${params.packageName.toUpperCase()}</DEVCLASS><CTEXT>${description}</CTEXT></DATA></asx:values></asx:abap>`;
  }

  private extractAvailableGeneratedServiceTypes(
    response: IAdtResponse,
  ): Set<'odatav2' | 'odatav4'> {
    const available = new Set<'odatav2' | 'odatav4'>();
    const raw = typeof response.data === 'string' ? response.data : '';
    if (!raw) {
      return available;
    }

    const parsed = this.parser.parse(raw) as any;
    const list = parsed?.['nameditem:namedItemList']?.['nameditem:namedItem'];
    const items = Array.isArray(list) ? list : list ? [list] : [];

    for (const item of items) {
      const data = String(item?.['nameditem:data'] ?? '').toUpperCase();
      if (data.includes('ODATA V4')) {
        available.add('odatav4');
      }
      if (data.includes('ODATA V2')) {
        available.add('odatav2');
      }
    }

    return available;
  }

  private parseServiceBindingState(response: IAdtResponse): {
    published: boolean;
    allowedAction?: string;
    serviceType?: 'odatav2' | 'odatav4';
    serviceName?: string;
    serviceVersion?: string;
  } {
    const raw = typeof response.data === 'string' ? response.data : '';
    if (!raw) {
      return { published: false };
    }

    const parsed = this.parser.parse(raw) as any;
    const root = parsed?.['srvb:serviceBinding'] ?? parsed?.serviceBinding;
    const publishedRaw = root?.['@_srvb:published'] ?? root?.['@_published'];
    const allowedActionRaw =
      root?.['@_srvb:allowedAction'] ?? root?.['@_allowedAction'];
    const binding = root?.['srvb:binding'] ?? root?.binding;
    const services = root?.['srvb:services'] ?? root?.services;
    const content = services?.['srvb:content'] ?? services?.content;

    const bindingType = String(
      binding?.['@_srvb:type'] ?? binding?.['@_type'] ?? '',
    ).toUpperCase();
    const bindingVersion = String(
      binding?.['@_srvb:version'] ?? binding?.['@_version'] ?? '',
    ).toUpperCase();

    let serviceType: 'odatav2' | 'odatav4' | undefined;
    if (bindingType === 'ODATA') {
      serviceType = bindingVersion === 'V4' ? 'odatav4' : 'odatav2';
    }

    return {
      published: String(publishedRaw).toLowerCase() === 'true',
      allowedAction: allowedActionRaw ? String(allowedActionRaw) : undefined,
      serviceType,
      serviceName: services?.['@_srvb:name'] ?? services?.['@_name'],
      serviceVersion: content?.['@_srvb:version'] ?? content?.['@_version'],
    };
  }

  private async publishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    servicename: string,
    serviceversion?: string,
  ): Promise<IAdtResponse> {
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/publishjobs`,
      method: 'GET',
      timeout: getTimeout('default'),
      params: { servicename, serviceversion },
      headers: {
        Accept:
          serviceType === 'odatav2'
            ? 'application/vnd.sap.adt.businessservices.odatav2.v2+xml, application/vnd.sap.adt.businessservices.odatav2.v3+xml'
            : 'application/vnd.sap.adt.businessservices.odatav4.v1+xml, application/vnd.sap.adt.businessservices.odatav4.v2+xml',
      },
    });
  }

  private async unpublishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    servicename: string,
    serviceversion?: string,
  ): Promise<IAdtResponse> {
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/unpublishjobs`,
      method: 'GET',
      timeout: getTimeout('default'),
      params: { servicename, serviceversion },
      headers: {
        Accept:
          serviceType === 'odatav2'
            ? 'application/vnd.sap.adt.businessservices.odatav2.v2+xml, application/vnd.sap.adt.businessservices.odatav2.v3+xml'
            : 'application/vnd.sap.adt.businessservices.odatav4.v1+xml, application/vnd.sap.adt.businessservices.odatav4.v2+xml',
      },
    });
  }

  async getServiceBindingTypes(): Promise<IAdtResponse> {
    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/bindings/bindingtypes',
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/vnd.sap.adt.nameditems.v1+xml, application/xml',
      },
    });
  }

  async validateServiceBinding(
    params: IValidateServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.objname) {
      throw new Error('objname is required');
    }
    if (!params.serviceDefinition) {
      throw new Error('serviceDefinition is required');
    }

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/bindings/validation',
      method: 'GET',
      timeout: getTimeout('default'),
      params,
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
      },
    });
  }

  async transportCheckServiceBinding(
    params: ITransportCheckServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.objectName) {
      throw new Error('objectName is required');
    }
    if (!params.packageName) {
      throw new Error('packageName is required');
    }

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/cts/transportchecks',
      method: 'POST',
      timeout: getTimeout('default'),
      data: this.buildTransportCheckXml(params),
      headers: {
        Accept:
          'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData',
        'Content-Type':
          'application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData',
      },
    });
  }

  async createServiceBinding(
    params: ICreateServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!params.packageName) {
      throw new Error('packageName is required');
    }
    if (!params.description) {
      throw new Error('description is required');
    }
    if (!params.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required');
    }
    if (!params.serviceName) {
      throw new Error('serviceName is required');
    }
    if (!params.serviceVersion) {
      throw new Error('serviceVersion is required');
    }
    if (!params.bindingType) {
      throw new Error('bindingType is required');
    }
    if (!params.bindingVersion) {
      throw new Error('bindingVersion is required');
    }

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/bindings',
      method: 'POST',
      timeout: getTimeout('default'),
      data: this.buildServiceBindingCreateXml(params),
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.servicebinding.v1+xml, application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
        'Content-Type':
          'application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
      },
    });
  }

  async readServiceBinding(
    params: IReadServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/bindings/${AdtService.encodeName(params.bindingName)}`,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.servicebinding.v1+xml, application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
      },
    });
  }

  async updateServiceBinding(
    params: IUpdateServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!params.desiredPublicationState) {
      throw new Error('desiredPublicationState is required');
    }

    const readResponse = await this.readServiceBinding({
      bindingName: params.bindingName,
    });
    const current = this.parseServiceBindingState(readResponse);

    if (params.desiredPublicationState === 'unchanged') {
      return readResponse;
    }

    const serviceType = params.serviceType ?? current.serviceType;
    const serviceName = params.serviceName ?? current.serviceName;
    const serviceVersion = params.serviceVersion ?? current.serviceVersion;

    if (!serviceType) {
      throw new Error(
        'serviceType is required (could not infer from service binding metadata)',
      );
    }
    if (!serviceName) {
      throw new Error(
        'serviceName is required (could not infer from service binding metadata)',
      );
    }

    if (params.desiredPublicationState === 'published') {
      if (current.published) {
        return readResponse;
      }
      if (current.allowedAction !== 'PUBLISH') {
        throw new Error(
          `Invalid state transition: cannot publish service binding ${params.bindingName}. allowedAction=${current.allowedAction ?? 'UNKNOWN'}`,
        );
      }
      return this.publishByServiceType(
        serviceType,
        serviceName,
        serviceVersion,
      );
    }

    if (params.desiredPublicationState === 'unpublished') {
      if (!current.published) {
        return readResponse;
      }
      if (current.allowedAction !== 'UNPUBLISH') {
        throw new Error(
          `Invalid state transition: cannot unpublish service binding ${params.bindingName}. allowedAction=${current.allowedAction ?? 'UNKNOWN'}`,
        );
      }
      return this.unpublishByServiceType(
        serviceType,
        serviceName,
        serviceVersion,
      );
    }

    return readResponse;
  }

  async checkServiceBinding(
    params: ICheckServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    const version = params.version ?? 'inactive';
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtService.encodeName(params.bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core"><chkrun:checkObject adtcore:uri="${bindingUri}" chkrun:version="${version}"/></chkrun:checkObjectList>`;

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/checkruns',
      method: 'POST',
      timeout: getTimeout('default'),
      data: xml,
      headers: {
        Accept: 'application/vnd.sap.adt.checkmessages+xml',
        'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
      },
    });
  }

  async activateServiceBinding(
    params: IActivateServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    const preauditRequested =
      params.preauditRequested === undefined ? true : params.preauditRequested;
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtService.encodeName(params.bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${params.bindingName.toUpperCase()}"/></adtcore:objectReferences>`;

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xml,
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
      },
    });
  }

  async generateServiceBinding(
    params: IGenerateServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!params.serviceName) {
      throw new Error('serviceName is required');
    }
    if (!params.serviceVersion) {
      throw new Error('serviceVersion is required');
    }
    if (!params.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required');
    }

    const serviceType = params.serviceType;
    const path = serviceType === 'odatav2' ? 'odatav2' : 'odatav4';
    const accept =
      serviceType === 'odatav2'
        ? 'application/vnd.sap.adt.businessservices.odatav2.v2+xml, application/vnd.sap.adt.businessservices.odatav2.v3+xml'
        : 'application/vnd.sap.adt.businessservices.odatav4.v1+xml, application/vnd.sap.adt.businessservices.odatav4.v2+xml';

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${path}/${encodeURIComponent(params.bindingName.toUpperCase())}`,
      method: 'GET',
      timeout: getTimeout('default'),
      params: {
        servicename: params.serviceName.toUpperCase(),
        serviceversion: params.serviceVersion,
        srvdname: params.serviceDefinitionName.toUpperCase(),
      },
      headers: {
        Accept: accept,
      },
    });
  }

  async createAndGenerateServiceBinding(
    params: ICreateAndGenerateServiceBindingParams,
  ): Promise<{
    createResult: IAdtResponse;
    inactiveCheckResult: IAdtResponse;
    activationResult?: IAdtResponse;
    readResult: IAdtResponse;
    generatedInfoResult: IAdtResponse;
    activeCheckResult?: IAdtResponse;
  }> {
    // Step 0: fetch binding types (as Eclipse ADT does before create)
    const serviceTypesResponse = await this.getServiceBindingTypes();
    const availableServiceTypes =
      this.extractAvailableGeneratedServiceTypes(serviceTypesResponse);
    if (!availableServiceTypes.has(params.serviceType)) {
      throw new Error(
        `Service type "${params.serviceType}" is not available for service binding generation on this system`,
      );
    }

    // Step 1: transport check
    if (params.runTransportCheck ?? true) {
      await this.transportCheckServiceBinding({
        objectName: params.bindingName,
        packageName: params.packageName,
        description: params.description,
        operation: 'I',
      });
    }

    // Step 2: create binding
    const createResult = await this.createServiceBinding(params);

    // Step 3: check inactive
    const inactiveCheckResult = await this.checkServiceBinding({
      bindingName: params.bindingName,
      version: 'inactive',
    });

    // Step 4: activate (optional)
    let activationResult: IAdtResponse | undefined;
    if (params.activateAfterCreate ?? true) {
      activationResult = await this.activateServiceBinding({
        bindingName: params.bindingName,
        preauditRequested: true,
      });
    }

    // Step 5: read binding
    const readResult = await this.readServiceBinding({
      bindingName: params.bindingName,
    });

    // Step 6: generate/fetch OData V4 group info
    const generatedInfoResult = await this.generateServiceBinding({
      serviceType: params.serviceType,
      bindingName: params.bindingName,
      serviceName: params.serviceName,
      serviceVersion: params.serviceVersion,
      serviceDefinitionName: params.serviceDefinitionName,
    });

    // Step 7: check active (if activated)
    let activeCheckResult: IAdtResponse | undefined;
    if (params.activateAfterCreate ?? true) {
      activeCheckResult = await this.checkServiceBinding({
        bindingName: params.bindingName,
        version: 'active',
      });
    }

    return {
      createResult,
      inactiveCheckResult,
      activationResult,
      readResult,
      generatedInfoResult,
      activeCheckResult,
    };
  }

  async getODataV2ServiceBinding(
    params: IGetServiceBindingODataParams,
  ): Promise<IAdtResponse> {
    if (!params.objectname) {
      throw new Error('objectname is required');
    }

    const objectname = encodeURIComponent(params.objectname);
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/odatav2/${objectname}`,
      method: 'GET',
      timeout: getTimeout('default'),
      params: {
        servicename: params.servicename,
        serviceversion: params.serviceversion,
        srvdname: params.srvdname,
      },
      headers: {
        Accept: 'application/vnd.sap.adt.businessservices.odatav2.v3+xml',
      },
    });
  }

  async getODataV4ServiceBinding(
    params: IGetServiceBindingODataParams,
  ): Promise<IAdtResponse> {
    if (!params.objectname) {
      throw new Error('objectname is required');
    }

    const objectname = encodeURIComponent(params.objectname);
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/odatav4/${objectname}`,
      method: 'GET',
      timeout: getTimeout('default'),
      params: {
        servicename: params.servicename,
        serviceversion: params.serviceversion,
        srvdname: params.srvdname,
      },
      headers: {
        Accept: 'application/vnd.sap.adt.businessservices.odatav4.v2+xml',
      },
    });
  }

  async publishODataV2(params: IPublishODataV2Params): Promise<IAdtResponse> {
    if (!params.servicename) {
      throw new Error('servicename is required');
    }

    this.logger?.info?.('Publishing OData V2 service', params);
    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/odatav2/publishjobs',
      method: 'GET',
      timeout: getTimeout('default'),
      params,
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.odatav2.v3+xml, application/json, text/plain',
      },
    });
  }

  async unpublishODataV2(
    params: IUnpublishODataV2Params,
  ): Promise<IAdtResponse> {
    if (!params.servicename) {
      throw new Error('servicename is required');
    }

    this.logger?.info?.('Unpublishing OData V2 service', params);
    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/odatav2/unpublishjobs',
      method: 'GET',
      timeout: getTimeout('default'),
      params,
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.odatav2.v3+xml, application/json, text/plain',
      },
    });
  }

  async classifyServiceBinding(
    params: IClassifyServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.objectname) {
      throw new Error('objectname is required');
    }

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/release',
      method: 'GET',
      timeout: getTimeout('default'),
      params,
      headers: {
        Accept: 'application/xml, application/json, text/plain',
      },
    });
  }
}
