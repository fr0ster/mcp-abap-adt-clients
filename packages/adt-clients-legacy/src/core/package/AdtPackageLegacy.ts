/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04)
 *
 * Every package operation is refused on legacy. The `/sap/bc/adt/packages`
 * collection is advertised, but 7.40 SP04 does not serve the item resource over
 * RFC: `GET /sap/bc/adt/packages/{name}` answered `404`, and
 * `POST /sap/bc/adt/packages` answered `405`. `lock`, `unlock`, `readTransport`
 * and `check` address that same item resource, so they refuse without a
 * request. A package's contents come through `repository/nodestructure`
 * (`DEVC/K`), another endpoint family that `getPackage()` does not offer.
 */

import {
  AdtPackage,
  failed,
  PACKAGE,
  type PackageValues,
  type packageDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  AdtRequiredUpdateOptions,
  IAdtAnalyseOptions,
  IAdtCreateOptions,
  IAdtError,
  IAdtHeaders,
  IAdtLockedWrite,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtUpdateOptions,
  IAnalyse,
  IPackageConfig,
  IReadOptions,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import {
  legacyRefusal,
  noDeletionCheckNorDelete,
} from '../shared/refusalLegacy';

/** The resource 7.40 SP04 answered 404 to, shown without a name. */
const ITEM_RESOURCE = `${PACKAGE.collection}/{name}`;

const UNSUPPORTED: IAdtError = {
  origin: 'refusal',
  code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
  message:
    'Package operations are not supported on a legacy system (7.40 SP04): ' +
    'the package item resource answers 404 and the collection answers 405 to a create. ' +
    'Use SAP GUI (SE80 or SE21) to manage packages.',
};

/**
 * Every member answers the refusal rather than throwing it.
 *
 * A caller asking a legacy system for a package is the normal case here — a
 * consumer that supports both kinds of system will do it — and a normal case
 * belongs in the return type. The code says which kind of refusal it is, so a
 * consumer branches on `UNSUPPORTED_OPERATION` rather than matching a message.
 */
export class AdtPackageLegacy<
  T extends PackageValues = ResultValuesOf<typeof packageDocuments>,
> extends AdtPackage<T> {
  override create<E extends IAdtError>(
    config: Omit<IPackageConfig, 'source'> & { source?: never },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  override create(
    config: Omit<IPackageConfig, 'source'> & { source?: never },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  override async create<E extends IAdtError = IAdtError>(
    _config: Omit<IPackageConfig, 'source'> & { source?: never },
    _options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
    return failed<T['created']>(UNSUPPORTED);
  }

  override readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  override readMetadata(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  override async readMetadata<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    return failed<T['metadata']>(UNSUPPORTED);
  }

  override validate<E extends IAdtError>(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  override validate(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  override async validate<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    return failed<T['validation']>(UNSUPPORTED);
  }

  override updateMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  override updateMetadata(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  override async updateMetadata<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    return failed<T['metadataUpdated']>(UNSUPPORTED);
  }

  override delete<E extends IAdtError>(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  override delete(
    config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  override async delete<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    return failed<T['deletion']>(UNSUPPORTED);
  }

  /**
   * Refused without a request, on its own grounds: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5) — and the
   * package `delete` refuses as well (§8).
   */
  override checkDeletion<E extends IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  override checkDeletion(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    return noDeletionCheckNorDelete<T['deletionCheck']>();
  }

  /**
   * `lock`, `unlock`, `readTransport` and `check` address `PACKAGE.uri(name)`
   * (or name it, for the check run), the item resource 7.40 SP04 answered
   * `404` to. Refused without a request; not measured themselves (spec §8).
   */
  override lock<E extends IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  override lock(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  override async lock<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    return legacyRefusal<string>('lock', ITEM_RESOURCE);
  }

  override unlock<E extends IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _lockHandle: string,
    _options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  override unlock(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _lockHandle: string,
    _options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  override async unlock<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _lockHandle: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    return legacyRefusal<void>('unlock', ITEM_RESOURCE);
  }

  override readTransport<E extends IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  override readTransport(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  override async readTransport<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    return legacyRefusal<T['transport']>(
      'readTransport',
      `${ITEM_RESOURCE}/transport`,
    );
  }

  override check<E extends IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _status: string | undefined,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  override check(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _status: string | undefined,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  override async check<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<IPackageConfig, 'packageName'>,
    _status: string | undefined,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    return legacyRefusal<T['check']>(
      'check',
      `${ITEM_RESOURCE} to check (the check run names it)`,
    );
  }
}
