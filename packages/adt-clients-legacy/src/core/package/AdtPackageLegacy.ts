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
  type packageDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IPackageConfig,
  IPackageResults,
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
  R extends IPackageResults = typeof packageDocuments,
> extends AdtPackage<R> {
  override async create<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['created']>, E>
  > {
    return failed<ReturnType<R['created']>, E>(UNSUPPORTED as E);
  }

  override async readMetadata<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['metadata']>, E>
  > {
    return failed<ReturnType<R['metadata']>, E>(UNSUPPORTED as E);
  }

  override async validate<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['validation']>, E>
  > {
    return failed<ReturnType<R['validation']>, E>(UNSUPPORTED as E);
  }

  override async updateMetadata<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['metadataUpdated']>, E>
  > {
    return failed<ReturnType<R['metadataUpdated']>, E>(UNSUPPORTED as E);
  }

  override async delete<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['deletion']>, E>
  > {
    return failed<ReturnType<R['deletion']>, E>(UNSUPPORTED as E);
  }

  /**
   * Refused without a request, on its own grounds: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5) — and the
   * package `delete` refuses as well (§8).
   */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IPackageConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheckNorDelete<ReturnType<R['deletionCheck']>, E>();
  }

  /**
   * `lock`, `unlock`, `readTransport` and `check` address `PACKAGE.uri(name)`
   * (or name it, for the check run), the item resource 7.40 SP04 answered
   * `404` to. Refused without a request; not measured themselves (spec §8).
   */
  override async lock<E extends IAdtError = IAdtError>(
    _config: Partial<IPackageConfig>,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    return legacyRefusal<string, E>('lock', ITEM_RESOURCE);
  }

  override async unlock<E extends IAdtError = IAdtError>(
    _config: Partial<IPackageConfig>,
    _lockHandle: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    return legacyRefusal<void, E>('unlock', ITEM_RESOURCE);
  }

  override async readTransport<E extends IAdtError = IAdtError>(
    _config: Partial<IPackageConfig>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    return legacyRefusal<ReturnType<R['transport']>, E>(
      'readTransport',
      `${ITEM_RESOURCE}/transport`,
    );
  }

  override async check<E extends IAdtError = IAdtError>(
    _config: Partial<IPackageConfig>,
    _status: string | undefined,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    return legacyRefusal<ReturnType<R['check']>, E>(
      'check',
      `${ITEM_RESOURCE} to check (the check run names it)`,
    );
  }
}
