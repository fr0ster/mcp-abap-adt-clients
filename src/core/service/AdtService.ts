import type {
  IAbapConnection,
  IAdtOperationOptions,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type {
  IActivateServiceBindingParams,
  IAdtServiceBinding,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateAndGenerateServiceBindingParams,
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
} from './types';

export class AdtServiceBinding implements IAdtServiceBinding {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  public readonly objectType: string = 'ServiceBinding';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  private asRecord(value: unknown): Record<string, unknown> {
    return (value ?? {}) as Record<string, unknown>;
  }

  private static encodeName(name: string): string {
    return encodeURIComponent(name.toLowerCase());
  }

  private buildServiceBindingCreateXml(
    params: ICreateServiceBindingParams,
  ): string {
    const bindingCategory = params.bindingCategory ?? '1';
    const masterLanguage = params.masterLanguage ?? 'EN';
    const masterSystem = params.masterSystem;
    const responsible = params.responsible;
    const escapedDescription = params.description.replace(/"/g, '&quot;');
    const escapedBindingName = params.bindingName.toUpperCase();
    const escapedPackageName = params.packageName.toUpperCase();
    const escapedServiceName = params.serviceName.toUpperCase();
    const escapedServiceVersion = params.serviceVersion;
    const escapedServiceDefinition = params.serviceDefinitionName.toUpperCase();

    const masterSystemAttr = masterSystem
      ? ` adtcore:masterSystem="${masterSystem}"`
      : '';
    const responsibleAttr = responsible
      ? ` adtcore:responsible="${responsible}"`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?><srvb:serviceBinding xmlns:srvb="http://www.sap.com/adt/ddic/ServiceBindings" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${escapedDescription}" adtcore:language="${masterLanguage}" adtcore:name="${escapedBindingName}" adtcore:type="SRVB/SVB" adtcore:masterLanguage="${masterLanguage}"${masterSystemAttr}${responsibleAttr}>
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

  private buildDeletionXml(params: IDeleteServiceBindingParams): string {
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(params.bindingName)}`;
    const transportNumber = params.transportRequest ?? '';

    return `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object adtcore:uri="${bindingUri}"><del:transportNumber>${transportNumber}</del:transportNumber></del:object></del:deletionRequest>`;
  }

  private extractAvailableBindingTypes(response: IAdtResponse): Set<string> {
    const available = new Set<string>();
    const raw = typeof response.data === 'string' ? response.data : '';
    if (!raw) {
      return available;
    }

    const parsed = this.asRecord(this.parser.parse(raw));
    const namedItemList = this.asRecord(parsed['nameditem:namedItemList']);
    const list = namedItemList['nameditem:namedItem'];
    const items = Array.isArray(list) ? list : list ? [list] : [];

    for (const item of items) {
      const name = String(item?.['nameditem:name'] ?? '').toUpperCase();
      const description = String(item?.['nameditem:description'] ?? '');
      const data = String(item?.['nameditem:data'] ?? '').toUpperCase();
      if (!name || !data) {
        continue;
      }
      available.add(`${name}:${description}:${data}`);
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

    const parsed = this.asRecord(this.parser.parse(raw));
    const root = this.asRecord(
      parsed['srvb:serviceBinding'] ?? parsed.serviceBinding,
    );
    const publishedRaw = root['@_srvb:published'] ?? root['@_published'];
    const allowedActionRaw =
      root['@_srvb:allowedAction'] ?? root['@_allowedAction'];
    const binding = this.asRecord(root['srvb:binding'] ?? root.binding);
    const services = this.asRecord(root['srvb:services'] ?? root.services);
    const content = this.asRecord(services['srvb:content'] ?? services.content);

    const bindingType = String(
      binding['@_srvb:type'] ?? binding['@_type'] ?? '',
    ).toUpperCase();
    const bindingVersion = String(
      binding['@_srvb:version'] ?? binding['@_version'] ?? '',
    ).toUpperCase();

    let serviceType: 'odatav2' | 'odatav4' | undefined;
    if (bindingType === 'ODATA') {
      serviceType = bindingVersion === 'V4' ? 'odatav4' : 'odatav2';
    }

    return {
      published: String(publishedRaw).toLowerCase() === 'true',
      allowedAction: allowedActionRaw ? String(allowedActionRaw) : undefined,
      serviceType,
      serviceName: (services['@_srvb:name'] ?? services['@_name']) as
        | string
        | undefined,
      serviceVersion: (content['@_srvb:version'] ?? content['@_version']) as
        | string
        | undefined,
    };
  }

  private getBindingTypeAvailabilityKey(
    bindingType: string,
    bindingVersion: string,
  ): string {
    const name = bindingType.toUpperCase();
    const version = bindingVersion.toUpperCase();
    if (name === 'ODATA' && version === 'V4') {
      return 'ODATA:1:ODATA V4';
    }
    if (name === 'ODATA' && version === 'V2') {
      return 'ODATA:1:ODATA V2';
    }
    return `${name}:1:${name}`;
  }

  private async publishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    bindingName: string,
    servicename: string,
    serviceversion?: string,
  ): Promise<IAdtResponse> {
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${bindingName.toUpperCase()}"/></adtcore:objectReferences>`;

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/publishjobs`,
      method: 'POST',
      timeout: getTimeout('long'),
      data: xml,
      params: { servicename, serviceversion },
      headers: {
        Accept: 'application/vnd.sap.as+xml',
        'Content-Type': 'application/xml',
      },
    });
  }

  private async unpublishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    bindingName: string,
    servicename: string,
    serviceversion?: string,
  ): Promise<IAdtResponse> {
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${bindingName.toUpperCase()}"/></adtcore:objectReferences>`;

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/unpublishjobs`,
      method: 'POST',
      timeout: getTimeout('long'),
      data: xml,
      params: { servicename, serviceversion },
      headers: {
        Accept: 'application/vnd.sap.as+xml',
        'Content-Type': 'application/xml',
      },
    });
  }

  async validate(
    config: Partial<IServiceBindingConfig>,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required for validation');
    }
    if (!config.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required for validation');
    }
    if (!config.packageName) {
      throw new Error('packageName is required for validation');
    }
    if (!config.bindingType) {
      throw new Error('bindingType is required for validation');
    }
    if (!config.bindingVersion) {
      throw new Error('bindingVersion is required for validation');
    }

    // Validation flow:
    // 1) Read available binding types (GET discovery endpoint)
    // 2) Run transport check (POST), as pre-create server-side validation
    const serviceTypesResult = await this.getServiceBindingTypes();
    const availableBindingTypes =
      this.extractAvailableBindingTypes(serviceTypesResult);
    const availabilityKey = this.getBindingTypeAvailabilityKey(
      config.bindingType,
      config.bindingVersion,
    );
    if (!availableBindingTypes.has(availabilityKey)) {
      throw new Error(
        `Binding type ${config.bindingType}/${config.bindingVersion} is not available on current ADT system`,
      );
    }

    const validationResponse = await this.transportCheckServiceBinding({
      objectName: config.bindingName,
      packageName: config.packageName,
      description: config.description,
      operation: 'I',
    });

    return {
      errors: [],
      validationResponse,
      serviceTypesResult,
      transportResult: validationResponse,
    };
  }

  async create(
    config: IServiceBindingConfig,
    options?: IAdtOperationOptions,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!config.packageName) {
      throw new Error('packageName is required');
    }
    if (!config.description) {
      throw new Error('description is required');
    }
    if (!config.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required');
    }
    if (!config.serviceName) {
      throw new Error('serviceName is required');
    }
    if (!config.serviceVersion) {
      throw new Error('serviceVersion is required');
    }
    if (!config.bindingType) {
      throw new Error('bindingType is required');
    }
    if (!config.bindingVersion) {
      throw new Error('bindingVersion is required');
    }

    const state: IServiceBindingState = { errors: [] };

    const serviceTypesResult = await this.getServiceBindingTypes();
    state.serviceTypesResult = serviceTypesResult;
    const availableBindingTypes =
      this.extractAvailableBindingTypes(serviceTypesResult);
    const availabilityKey = this.getBindingTypeAvailabilityKey(
      config.bindingType,
      config.bindingVersion,
    );
    if (!availableBindingTypes.has(availabilityKey)) {
      throw new Error(
        `Binding type ${config.bindingType}/${config.bindingVersion} is not available on current ADT system`,
      );
    }

    if (config.runTransportCheck ?? true) {
      state.transportResult = await this.transportCheckServiceBinding({
        objectName: config.bindingName,
        packageName: config.packageName,
        description: config.description,
        operation: 'I',
      });
    }

    state.createResult = await this.createServiceBinding({
      bindingName: config.bindingName,
      packageName: config.packageName,
      description: config.description,
      serviceDefinitionName: config.serviceDefinitionName,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      bindingType: config.bindingType,
      bindingVersion: config.bindingVersion,
      bindingCategory: config.bindingCategory,
      masterLanguage: config.masterLanguage,
      masterSystem: config.masterSystem,
      responsible: config.responsible,
    });

    state.inactiveCheckResult = await this.checkServiceBinding({
      bindingName: config.bindingName,
      version: 'inactive',
    });

    const activateAfterCreate =
      options?.activateOnCreate === undefined ? true : options.activateOnCreate;

    if (activateAfterCreate) {
      state.activateResult = await this.activateServiceBinding({
        bindingName: config.bindingName,
        preauditRequested: true,
      });
    }

    state.readResult = await this.readServiceBinding({
      bindingName: config.bindingName,
      version: activateAfterCreate ? 'active' : 'inactive',
    });

    const generatedServiceType =
      config.serviceType ??
      (config.bindingType === 'ODATA' && String(config.bindingVersion) === 'V2'
        ? 'odatav2'
        : 'odatav4');

    state.generatedInfoResult = await this.generateServiceBinding({
      serviceType: generatedServiceType,
      bindingName: config.bindingName,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      serviceDefinitionName: config.serviceDefinitionName,
    });

    if (activateAfterCreate) {
      state.activeCheckResult = await this.checkServiceBinding({
        bindingName: config.bindingName,
        version: 'active',
      });
      state.checkResult = state.activeCheckResult;
    } else {
      state.checkResult = state.inactiveCheckResult;
    }

    return state;
  }

  async read(
    config: Partial<IServiceBindingConfig>,
    version?: 'active' | 'inactive',
  ): Promise<IServiceBindingState | undefined> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }

    try {
      const readResult = await this.readServiceBinding({
        bindingName: config.bindingName,
        version,
      });

      return {
        errors: [],
        readResult,
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async readMetadata(
    config: Partial<IServiceBindingConfig>,
    options?: { withLongPolling?: boolean; version?: 'active' | 'inactive' },
  ): Promise<IServiceBindingState> {
    const state = await this.read(config, options?.version);
    return {
      ...(state ?? { errors: [] }),
      metadataResult: state?.readResult,
    };
  }

  async update(
    config: Partial<IServiceBindingConfig>,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!config.desiredPublicationState) {
      throw new Error('desiredPublicationState is required');
    }
    if (!config.serviceType) {
      throw new Error('serviceType is required for update');
    }
    if (!config.serviceName) {
      throw new Error('serviceName is required for update');
    }

    const updateResult = await this.updateServiceBinding({
      bindingName: config.bindingName,
      desiredPublicationState: config.desiredPublicationState,
      serviceType: config.serviceType,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
    });

    const readResult = await this.readServiceBinding({
      bindingName: config.bindingName,
      version: 'active',
    });

    return {
      errors: [],
      updateResult,
      readResult,
    };
  }

  async delete(
    config: Partial<IServiceBindingConfig>,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }

    try {
      const activeState = await this.readServiceBinding({
        bindingName: config.bindingName,
        version: 'active',
      });
      const current = this.parseServiceBindingState(activeState);
      if (current.published && current.allowedAction === 'UNPUBLISH') {
        const serviceType = config.serviceType ?? current.serviceType;
        const serviceName = config.serviceName ?? current.serviceName;
        const serviceVersion = config.serviceVersion ?? current.serviceVersion;
        if (serviceType && serviceName) {
          this.logger?.info?.(
            `ServiceBinding delete pre-step: unpublish ${config.bindingName}`,
            {
              serviceType,
              serviceName,
              serviceVersion,
            },
          );
          await this.updateServiceBinding({
            bindingName: config.bindingName,
            desiredPublicationState: 'unpublished',
            serviceType,
            serviceName,
            serviceVersion,
          });
        }
      }
    } catch {
      // best-effort: if read/unpublish fails, try delete directly
    }

    const deleteResult = await this.deleteServiceBinding({
      bindingName: config.bindingName,
      transportRequest: config.transportRequest,
    });

    return {
      errors: [],
      deleteResult,
    };
  }

  async activate(
    config: Partial<IServiceBindingConfig>,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }

    const activateResult = await this.activateServiceBinding({
      bindingName: config.bindingName,
      preauditRequested: true,
    });

    return {
      errors: [],
      activateResult,
    };
  }

  async check(
    config: Partial<IServiceBindingConfig>,
    status?: string,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }

    const version = status === 'active' ? 'active' : 'inactive';
    const checkResult = await this.checkServiceBinding({
      bindingName: config.bindingName,
      version,
    });

    return {
      errors: [],
      checkResult,
    };
  }

  async readTransport(
    config: Partial<IServiceBindingConfig>,
  ): Promise<IServiceBindingState> {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!config.packageName) {
      throw new Error('packageName is required for transport check');
    }

    const transportResult = await this.transportCheckServiceBinding({
      objectName: config.bindingName,
      packageName: config.packageName,
      description: config.description,
      operation: 'U',
    });

    return {
      errors: [],
      transportResult,
    };
  }

  async lock(_config: Partial<IServiceBindingConfig>): Promise<string> {
    throw new Error('Lock is not supported for service bindings via ADT API');
  }

  async unlock(
    _config: Partial<IServiceBindingConfig>,
    _lockHandle: string,
  ): Promise<IServiceBindingState> {
    throw new Error('Unlock is not supported for service bindings via ADT API');
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

    const systemInfo = await getSystemInformation(this.connection);
    const createParams: ICreateServiceBindingParams = {
      ...params,
      masterLanguage: params.masterLanguage ?? systemInfo?.language ?? 'EN',
      masterSystem: params.masterSystem ?? systemInfo?.systemID,
      responsible: params.responsible ?? systemInfo?.userName,
    };

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/bindings',
      method: 'POST',
      timeout: getTimeout('default'),
      data: this.buildServiceBindingCreateXml(createParams),
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
      url: `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(params.bindingName)}`,
      method: 'GET',
      timeout: getTimeout('default'),
      params: params.version ? { version: params.version } : undefined,
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
    if (!params.serviceType) {
      throw new Error('serviceType is required');
    }
    if (!params.serviceName) {
      throw new Error('serviceName is required');
    }

    const readResponse = await this.readServiceBinding({
      bindingName: params.bindingName,
      version: 'active',
    });
    const current = this.parseServiceBindingState(readResponse);
    this.logger?.info?.(
      `ServiceBinding update: ${params.bindingName} -> ${params.desiredPublicationState}`,
      {
        desiredPublicationState: params.desiredPublicationState,
        currentPublished: current.published,
        allowedAction: current.allowedAction,
        serviceType: params.serviceType,
        serviceName: params.serviceName,
        serviceVersion: params.serviceVersion,
      },
    );

    if (params.desiredPublicationState === 'unchanged') {
      return readResponse;
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
        params.serviceType,
        params.bindingName,
        params.serviceName,
        params.serviceVersion,
      );
    }

    if (current.allowedAction !== 'UNPUBLISH') {
      throw new Error(
        `Invalid state transition: cannot unpublish service binding ${params.bindingName}. allowedAction=${current.allowedAction ?? 'UNKNOWN'}`,
      );
    }
    return this.unpublishByServiceType(
      params.serviceType,
      params.bindingName,
      params.serviceName,
      params.serviceVersion,
    );
  }

  async deleteServiceBinding(
    params: IDeleteServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/deletion/delete',
      method: 'POST',
      timeout: getTimeout('default'),
      data: this.buildDeletionXml(params),
      headers: {
        Accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml',
      },
    });
  }

  async checkServiceBinding(
    params: ICheckServiceBindingParams,
  ): Promise<IAdtResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    const version = params.version ?? 'inactive';
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(params.bindingName)}`;
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
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(params.bindingName)}`;
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

    const path = params.serviceType === 'odatav2' ? 'odatav2' : 'odatav4';
    const accept =
      params.serviceType === 'odatav2'
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
    const state = await this.create(
      {
        bindingName: params.bindingName,
        packageName: params.packageName,
        description: params.description,
        serviceDefinitionName: params.serviceDefinitionName,
        serviceName: params.serviceName,
        serviceVersion: params.serviceVersion,
        bindingType: params.bindingType,
        bindingVersion: params.bindingVersion,
        bindingCategory: params.bindingCategory,
        masterLanguage: params.masterLanguage,
        masterSystem: params.masterSystem,
        responsible: params.responsible,
        serviceType: params.serviceType,
        runTransportCheck: params.runTransportCheck,
      },
      { activateOnCreate: true },
    );

    if (
      !state.createResult ||
      !state.inactiveCheckResult ||
      !state.readResult ||
      !state.generatedInfoResult
    ) {
      throw new Error(
        'Create and generate flow did not produce required results',
      );
    }

    return {
      createResult: state.createResult,
      inactiveCheckResult: state.inactiveCheckResult,
      activationResult: state.activateResult,
      readResult: state.readResult,
      generatedInfoResult: state.generatedInfoResult,
      activeCheckResult: state.activeCheckResult,
    };
  }

  async getODataV2ServiceBinding(
    params: IGetServiceBindingODataParams,
  ): Promise<IAdtResponse> {
    if (!params.objectname) {
      throw new Error('objectname is required');
    }

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/odatav2/${encodeURIComponent(params.objectname)}`,
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

    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/odatav4/${encodeURIComponent(params.objectname)}`,
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

// Backward compatibility for existing imports.
export class AdtService extends AdtServiceBinding {}
