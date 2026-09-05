import type {
  AdtNoFailure,
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtCreatable,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_CHECK_MESSAGES,
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  ACCEPT_TRANSPORT_CHECK,
  ACCEPT_VALIDATION,
  CT_CHECK_OBJECTS,
  CT_DELETION,
  CT_DELETION_CHECK,
  CT_TRANSPORT_CHECK,
} from '../../constants/contentTypes';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { deletionRefusal } from '../../utils/deletionCheck';
import {
  buildQueryString,
  encodeSapObjectName,
} from '../../utils/internalUtils';
import { requestOf } from '../../utils/requestTrace';
import { nothing, rawDocument } from '../../utils/resultStrategy';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import { chain } from '../shared/chain';
import type { ObjectVersion } from '../shared/results';
import { lockServiceBinding, unlockServiceBinding } from './lock';
import type {
  IActivateServiceBindingParams,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateAndGenerateServiceBindingParams,
  ICreateServiceBindingParams,
  IDeleteServiceBindingParams,
  IGenerateServiceBindingParams,
  IPublishODataV2Params,
  IReadServiceBindingParams,
  IServiceBindingConfig,
  IServiceBindingPublicationParams,
  IServiceGroupParams,
  IServiceResults,
  ITransportCheckServiceBindingParams,
  IUnpublishODataV2Params,
  IUpdateServiceBindingParams,
  IValidateServiceBindingParams,
  ServiceBindingVariant,
} from './types';
import { resolveBindingVariant, serviceDocuments } from './types';
/**
 * The verdict a publish or unpublish job answers with.
 *
 * `POST …/{serviceType}/publishjobs` (and `unpublishjobs`) does not just accept
 * the work — it reports the outcome, in ADT's own `asx:abap` envelope:
 *
 * ```xml
 * <asx:values><DATA>
 *   <SEVERITY>OK</SEVERITY>
 *   <SHORT_TEXT>ZAC_SRVB01 published locally</SHORT_TEXT>
 * </DATA></asx:values>
 * ```
 *
 * Nobody read it. The member answered the document and a caller who checked
 * only `ok` learned that the request completed, never what it did — which is
 * the shape this release removes everywhere else. Measured on the trial
 * 2026-09-05: the POST takes ~130s of server time and then says exactly this.
 *
 * Conservative in the same way as its neighbours: a body with no `SEVERITY` is
 * not a refusal, because inventing a "no" from silence is how an empty answer
 * came to mean failure elsewhere. Only a severity that is not OK is one.
 */
export const publicationRefusal = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict !== ADT_NO_FAILURE) return verdict;

  const xml = typeof answer?.data === 'string' ? answer.data : '';
  const severity = /<SEVERITY>([^<]*)<\/SEVERITY>/i.exec(xml)?.[1]?.trim();
  if (!severity || severity.toUpperCase() === 'OK') return ADT_NO_FAILURE;

  const shortText = /<SHORT_TEXT>([^<]*)<\/SHORT_TEXT>/i.exec(xml)?.[1]?.trim();
  const longText = /<LONG_TEXT>([^<]*)<\/LONG_TEXT>/i.exec(xml)?.[1]?.trim();
  return {
    origin: 'refusal',
    message:
      `Publication ${severity}: ${shortText || 'the server gave no short text'}` +
      (longText ? ` — ${longText}` : ''),
    response: answer,
    request: requestOf(answer),
  };
};

export class AdtServiceBinding<
  R extends IServiceResults = typeof serviceDocuments,
