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
  override async create(): Promise<IAdtResponse<ReturnType<R['created']>>> {
    return failed(UNSUPPORTED);
  }

  override async read(): Promise<IAdtResponse<ReturnType<R['source']>>> {
    return failed(UNSUPPORTED);
  }

  override async readMetadata(): Promise<
    IAdtResponse<ReturnType<R['metadata']>>
  > {
    return failed(UNSUPPORTED);
  }

  override async validate(): Promise<
    IAdtResponse<ReturnType<R['validation']>>
  > {
    return failed(UNSUPPORTED);
  }

  override async update(): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    return failed(UNSUPPORTED);
  }

  override async delete(): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    return failed(UNSUPPORTED);
  }
}
