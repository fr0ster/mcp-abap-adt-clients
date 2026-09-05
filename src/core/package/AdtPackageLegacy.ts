/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (BASIS < 7.50)
 *
 * All package operations are refused on legacy — the `/sap/bc/adt/packages`
 * endpoint exists in discovery but does not return usable results over RFC.
 */

import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { failed } from '../../utils/adtResponse';
import { AdtPackage } from './AdtPackage';
import type { IPackageResults } from './types';

const UNSUPPORTED: IAdtError = {
  origin: 'refusal',
  code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
  message:
    'Package operations are not supported on legacy SAP systems (BASIS < 7.50) via ADT. ' +
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
  R extends IPackageResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IPackageResults,
> extends AdtPackage<R> {
  override async create<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['created']>, E>
  > {
    return failed<ReturnType<R['created']>, E>(UNSUPPORTED as E);
  }

  override async read<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['source']>, E>
  > {
    return failed<ReturnType<R['source']>, E>(UNSUPPORTED as E);
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

  override async update<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['updated']>, E>
  > {
    return failed<ReturnType<R['updated']>, E>(UNSUPPORTED as E);
  }

  override async delete<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['deletion']>, E>
  > {
    return failed<ReturnType<R['deletion']>, E>(UNSUPPORTED as E);
  }
}
