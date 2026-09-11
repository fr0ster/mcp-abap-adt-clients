import type {
  AdtNoFailure,
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtWireResponse,
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_CHECK_MESSAGES,
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  ACCEPT_PUBLICATION_JOB,
  ACCEPT_TRANSPORT_CHECK,
  CT_CHECK_OBJECTS,
  CT_DELETION,
  CT_DELETION_CHECK,
  CT_TRANSPORT_CHECK,
} from '../../constants/contentTypes';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import {
  buildQueryString,
  encodeSapObjectName,
} from '../../utils/internalUtils';
import { requestOf } from '../../utils/requestTrace';
import { nothing, rawDocument } from '../../utils/resultStrategy';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { lockServiceBinding, unlockServiceBinding } from './lock';
import type {
  IActivateServiceBindingParams,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateServiceBindingParams,
  IDeleteServiceBindingParams,
  IGenerateServiceBindingParams,
  IReadServiceBindingParams,
  IServiceBindingConfig,
  IServiceBindingPublicationConfig,
  IServiceBindingPublicationParams,
  IServiceGroupParams,
  IServiceResults,
  ITransportCheckServiceBindingParams,
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
 * the shape this release removes everywhere else. Measured
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
    IAdtReadable<IServiceBindingConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IServiceBindingConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<IServiceBindingPublicationConfig, ReturnType<R['updated']>>,
    IAdtDeletable<
      IServiceBindingConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IServiceBindingConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IServiceBindingConfig, ReturnType<R['check']>>,
    IAdtActivatable<IServiceBindingConfig, ReturnType<R['activation']>>,
    IAdtTransportAware<IServiceBindingConfig, ReturnType<R['transport']>>,
    IAdtLockable<IServiceBindingConfig>
{
  // The list above is the whole of it. `IAdtServiceBinding` used to sit in the
  // contracts package declaring `publishODataV2` and `unpublishODataV2` — two
  // method names for one endpoint with a `serviceType` parameter — and this
  // class deliberately did not implement it while the shape was settled against
  // measured traffic. It is gone as of interfaces 33.0.0, and nothing replaced
  // it: a binding is the atoms, composed, like every other object. Publishing is
  // an `update`, because `desiredPublicationState` is a field of the config.

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

  /** The binding name, or the caller's mistake. */
  private name(config: Partial<IServiceBindingConfig>): string {
    if (!config.bindingName) {
      throw new Error('bindingName is required');
    }
    return config.bindingName;
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

  private async publishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    bindingName: string,
    // **The caller's, when they give one.** A publication job is the slowest
    // thing this library asks for — measured at ~135s on a trial, and an
    // unpublish once not settled after eleven minutes — so the 120s
    // `SAP_TIMEOUT_LONG` default is a floor, not a ceiling. The contract has
    // carried `IAdtOperationOptions.timeout` all along; this member used to
    // drop it, which left a caller no way to wait longer than the library had
    // decided to.
    timeout?: number,
  ): Promise<IAdtWireResponse> {
    // **The document Eclipse sends**, captured on one system: the target is
    // named by *type* — `SCGR`, a service group — and by name, with no
    // `adtcore:uri`. This library used to send the binding's URI instead, and
    // the server accepted it; "the server accepted it" and "this is what the
    // request is" are different claims, and only one of them was measured.
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:type="SCGR" adtcore:name="${bindingName.toUpperCase()}"/>
</adtcore:objectReferences>`;

    // **No query string.** `servicename` and `serviceversion` used to be
    // appended here; Eclipse sends neither, and the job answers `SEVERITY OK`
    // without them. They stay on the params because they still override what
    // the binding's own document says when this member reads it.
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/publishjobs`,
      method: 'POST',
      // Measured at ~133s in both directions, so the 120s `SAP_TIMEOUT_LONG`
      // default could never have been enough. A caller who knows their system
      // passes their own.
      timeout: timeout ?? getTimeout('long'),
      data: xml,
      headers: {
        Accept: ACCEPT_PUBLICATION_JOB,
        'Content-Type': 'application/xml',
      },
      // `sap-cancel-on-close: true` is what Eclipse adds and this does not, on
      // purpose. It tells the server to abandon the job when the connection
      // goes, and this library's caller is far likelier to give up before 133
      // seconds than an editor is — measured here: the client timed out at 120s
      // and the binding was published anyway, which is the outcome to keep.
    });
  }

  private async unpublishByServiceType(
    serviceType: 'odatav2' | 'odatav4',
    bindingName: string,
    // **The caller's, when they give one.** A publication job is the slowest
    // thing this library asks for — measured at ~135s on a trial, and an
    // unpublish once not settled after eleven minutes — so the 120s
    // `SAP_TIMEOUT_LONG` default is a floor, not a ceiling. The contract has
    // carried `IAdtOperationOptions.timeout` all along; this member used to
    // drop it, which left a caller no way to wait longer than the library had
    // decided to.
    timeout?: number,
  ): Promise<IAdtWireResponse> {
    // **The document Eclipse sends**, captured on one system: the target is
    // named by *type* — `SCGR`, a service group — and by name, with no
    // `adtcore:uri`. This library used to send the binding's URI instead, and
    // the server accepted it; "the server accepted it" and "this is what the
    // request is" are different claims, and only one of them was measured.
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:type="SCGR" adtcore:name="${bindingName.toUpperCase()}"/>
</adtcore:objectReferences>`;

    // **No query string.** `servicename` and `serviceversion` used to be appended
    // here; Eclipse sends neither, and the job answers `SEVERITY OK` without
    // them. They stay on the params because they still override what the
    // binding's own document says when this member reads it.
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${serviceType}/unpublishjobs`,
      method: 'POST',
      // Measured at ~133s in both directions, so the 120s `SAP_TIMEOUT_LONG`
      // default could never have been enough. A caller who knows their system
      // passes their own.
      timeout: timeout ?? getTimeout('long'),
      data: xml,
      headers: {
        Accept: ACCEPT_PUBLICATION_JOB,
        'Content-Type': 'application/xml',
      },
      // `sap-cancel-on-close: true` is what Eclipse adds and this does not, on
      // purpose. It tells the server to abandon the job when the connection
      // goes, and this library's caller is far likelier to give up before 133
      // seconds than an editor is — measured here: the client timed out at 120s
      // and the binding was published anyway, which is the outcome to keep.
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
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

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
    return answering(
      () =>
        this.transportCheckRequest(connection, {
          objectName: name,
          packageName,
          description: config.description,
          operation: 'I',
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /**
   * Create the binding, and activate and generate its service.
   *
   * The answer is the create's own. What the chain does after it — the check,
   * the activation, the generation — is this implementation's business and
   * reaches a caller only if it fails.
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IServiceBindingConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.packageName) throw new Error('packageName is required');
    if (!config.description) throw new Error('description is required');
    if (!config.serviceDefinitionName) {
      throw new Error('serviceDefinitionName is required');
    }
    if (!config.serviceName) throw new Error('serviceName is required');
    if (!config.serviceVersion) throw new Error('serviceVersion is required');
    if (!config.bindingVariant) throw new Error('bindingVariant is required');
    const packageName = config.packageName;
    const description = config.description;
    const serviceName = config.serviceName;
    const serviceVersion = config.serviceVersion;
    const serviceDefinitionName = config.serviceDefinitionName;
    const bindingVariant = config.bindingVariant;
    return answering(
      () =>
        this.createRequest(connection, {
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
    );
  }

  /** Read the binding document. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: whether an empty or missing answer *is* absence is
    // the caller's reading, supplied through `analyse`.
    return answering(
      () => this.readRequest(connection, { bindingName: name, version }),
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        this.readRequest(connection, {
          bindingName: name,
          version: options?.version,
        }),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Change the binding's publication state — one POST to a job endpoint.
   *
   * That is the only thing an update does to a binding: publish it or withdraw
   * it. `unchanged` is refused, because there is no request that changes
   * nothing; a caller who wants no change does not call this.
   *
   * `config.serviceType` is **required** — it selects `odatav2` or `odatav4` —
   * and `config.serviceName` / `config.serviceVersion` are not read here at
   * all: the job carries neither. The job takes ~133 seconds on the systems
   * measured, so pass `options.timeout` unless the 120s default is enough,
   * which it is not.
   */
  async update<E extends IAdtError = IAdtError>(
    // **Narrower than `IAdtUpdatable` gives every other type, on purpose.**
    // A binding's update is its publication, and two of its fields are not
    // optional in practice: without `serviceType` there is no endpoint, and
    // `'unchanged'` is not a request. `Partial<IServiceBindingConfig>` admitted
    // both and this member threw before the wire — a demand made where the
    // caller could not see it. The parameter is contravariant, so the class
    // still satisfies `IAdtUpdatable`.
    config: IServiceBindingPublicationConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.desiredPublicationState) {
      throw new Error('desiredPublicationState is required');
    }
    // `serviceType` selects the endpoint and comes from the caller. It used to
    // be derived from the binding's own document, along with the service name
    // and version — by a read that made this member two requests. The read is
    // gone; so are the two fields, which the job no longer carries anywhere.
    //
    // Checked here, where the config makes it optional, so the params type
    // below can require it: the demand belongs in one place, and a type is the
    // place a caller sees it.
    const serviceType = config.serviceType;
    if (!serviceType) {
      throw new Error(
        `serviceType is required to publish or unpublish ${name}: it selects ` +
          "the endpoint, 'odatav2' or 'odatav4'.",
      );
    }
    const desiredPublicationState = config.desiredPublicationState;

    return answering(
      () =>
        this.updateRequest(connection, {
          bindingName: name,
          desiredPublicationState,
          serviceType,
          // The contract has always offered this; it used to stop here.
          timeout: options?.timeout,
        }),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      // A publication change IS this member's write: `update` on a binding
      // changes nothing else. The job reports `SEVERITY` and `SHORT_TEXT` in
      // its answer, and reading them here is what makes a refused publish a
      // refusal rather than a document nobody looked at.
      (options?.analyse ?? publicationRefusal) as IAnalyse<E>,
    );
  }

  /**
   * Take the binding's lock.
   *
   * **Publishing is what editing a service binding is** — it is not edited any
   * other way — so this is the lock a publication takes. Measured from Eclipse
   * (ADT 3.60.3) , 2026-09-05: `_action=LOCK&accessMode=MODIFY` on a
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
    // Stateful for the LOCK request alone: on older BASIS a handle is only
    // issued inside a stateful request. The switch used to sit outside
    // `answering`, so a refused LOCK returned through the failure path with the
    // connection still stateful — and this connection is shared.
    return answering(async () => {
      const data = await inStatefulSession(this.connection, () =>
        lockServiceBinding(this.connection, name),
      );
      return { data, status: 200, statusText: 'OK', headers: {} };
    }, rawDocument);
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
  /**
   * Asks ADT whether the binding can be deleted.
   *
   * Its own member because it is its own endpoint. `delete` no longer runs it,
   * and no longer unpublishes first either: a published binding is unpublished
   * with `update({ desiredPublicationState: 'unpublished' })`, which is a call
   * the consumer makes and can see the answer to.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => this.deletionCheckRequest(connection, name),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        this.deleteRequest(connection, {
          bindingName: name,
          transportRequest: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /**
   * Activate the binding.
   *
   * Judged by the messages, never by the status: ADT answers 200 with a
   * `<msg type="E">` when it refuses.
   */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        this.activateRequest(connection, {
          bindingName: name,
          preauditRequested: true,
        }),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the binding. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version = status === 'active' ? 'active' : 'inactive';

    return answering(
      () => this.checkRequest(connection, { bindingName: name, version }),
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
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IServiceBindingConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('packageName is required for transport check');
    }
    const packageName = config.packageName;

    return answering(
      () =>
        this.transportCheckRequest(connection, {
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
      () => this.bindingTypesRequest(this.connection),
      this.results.bindingTypes as IResultStrategy<
        ReturnType<R['bindingTypes']>
      >,
    );
  }

  private async bindingTypesRequest(
    connection: IAbapConnection,
  ): Promise<IAdtWireResponse> {
    return connection.makeAdtRequest({
      url: '/sap/bc/adt/businessservices/bindings/bindingtypes',
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/vnd.sap.adt.nameditems.v1+xml, application/xml',
      },
    });
  }

  /** ADT's generic deletion check, over this binding's URI. */
  private async deletionCheckRequest(
    connection: IAbapConnection,
    name: string,
  ): Promise<IAdtWireResponse> {
    const encoded = encodeSapObjectName(name).toLowerCase();
    return connection.makeAdtRequest({
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

  private async transportCheckRequest(
    connection: IAbapConnection,
    params: ITransportCheckServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.objectName) {
      throw new Error('objectName is required');
    }
    if (!params.packageName) {
      throw new Error('packageName is required');
    }

    return connection.makeAdtRequest({
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
    connection: IAbapConnection,
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

    // The language, the master system and the author come from what the caller
    // gave, or from the system context they set on this client. They used to
    // fall back to `/core/http/systeminformation`, which made a create two
    // requests — and that read answered `null` on its own failure, so the
    // fallback could silently be no value at all.
    const createParams: ICreateServiceBindingParams = {
      ...params,
      masterLanguage:
        params.masterLanguage ?? this.systemContext.masterLanguage ?? 'EN',
      masterSystem: params.masterSystem ?? this.systemContext.masterSystem,
      responsible: params.responsible ?? this.systemContext.responsible,
    };

    const queryParams = params.transportRequest
      ? { corrNr: params.transportRequest }
      : undefined;

    return connection.makeAdtRequest({
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
    connection: IAbapConnection,
    params: IReadServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    return connection.makeAdtRequest({
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

  /**
   * The publication job, and nothing before it.
   *
   * **This used to read the binding first.** The read filled in the service
   * name and version from the object's own document, short-circuited when the
   * state was already the one asked for, and refused a transition ADT would
   * have refused itself — four useful things, and one member issuing two
   * requests, which is the rule this release is about.
   *
   * Three of the four went with the query string: the job is posted without
   * `servicename` or `serviceversion`, so there is nothing left to derive.
   * The fourth — "can it go from here to there?" — is the server's to answer,
   * and it does: an invalid transition comes back as `SEVERITY` in the job's
   * own document, read by `publicationRefusal`. A caller who wants to know
   * beforehand calls `read` and looks at `srvb:allowedAction`, which is one
   * request they can see.
   */
  private async updateRequest(
    connection: IAbapConnection,
    params: IServiceBindingPublicationParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }
    if (!params.desiredPublicationState) {
      throw new Error('desiredPublicationState is required');
    }
    if (params.desiredPublicationState === 'unchanged') {
      // A caller error rather than a request: `update` on a binding *is* the
      // publication change, so asking it for no change is asking for nothing.
      // `unchanged` stays a legitimate value on a binding's *config*, where it
      // says a create should not publish.
      throw new Error(
        `Cannot update ${params.bindingName} to 'unchanged': a service ` +
          "binding's update is its publication, and there is no request that " +
          'changes nothing. Omit the call instead.',
      );
    }
    // Not derived from the object any more — the read that derived it was the
    // second request. `ODATA_V4_*` and `ODATA_V2_*` binding variants map to the
    // two service types, so a caller that knows its binding knows this, and the
    // params type requires it rather than this function checking again.
    const serviceType = params.serviceType;

    this.logger?.info?.(
      `ServiceBinding ${params.desiredPublicationState}: ${params.bindingName}`,
      { serviceType, timeout: params.timeout },
    );

    return params.desiredPublicationState === 'published'
      ? this.publishByServiceType(
          serviceType,
          params.bindingName,
          params.timeout,
        )
      : this.unpublishByServiceType(
          serviceType,
          params.bindingName,
          params.timeout,
        );
  }

  private async deleteRequest(
    connection: IAbapConnection,
    params: IDeleteServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    return connection.makeAdtRequest({
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
    connection: IAbapConnection,
    params: ICheckServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    const version = params.version ?? 'inactive';
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(params.bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core"><chkrun:checkObject adtcore:uri="${bindingUri}" chkrun:version="${version}"/></chkrun:checkObjectList>`;

    return connection.makeAdtRequest({
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
    connection: IAbapConnection,
    params: IActivateServiceBindingParams,
  ): Promise<IAdtWireResponse> {
    if (!params.bindingName) {
      throw new Error('bindingName is required');
    }

    const preauditRequested =
      params.preauditRequested === undefined ? true : params.preauditRequested;
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${AdtServiceBinding.encodeName(params.bindingName)}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${params.bindingName.toUpperCase()}"/></adtcore:objectReferences>`;

    return connection.makeAdtRequest({
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
      () => this.generateRequest(this.connection, params),
      this.results.generation as IResultStrategy<ReturnType<R['generation']>>,
    );
  }

  private async generateRequest(
    connection: IAbapConnection,
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
    return connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/${path}/${encodeURIComponent(params.bindingName.toUpperCase())}?${genQs}`,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: accept,
      },
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
      () => this.serviceGroupRequest(this.connection, params),
      this.results.odata as IResultStrategy<ReturnType<R['odata']>>,
    );
  }

  private async serviceGroupRequest(
    connection: IAbapConnection,
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
    return connection.makeAdtRequest({
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
      () => this.classifyRequest(this.connection, params),
      this.results.classification as IResultStrategy<
        ReturnType<R['classification']>
      >,
    );
  }

  private async classifyRequest(
    connection: IAbapConnection,
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
    return connection.makeAdtRequest({
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
