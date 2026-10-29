/**
 * AdtLocalDefinitionsLegacy - the class's `definitions` include handler for legacy SAP
 * systems (SAP_BASIS 7.40, measured on 7.40 SP04)
 *
 * Overrides:
 * - readTransport() — refused without a request, as the container class's is.
 */

import {
  AdtLocalDefinitions,
  type AdtPerformedBy,
  CLASS,
  type classDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IClassConfig,
  IClassResults,
} from '@mcp-abap-adt/interfaces-adt';
import { noTransportResource } from '../shared/refusalLegacy';

export class AdtLocalDefinitionsLegacy<
  R extends IClassResults = typeof classDocuments,
> extends AdtLocalDefinitions<R, 'basis740'> {
  /**
   * Refused without a request: the inherited member asks for the container
   * class's `GET <class URI>/transport`, which answers `404` on 7.40 SP04
   * (record B4-cycles-20261026-2019, step c6-readTransport, the same request
   * `AdtClassLegacy.readTransport` refuses).
   */
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'localDefinitions', 'transport'>,
    config: Partial<IClassConfig>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    return noTransportResource<ReturnType<R['transport']>, E>(
      CLASS.uri(config.className as string),
    );
  }
}
