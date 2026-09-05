import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import {
  type DesiredPublicationState,
  type GeneratedServiceType,
  SERVICE_BINDING_VARIANT_MAP,
  type ServiceBindingType,
  type ServiceBindingVariant,
  type ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  DesiredPublicationState,
  GeneratedServiceType,
  IActivateServiceBindingParams,
  IAdtServiceBinding,
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
  IServiceBindingResults,
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

/**
 * One strategy per member of a service binding implementation.
 *
 * A record rather than fourteen positional type parameters — the fourteenth
 * would be unnameable without spelling the thirteen before it, and a consumer
 * overriding one reading writes the key. `IServiceBindingResults` in the
 * contract names five of these; the rest belong to the capability atoms.
 */
export interface IServiceResults {
  /** What the create answers: the binding's own document. */
  readonly created: IResultStrategy<unknown>;
  /** What a read answers: the binding document, active or inactive. */
  readonly source: IResultStrategy<unknown>;
  /** The same document, read as metadata — a binding has no second resource. */
  readonly metadata: IResultStrategy<unknown>;
  /** What a check run answers: `chkl:messages`, whose `E` entries are the verdict. */
  readonly check: IResultStrategy<unknown>;
  /** What activation answers. */
  readonly activation: IResultStrategy<unknown>;
  /** What the pre-create transport check answers. */
  readonly validation: IResultStrategy<unknown>;
  /** What the deletion answers. */
  readonly deletion: IResultStrategy<unknown>;
  /** What a publication change answers. */
  readonly updated: IResultStrategy<unknown>;
  /** What the transport check answers. */
  readonly transport: IResultStrategy<unknown>;
  /** The binding types this system offers. */
  readonly bindingTypes: IResultStrategy<unknown>;
  /** What generating the service answers. */
  readonly generation: IResultStrategy<unknown>;
  /** What an OData v2 or v4 read of the binding answers. */
  readonly odata: IResultStrategy<unknown>;
  /** What publishing or withdrawing answers. */
  readonly publication: IResultStrategy<unknown>;
  /** What classifying the binding answers. */
  readonly classification: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const serviceDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
  bindingTypes: rawDocument,
  generation: rawDocument,
  odata: rawDocument,
  publication: rawDocument,
  classification: rawDocument,
} satisfies IServiceResults;

/**
 * What a publication change needs, as this package currently understands it.
 *
 * Declared **here** rather than in `@mcp-abap-adt/interfaces` on purpose: the
 * shape is still being settled against measured ADT traffic, and a contract
 * moves to the contracts package once it does what it needs to, not before.
 *
 * The difference from `IUpdateServiceBindingParams` there is that only the
 * binding is required. Which service, which version and which protocol are
 * **properties of the binding** — it states all three in its own document
 * (`srvb:services srvb:name`, `srvb:content srvb:version`, `srvb:binding
 * srvb:type`) — so requiring them from the caller asked them to repeat what the
 * object already says, and let them pass a version that disagrees with it.
 * They remain accepted as an override.
 *
 * There is no `publishODataV2` and no `publishODataV4`: the protocol is a
 * **parameter**, not a method name. Two members that differ only by a value
 * they could have taken as an argument are two names for one endpoint.
 */
export interface IServiceBindingPublicationParams {
  bindingName: string;
  desiredPublicationState: DesiredPublicationState;
  /** Overrides the binding's own `srvb:binding srvb:type`/`srvb:version`. */
  serviceType?: GeneratedServiceType;
  /** Overrides the binding's own `srvb:services srvb:name`. */
  serviceName?: string;
  /** Overrides the binding's own `srvb:content srvb:version`. */
  serviceVersion?: string;
}