> implements
    IAdtCreatable<IServiceBindingConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IServiceBindingConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IServiceBindingConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IServiceBindingConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IServiceBindingConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IServiceBindingConfig, ReturnType<R['check']>>,
    IAdtActivatable<IServiceBindingConfig, ReturnType<R['activation']>>,
    IAdtTransportAware<IServiceBindingConfig, ReturnType<R['transport']>>,
    IAdtLockable<IServiceBindingConfig>
{
  // `IAdtServiceBinding` from the contracts package is deliberately NOT in the
  // list above yet. It still declares `publishODataV2` and `unpublishODataV2` —
  // two method names for what is one endpoint with a `serviceType` parameter,
  // and both of them GET a `…jobs` URL that Eclipse POSTs to. The shape here is
  // being settled against measured traffic first; it moves to
  // `@mcp-abap-adt/interfaces` when it does what it needs to, not before.

  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;

  public readonly objectType: string = 'ServiceBinding';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    private readonly results: R = serviceDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  private asRecord(value: unknown): Record<string, unknown> {
    return (value ?? {}) as Record<string, unknown>;
  }

  /** The binding name, or the caller's mistake. */
  private name(config: Partial<IServiceBindingConfig>): string {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }
    return config.bindingName;
  }

  /**
   * Read the system's binding-type catalogue and answer a failure if the
   * variant asked for is not in it.
   *
   * Not a judgement of a document: posting a variant the system does not offer
   * produces an answer a caller cannot act on, and the catalogue is the
   * system's own statement of what it has.
   */
  private async assertVariantAvailable(
    variant: ServiceBindingVariant,
  ): Promise<IAdtResponse<ReturnType<R['bindingTypes']>>> {
    const { bindingType, bindingVersion } = resolveBindingVariant(variant);
    const key = this.getBindingTypeAvailabilityKey(bindingType, bindingVersion);

    return answering(
      () => this.bindingTypesRequest(),
      this.results.bindingTypes as IResultStrategy<
        ReturnType<R['bindingTypes']>
      >,
      (verdict, answer) => {
        if (verdict !== ADT_NO_FAILURE) return verdict;
        const available = this.extractAvailableBindingTypes(
          answer as IAdtWireResponse,
        );
        return available.has(key)
          ? ADT_NO_FAILURE
          : {
              origin: 'refusal' as const,
              message: `Binding variant ${variant} (${bindingType}/${bindingVersion}) is not available on current ADT system`,
              response: answer,
              request: requestOf(answer),
            };
      },
    );
  }

  private static encodeName(name: string): string {
    return encodeURIComponent(name.toLowerCase());
  }

  private buildServiceBindingCreateXml(
    params: ICreateServiceBindingParams,
  ): string {
    const { bindingType, bindingVersion, bindingCategory } =
      resolveBindingVariant(params.bindingVariant);
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
  <srvb:binding srvb:category="${bindingCategory}" srvb:type="${bindingType}" srvb:version="${bindingVersion}">
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

  private extractAvailableBindingTypes(
    response: IAdtWireResponse,
  ): Set<string> {
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

  private parseServiceBindingState(response: IAdtWireResponse): {
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
  ): Promise<IAdtWireResponse> {
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${bindingName.toUpperCase()}"/></adtcore:objectReferences>`;

    const publishQs = buildQueryString({ servicename, serviceversion });
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/publishjobs?${publishQs}`,
      method: 'POST',
      timeout: getTimeout('long'),
      data: xml,
      headers: {
        Accept: ACCEPT_VALIDATION,
        'Content-Type': 'application/xml',
      },
    });
  }

  private async unpublishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    bindingName: string,
    servicename: string,
    serviceversion?: string,
  ): Promise<IAdtWireResponse> {
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${bindingName.toUpperCase()}"/></adtcore:objectReferences>`;

    const unpublishQs = buildQueryString({ servicename, serviceversion });
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/unpublishjobs?${unpublishQs}`,
      method: 'POST',
      timeout: getTimeout('long'),
      data: xml,
      headers: {
        Accept: ACCEPT_VALIDATION,
        'Content-Type': 'application/xml',
      },
    });
  }

  /**
   * Validate before creating: the variant must exist on this system, and the
   * transport check must accept the object.
   *
   * The variant check is not this library judging a document — it is a read of
   * the system's own catalogue, and posting a variant the system does not offer
   * produces a failure the caller cannot interpret.
   */
  async validate(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    const name = this.name(config);
    if (!config.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required for validation');
    }
    if (!config.packageName) {
      throw new Error('packageName is required for validation');
    }
    if (!config.bindingVariant) {
      throw new Error('bindingVariant is required for validation');
    }
    const packageName = config.packageName;
    const variant = config.bindingVariant;

    return chain(this.logger, async ({ step }) => {
      await step(this.assertVariantAvailable(variant));

      return step(
        answering(
          () =>
            this.transportCheckRequest({
              objectName: name,
              packageName,
              description: config.description,
              operation: 'I',
            }),
          this.results.validation as IResultStrategy<
            ReturnType<R['validation']>
          >,
          options?.analyse,
        ),
      );
    });
  }

  /**
   * Create the binding, and activate and generate its service.
   *
   * The answer is the create's own. What the chain does after it — the check,
   * the activation, the generation — is this implementation's business and
   * reaches a caller only if it fails.
   */
  async create(
    config: IServiceBindingConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const name = this.name(config);
    if (!config.packageName) throw new Error('packageName is required');
    if (!config.description) throw new Error('description is required');
    if (!config.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required');
    }
    if (!config.serviceName) throw new Error('serviceName is required');
    if (!config.serviceVersion) throw new Error('serviceVersion is required');
    if (!config.bindingVariant) throw new Error('bindingVariant is required');
    const { serviceType: generatedServiceType } = resolveBindingVariant(
      config.bindingVariant,
    );
    const packageName = config.packageName;
    const description = config.description;
    const serviceName = config.serviceName;
    const serviceVersion = config.serviceVersion;
    const serviceDefinitionName = config.serviceDefinitionName;
    const bindingVariant = config.bindingVariant;

    return chain(this.logger, async ({ step }) => {
      await step(this.assertVariantAvailable(bindingVariant));

      if (config.runTransportCheck ?? true) {
        await step(
          answering(
            () =>
              this.transportCheckRequest({
                objectName: name,
                packageName,
                description,
                operation: 'I',
              }),
            this.results.transport as IResultStrategy<
              ReturnType<R['transport']>
            >,
            options?.analyse,
          ),
        );
      }

      const value = await step(
        answering(
          () =>
            this.createRequest({
              bindingName: name,
              packageName,
              description,
              serviceDefinitionName,
              serviceName,
              serviceVersion,
              bindingVariant,
              masterLanguage: config.masterLanguage,
              masterSystem: config.masterSystem,
              responsible: config.responsible,
              transportRequest: config.transportRequest,
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );

      await step(this.check({ bindingName: name }, 'inactive', options));

      const activateAfterCreate = options?.activateOnCreate !== false;
      if (activateAfterCreate) {
        await step(this.activate({ bindingName: name }, options));
      }

      await step(
        answering(
          () =>
            this.generateRequest({
              serviceType: generatedServiceType,
              bindingName: name,
              serviceName,
              serviceVersion,
              serviceDefinitionName,
            }),
          this.results.generation as IResultStrategy<
            ReturnType<R['generation']>
          >,
          options?.analyse,
        ),
      );

      if (activateAfterCreate) {
        await step(this.check({ bindingName: name }, 'active', options));
      }

      return value;
    });
  }

  /** Read the binding document. */
  async read(
    config: Partial<IServiceBindingConfig>,
    version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: whether an empty or missing answer *is* absence is
    // the caller's reading, supplied through `analyse`.
    return answering(
      () => this.readRequest({ bindingName: name, version }),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /**
   * Read the binding as metadata.
   *
   * The same resource `read` fetches — a binding has one document — declared
   * separately because the contract asks both of a readable.
   */
  async readMetadata(
    config: Partial<IServiceBindingConfig>,
    options?: {
      withLongPolling?: boolean;
      version?: 'active' | 'inactive';
    } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () => this.readRequest({ bindingName: name, version: options?.version }),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Change the binding's publication state.
   *
   * That is the only thing an update does to a binding: publish it, withdraw
   * it, or leave it as it is.
   */
  async update(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    if (!config.desiredPublicationState) {
      throw new Error('desiredPublicationState is required');
    }
    // Which service, which version and which protocol are **properties of the
    // binding**, and it states all three in its own document:
    // `srvb:services srvb:name`, `srvb:content srvb:version` and
    // `srvb:binding srvb:type`. Requiring them from the caller asked them to
    // repeat what the object already says, and let them pass a version that
    // disagrees with it. They stay accepted as an override.
    const desiredPublicationState = config.desiredPublicationState;

    return answering(
      () =>
        this.updateRequest({
          bindingName: name,
          desiredPublicationState,
          serviceType: config.serviceType,
          serviceName: config.serviceName,
          serviceVersion: config.serviceVersion,
        }),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      // A publication change IS this member's write: `update` on a binding
      // changes nothing else. The job reports `SEVERITY` and `SHORT_TEXT` in
      // its answer, and reading them here is what makes a refused publish a
      // refusal rather than a document nobody looked at.
      options?.analyse ?? publicationRefusal,
    );
  }

  /**
   * Take the binding's lock.
   *
   * **Publishing is what editing a service binding is** — it is not edited any
   * other way — so this is the lock a publication takes. Measured from Eclipse
   * (ADT 3.60.3) on the trial, 2026-09-05: `_action=LOCK&accessMode=MODIFY` on a
   * stateful session before the job, and `_action=UNLOCK&lockHandle=…` when the
   * editor closes.
   *
   * **The caller takes it, and the caller gives it back.** This member does not
   * lock inside `update` on the caller's behalf: how long a lock is held is a
   * policy — Eclipse holds one for as long as an editor is open, a script holds
   * one for a single call — and the connection is usually shared, so a library
   * that locks and unlocks around its own operation decides that for everyone.
   * See `docs/usage/CLIENT_API_REFERENCE.md` for the shape a consumer writes.
   */
  async lock(
    config: Partial<IServiceBindingConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);
    // Stateful for the window: on older BASIS a handle is only valid inside a
    // stateful request. The caller returns to stateless via `unlock`.
    this.connection.setSessionType?.('stateful');
    return answering(
      async () => ({
        data: await lockServiceBinding(this.connection, name),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      rawDocument,
    );
  }

  /**
   * Give the lock back.
   *
   * Without it the binding stays "currently being edited": its own delete is
   * refused with `You are already editing`, and a `_action=LOCK` from anywhere
   * else — another session, another process, the same user — is answered
   * `403 ExceptionResourceNoAccess`.
   */
  async unlock(
    config: Partial<IServiceBindingConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);
    return answering(async () => {
      try {
        return await unlockServiceBinding(this.connection, name, lockHandle);
      } finally {
        this.connection.setSessionType?.('stateless');
      }
    }, nothing);
  }

  /**
   * Delete the binding.
   *
   * A published binding is withdrawn first, because ADT refuses to delete one
   * that is still published; that pre-step is best-effort, since a binding that
   * cannot be read is one the delete will refuse for its own reasons.
   *
   * The deletion check is read, not merely performed. Until 12.0.0 this handler
   * alone deleted without asking, and a delete the server never approved is one
   * a caller has no reason to believe happened.
   */
  async delete(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      await this.unpublishBeforeDelete(config, name);

      await step(
        answering(
          () => this.deletionCheckRequest(name),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );

      return step(
        answering(
          () =>
            this.deleteRequest({
              bindingName: name,
              transportRequest: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
    });
  }

  /**
   * Withdraw a published binding so the delete is not refused.
   *
   * Best-effort by design: if the read or the withdrawal fails, the delete is
   * attempted anyway and answers for itself.
   */
  private async unpublishBeforeDelete(
    config: Partial<IServiceBindingConfig>,
    name: string,
  ): Promise<void> {
    try {
      const active = await this.readRequest({
        bindingName: name,
        version: 'active',
      });
      const current = this.parseServiceBindingState(active);
      if (!current.published || current.allowedAction !== 'UNPUBLISH') return;

      const serviceType = config.serviceType ?? current.serviceType;
      const serviceName = config.serviceName ?? current.serviceName;
      const serviceVersion = config.serviceVersion ?? current.serviceVersion;
      if (!serviceType || !serviceName) return;

      this.logger?.info?.(`ServiceBinding delete pre-step: unpublish ${name}`, {
        serviceType,
        serviceName,
        serviceVersion,
      });
      await this.updateRequest({
        bindingName: name,
        desiredPublicationState: 'unpublished',
        serviceType,
        serviceName,
        serviceVersion,
      });
    } catch (error: unknown) {
      this.logger?.warn?.(
        'unpublish before delete did not complete; deleting anyway',
        { error: String(error) },
      );
    }
  }

  /**
   * Activate the binding.
   *
   * Judged by the messages, never by the status: ADT answers 200 with a
   * `<msg type="E">` when it refuses.
   */
  async activate(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const name = this.name(config);

    return answering(
      () =>
        this.activateRequest({ bindingName: name, preauditRequested: true }),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /** Check the binding. */
  async check(
    config: Partial<IServiceBindingConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    const name = this.name(config);
    const version = status === 'active' ? 'active' : 'inactive';

    return answering(
      () => this.checkRequest({ bindingName: name, version }),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /**
   * The transport check for the binding.
   *
   * A binding has no `objectstates` resource: what stands in for it is the CTS
   * transport check, which is why this needs the package as well as the name.
   */
  async readTransport(
    config: Partial<IServiceBindingConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('packageName is required for transport check');
    }
    const packageName = config.packageName;

    return answering(
      () =>
        this.transportCheckRequest({
          objectName: name,
          packageName,
          description: config.description,
          operation: 'U',
        }),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /** The binding types this system offers. */
  async getServiceBindingTypes(): Promise<
    IAdtResponse<ReturnType<R['bindingTypes']>>
  > {
    return answering(
      () => this.bindingTypesRequest(),
      this.results.bindingTypes as IResultStrategy<
        ReturnType<R['bindingTypes']>
      >,
    );
  }

  private async bindingTypesRequest(): Promise<IAdtWireResponse> {
    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/bindings/bindingtypes',
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/vnd.sap.adt.nameditems.v1+xml, application/xml',
      },
    });
  }

  /** ADT's generic deletion check, over this binding's URI. */
  private async deletionCheckRequest(name: string): Promise<IAdtWireResponse> {
    const encoded = encodeSapObjectName(name).toLowerCase();
    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/deletion/check',
      method: 'POST',
      timeout: getTimeout('default'),
      data: `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="/sap/bc/adt/businessservices/bindings/${encoded}"/>
</del:checkRequest>`,
      headers: {
        Accept: ACCEPT_DELETION_CHECK,
        'Content-Type': CT_DELETION_CHECK,
      },
    });
  }

  private async validateRequest(
    params: IValidateServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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

  private async transportCheckRequest(
    params: ITransportCheckServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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
        Accept: ACCEPT_TRANSPORT_CHECK,
        'Content-Type': CT_TRANSPORT_CHECK,
      },
    });
  }

  private async createRequest(
    params: ICreateServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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
    if (!params.bindingVariant) {
      throw new Error('bindingVariant is required');
    }

    const systemInfo = await getSystemInformation(this.connection);
    const createParams: ICreateServiceBindingParams = {
      ...params,
      masterLanguage:
        params.masterLanguage ??
        this.systemContext.masterLanguage ??
        systemInfo?.language ??
        'EN',
      masterSystem:
        params.masterSystem ??
        this.systemContext.masterSystem ??
        systemInfo?.systemID,
      responsible:
        params.responsible ??
        this.systemContext.responsible ??
        systemInfo?.userName,
    };

    const queryParams = params.transportRequest
      ? { corrNr: params.transportRequest }
      : undefined;

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
      params: queryParams,
    });
  }

  private async readRequest(
    params: IReadServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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

  private async updateRequest(
    params: IServiceBindingPublicationParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!params.desiredPublicationState) {
      throw new Error('desiredPublicationState is required');
    }
    const readResponse = await this.readRequest({
      bindingName: params.bindingName,
      version: 'active',
    });
    const current = this.parseServiceBindingState(readResponse);
    // The binding's own answer fills in what the caller did not say. This read
    // already happens for the state check, so knowing which service is being
    // published costs the server nothing extra.
    const serviceType = params.serviceType ?? current.serviceType;
    const serviceName = params.serviceName ?? current.serviceName;
    const serviceVersion = params.serviceVersion ?? current.serviceVersion;
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
      if (!(serviceType && serviceName)) {
        throw new Error(
          `Cannot publish ${params.bindingName}: neither the caller nor the ` +
            'binding names a service type and a service name.',
        );
      }
      return this.publishByServiceType(
        serviceType,
        params.bindingName,
        serviceName,
        serviceVersion,
      );
    }

    if (current.allowedAction !== 'UNPUBLISH') {
      throw new Error(
        `Invalid state transition: cannot unpublish service binding ${params.bindingName}. allowedAction=${current.allowedAction ?? 'UNKNOWN'}`,
      );
    }
    if (!(serviceType && serviceName)) {
      throw new Error(
        `Cannot unpublish ${params.bindingName}: neither the caller nor the ` +
          'binding names a service type and a service name.',
      );
    }
    return this.unpublishByServiceType(
      serviceType,
      params.bindingName,
      serviceName,
      serviceVersion,
    );
  }

  private async deleteRequest(
    params: IDeleteServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    return this.connection.makeAdtRequest({
      url: '/sap/bc/adt/deletion/delete',
      method: 'POST',
      timeout: getTimeout('default'),
      data: this.buildDeletionXml(params),
      headers: {
        Accept: ACCEPT_DELETION,
        'Content-Type': CT_DELETION,
      },
    });
  }

  private async checkRequest(
    params: ICheckServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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
        Accept: ACCEPT_CHECK_MESSAGES,
        'Content-Type': CT_CHECK_OBJECTS,
      },
    });
  }

  private async activateRequest(
    params: IActivateServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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

  /** Generate the service the binding exposes. */
  async generateServiceBinding(
    params: IGenerateServiceBindingParams,
  ): Promise<IAdtResponse<ReturnType<R['generation']>>> {
    return answering(
      () => this.generateRequest(params),
      this.results.generation as IResultStrategy<ReturnType<R['generation']>>,
    );
  }

  private async generateRequest(
    params: IGenerateServiceBindingParams,
  ): Promise<IAdtWireResponse> {
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

    const genQs = buildQueryString({
      servicename: params.serviceName.toUpperCase(),
      serviceversion: params.serviceVersion,
      srvdname: params.serviceDefinitionName.toUpperCase(),
    });
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${path}/${encodeURIComponent(params.bindingName.toUpperCase())}?${genQs}`,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: accept,
      },
    });
  }

  /**
   * Create the binding and generate its service.
   *
   * One value, not six envelopes. Until 30.0.0 this handed back the answer of
   * every request it made along the way; what an implementation does on the way
   * to an answer is its own business, and reaches a caller only if it fails.
   */
  async createAndGenerateServiceBinding(
    params: ICreateAndGenerateServiceBindingParams,
  ): Promise<IAdtResponse<ReturnType<R['generation']>>> {
    const { serviceType } = resolveBindingVariant(params.bindingVariant);

    return chain(this.logger, async ({ step }) => {
      await step(
        this.create(
          {
            bindingName: params.bindingName,
            packageName: params.packageName,
            description: params.description,
            serviceDefinitionName: params.serviceDefinitionName,
            serviceName: params.serviceName,
            serviceVersion: params.serviceVersion,
            bindingVariant: params.bindingVariant,
            masterLanguage: params.masterLanguage,
            masterSystem: params.masterSystem,
            responsible: params.responsible,
            runTransportCheck: params.runTransportCheck,
          },
          { activateOnCreate: true },
        ),
      );

      return step(
        this.generateServiceBinding({
          serviceType,
          bindingName: params.bindingName,
          serviceName: params.serviceName,
          serviceVersion: params.serviceVersion,
          serviceDefinitionName: params.serviceDefinitionName,
        }),
      );
    });
  }

  /**
   * The OData service group this binding publishes.
   *
   * `GET …/{serviceType}/{binding}?servicename=…&serviceversion=…&srvdname=…`,
   * measured from Eclipse. It is a **read of another object** — the service
   * group, with its URL prefix, its collections and its deployment state —
   * which happens to carry `published`, which is why Eclipse reads it after a
   * publish job. It is not a job-status endpoint.
   *
   * One member, not `getODataV2ServiceBinding` and `getODataV4ServiceBinding`:
   * the protocol is a parameter. Accept carries v1 as well as v2, as Eclipse
   * sends it — a system that only serves v1 answered 406 to the v2-only header
   * this used to send.
   */
  async getServiceGroup(
    params: IServiceGroupParams,
  ): Promise<IAdtResponse<ReturnType<R['odata']>>> {
    return answering(
      () => this.serviceGroupRequest(params),
      this.results.odata as IResultStrategy<ReturnType<R['odata']>>,
    );
  }

  private async serviceGroupRequest(
    params: IServiceGroupParams,
  ): Promise<IAdtWireResponse> {
    if (!params.objectname) {
      throw new Error('objectname is required');
    }
    if (!params.serviceType) {
      throw new Error('serviceType is required');
    }

    const query = buildQueryString({
      servicename: params.servicename,
      serviceversion: params.serviceversion,
      srvdname: params.srvdname,
    });
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${params.serviceType}/${encodeURIComponent(params.objectname)}?${query}`,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept:
          `application/vnd.sap.adt.businessservices.${params.serviceType}.v1+xml, ` +
          `application/vnd.sap.adt.businessservices.${params.serviceType}.v2+xml`,
      },
    });
  }

  async classifyServiceBinding(
    params: IClassifyServiceBindingParams,
  ): Promise<IAdtResponse<ReturnType<R['classification']>>> {
    return answering(
      () => this.classifyRequest(params),
      this.results.classification as IResultStrategy<
        ReturnType<R['classification']>
      >,
    );
  }

  private async classifyRequest(
    params: IClassifyServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.objectname) {
      throw new Error('objectname is required');
    }

    const classifyQs = buildQueryString({
      objectname: params.objectname,
      bindtype: params.bindtype,
      bindtypeversion: params.bindtypeversion,
      repositoryid: params.repositoryid,
      servicename: params.servicename,
    });
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/release?${classifyQs}`,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/xml, application/json, text/plain',
      },
    });
  }
}

// Backward compatibility for existing imports.
export class AdtService extends AdtServiceBinding {}
